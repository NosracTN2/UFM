// The serializable view the frontend renders. Every number is computed here, on the backend.

import { ATTR_KEYS, FORMS, masteryName, PILLARS, soulStage } from "../shared/data";
import { circleName, levelLabel, nextThresholdLevel, thresholdName, xpToNext } from "../shared/math";
import type { Familiar, GameState, MsgResult, Order, PlayerStore, ReplayResult, Settings, Squad, Suggestion } from "../shared/types";
import { bondAttrs, derive, holdsTether } from "./derive";
import { clockText, famLabel } from "./render";

export interface FamView {
  id: string;
  name: string;
  label: string;
  pillar: string;
  kind: string;
  form: string;
  control: string;
  state: string;
  tether: number;
  order: string | null;
  stance: string | null;
  condition: string;
  wounds: string[];
  minded: boolean;
  level: number;
  resonance: string;
  stage: string | null;
  kills: number;
  xpSent: number;
  inHand: boolean;
  place: string | null;
  portrait: string | null;
  ready: Familiar["ready"];
  raw: Familiar;
}

export interface LedgerView {
  chatId: string;
  enabled: boolean;
  started: boolean;
  needsSetup: boolean;
  runHint: string | null;
  sheet: GameState["sheet"];
  world: GameState["world"];
  derived: ReturnType<typeof derive> & { bondsBy: ReturnType<typeof bondAttrs>["by"] };
  levelText: string;
  circle: string;
  threshold: string;
  xpNext: number;
  nextThreshold: number;
  clock: string;
  pillars: { id: string; num: number; name: string; status: string; stir: string | null; first: boolean; display: string; branches: { name: string; mastery: string; pct: number; origin: string }[] }[];
  roster: FamView[];
  counts: Record<string, number>;
  last: MsgResult | null;
  recentRejected: { key: string; line: string; reason: string }[];
  recentEvents: { key: string; text: string; big?: boolean }[];
  pending: Order[];
  squads: Squad[];
  suggestions: { key: string; items: Suggestion[] }[];
  settings: Settings;
  perms: Record<string, boolean>;
  extras: Record<string, unknown>;
}

export function famView(state: GameState, f: Familiar): FamView {
  const def = FORMS[f.form];
  const cond = f.wounds.length ? f.wounds.map((w) => w.label).join(", ") : f.state === "lost" ? "lost" : "sound";
  return {
    id: f.id,
    name: f.name,
    label: famLabel(f),
    pillar: f.pillar,
    kind: f.kind,
    form: f.form,
    control: def?.control ?? "order",
    state: f.state,
    tether: f.tether,
    order: f.order,
    stance: f.stance,
    condition: cond,
    wounds: f.wounds.map((w) => w.label),
    minded: f.minded,
    level: f.level,
    resonance: f.resonance,
    stage: soulStage(f.stage)?.name ?? f.stage,
    kills: f.kills,
    xpSent: f.xpSent,
    inHand: state.sheet.hand === f.id,
    place: f.place,
    portrait: f.portrait,
    ready: f.ready,
    raw: f,
  };
}

export function buildView(
  chatId: string,
  result: ReplayResult,
  player: PlayerStore,
  settings: Settings,
  perms: Record<string, boolean>,
  extras: Record<string, unknown> = {},
): LedgerView {
  const state = result.state;
  const s = state.sheet;
  const d = derive(state);
  const clock = state.world.clocks[String(state.world.floor)];
  const counts: Record<string, number> = { active: 0, slumbering: 0, soul: 0, lost: 0, released: 0 };
  for (const f of state.roster) counts[f.state] = (counts[f.state] ?? 0) + 1;
  const recentRejected: LedgerView["recentRejected"] = [];
  const recentEvents: LedgerView["recentEvents"] = [];
  for (const r of result.results.slice(-8)) {
    for (const x of r.rejected) recentRejected.push({ key: r.key, line: x.line, reason: x.reason });
    for (const e of r.events) recentEvents.push({ key: r.key, text: e.text, big: e.big });
  }
  const suggestions = Object.entries(player.suggestions)
    .map(([key, items]) => ({ key, items: items.filter((i) => i.status === "open") }))
    .filter((x) => x.items.length);
  return {
    chatId,
    enabled: player.enabled,
    started: state.started,
    needsSetup: !state.started,
    runHint: player.runHint,
    sheet: s,
    world: state.world,
    derived: { ...d, bondsBy: bondAttrs(state).by },
    levelText: levelLabel(s.level),
    circle: circleName(s.level),
    threshold: thresholdName(s.level),
    xpNext: xpToNext(s.level),
    nextThreshold: nextThresholdLevel(s.level),
    clock: clockText(clock?.hours ?? 8),
    pillars: PILLARS.map((p) => {
      const ps = s.pillars[p.id];
      const known = ps?.status === "open" || s.run === "sandbox";
      return {
        id: p.id,
        num: p.num,
        name: p.name,
        status: ps?.status ?? "sealed",
        stir: ps?.stir ?? null,
        first: !!ps?.first,
        display: ps?.status === "open" || known ? p.name : "[???]",
        branches: s.branches.filter((b) => b.pillar === p.id).map((b) => ({ name: b.name, mastery: masteryName(b.tier), pct: Math.floor(b.pct), origin: b.origin })),
      };
    }),
    roster: state.roster.map((f) => famView(state, f)),
    counts,
    last: result.last,
    recentRejected: recentRejected.slice(-12),
    recentEvents: recentEvents.slice(-12),
    pending: player.pending,
    squads: player.squads,
    suggestions,
    settings,
    perms,
    extras,
  };
}

export { ATTR_KEYS, holdsTether };
