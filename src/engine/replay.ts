// Rebuild the whole game by replaying the change log from the start. Swipes, edits and
// deletes roll back cleanly because nothing is ever applied anywhere else.

import { ATTR_KEYS } from "../shared/data";
import type { AttrKey, ChatLog, MsgResult, PlayerEvent, PlayerStore, ReplayResult, Settings } from "../shared/types";
import { makeCtx, reject, Reject } from "./context";
import { clampVitals, fullRestore } from "./derive";
import { applyOps } from "./ops";
import { parseBlock, parseLine } from "./parse";
import { applySetup, initialState, type SetupData } from "./state";
import { PLAYER_EVENT_HANDLERS } from "./player-events";
import { installRules } from "./rules";
import "./growth";
import { onSetup } from "./growth-hooks";
import { applyOffscreen } from "./world";

installRules();

export const DEFAULT_SETTINGS: Settings = {
  narrowTether: true,
  rerolls: false,
  check: { enabled: false, mode: "quiet", connectionId: null },
  offscreen: { enabled: false, connectionId: null },
  cutaways: false,
  readUpTo: null,
  worldBookId: null,
  portraits: { connectionId: null, style: "painterly fantasy portrait, grounded, muted palette" },
  historyTags: 2,
  hud: true,
};

export function emptyLog(): ChatLog {
  return { version: 1, messages: [], blocks: {} };
}

export function emptyPlayer(): PlayerStore {
  return { version: 1, enabled: false, runHint: null, events: [], pending: [], issued: {}, squads: [], suggestions: {}, offscreen: {}, voices: {} };
}

export const msgKey = (id: string, swipe: number) => `${id}#${swipe}`;

export interface ReplayOptions {
  seed?: string;
  /** Stop after this message (inclusive). */
  until?: string | null;
  /** Stop before this message (exclusive). */
  before?: string | null;
}

export function replay(log: ChatLog, player: PlayerStore, settings: Settings, opts: ReplayOptions = {}): ReplayResult {
  const state = initialState(opts.seed ?? "ufm");
  const results: MsgResult[] = [];

  const startRes: MsgResult = { key: "start", msgId: "start", swipe: 0, applied: [], notes: [], rejected: [], events: [] };
  const setups = player.events.filter((e) => e.kind === "setup" && e.anchor == null);
  const setup = setups[setups.length - 1];
  if (setup) {
    applySetup(state, setup.data as SetupData);
    fullRestore(state);
    onSetup(makeCtx(state, settings, startRes));
  }
  for (const ev of player.events.filter((e) => e.anchor == null && e.kind !== "setup").sort((a, b) => a.ts - b.ts)) {
    applyPlayerEvent(ev, makeCtx(state, settings, startRes));
  }

  const anchored = new Map<string, PlayerEvent[]>();
  for (const ev of player.events) {
    if (!ev.anchor) continue;
    const k = msgKey(ev.anchor.msgId, ev.anchor.swipe);
    if (!anchored.has(k)) anchored.set(k, []);
    anchored.get(k)!.push(ev);
  }

  let last: MsgResult | null = null;
  const ordered = [...log.messages].sort((a, b) => a.index - b.index);
  for (const m of ordered) {
    if (opts.before && m.id === opts.before) break;
    const key = msgKey(m.id, m.swipe);
    const res: MsgResult = { key, msgId: m.id, swipe: m.swipe, applied: [], notes: [], rejected: [], events: [] };
    const ctx = makeCtx(state, settings, res);
    if (m.role === "assistant") {
      const bodies = log.blocks[m.id]?.[String(m.swipe)] ?? [];
      for (const body of bodies) applyOps(ctx, parseBlock(body));
    }
    for (const ev of (anchored.get(key) ?? []).sort((a, b) => a.ts - b.ts)) applyPlayerEvent(ev, ctx);
    const off = player.offscreen?.[key];
    if (off?.length) applyOffscreen(ctx, off);
    clampVitals(state);
    if (m.role === "assistant") last = res;
    if (m.role === "assistant" || res.applied.length || res.rejected.length || res.events.length) results.push(res);
    if (opts.until && m.id === opts.until) break;
  }
  if (startRes.applied.length || startRes.rejected.length || startRes.events.length) results.unshift(startRes);
  return { state, results, last };
}

function applyPlayerEvent(ev: PlayerEvent, ctx: ReturnType<typeof makeCtx>): void {
  const label = `[you] ${ev.kind}`;
  try {
    if (ev.kind === "amend") {
      const lines: string[] = Array.isArray(ev.data?.ops) ? ev.data.ops : [];
      const ops = lines.map((l, i) => parseLine(l, i)).filter((o): o is NonNullable<typeof o> => !!o);
      applyOps(ctx, ops);
      return;
    }
    if (ev.kind === "alloc") {
      allocate(ctx, ev.data?.points ?? {});
      ctx.res.applied.push(label);
      return;
    }
    const h = PLAYER_EVENT_HANDLERS[ev.kind];
    if (!h) reject(`unknown player event ${ev.kind}`);
    h(ev, ctx);
    ctx.res.applied.push(label);
  } catch (e) {
    ctx.res.rejected.push({ line: label, reason: e instanceof Reject ? e.message : String((e as Error)?.message ?? e) });
  }
}

/** Place unspent attribute points (the level-up modal). */
export function allocate(ctx: ReturnType<typeof makeCtx>, points: Partial<Record<AttrKey, number>>): void {
  const s = ctx.state.sheet;
  let total = 0;
  for (const k of ATTR_KEYS) {
    const v = Math.floor(points[k] ?? 0);
    if (v < 0) reject("points can't be negative");
    total += v;
  }
  if (total === 0) reject("no points placed");
  if (total > s.unspent) reject(`only ${s.unspent} unspent point(s)`);
  for (const k of ATTR_KEYS) s.attrs[k] += Math.floor(points[k] ?? 0);
  s.unspent -= total;
}
