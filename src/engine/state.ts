// Initial state and run setup.

import {
  BASE_ATTRS,
  birthplaceDef,
  floorBand,
  PILLARS,
  pillarDef,
  rarityDef,
  TETHER_ARTS,
} from "../shared/data";
import { rate } from "../shared/math";
import { pick, rollInt, slug } from "../shared/rng";
import type { Branch, GameState, RunType, Sheet, WorldState } from "../shared/types";

export interface SetupData {
  run: RunType;
  name: string;
  birthplace: string; // birthplace id or "custom"
  customBirthplace?: string;
  people?: string;
  floor?: number;
  /** First Pillar (Origin / spread). */
  pillar: string;
  /** spread (Very rare and up) and sandbox (three Pillars open). */
  extraPillars?: string[];
  /** Starting Branch name: a set Branch or one born from the birthplace. */
  branch: string;
  rarity?: string;
  className?: string;
  method: "birthplace" | "random" | "pick" | "preset";
  seed: string;
}

export function emptySheet(): Sheet {
  const pillars: Sheet["pillars"] = {};
  for (const p of PILLARS) pillars[p.id] = { status: "sealed", stir: null, openedAtLevel: null, first: false };
  const arts: Sheet["arts"] = {};
  for (const a of TETHER_ARTS) arts[a.id] = "locked";
  return {
    name: "You",
    className: "Ultimate Familiar Master (Origin)",
    run: "origin",
    rarity: null,
    people: "Human",
    birthplace: "",
    level: 1,
    xp: 0,
    hp: 0,
    mana: 0,
    hpBonus: 0,
    manaBonus: 0,
    attrs: { ...BASE_ATTRS },
    unspent: 0,
    silver: 0,
    items: [],
    wounds: [],
    exhaustion: 0,
    hunger: 0,
    cold: 0,
    pillars,
    branches: [],
    branchesEarned: 0,
    gifts: [],
    borrowed: [],
    arts,
    hand: null,
    riding: false,
    narrow: { pct: 20, spilled: 0 },
  };
}

export function emptyWorld(): WorldState {
  return {
    floor: 1,
    place: "",
    elapsed: 0,
    clocks: { "1": { hours: 8, weather: null } },
    npcs: {},
    facts: [],
    enemies: {},
    lastEnemy: null,
    threads: [],
  };
}

export function initialState(seed: string): GameState {
  const state: GameState = { started: false, seed, sheet: emptySheet(), roster: [], world: emptyWorld(), famSeq: 0 };
  return state;
}

export function makeBranch(pillar: string, name: string, origin: Branch["origin"], level: number): Branch {
  return { id: `${pillar}:${slug(name)}`, pillar, name, tier: 0, pct: 0, skills: [], origin, openedAtLevel: level };
}

export function hasBranch(sheet: Sheet, pillar: string, name: string): boolean {
  return sheet.branches.some((b) => b.pillar === pillar && b.name.toLowerCase() === name.toLowerCase());
}

/** Write the starting sheet for a run. Health and Mana are filled by the caller once derived maxima are known. */
export function applySetup(state: GameState, setup: SetupData): void {
  const sheet = emptySheet();
  const world = emptyWorld();
  const bp = birthplaceDef(setup.birthplace);
  const floor = Math.max(1, Math.round(bp?.floor ?? setup.floor ?? 1));
  const startLevel = floorBand(floor).min;

  sheet.run = setup.run;
  sheet.name = setup.name?.trim() || "You";
  sheet.birthplace = bp?.name ?? (setup.customBirthplace?.trim() || `Floor ${floor}`);
  sheet.people = setup.people?.trim() || bp?.people || "Unknown";
  state.seed = setup.seed || state.seed;

  // Natives grow up at their floor's strength: climb silently to the bottom of the band.
  for (let l = 2; l <= startLevel; l++) {
    const r = rate(l);
    sheet.hpBonus += 10 * r;
    sheet.manaBonus += 5 * r;
    sheet.unspent += r;
  }
  sheet.level = startLevel;

  const first = pillarDef(setup.pillar) ?? pillarDef("elemental")!;
  const extra = (setup.extraPillars ?? []).map((p) => pillarDef(p)).filter((p) => p && p.id !== first.id && p.id !== "ufm") as typeof PILLARS;
  const held = [first, ...extra];
  for (const p of held) {
    sheet.pillars[p.id] = { status: "open", stir: null, openedAtLevel: startLevel, first: p.id === first.id };
  }

  if (setup.run === "spread") {
    const r = rarityDef(setup.rarity) ?? rarityDef("rare")!;
    sheet.rarity = r.name;
    const cls = setup.className?.trim() || first.className;
    sheet.className = `${cls} (${r.name})`;
  } else if (setup.run === "sandbox") {
    sheet.className = "Ultimate Familiar Master (Origin, sandbox)";
  } else {
    sheet.className = "Ultimate Familiar Master (Origin)";
  }

  // One Pillar, one Branch at No Mastery. A higher-floor birthplace starts with more Branches open.
  const startBranch = setup.branch?.trim() || first.branches[0] || "First Branch";
  const isSet = first.branches.some((b) => b.toLowerCase() === startBranch.toLowerCase());
  sheet.branches.push(makeBranch(first.id, startBranch, isSet ? "set" : "birthplace", startLevel));
  for (const p of extra) {
    const b = p.branches[0] ?? "First Branch";
    sheet.branches.push(makeBranch(p.id, b, "set", startLevel));
  }
  const extraBranches = Math.floor(startLevel / 10);
  for (let i = 0; i < extraBranches; i++) {
    const pool = held.flatMap((p) => p.branches.filter((b) => !hasBranch(sheet, p.id, b)).map((b) => ({ p: p.id, b })));
    if (pool.length === 0) break;
    const choice = pick(`${state.seed}:startbranch:${i}`, pool);
    sheet.branches.push(makeBranch(choice.p, choice.b, "starting", startLevel));
  }

  // Narrow tether (Origin runs): a random 10–30% of kill XP reaches you below Level 15.
  sheet.narrow = { pct: rollInt(`${state.seed}:narrow`, 10, 30), spilled: 0 };

  world.floor = floor;
  world.place = sheet.birthplace;
  world.clocks = { [String(floor)]: { hours: 8, weather: null } };
  if (bp?.registryDays && setup.run !== "sandbox") {
    world.threads.push({ id: "registry", text: `Registry clock: ${bp.registryDays} days to present yourself at the Registry`, open: true });
  }

  state.sheet = sheet;
  state.world = world;
  state.roster = [];
  state.famSeq = 0;
  state.started = true;
}
