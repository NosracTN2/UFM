// Before each generation: inject the compact state block, standing orders and System events,
// fix up the {{ufm_state}} macro output to match the exact point in the chat, and trim old tags.

import type { InterceptorContextDTO, InterceptorResultDTO, LlmMessageDTO } from "lumiverse-spindle-types";
import { replay } from "../engine/replay";
import { renderOrders, renderState, renderSystem, STATE_CLOSE, STATE_OPEN, TAG_REMINDER } from "../engine/render";
import type { Order, ReplayResult } from "../shared/types";
import { errText, log } from "./sp";
import { type ChatCache, getSettings, loadChat, savePlayer } from "./store";
import { recompute, resyncNow, seedOf } from "./sync";

const UFM_BLOCK_RE = /<ufm\b[^>]*>[\s\S]*?<\/ufm>/gi;
const SETUP_TAG_RE = /<ufm-setup\b[^>]*>[\s\S]*?<\/ufm-setup>/gi;
const STATE_RE = /\[UFM STATE\][\s\S]*?\[\/UFM STATE\]/g;

function text(m: LlmMessageDTO): string {
  if (typeof m.content === "string") return m.content;
  return m.content.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function mapText(m: LlmMessageDTO, fn: (s: string) => string): LlmMessageDTO {
  if (typeof m.content === "string") return { ...m, content: fn(m.content) };
  return { ...m, content: m.content.map((p) => (p.type === "text" ? { ...p, text: fn(p.text) } : p)) };
}

/** Extra prompt sections contributed by later phases (NPC news, cutaway permission...). */
type Extra = (c: ChatCache, r: ReplayResult, ctx: InterceptorContextDTO) => string[] | Promise<string[]>;
const extras: Extra[] = [];
export function addPromptExtra(fn: Extra): void {
  extras.push(fn);
}

/** Commands from the panel that belong to this generation. Issued orders only re-apply while the
 *  prompt ends on the user turn they were sent with (a regenerate or swipe), never on a later turn. */
export function freshOrders(c: ChatCache, lastUserId: string | null, endsOnUser: boolean): Order[] {
  const issued = lastUserId && endsOnUser ? (c.player.issued[lastUserId] ?? []) : [];
  return [...issued, ...c.player.pending];
}

/** Bind queued orders to the user message they were sent with. A line deleted from the composer cancels its order. */
async function bindPending(c: ChatCache, lastUserId: string, lastUserText: string): Promise<void> {
  if (!c.player.pending.length) return;
  const keep = c.player.pending.filter((o) => !o.inComposer || lastUserText.includes(o.line.trim()));
  c.player.issued[lastUserId] = [...(c.player.issued[lastUserId] ?? []), ...keep];
  c.player.pending = [];
  await savePlayer(c);
}

export async function intercept(messages: LlmMessageDTO[], context: InterceptorContextDTO): Promise<LlmMessageDTO[] | InterceptorResultDTO> {
  const chatId = context.chatId;
  if (!chatId) return messages;
  if (context.generationType === "quiet" || context.generationType === "impersonate") return messages;
  try {
    let c = await loadChat(chatId);
    const all = messages.map(text).join("\n");
    const promptHasUfm = all.includes("<ufm") || all.includes(STATE_OPEN);
    if (!c.player.enabled && !promptHasUfm) return messages;
    if (!c.player.enabled) {
      c.player.enabled = true;
      await savePlayer(c);
    }
    if (!c.result) c = await resyncNow(chatId, true);
    const settings = await getSettings();

    // State as of the last chat message actually in this prompt (a swipe excludes the reply it replaces).
    const hist = messages.filter((m) => m.__isChatHistory && m.sourceMessageId);
    const lastSrc = hist.length ? hist[hist.length - 1].sourceMessageId! : null;
    const lastUser = [...hist].reverse().find((m) => m.role === "user")?.sourceMessageId ?? null;
    let result = c.result!;
    const lastLogged = [...c.log.messages].sort((a, b) => a.index - b.index).at(-1)?.id;
    if (lastSrc && c.log.messages.some((m) => m.id === lastSrc) && lastSrc !== lastLogged) {
      result = replay(c.log, c.player, settings, { seed: seedOf(c), until: lastSrc });
    } else if (!lastSrc && context.excludeMessageId) {
      result = replay(c.log, c.player, settings, { seed: seedOf(c), before: context.excludeMessageId });
    }

    const stateText = renderState(result.state);
    let replaced = false;
    const assistantIdx = messages.map((m, i) => (m.role === "assistant" && m.__isChatHistory ? i : -1)).filter((i) => i >= 0);
    const keepFrom = assistantIdx.length > settings.historyTags ? assistantIdx[assistantIdx.length - settings.historyTags] : 0;
    let out = messages.map((m, i) => {
      let mm = m;
      if (text(mm).includes(STATE_OPEN)) {
        mm = mapText(mm, (s) => s.replace(STATE_RE, () => stateText));
        replaced = true;
      }
      if (mm.__isChatHistory) {
        mm = mapText(mm, (s) => s.replace(SETUP_TAG_RE, ""));
        if (mm.role === "assistant" && i < keepFrom) mm = mapText(mm, (s) => s.replace(UFM_BLOCK_RE, "").trimEnd());
      }
      return mm;
    });

    const lastHist = hist[hist.length - 1];
    const endsOnUser = !!lastHist && lastHist.role === "user";
    if (!context.isDryRun && lastUser && endsOnUser && c.player.pending.length) {
      const userText = text(hist.filter((m) => m.sourceMessageId === lastUser).at(-1)!);
      await bindPending(c, lastUser, userText);
      void recompute(c);
    }
    const fresh = freshOrders(c, lastUser, endsOnUser);
    const extraLines: string[] = [];
    for (const fn of extras) {
      try {
        extraLines.push(...(await fn(c, result, context)));
      } catch (e) {
        log("warn", `prompt extra failed: ${errText(e)}`);
      }
    }
    const parts = [replaced ? "" : stateText, renderOrders(result.state, fresh), renderSystem(result.last, extraLines), TAG_REMINDER].filter(Boolean);
    const inject: LlmMessageDTO = { role: "system", content: parts.join("\n\n") };

    // Place it just before the latest user turn so it sits close to the reply.
    let at = out.length;
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i].role === "user") {
        at = i;
        break;
      }
      if (out[i].partial) at = i;
    }
    out = [...out.slice(0, at), inject, ...out.slice(at)];
    return { messages: out, breakdown: [{ messageIndex: at, name: "Familiar Ledger state" }] };
  } catch (e) {
    log("error", `interceptor failed: ${errText(e)}`);
    return messages;
  }
}

/** {{ufm_state}}: the current sheet, roster and standing orders for the chat being assembled. */
export async function stateMacro(ctx: { chatId?: string; commit?: boolean }): Promise<string> {
  const chatId = ctx?.chatId;
  if (!chatId) return "";
  try {
    let c = await loadChat(chatId);
    if (!c.result) c = await resyncNow(chatId, true);
    if (!c.result) return "";
    const st = c.result.state;
    return [renderState(st), renderOrders(st, [])].filter(Boolean).join("\n");
  } catch (e) {
    log("warn", `ufm_state macro failed: ${errText(e)}`);
    return "";
  }
}

export { STATE_CLOSE };
