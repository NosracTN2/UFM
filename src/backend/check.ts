// Optional second-model check: a cheap model reads each new reply and asks whether anything died,
// arrived or changed that the tag missed. It only suggests; you accept a fix in the panel.

import { dryRun } from "../engine/panel";
import { extractBlocks, parseLine, stripBlocks } from "../engine/parse";
import { msgKey } from "../engine/replay";
import { famLabel } from "../engine/render";
import { newId } from "../shared/rng";
import type { GameState, Settings, Suggestion } from "../shared/types";
import { onAfterRecompute } from "./hooks";
import { addPlayerEvent, onFront, reply, toast } from "./protocol";
import { can, errText, log, sp } from "./sp";
import { type ChatCache, getSettings, savePlayer } from "./store";
import { pushView, recompute } from "./sync";

/** Latest reply text per message (from GENERATION_ENDED), so the check needn't re-read the chat. */
export const replyTexts = new Map<string, string>();

const CHECK_SYSTEM = `You audit a roleplay narrator's change log. The narrator wrote a reply and a <ufm> tag that must list every change in that reply. Compare the prose to the tag.
List ONLY changes that clearly happened in the prose but are MISSING from the tag:
- a familiar died, was destroyed, lost or released (lose "Name" / release "Name")
- a new familiar appeared: formed, bound or raised (form / bind / raise ...)
- a kill made by a familiar (kill enemy="..." level=N by=Name) — only if the prose states the enemy's level
- a wound (wound you "label" heal=3d), an item gained or lost, time passing (time +6h), moving to a new place (move place="...")
- someone learning a fact about the player (learn who="..." fact="...")
Never invent numbers the prose doesn't give. Never repeat a line already in the tag.
Answer ONLY with a JSON array, [] if nothing is missing: [{"op": "<one tag line>", "why": "<short reason or quote>"}]`;

function rosterText(state: GameState): string {
  const live = state.roster.filter((f) => f.state !== "lost" && f.state !== "released");
  return live.length ? live.map((f) => `${f.name} (${famLabel(f)}, ${f.state})`).join("; ") : "none";
}

export function parseSuggestions(raw: string): { op: string; why: string }[] {
  const m = /\[[\s\S]*\]/.exec(raw ?? "");
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.op === "string" && x.op.trim())
      .slice(0, 8)
      .map((x) => ({ op: String(x.op).trim().replace(/^<ufm>|<\/ufm>$/g, ""), why: String(x.why ?? "").slice(0, 200) }));
  } catch {
    return [];
  }
}

async function replyText(c: ChatCache, msgId: string, swipe: number): Promise<string | null> {
  const cached = replyTexts.get(msgKey(msgId, swipe)) ?? replyTexts.get(msgId);
  if (cached) return cached;
  if (!can("chat_mutation")) return null;
  try {
    const msgs = (await sp().chat.getMessages(c.chatId)) as unknown as { id: string; swipes?: string[]; content?: string }[];
    const m = msgs.find((x) => x.id === msgId);
    return m?.swipes?.[swipe] ?? m?.content ?? null;
  } catch {
    return null;
  }
}

async function runCheck(c: ChatCache, key: string, msgId: string, swipe: number, settings: Settings): Promise<void> {
  const text = await replyText(c, msgId, swipe);
  if (!text || !c.result) return;
  const prose = stripBlocks(text);
  const tag = extractBlocks(text).join("\n").trim() || "(empty)";
  const state = c.result.state;
  const found: Suggestion[] = [];
  const signal = AbortSignal.timeout(45_000);

  if (settings.check.mode === "decision" && can("decisions")) {
    const res = await sp().decisions.evaluate(
      {
        connection_id: settings.check.connectionId ?? undefined,
        state: { familiars_before: rosterText(state), reply: prose.slice(0, 12000), change_log: tag },
        questions: {
          died: { type: "noul", instructions: "Did any familiar die, get destroyed, get lost or released in the reply without a matching lose/release line in the change log?" },
          arrived: { type: "noul", instructions: "Did a new familiar appear (formed, bound, raised, summoned) in the reply without a matching form/bind/raise/make line in the change log?" },
          changed: { type: "noul", instructions: "Did anything else change in the reply (a kill by a familiar, a wound, an item, time passing, a move, someone learning about the player) that the change log missed?" },
        },
      } as never,
      { signal } as never,
    );
    const a = (res as { answers: Record<string, { noul?: number }> }).answers;
    const labels: Record<string, string> = { died: "a familiar died or was lost", arrived: "a new familiar arrived", changed: "another change (kill, wound, item, time, place, a fact)" };
    for (const k of ["died", "arrived", "changed"]) {
      const p = a?.[k]?.noul ?? 0;
      if (p >= 0.6) found.push({ id: newId("sg"), op: "", why: `Possible miss: ${labels[k]} (${Math.round(p * 100)}%). Add a fix line if so.`, status: "open" });
    }
  } else if (can("generation")) {
    const out = (await sp().generate.quiet({
      type: "quiet",
      connection_id: settings.check.connectionId ?? undefined,
      messages: [
        { role: "system", content: CHECK_SYSTEM },
        { role: "user", content: `FAMILIARS BEFORE THIS REPLY: ${rosterText(state)}\n\nREPLY:\n${prose.slice(0, 12000)}\n\nTAG:\n${tag}` },
      ],
      parameters: { temperature: 0, max_tokens: 500 },
      reasoning: { source: "off" },
      signal,
    } as never)) as { content?: string } | string;
    const content = typeof out === "string" ? out : (out?.content ?? "");
    const existing = new Set(tag.split("\n").map((l) => l.trim().toLowerCase()));
    for (const s of parseSuggestions(content)) {
      if (existing.has(s.op.toLowerCase()) || !parseLine(s.op)) continue;
      const r = dryRun(state, settings, [s.op]);
      found.push({ id: newId("sg"), op: s.op, why: r.ok ? s.why : `${s.why} (would be rejected: ${r.reason})`, status: "open" });
    }
  } else return;

  c.player.suggestions[key] = found;
  await savePlayer(c);
  pushView(c, settings);
  if (found.length) toast("info", `Rule check: ${found.length} possible miss${found.length === 1 ? "" : "es"} in the last reply. See the Familiar panel.`, c.userId);
}

export function registerCheck(): void {
  onAfterRecompute(async (c) => {
    const settings = await getSettings();
    if (!settings.check.enabled || !c.result?.last) return;
    const last = c.result.last;
    const newest = [...c.log.messages].sort((a, b) => a.index - b.index).at(-1);
    if (!newest || newest.id !== last.msgId) return; // only the newest reply
    if (c.checked.has(last.key) || c.player.suggestions[last.key]) return;
    if (!replyTexts.has(last.msgId) && !replyTexts.has(last.key)) return; // only freshly generated replies
    c.checked.add(last.key);
    void runCheck(c, last.key, last.msgId, last.swipe, settings).catch((e) => log("warn", `rule check failed: ${errText(e)}`));
  });

  onFront("suggestion", async (msg, c, userId) => {
    if (!c) return;
    const list = c.player.suggestions[msg.key] ?? [];
    const s = list.find((x) => x.id === msg.id);
    if (!s) return;
    if (msg.action === "dismiss") {
      s.status = "dismissed";
      await savePlayer(c);
      await recompute(c);
      return;
    }
    const op = String(msg.op ?? s.op ?? "").trim();
    if (!op) {
      toast("warning", "Write the line to add.", userId);
      return;
    }
    const [msgId, swipe] = String(msg.key).split("#");
    s.status = "accepted";
    await addPlayerEvent(c, "amend", { ops: [op], source: "check" }, { msgId, swipe: Number(swipe) || 0 });
  });

  /** A manual fix for the last reply: a tag line you add yourself (rolls back with that reply). */
  onFront("amend", async (msg, c, userId) => {
    const last = c?.result?.last;
    if (!c || !last) {
      toast("warning", "There's no narrator reply to amend yet.", userId);
      return;
    }
    const lines = String(msg.lines ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    await addPlayerEvent(c, "amend", { ops: lines, source: "manual" }, { msgId: last.msgId, swipe: last.swipe });
    reply(userId, { type: "amended", chatId: c.chatId });
  });

  onFront("connections", async (_msg, _c, userId) => {
    const out: { llm: { id: string; name: string }[]; decision: { id: string; name: string }[]; image: { id: string; name: string }[] } = { llm: [], decision: [], image: [] };
    try {
      if (can("image_gen")) out.image = ((await sp().imageGen.listConnections()) as unknown as { id: string; name: string }[]).map((x) => ({ id: x.id, name: x.name }));
    } catch {
      /* no image connections */
    }
    try {
      if (can("generation")) out.llm = ((await sp().connections.list()) as { id: string; name: string; model?: string }[]).map((x) => ({ id: x.id, name: `${x.name}${x.model ? ` · ${x.model}` : ""}` }));
    } catch (e) {
      log("warn", `listing connections failed: ${errText(e)}`);
    }
    try {
      if (can("decisions")) out.decision = ((await sp().decisions.listConnections()) as unknown as { id: string; name: string }[]).map((x) => ({ id: x.id, name: x.name }));
    } catch {
      /* decisions not available on this host */
    }
    reply(userId, { type: "connections", ...out });
  });
}
