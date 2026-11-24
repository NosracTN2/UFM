// Phase 5 — the living world. Enemy windows and floor bands, NPC records, the who-knows-what
// ledger (facts spread only through ops; heat is derived from it), threads, and the offscreen
// changes a background pass writes on time skips and floor changes.

import { FACTIONS, factionOf, floorBand } from "../shared/data";
import { circleIndex, killXp } from "../shared/math";
import { slug } from "../shared/rng";
import type { EnemyWindow, Fact, GameState, Npc } from "../shared/types";
import { clean, type Ctx, isSelf, reject } from "./context";
import { num, parseDuration, yes } from "./parse";
import { HANDLERS, setLearnFact, setOnFloorChange, setOnTimePassed, setRecordKill } from "./ops";

// ── NPCs ──────────────────────────────────────────────────────────────

export function findNpc(state: GameState, name: string | undefined): Npc | undefined {
  if (!name) return undefined;
  const k = clean(name);
  const all = Object.values(state.world.npcs);
  return all.find((n) => n.name.toLowerCase() === k) ?? state.world.npcs[slug(name)] ?? (k.length >= 3 ? all.find((n) => n.name.toLowerCase().split(/\s+/).includes(k)) : undefined);
}

function ensureNpc(ctx: Ctx, name: string): Npc {
  const found = findNpc(ctx.state, name);
  if (found) return found;
  const id = slug(name) || `npc${Object.keys(ctx.state.world.npcs).length + 1}`;
  const n: Npc = { id, name: name.trim(), faction: null, rank: null, voice: null, goal: null, wounds: [], grudges: [], notes: [], floor: ctx.state.world.floor, place: ctx.state.world.place || null, alive: true, lastSeenHours: ctx.state.world.elapsed, news: [] };
  ctx.state.world.npcs[id] = n;
  return n;
}

HANDLERS.npc = (op, ctx) => {
  const name = op.kv.name ?? op.args[0];
  if (!name) reject('npc needs name="..."');
  if (isSelf(ctx.state, name)) reject("that's you");
  const isNew = !findNpc(ctx.state, name);
  const n = ensureNpc(ctx, name);
  const kv = op.kv;
  if (kv.faction) n.faction = factionOf(kv.faction) ?? kv.faction;
  if (kv.rank) n.rank = kv.rank;
  if (kv.voice) n.voice = kv.voice;
  if (kv.goal) n.goal = kv.goal;
  if (kv.wound) n.wounds.push(kv.wound);
  if (kv.healed) n.wounds = n.wounds.filter((w) => !w.toLowerCase().includes(kv.healed.toLowerCase()));
  if (kv.grudge) n.grudges.push(kv.grudge);
  if (kv.note) n.notes.push(kv.note);
  if (kv.place) n.place = kv.place;
  if (kv.floor && num(kv.floor) != null) n.floor = num(kv.floor);
  if (yes(kv.dead) || /^(dead|dies|died|killed)$/i.test(op.args[1] ?? "")) {
    n.alive = false;
    ctx.event("info", `${n.name} is dead. What only they knew dies with them.`);
  }
  n.lastSeenHours = ctx.state.world.elapsed;
  n.floor = n.floor ?? ctx.state.world.floor;
  // They're back in the story: any offscreen news has now been shown.
  if (!isNew && (yes(kv.seen) || op.args.slice(1).some((a) => /^seen$/i.test(a)))) n.news = [];
  if (isNew && !n.voice) ctx.note(`${n.name} has no voice notes yet: add voice="..." the first time they speak.`);
};

// ── who knows what ────────────────────────────────────────────────────

/** gameOnly: how much a fact about you weighs. Origin-level secrets also feed Decree 00. */
export function factWeight(text: string): { weight: number; origin: boolean } {
  const t = text.toLowerCase();
  if (/\b(origin|ultimate|fifty pillars|50 pillars|all the pillars|every pillar|\[\?\?\?\])\b/.test(t)) return { weight: 5, origin: true };
  if (/(golem|summon|rais|familiar|bind|bound|beast|stone (rise|stand)|undead|zombie|tether|pillar|element)/.test(t)) return { weight: 3, origin: false };
  if (/(name|lives|home|where|face|mine|family|born)/.test(t)) return { weight: 2, origin: false };
  return { weight: 1, origin: false };
}

setLearnFact((ctx, who, fact, about, via) => {
  const st = ctx.state;
  const key = fact.trim().toLowerCase();
  let f = st.world.facts.find((x) => x.text.toLowerCase() === key);
  if (!f) {
    f = { id: `k${st.world.facts.length + 1}`, text: fact.trim(), about, holders: [], weight: factWeight(fact).weight };
    st.world.facts.push(f);
  }
  // A holder is a faction, or a person (tracked as an NPC so the fact can die with them).
  const fac = factionOf(who);
  const holder = fac && FACTIONS.some((x) => clean(who).replace(/^the /, "") === x.name.toLowerCase().replace(/^the /, "") || clean(who) === x.id) ? `faction:${fac}` : `npc:${ensureNpc(ctx, who).id}`;
  if (!f.holders.includes(holder)) f.holders.push(holder);
  if (via) ctx.note(`${who} learned "${fact}" (${via}).`);
});

function holderAlive(state: GameState, holder: string): boolean {
  if (!holder.startsWith("npc:")) return true;
  return state.world.npcs[holder.slice(4)]?.alive !== false;
}

function holderFaction(state: GameState, holder: string): string | null {
  if (holder.startsWith("faction:")) return holder.slice(8);
  const n = state.world.npcs[holder.slice(4)];
  return n?.faction ? (factionOf(n.faction) ?? n.faction) : null;
}

export function holderName(state: GameState, holder: string): string {
  if (holder.startsWith("faction:")) return FACTIONS.find((f) => f.id === holder.slice(8))?.name ?? holder.slice(8);
  return state.world.npcs[holder.slice(4)]?.name ?? holder.slice(4);
}

/** Heat per faction, derived from what its living members (or the faction itself) know about you. */
export function heat(state: GameState): { byFaction: Record<string, number>; decree00: number } {
  const byFaction: Record<string, number> = {};
  for (const f of FACTIONS) byFaction[f.id] = 0;
  let decree00 = 0;
  for (const fact of state.world.facts) {
    if (fact.about !== "you") continue;
    const { origin } = factWeight(fact.text);
    const factions = new Set<string>();
    let living = 0;
    for (const h of fact.holders) {
      if (!holderAlive(state, h)) continue;
      living += 1;
      const fac = holderFaction(state, h);
      if (fac) factions.add(fac);
    }
    for (const fac of factions) byFaction[fac] = (byFaction[fac] ?? 0) + fact.weight;
    if (origin && living) decree00 += fact.weight * Math.min(3, living);
  }
  return { byFaction, decree00 };
}

export function whoKnows(state: GameState): { fact: Fact; holders: { name: string; alive: boolean; faction: string | null }[] }[] {
  return state.world.facts.map((fact) => ({
    fact,
    holders: fact.holders.map((h) => ({ name: holderName(state, h), alive: holderAlive(state, h), faction: holderFaction(state, h) })),
  }));
}

// ── enemies and floors ────────────────────────────────────────────────

HANDLERS.see = (op, ctx) => {
  const st = ctx.state;
  const name = op.kv.enemy ?? op.kv.name ?? op.args[0];
  if (!name) reject('see needs enemy="..."');
  const level = num(op.kv.level ?? op.args[1]);
  if (level == null || level < 1) reject("see needs the enemy's level (level=N)");
  const id = slug(`${name}`) || `e${Object.keys(st.world.enemies).length + 1}`;
  const w: EnemyWindow = {
    id,
    name,
    level,
    className: op.kv.class ?? op.kv.classname ?? null,
    lineage: op.kv.lineage ?? null,
    rarity: op.kv.rarity ?? null,
    floor: num(op.kv.floor) ?? st.world.floor,
    notes: op.kv.note ?? null,
  };
  st.world.enemies[id] = w;
  st.world.lastEnemy = id;
};

setRecordKill((ctx, enemy, level) => {
  const st = ctx.state;
  const id = slug(enemy);
  const known = st.world.enemies[id];
  if (known) known.notes = `${known.notes ? `${known.notes}; ` : ""}killed`;
  const n = findNpc(st, enemy);
  if (n) n.alive = false;
  void level;
});

export interface EnemyView extends EnemyWindow {
  fogged: boolean;
  payByFamiliar: number;
  circleAbove: boolean;
  band: { min: number; max: number };
}

/** The window you see: the Origin sees every enemy's window natively; ordinary Awakened see it fogged. */
export function enemyView(state: GameState, id: string | null): EnemyView | null {
  const e = id ? state.world.enemies[id] : null;
  if (!e) return null;
  const fogged = state.sheet.run === "spread";
  return {
    ...e,
    className: e.className,
    lineage: fogged ? null : e.lineage,
    rarity: fogged ? null : e.rarity,
    fogged,
    payByFamiliar: killXp(e.level, state.sheet.level),
    circleAbove: circleIndex(e.level) > circleIndex(state.sheet.level),
    band: floorBand(e.floor),
  };
}

HANDLERS.thread = (op, ctx) => {
  const w = ctx.state.world;
  const closing = (op.args[0] ?? "").toLowerCase() === "close" || yes(op.kv.close);
  const text = op.kv.text ?? (closing ? op.args.slice(1) : op.args).join(" ").trim();
  if (!text) reject("thread needs text");
  const k = text.toLowerCase();
  const t = w.threads.find((x) => x.text.toLowerCase() === k || x.text.toLowerCase().startsWith(k));
  if (closing) {
    if (!t) reject(`no open thread "${text}"`);
    t.open = false;
    return;
  }
  if (t) t.open = true;
  else w.threads.push({ id: slug(text), text, open: true });
};

// ── offscreen passes: triggered here, written by a background model, applied on replay ──

/** gameOnly: a time skip of at least this many hours wakes the offscreen pass. */
export const OFFSCREEN_HOURS = 12;

setOnTimePassed((ctx, hours) => {
  if (hours >= OFFSCREEN_HOURS) ctx.event("info", `__offscreen:time:${hours}`);
});

setOnFloorChange((ctx, floor) => {
  ctx.event("info", `__offscreen:floor:${floor}`);
  const b = floorBand(floor);
  ctx.event("world", `Floor ${floor}: enemies here run Level ${b.min}–${b.max}; its Guardian sits at the top.`);
});

export interface OffscreenUpdate {
  npc: string;
  text: string;
  kind?: string;
}

/** Fold a background pass's results into the world (keyed to the message that triggered it). */
export function applyOffscreen(ctx: Ctx, updates: OffscreenUpdate[]): void {
  for (const u of updates) {
    const fac = FACTIONS.find((f) => clean(u.npc).replace(/^the /, "") === f.name.toLowerCase().replace(/^the /, "") || clean(u.npc) === f.id);
    if (fac) {
      ctx.note(`Offscreen (${fac.name}): ${u.text}`);
      continue;
    }
    const n = findNpc(ctx.state, u.npc);
    if (!n || !n.alive) continue;
    const kind = (u.kind ?? "news").toLowerCase();
    if (kind === "wound") n.wounds.push(u.text);
    else if (kind === "rank") n.rank = u.text;
    else if (kind === "grudge") n.grudges.push(u.text);
    else if (kind === "death" || kind === "dead") n.alive = false;
    n.news.push(u.text);
  }
}

export function isOffscreenMarker(text: string): boolean {
  return text.startsWith("__offscreen:");
}

export function _forTests() {
  return { parseDuration };
}
