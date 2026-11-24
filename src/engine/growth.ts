// Phase 4 — Growth. Mastery, Branches (set, earned, rolled, cross-Pillar), Pillars opening,
// Gifts and Borrowed Traits, tether arts, Resonance, familiar levels, and one growth path per
// familiar kind. Fuel crosses a line → the card glows "ready" → you trigger it in the story →
// the narrator confirms with evolve. Nothing evolves on its own.

import {
  artDef,
  ELEMENTAL_CORES,
  ESSENCE_GRADES,
  FLOOR_FORBIDS,
  masteryCap,
  masteryName,
  levelsPerBranch,
  PILLARS,
  pillarDef,
  PRACTICE_PCT,
  rarityDef,
  RESONANCE_ORDER,
  SOUL_STAGES,
  soulStage,
  TETHER_ARTS,
  VAMPIRE_RANKS,
  ZOMBIE_GRADES,
} from "../shared/data";
import { killXp, nextThresholdLevel, rate, thresholdsCrossed, xpToNext } from "../shared/math";
import { pick } from "../shared/rng";
import type { Branch, Familiar, GameState, MasteryTier, Resonance, Skill } from "../shared/types";
import { clean, type Ctx, isSelf, needFam, reject } from "./context";
import { derive } from "./derive";
import { addLevelUpHook, addSetupHook } from "./growth-hooks";
import { blankFamiliar, famBaseAttrs, HANDLERS, parseAttrList, setFamKill } from "./ops";
import { num, yes } from "./parse";
import { PLAYER_EVENT_HANDLERS } from "./player-events";
import { hasBranch, makeBranch } from "./state";

// ── shared helpers ────────────────────────────────────────────────────

export function openPillars(state: GameState): string[] {
  return Object.entries(state.sheet.pillars)
    .filter(([, p]) => p.status === "open")
    .map(([id]) => id);
}

export function artsLearned(state: GameState): number {
  return Object.values(state.sheet.arts).filter((v) => v === "learned").length;
}

/** One tether art per Threshold crossed. */
export function artSlots(state: GameState): number {
  return Math.max(0, thresholdsCrossed(state.sheet.level) - artsLearned(state));
}

export function branchSlots(state: GameState): number {
  return Math.max(0, Math.floor(state.sheet.branchProgress) - state.sheet.branchesEarned);
}

/** Borrowed Trait slots: one per Threshold, from Level 15 (Beast Taming's Gift). */
export function borrowedSlots(state: GameState): number {
  if (!state.sheet.gifts.some((g) => g.pillar === "beast")) return 0;
  return Math.max(0, thresholdsCrossed(state.sheet.level));
}

/** Pairs of open Pillars that both reach Mid Mastery: their Branches carry between them. */
export function crossPairs(state: GameState): [string, string][] {
  const mid = openPillars(state).filter((p) => state.sheet.branches.some((b) => b.pillar === p && b.tier >= 2));
  const out: [string, string][] = [];
  for (let i = 0; i < mid.length; i++) for (let j = i + 1; j < mid.length; j++) out.push([mid[i], mid[j]]);
  return out;
}

function findBranch(state: GameState, name: string | undefined, pillar?: string): Branch | undefined {
  if (!name) return undefined;
  const k = clean(name);
  return state.sheet.branches.find((b) => b.name.toLowerCase() === k && (!pillar || b.pillar === pillar)) ?? state.sheet.branches.find((b) => b.name.toLowerCase() === k);
}

/** Add practice to a mastery track; tiers advance at 100% up to the cap for your level. */
function addMastery(ctx: Ctx, track: { tier: MasteryTier; pct: number }, label: string, amount: number): void {
  const cap = masteryCap(ctx.state.sheet.level);
  track.pct += amount / (track.tier + 1);
  while (track.pct >= 100) {
    if (track.tier >= cap || track.tier >= 4) {
      track.pct = 100;
      ctx.note(`${label} is capped at ${masteryName(track.tier)} until you climb higher.`);
      return;
    }
    track.pct -= 100;
    track.tier = (track.tier + 1) as MasteryTier;
    ctx.event("info", `Mastery: ${label} reaches ${masteryName(track.tier)}.`, track.tier >= 2);
  }
  track.pct = Math.round(track.pct * 10) / 10;
}

// ── readiness: fuel crosses a line, the card glows ────────────────────

export function checkReady(ctx: Ctx, f: Familiar): void {
  if (f.state === "lost" || f.state === "released") return;
  const before = f.ready?.label ?? null;
  f.ready = readiness(ctx.state, f);
  if (f.ready && f.ready.label !== before) ctx.event("ready", `${f.name} is ready to change: ${f.ready.label}. Trigger it in the story when you choose.`);
}

function nextOf<T extends { id: string }>(list: T[], id: string | null): T | undefined {
  const i = list.findIndex((x) => x.id === id);
  return list[i + 1];
}

export function readiness(state: GameState, f: Familiar): Familiar["ready"] {
  if (f.kind === "beast") {
    const next = nextOf(SOUL_STAGES, f.stage ?? "nascent");
    if (!next) return null;
    const res = RESONANCE_ORDER.indexOf(f.resonance);
    if (f.level < next.readyAt) return null;
    if (SOUL_STAGES.indexOf(next) >= 2 && res < RESONANCE_ORDER.indexOf("steady")) return null;
    return { label: `${next.name} Soul Stage (${next.tether} tethers${next.gameOnly ? ", game-only" : ""})`, options: ["bigger monstrous form", "humanoid shifter form"] };
  }
  if (f.kind === "elemental") {
    const next = nextOf(ELEMENTAL_CORES, f.stage ?? "plain");
    if (!next) return null;
    const tier = state.sheet.branches.find((b) => b.pillar === "elemental" && b.name.toLowerCase() === (f.element ?? "").toLowerCase())?.tier ?? 0;
    if ((f.fuel.forge ?? 0) < next.forged) return null;
    if (next.id === "true" && tier < 3) return null;
    return { label: next.name, options: next.id === "true" ? ["commands its element", "humanoid and sentient"] : [] };
  }
  if (f.kind === "zombie") {
    const next = nextOf(ZOMBIE_GRADES, f.stage ?? "cracked");
    if (!next || (f.fuel.cores ?? 0) < next.cores) return null;
    return { label: next.name, options: ["a mutation of its own", "more of what it was"] };
  }
  if (f.kind === "skeleton" || f.kind === "spirit") {
    const next = nextOf(ESSENCE_GRADES, f.stage ?? "raw");
    if (!next || (f.fuel.essence ?? 0) < next.essence) return null;
    return { label: `${next.name} ${f.kind}`, options: [] };
  }
  return null;
}

// ── familiar levels: minded familiars climb the same Circles ──────────

export function famGainXp(ctx: Ctx, f: Familiar, amount: number): void {
  if (!f.minded || amount <= 0) return;
  f.xp += amount;
  let guard = 0;
  while (f.xp >= xpToNext(f.level) && guard++ < 200) {
    f.xp -= xpToNext(f.level);
    f.level += 1;
    const r = rate(f.level);
    f.unspent += r;
    ctx.event("level", `${f.name} reaches Level ${f.level} (+${r} attribute point${r === 1 ? "" : "s"} to place).`);
  }
  checkReady(ctx, f);
}

setFamKill((ctx, f, enemyLevel) => famGainXp(ctx, f, killXp(enemyLevel, Math.max(1, f.level))));

// A familiar bound at a high level may already be ready to change.
for (const verb of ["form", "bind", "raise", "make"]) {
  const base = HANDLERS[verb];
  HANDLERS[verb] = (op, ctx) => {
    const before = ctx.state.roster.length;
    base(op, ctx);
    if (ctx.state.roster.length > before) checkReady(ctx, ctx.state.roster[ctx.state.roster.length - 1]);
  };
}

// ── level-up reactions ────────────────────────────────────────────────

addLevelUpHook((ctx, from, to) => {
  const st = ctx.state;
  const s = st.sheet;
  if (thresholdsCrossed(to) > thresholdsCrossed(from)) {
    ctx.event("art_unlock", `A tether art can be learned (one per Threshold crossed; ${artSlots(st)} open). It's learned in a story moment that fits.`);
  }
  const before = Math.floor(s.branchProgress);
  s.branchProgress += 1 / levelsPerBranch(s.run, s.rarity, openPillars(st).length);
  if (Math.floor(s.branchProgress) > before) {
    if (s.run === "spread") rollBranch(ctx);
    else ctx.event("branch_slot", "A Branch slot opens: when you earn a new Branch in the story, the narrator can name it.");
  }
  if (from < 15 && to >= 15) {
    grantGifts(ctx);
    if (s.run !== "spread") ctx.event("info", "Bond Feedback wakes: your closest familiars now make you stronger.", true);
  }
});

addSetupHook((ctx) => {
  if (ctx.state.sheet.level >= 15) grantGifts(ctx);
});

/** The spread: new Branches arrive at the rarity's pace, rolled from the Pillars you hold. */
function rollBranch(ctx: Ctx): void {
  const st = ctx.state;
  const s = st.sheet;
  const pool = openPillars(st).flatMap((p) => (pillarDef(p)?.branches ?? []).filter((b) => !hasBranch(s, p, b)).map((b) => ({ p, b })));
  if (!pool.length) {
    ctx.event("branch_slot", "A Branch slot opens, but your set Branches are all open: the narrator names a new one born from how you play.");
    return;
  }
  const choice = pick(`${ctx.seed}:rollbranch:${s.level}`, pool);
  s.branches.push(makeBranch(choice.p, choice.b, "rolled", s.level));
  s.branchesEarned += 1;
  ctx.event("branch_rolled", `New Branch: ${choice.b} (${pillarDef(choice.p)?.name}), at No Mastery.`, true);
}

function grantGifts(ctx: Ctx): void {
  const s = ctx.state.sheet;
  for (const id of openPillars(ctx.state)) {
    if (s.gifts.some((g) => g.pillar === id)) continue;
    const p = pillarDef(id);
    if (p?.gift) {
      s.gifts.push({ pillar: id, name: p.gift.name, desc: p.gift.desc });
      ctx.event("gift", `Gift of ${p.name}: ${p.gift.name} — ${p.gift.desc}.`, true);
    } else if (p) ctx.event("gift", `A Gift of ${p.name} is due: the narrator sets it when it shows (gift pillar=${id} name="..." desc="...").`);
  }
}

// ── ops ───────────────────────────────────────────────────────────────

HANDLERS.practice = (op, ctx) => {
  const s = ctx.state.sheet;
  const amountKey = (op.kv.amount ?? op.args.find((a) => PRACTICE_PCT[a.toLowerCase()] != null) ?? "light").toLowerCase();
  const amount = PRACTICE_PCT[amountKey];
  if (amount == null) reject("amount is light, solid, intense or breakthrough");
  const b = findBranch(ctx.state, op.kv.branch ?? op.args[0], op.kv.pillar ? pillarDef(op.kv.pillar)?.id : undefined);
  if (!b) reject(`no open Branch called "${op.kv.branch ?? op.args[0] ?? ""}"`);
  if (op.kv.skill) {
    const sk = b.skills.find((k) => k.name.toLowerCase() === clean(op.kv.skill));
    if (!sk) reject(`${b.name} has no skill "${op.kv.skill}" (add it with: skill branch="${b.name}" name="...")`);
    addMastery(ctx, sk, `${sk.name} (${b.name})`, amount);
  } else addMastery(ctx, b, b.name, amount);
  for (const f of ctx.state.roster) if (f.kind === "elemental" && f.element?.toLowerCase() === b.name.toLowerCase()) checkReady(ctx, f);
  void s;
};

HANDLERS.skill = (op, ctx) => {
  const b = findBranch(ctx.state, op.kv.branch ?? op.args[0]);
  const name = op.kv.name ?? op.args[1];
  if (!b) reject(`no open Branch called "${op.kv.branch ?? op.args[0] ?? ""}"`);
  if (!name) reject('skill needs name="..."');
  if (b.skills.some((k) => k.name.toLowerCase() === name.toLowerCase())) reject(`${b.name} already has ${name}`);
  const sk: Skill = { name, tier: 0, pct: 0 };
  b.skills.push(sk);
  ctx.event("info", `New skill in ${b.name}: ${name} (No Mastery).`);
};

HANDLERS.branch = (op, ctx) => {
  const st = ctx.state;
  const s = st.sheet;
  const name = op.kv.name ?? op.args[0];
  if (!name) reject('branch needs name="..."');
  const crossRaw = op.kv.cross ?? op.kv.pillars;
  if (crossRaw) {
    const ids = crossRaw.split(/[,+&/ ]+/).map((x) => pillarDef(x)?.id).filter((x): x is string => !!x);
    if (ids.length !== 2) reject("cross= names two Pillars (cross=elemental,necromancy)");
    const ok = crossPairs(st).some(([a, b]) => (a === ids[0] && b === ids[1]) || (a === ids[1] && b === ids[0]));
    if (!ok) reject(`cross-Pillar Branches need both ${pillarDef(ids[0])?.name} and ${pillarDef(ids[1])?.name} at Mid Mastery`);
    if (findBranch(st, name)) reject(`${name} is already open`);
    const b = makeBranch(ids[0], name, "cross", s.level);
    b.cross = [ids[0], ids[1]];
    s.branches.push(b);
    ctx.event("info", `Cross-Pillar Branch: ${name} (${pillarDef(ids[0])?.name} × ${pillarDef(ids[1])?.name}). It shows as its own Form option.`, true);
    return;
  }
  const pid = pillarDef(op.kv.pillar)?.id ?? openPillars(st)[0];
  if (!pid || s.pillars[pid]?.status !== "open") reject(`that Pillar isn't open`);
  if (hasBranch(s, pid, name)) reject(`${name} is already open`);
  if (branchSlots(st) < 1) {
    const per = levelsPerBranch(s.run, s.rarity, openPillars(st).length);
    reject(`no Branch slot yet (one every ${Number.isInteger(per) ? per : per.toFixed(1)} levels)`);
  }
  s.branches.push(makeBranch(pid, name, "earned", s.level));
  s.branchesEarned += 1;
  ctx.event("info", `New Branch: ${name} (${pillarDef(pid)?.name}), at No Mastery.`, true);
};

HANDLERS.stir = (op, ctx) => {
  const p = pillarDef(op.kv.pillar ?? op.args[0]);
  if (!p || p.id === "ufm") reject("names no Pillar that can stir");
  const ps = ctx.state.sheet.pillars[p.id];
  if (ps.status === "open") reject(`${p.name} is already open`);
  const warmth = (op.kv.warmth ?? op.args[1] ?? "warm").toLowerCase();
  ps.status = "stirring";
  ps.stir = warmth.startsWith("c") ? "cold" : "warm";
  ctx.event("pillar", `A [???] line trembles ${ps.stir}.`);
};

HANDLERS.open = (op, ctx) => {
  const st = ctx.state;
  const s = st.sheet;
  const p = pillarDef(op.kv.pillar ?? op.args[0]);
  if (!p) reject("names no Pillar");
  if (p.id === "ufm") reject("Ultimate Familiar Mastery is the capstone; it doesn't open like the others");
  const ps = s.pillars[p.id];
  if (ps.status === "open") reject(`${p.name} is already open`);
  if (s.run === "spread") {
    const max = rarityDef(s.rarity)?.maxPillars ?? 1;
    if (openPillars(st).length >= max) reject(`a ${s.rarity ?? ""} class holds at most ${max} Pillar${max === 1 ? "" : "s"}`);
  }
  if (s.run !== "sandbox") {
    if (!p.floors) reject(`${p.name} waits beyond the Tower`);
    const f = st.world.floor;
    if (f < p.floors[0] || f > p.floors[1]) reject(`${p.name} opens on Floor${p.floors[0] === p.floors[1] ? ` ${p.floors[0]}` : `s ${p.floors[0]}–${p.floors[1]}`}, not Floor ${f}`);
    if ((FLOOR_FORBIDS[f] ?? []).includes(p.id)) reject(`Floor ${f}'s Conquest Requirements forbid ${p.name}`);
    if (!op.kv.heart && !op.kv.deed) reject(`say the heart or deed that opened it (heart="..." or deed="...")${p.heart ? `; it needs ${p.heart}` : ""}`);
  }
  const held = openPillars(st).map((id) => pillarDef(id)!.name);
  ps.status = "open";
  ps.stir = null;
  ps.openedAtLevel = s.level;
  const first = op.kv.branch ?? p.branches[0] ?? "First Branch";
  if (!hasBranch(s, p.id, first)) s.branches.push(makeBranch(p.id, first, "set", s.level));
  ctx.event("pillar", `PILLAR OPENED: ${p.name}, with the ${first} Branch.${held.length ? ` Crossover into ${held.join(", ")}: your old familiars get better, not shelved.` : ""}`, true);
  if (s.level >= 15) grantGifts(ctx);
};

HANDLERS.resonance = (op, ctx) => {
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  if (!f.minded) reject(`${f.name} has no mind: no Resonance`);
  const dir = (op.args[1] ?? op.kv.to ?? "up").toLowerCase();
  const i = RESONANCE_ORDER.indexOf(f.resonance);
  let next: Resonance;
  if (dir === "up" || dir === "+1" || dir === "deepen") next = RESONANCE_ORDER[Math.min(RESONANCE_ORDER.length - 1, i + 1)];
  else if (dir === "down" || dir === "-1") next = RESONANCE_ORDER[Math.max(1, i - 1)];
  else if ((RESONANCE_ORDER as string[]).includes(dir) && dir !== "none") next = dir as Resonance;
  else reject("resonance is up, down, or faint/steady/deep/kindred/soulbound");
  if (Math.abs(RESONANCE_ORDER.indexOf(next) - i) > 1) reject("Resonance moves one step at a time");
  if (next === f.resonance) reject(`${f.name} is already ${next}`);
  f.resonance = next;
  ctx.event("info", `Resonance with ${f.name}: ${next}.`);
  checkReady(ctx, f);
};

HANDLERS.evolve = (op, ctx) => {
  const st = ctx.state;
  const f = needFam(st, op.args[0] ?? op.kv.name);
  const ready = readiness(st, f);
  if (!ready) reject(`${f.name} isn't ready to change yet`);
  const path = op.kv.path ?? op.kv.form ?? op.args[1] ?? null;
  if (ready.options.length && path && !ready.options.some((o) => o.toLowerCase().includes(path.toLowerCase()) || path.toLowerCase().includes(o.split(" ")[1] ?? o))) {
    reject(`choose one of: ${ready.options.join(" / ")}`);
  }
  if (f.kind === "beast") {
    const next = nextOf(SOUL_STAGES, f.stage ?? "nascent")!;
    const extra = next.tether - f.tether;
    if (f.state === "active" && extra > derive(st).tethersFree) reject(`${next.name} costs ${next.tether} tethers; you'd need ${extra} more free`);
    f.stage = next.id;
    f.tether = next.tether;
  } else if (f.kind === "elemental") f.stage = nextOf(ELEMENTAL_CORES, f.stage ?? "plain")!.id;
  else if (f.kind === "zombie") f.stage = nextOf(ZOMBIE_GRADES, f.stage ?? "cracked")!.id;
  else if (f.kind === "skeleton" || f.kind === "spirit") f.stage = nextOf(ESSENCE_GRADES, f.stage ?? "raw")!.id;
  if (path) {
    const chosen = ready.options.find((o) => o.toLowerCase().includes(path.toLowerCase())) ?? path;
    f.path = chosen;
    if (chosen.includes("shifter")) f.form = "shifter";
  }
  f.ready = null;
  ctx.event("ready", `${f.name} changes: ${ready.label}${f.path ? ` — ${f.path}` : ""}.`, true);
  checkReady(ctx, f);
};

HANDLERS.art = (op, ctx) => {
  const s = ctx.state.sheet;
  const a = artDef(op.kv.name ?? op.args.join(" "));
  if (!a) reject(`unknown tether art (${TETHER_ARTS.map((x) => x.name).join(", ")})`);
  if (s.arts[a.id] === "learned") reject(`${a.name} is already learned`);
  if (artSlots(ctx.state) < 1) reject(`no tether art to learn yet (one per Threshold crossed; next at Level ${nextThresholdLevel(s.level)})`);
  s.arts[a.id] = "learned";
  ctx.event("art_unlock", `Tether art learned: ${a.name} — ${a.desc}.`, true);
};

HANDLERS.gift = (op, ctx) => {
  const s = ctx.state.sheet;
  const p = pillarDef(op.kv.pillar ?? op.args[0]);
  if (!p || s.pillars[p.id]?.status !== "open") reject("Gifts come from open Pillars");
  if (s.level < 15) reject("Gifts come from Level 15");
  if (s.gifts.some((g) => g.pillar === p.id)) reject(`${p.name} has already given its Gift`);
  const name = op.kv.name ?? op.args[1];
  if (!name) reject('gift needs name="..."');
  s.gifts.push({ pillar: p.id, name, desc: op.kv.desc ?? "" });
  ctx.event("gift", `Gift of ${p.name}: ${name}${op.kv.desc ? ` — ${op.kv.desc}` : ""}.`, true);
};

HANDLERS.trait = (op, ctx) => {
  const st = ctx.state;
  const f = needFam(st, op.args[0] ?? op.kv.from);
  const trait = op.kv.trait ?? op.args[1];
  if (!trait) reject("names no trait");
  if (!st.sheet.gifts.some((g) => g.pillar === "beast")) reject("Borrowed Traits are Beast Taming's Gift (from Level 15)");
  if (f.kind !== "beast") reject("traits are borrowed from tamed beasts");
  if (RESONANCE_ORDER.indexOf(f.resonance) < RESONANCE_ORDER.indexOf("deep")) reject(`borrowing needs Deep Resonance (${f.name} is ${f.resonance})`);
  if (st.sheet.borrowed.length >= borrowedSlots(st)) reject(`no free Borrowed Trait slot (one per Threshold: ${borrowedSlots(st)})`);
  st.sheet.borrowed.push({ familiarId: f.id, trait });
  if (!f.traits.includes(trait)) f.traits.push(trait);
  ctx.event("info", `Borrowed Trait: ${trait} from ${f.name}, at reduced strength.`);
};

HANDLERS.eat = (op, ctx) => {
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  if (f.kind !== "zombie") reject(`${f.name} doesn't grow by eating cores`);
  const n = Math.max(1, num(op.kv.cores ?? op.args[1]) ?? 1);
  f.fuel.cores = (f.fuel.cores ?? 0) + n;
  checkReady(ctx, f);
};

HANDLERS.forge = (op, ctx) => {
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  if (f.kind !== "elemental") reject("Core Forging is for elementals");
  const n = yes(op.kv.mineral) || /mineral/i.test(op.kv.core ?? "") ? 3 : 1;
  f.fuel.forge = (f.fuel.forge ?? 0) + n;
  if (op.kv.core) f.material = f.material ?? op.kv.core;
  checkReady(ctx, f);
};

HANDLERS.essence = (op, ctx) => {
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  if (f.kind !== "skeleton" && f.kind !== "spirit") reject("essence feeds skeletons and spirits");
  const amt = { light: 1, solid: 2, intense: 4, breakthrough: 8 }[(op.kv.amount ?? op.args[1] ?? "light").toLowerCase() as "light"] ?? 1;
  f.fuel.essence = (f.fuel.essence ?? 0) + amt;
  checkReady(ctx, f);
};

HANDLERS.mutate = (op, ctx) => {
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  if (f.kind !== "zombie") reject("mutations are the zombies' own");
  const m = op.kv.mutation ?? op.args[1];
  if (!m) reject("names no mutation");
  f.mutations.push(m);
};

HANDLERS.echo = (op, ctx) => {
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  if (f.kind !== "spirit") reject("only spirits keep Echoes");
  const e = op.kv.skill ?? op.args[1];
  if (!e) reject("names no Echo");
  f.echoes.push(e);
};

/** Blood Bonding: turn someone. Turned by you = Progenitor; by one of your vampires = one rank below it. */
HANDLERS.turn = (op, ctx) => {
  const st = ctx.state;
  if (st.sheet.pillars.blood?.status !== "open") reject("Blood Bonding isn't open");
  if ((FLOOR_FORBIDS[st.world.floor] ?? []).includes("blood")) reject(`Floor ${st.world.floor}'s Conquest Requirements forbid Blood Bonding`);
  const name = op.kv.name ?? op.args[0];
  if (!name) reject('turn needs name="..."');
  const by = op.kv.by ?? "you";
  let rank = VAMPIRE_RANKS[0];
  if (!isSelf(st, by)) {
    const sire = needFam(st, by);
    if (sire.kind !== "vampire") reject(`${sire.name} is no vampire`);
    rank = VAMPIRE_RANKS[Math.min(VAMPIRE_RANKS.length - 1, VAMPIRE_RANKS.indexOf(sire.stage ?? "Progenitor") + 1)];
  }
  const tether = { Progenitor: 3, Pure: 2, Royal: 2 }[rank as "Pure"] ?? 1;
  if (tether > derive(st).tethersFree) reject(`a ${rank} vampire needs ${tether} tether(s)`);
  st.famSeq += 1;
  const f: Familiar = {
    ...blankFamiliar(),
    id: `f${st.famSeq}`,
    name,
    pillar: "blood",
    kind: "vampire",
    form: "vampire",
    people: op.kv.people ?? null,
    species: op.kv.species ?? null,
    tether,
    minded: true,
    level: Math.max(1, num(op.kv.level) ?? 1),
    attrs: famBaseAttrs(parseAttrList(op.kv.strong)),
    feeds: parseAttrList(op.kv.strong),
    resonance: "faint",
    stage: rank,
    floor: st.world.floor,
    traits: op.kv.bloodline ? [`Bloodline: ${op.kv.bloodline}`] : [],
  };
  st.roster.push(f);
  ctx.event("info", `${name} rises as a vampire: ${rank}${isSelf(st, by) ? " (turned by you)" : ""}.`);
};

HANDLERS.ride = (op, ctx) => {
  const s = ctx.state.sheet;
  if (s.arts.vessel_riding !== "learned") reject("riding a familiar needs the tether art Vessel Riding");
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  if (f.state !== "active") reject(`${f.name} is ${f.state}`);
  s.hand = f.id;
  s.riding = true;
};

HANDLERS.soul = (op, ctx) => {
  if (ctx.state.sheet.arts.soul_menagerie !== "learned") reject("carrying familiars in your soul needs the tether art Soul Menagerie");
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  if (f.state !== "active") reject(`${f.name} is ${f.state}`);
  f.state = "soul";
  f.order = null;
  if (ctx.state.sheet.hand === f.id) ctx.state.sheet.hand = null;
};

HANDLERS.call = (op, ctx) => {
  const st = ctx.state;
  const f = needFam(st, op.args[0] ?? op.kv.name);
  if (f.state === "active") reject(`${f.name} is already here`);
  if (f.state === "soul") {
    f.state = "active";
    return;
  }
  if (st.sheet.arts.gatecalling !== "learned") reject("summoning from afar needs the tether art Gatecalling");
  if (f.tether > derive(st).tethersFree) reject(`calling ${f.name} needs ${f.tether} tether(s)`);
  f.state = "active";
  f.place = st.world.place;
  f.floor = st.world.floor;
};

// ── player events: a minded familiar's own attribute window ───────────

PLAYER_EVENT_HANDLERS.fam_alloc = (ev, ctx) => {
  const f = ctx.state.roster.find((x) => x.id === ev.data?.famId);
  if (!f?.attrs) reject("that familiar has no attribute window");
  const pts = ev.data?.points ?? {};
  let total = 0;
  for (const k of Object.keys(f.attrs) as (keyof typeof f.attrs)[]) total += Math.max(0, Math.floor(pts[k] ?? 0));
  if (total === 0) reject("no points placed");
  if (total > f.unspent) reject(`${f.name} has only ${f.unspent} point(s)`);
  for (const k of Object.keys(f.attrs) as (keyof typeof f.attrs)[]) f.attrs[k] += Math.max(0, Math.floor(pts[k] ?? 0));
  f.unspent -= total;
};

export { PILLARS };
