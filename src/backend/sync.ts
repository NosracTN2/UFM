// Keep each chat's change log in step with the chat itself, replay, and publish the result.
// With chat_mutation granted the log is rebuilt from the real messages (exact per swipe);
// without it, it is kept from events and the frontend tag interceptor.

import { extractBlocks } from "../engine/parse";
import { replay } from "../engine/replay";
import { buildView, type LedgerView } from "../engine/view";
import { derive } from "../engine/derive";
import type { ChatLog, MsgInfo } from "../shared/types";
import { can, errText, hostCap, log, sp } from "./sp";
import { type ChatCache, getSettings, loadChat, saveLog, savePlayer } from "./store";
import { afterRecompute } from "./hooks";

export interface MsgLike {
  id: string;
  role?: string;
  is_user?: boolean;
  swipe_id?: number;
  swipes?: (string | null)[] | null;
  content?: string;
  index_in_chat?: number;
}

const SETUP_RE = /<ufm-setup\b([^>]*)>/i;

function roleOf(m: MsgLike): MsgInfo["role"] {
  if (m.role === "system" || m.role === "user" || m.role === "assistant") return m.role;
  return m.is_user ? "user" : "assistant";
}

function setBlocks(lg: ChatLog, id: string, swipe: number, text: string | null | undefined): boolean {
  if (text == null) return false;
  const bodies = extractBlocks(text);
  const cur = lg.blocks[id]?.[String(swipe)];
  if (!bodies.length) {
    if (!cur) return false;
    delete lg.blocks[id][String(swipe)];
    return true;
  }
  if (cur && cur.length === bodies.length && cur.every((b, i) => b === bodies[i])) return false;
  (lg.blocks[id] ??= {})[String(swipe)] = bodies;
  return true;
}

/** Fold one message into the log. `allSwipes` refreshes every swipe slot the payload carries. */
export function ingestMessage(lg: ChatLog, m: MsgLike, allSwipes: boolean): boolean {
  if (!m?.id) return false;
  let changed = false;
  const role = roleOf(m);
  const swipe = m.swipe_id ?? 0;
  const existing = lg.messages.find((x) => x.id === m.id);
  const index = m.index_in_chat ?? existing?.index ?? (lg.messages.length ? Math.max(...lg.messages.map((x) => x.index)) + 1 : 0);
  if (!existing) {
    lg.messages.push({ id: m.id, role, swipe, index });
    changed = true;
  } else if (existing.swipe !== swipe || existing.index !== index || existing.role !== role) {
    Object.assign(existing, { swipe, index, role });
    changed = true;
  }
  if (role !== "assistant") return changed;
  const swipes = Array.isArray(m.swipes) ? m.swipes : null;
  if (allSwipes && swipes) {
    swipes.forEach((t, s) => {
      if (setBlocks(lg, m.id, s, t)) changed = true;
    });
    const slots = lg.blocks[m.id];
    if (slots) for (const k of Object.keys(slots)) if (Number(k) >= swipes.length) {
      delete slots[k];
      changed = true;
    }
  } else {
    const text = m.content ?? swipes?.[swipe] ?? null;
    if (setBlocks(lg, m.id, swipe, text)) changed = true;
  }
  return changed;
}

export function removeMessage(lg: ChatLog, id: string): boolean {
  const before = lg.messages.length;
  lg.messages = lg.messages.filter((m) => m.id !== id);
  delete lg.blocks[id];
  return lg.messages.length !== before;
}

/** Rebuild the message list from the host (exact order, active swipes, deletions). */
export async function syncFromHost(c: ChatCache): Promise<boolean> {
  if (!can("chat_mutation")) return false;
  try {
    const lean = hostCap("chat-lean-messages-v1");
    const msgs = (lean
      ? await sp().chat.getMessages(c.chatId, { light: true, includeExtra: false })
      : await sp().chat.getMessages(c.chatId)) as unknown as MsgLike[];
    const ids = new Set(msgs.map((m) => m.id));
    let changed = false;
    for (const old of [...c.log.messages]) if (!ids.has(old.id)) changed = removeMessage(c.log, old.id) || changed;
    msgs.forEach((m, i) => {
      changed = ingestMessage(c.log, { ...m, index_in_chat: m.index_in_chat ?? i }, !lean) || changed;
    });
    // The greeting's <ufm-setup run="..."> marks this chat as a Familiar Ledger run.
    const first = msgs.find((m) => roleOf(m) !== "user") ?? msgs[0];
    const firstText = first ? (first.content ?? first.swipes?.[first.swipe_id ?? 0] ?? "") : "";
    const sm = SETUP_RE.exec(firstText ?? "");
    if (sm) {
      const run = /run\s*=\s*["']?(origin|spread|sandbox)/i.exec(sm[1])?.[1]?.toLowerCase() ?? "origin";
      if (!c.player.enabled || c.player.runHint !== run) {
        c.player.enabled = true;
        c.player.runHint = run as ChatCache["player"]["runHint"];
        await savePlayer(c);
      }
    }
    return changed;
  } catch (e) {
    log("warn", `reading messages for ${c.chatId} failed: ${errText(e)}`);
    return false;
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const running = new Map<string, Promise<void>>();

/** Debounced resync; bursts of events (swipe + edit + generation end) collapse into one replay. */
export function scheduleResync(chatId: string, fromHost = true, delay = 120): void {
  if (!chatId) return;
  const t = timers.get(chatId);
  if (t) clearTimeout(t);
  timers.set(
    chatId,
    setTimeout(() => {
      timers.delete(chatId);
      void resyncNow(chatId, fromHost);
    }, delay),
  );
}

export async function resyncNow(chatId: string, fromHost = true): Promise<ChatCache> {
  const prev = running.get(chatId);
  if (prev) await prev.catch(() => {});
  const c = await loadChat(chatId);
  const job = (async () => {
    const changed = fromHost ? await syncFromHost(c) : false;
    if (changed) await saveLog(c);
    await recompute(c);
  })();
  running.set(chatId, job);
  try {
    await job;
  } finally {
    running.delete(chatId);
  }
  return c;
}

export function seedOf(c: ChatCache): string {
  const setup = c.player.events.find((e) => e.kind === "setup");
  return (setup?.data?.seed as string) || c.chatId;
}

export async function recompute(c: ChatCache, push = true): Promise<void> {
  const settings = await getSettings();
  c.result = replay(c.log, c.player, settings, { seed: seedOf(c) });
  if (!c.player.enabled && (c.result.state.started || Object.keys(c.log.blocks).length)) {
    c.player.enabled = true;
    await savePlayer(c);
  }
  if (push) pushView(c, settings);
  await mirrorVars(c);
  await afterRecompute(c);
}

export function permsSnapshot(): Record<string, boolean> {
  const names = ["chat_mutation", "generation", "interceptor", "ui_panels", "world_books", "image_gen", "images", "decisions", "characters", "chats"];
  const out: Record<string, boolean> = {};
  for (const n of names) out[n] = can(n);
  return out;
}

export function makeView(c: ChatCache, settings: Parameters<typeof buildView>[3]): LedgerView | null {
  if (!c.result) return null;
  return buildView(c.chatId, c.result, c.player, settings, permsSnapshot(), viewExtras(c));
}

/** Later phases add panel data here (form options, ledger, NPCs...). */
export let viewExtras: (c: ChatCache) => Record<string, unknown> = () => ({});
export function setViewExtras(fn: typeof viewExtras): void {
  viewExtras = fn;
}

export function pushView(c: ChatCache, settings: Parameters<typeof buildView>[3]): void {
  const view = makeView(c, settings);
  if (!view) return;
  try {
    sp().sendToFrontend({ type: "state", chatId: c.chatId, view }, c.userId);
  } catch (e) {
    log("warn", `sendToFrontend failed: ${errText(e)}`);
  }
}

/** Mirror headline numbers into chat variables (@mana, @tethers, @hp, @level). Storage stays the truth. */
async function mirrorVars(c: ChatCache): Promise<void> {
  if (!c.result?.state.started || !c.player.enabled) return;
  const st = c.result.state;
  const d = derive(st);
  const vals: Record<string, string> = {
    mana: String(st.sheet.mana),
    mana_max: String(d.manaMax),
    hp: String(st.sheet.hp),
    hp_max: String(d.hpMax),
    tethers: String(d.tethersUsed),
    tethers_total: String(d.tethersTotal),
    level: String(st.sheet.level),
    xp: String(st.sheet.xp),
  };
  for (const [k, v] of Object.entries(vals)) {
    if (c.vars[k] === v) continue;
    try {
      await sp().variables.chat.set(c.chatId, k, v);
      c.vars[k] = v;
    } catch (e) {
      log("warn", `chat variable ${k} failed: ${errText(e)}`);
      return;
    }
  }
}
