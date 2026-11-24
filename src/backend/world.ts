// Phase 5 backend: the offscreen-lives pass, NPC voices and news in the prompt, cutaways,
// and world data for the panel.

import type { LlmMessageDTO } from "lumiverse-spindle-types";
import { enemyView, heat, isOffscreenMarker, whoKnows } from "../engine/world";
import { FACTIONS, floorBand } from "../shared/data";
import type { GameState, Npc } from "../shared/types";
import { onAfterRecompute } from "./hooks";
import { addPromptExtra } from "./interceptor";
import { toast } from "./protocol";
import { can, errText, log, sp } from "./sp";
import { type ChatCache, getSettings, savePlayer } from "./store";
import { addViewExtras, recompute } from "./sync";

const OFFSCREEN_SYSTEM = `You run the offscreen lives of a grounded fantasy world inside a hundred-floor Tower. While the player was away, time passed (or they changed floors). For each tracked person and faction below, decide what plausibly changed without the player: a new wound, a rank change, a new grudge, news, or a decision made without them. People act on their goals and on what they know, nothing more. Most entries change little; leave out anyone with no change. Keep each change to one short sentence.
Answer ONLY with a JSON array: [{"npc": "<name or faction>", "kind": "news|wound|rank|grudge|decision|death", "text": "<one sentence>"}]`;

function npcLine(n: Npc, state: GameState): string {
  const bits = [n.faction ? FACTIONS.find((f) => f.id === n.faction)?.name ?? n.faction : null, n.rank, n.alive ? null : "dead"].filter(Boolean);
  const ago = Math.round((state.world.elapsed - n.lastSeenHours) / 24);
  return `${n.name}${bits.length ? ` (${bits.join(", ")})` : ""}: goal ${n.goal ?? "unknown"}; wounds ${n.wounds.join(", ") || "none"}; grudges ${n.grudges.join(", ") || "none"}; last seen ${ago}d ago on Floor ${n.floor ?? "?"}${n.place ? ` at ${n.place}` : ""}`;
}

export function parseOffscreen(raw: string): { npc: string; kind: string; text: string }[] {
  const m = /\[[\s\S]*\]/.exec(raw ?? "");
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    return Array.isArray(arr)
      ? arr
          .filter((x) => x && typeof x.npc === "string" && typeof x.text === "string" && x.text.trim())
          .slice(0, 24)
          .map((x) => ({ npc: String(x.npc).trim(), kind: String(x.kind ?? "news").toLowerCase(), text: String(x.text).trim().slice(0, 240) }))
      : [];
  } catch {
    return [];
  }
}

const inFlight = new Set<string>();

async function runOffscreen(c: ChatCache, key: string, why: string): Promise<void> {
  const settings = await getSettings();
  const state = c.result!.state;
  const npcs = Object.values(state.world.npcs).filter((n) => n.alive);
  const ht = heat(state);
  const knows = whoKnows(state)
    .filter((k) => k.fact.about === "you")
    .map((k) => `"${k.fact.text}" — known by ${k.holders.filter((h) => h.alive).map((h) => h.name).join(", ") || "no one alive"}`);
  const content = [
    `WHAT HAPPENED: ${why}`,
    `TRACKED PEOPLE:\n${npcs.map((n) => `- ${npcLine(n, state)}`).join("\n") || "- none"}`,
    `FACTIONS (heat toward the player): ${FACTIONS.map((f) => `${f.name} ${ht.byFaction[f.id] ?? 0}`).join(", ")}; Decree 00 pressure ${ht.decree00}`,
    `WHAT THEY KNOW ABOUT THE PLAYER:\n${knows.join("\n") || "nothing"}`,
  ].join("\n\n");
  let updates: { npc: string; kind: string; text: string }[] = [];
  try {
    const out = (await sp().generate.quiet({
      type: "quiet",
      connection_id: settings.offscreen.connectionId ?? undefined,
      messages: [
        { role: "system", content: OFFSCREEN_SYSTEM },
        { role: "user", content },
      ],
      parameters: { temperature: 0.8, max_tokens: 700 },
      reasoning: { source: "off" },
      signal: AbortSignal.timeout(60_000),
    } as never)) as { content?: string } | string;
    updates = parseOffscreen(typeof out === "string" ? out : (out?.content ?? ""));
  } catch (e) {
    log("warn", `offscreen pass failed: ${errText(e)}`);
    return;
  }
  c.player.offscreen[key] = updates;
  await savePlayer(c);
  await recompute(c);
  if (updates.length) toast("info", `The Tower moved while you were away (${updates.length} change${updates.length === 1 ? "" : "s"}). People will come back changed.`, c.userId);
}

/** Names mentioned in the last few prompt turns: those NPCs are "in the scene". */
function mentioned(messages: LlmMessageDTO[], names: string[]): Set<string> {
  const recent = messages
    .filter((m) => m.__isChatHistory)
    .slice(-3)
    .map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => (p.type === "text" ? p.text : "")).join(" ")))
    .join("\n")
    .toLowerCase();
  const out = new Set<string>();
  for (const n of names) {
    const first = n.toLowerCase().split(/\s+/)[0];
    if (first.length >= 3 && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(recent)) out.add(n);
  }
  return out;
}

export function registerWorld(): void {
  onAfterRecompute(async (c) => {
    const settings = await getSettings();
    if (!settings.offscreen.enabled || !can("generation") || !c.result) return;
    const state = c.result.state;
    if (!Object.values(state.world.npcs).some((n) => n.alive)) return;
    const recent = c.result.results.slice(-3);
    for (const r of recent) {
      const marker = r.events.find((e) => isOffscreenMarker(e.text));
      if (!marker || c.player.offscreen[r.key] || inFlight.has(`${c.chatId}:${r.key}`)) continue;
      const [, kind, value] = marker.text.split(":");
      const why = kind === "floor" ? `the player moved to Floor ${value}` : `${Math.round(Number(value) / 24) || 1} day(s) passed`;
      inFlight.add(`${c.chatId}:${r.key}`);
      void runOffscreen(c, r.key, why).finally(() => inFlight.delete(`${c.chatId}:${r.key}`));
    }
  });

  addPromptExtra(async (_c, result, _ctx, messages) => {
    const settings = await getSettings();
    return sceneNotes(result.state, messages, settings.cutaways);
  });

  addViewExtras((c) => {
    const state = c.result?.state;
    if (!state?.started) return {};
    const ht = heat(state);
    return {
      world: {
        band: floorBand(state.world.floor),
        heat: FACTIONS.map((f) => ({ id: f.id, name: f.name, heat: ht.byFaction[f.id] ?? 0 })),
        decree00: ht.decree00,
        whoKnows: whoKnows(state).map((k) => ({ text: k.fact.text, about: k.fact.about, weight: k.fact.weight, holders: k.holders })),
        npcs: Object.values(state.world.npcs),
        enemy: enemyView(state, state.world.lastEnemy),
        enemies: Object.keys(state.world.enemies).map((id) => enemyView(state, id)),
        threads: state.world.threads,
        offscreenPending: [...inFlight].some((k) => k.startsWith(`${c.chatId}:`)),
      },
    };
  });
}

/** Voices, news since last seen, and what people know: only for NPCs in the scene. */
export function sceneNotes(state: GameState, messages: LlmMessageDTO[], cutaways: boolean): string[] {
  const out: string[] = [];
  const npcs = Object.values(state.world.npcs);
  const inScene = mentioned(messages, npcs.map((n) => n.name));
  const present = npcs.filter((n) => inScene.has(n.name));
  if (present.length) {
    out.push("People in the scene (their own voices; they know only what the ledger says they know):");
    for (const n of present) {
      const knows = state.world.facts.filter((f) => f.holders.includes(`npc:${n.id}`)).map((f) => f.text);
      const bits = [
        n.alive ? null : "DEAD — they cannot appear",
        n.voice ? `voice: ${n.voice}` : "no voice notes yet: give them a distinct voice and record it with npc name=\"...\" voice=\"...\"",
        n.goal ? `wants (offscreen): ${n.goal}` : null,
        n.wounds.length ? `wounds: ${n.wounds.join(", ")}` : null,
        n.grudges.length ? `grudges: ${n.grudges.join(", ")}` : null,
        knows.length ? `knows about {{user}}: ${knows.join("; ")}` : null,
        n.news.length ? `CHANGED since last seen: ${n.news.join(" ")} — show it, then write npc "${n.name}" seen=yes` : null,
      ].filter(Boolean);
      out.push(`- ${n.name}: ${bits.join("; ")}`);
    }
  }
  if (cutaways) {
    out.push(
      'Motive cutaways are allowed: when an NPC makes a big choice, you may add one short scene from their head wrapped in <ufm-cutaway who="Name">…</ufm-cutaway>. The player knows it; {{user}} does not, and nobody in the story learns it from the cutaway.',
    );
  }
  return out;
}
