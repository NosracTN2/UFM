// Derived numbers: never stored, always computed from the replayed state.

import {
  ATTR_KEYS,
  HP_BASE,
  HP_PER_CON,
  MANA_BASE,
  MANA_PER_INT,
  RESONANCE_SHARE,
  TETHERS_PER_CTL,
} from "../shared/data";
import type { AttrKey, Attrs, Familiar, GameState } from "../shared/types";

export function zeroAttrs(): Attrs {
  return { str: 0, con: 0, agi: 0, dex: 0, int: 0, ctl: 0 };
}

/** Bound familiars still hold their bond (and their tether, unless slumbering). */
export function isBound(f: Familiar): boolean {
  return f.state === "active" || f.state === "slumbering" || f.state === "soul";
}

export function holdsTether(f: Familiar): boolean {
  return f.state === "active" || f.state === "soul";
}

export function bondFeedbackActive(state: GameState): boolean {
  return state.sheet.run !== "spread" && state.sheet.level >= 15;
}

/** Bond Feedback: a share of each bound, minded familiar's attributes flows back, into what it feeds. */
export function bondAttrs(state: GameState): { total: Attrs; by: { id: string; name: string; attrs: Partial<Attrs> }[] } {
  const total = zeroAttrs();
  const by: { id: string; name: string; attrs: Partial<Attrs> }[] = [];
  if (!bondFeedbackActive(state)) return { total, by };
  for (const f of state.roster) {
    if (!isBound(f) || !f.minded || !f.attrs) continue;
    const share = RESONANCE_SHARE[f.resonance] ?? 0;
    if (share <= 0) continue;
    const feeds = f.feeds.length ? f.feeds : topAttrs(f.attrs);
    const part: Partial<Attrs> = {};
    for (const k of feeds) {
      const v = Math.floor(f.attrs[k] * share);
      if (v > 0) {
        part[k] = v;
        total[k] += v;
      }
    }
    if (Object.keys(part).length) by.push({ id: f.id, name: f.name, attrs: part });
  }
  return { total, by };
}

/** The attribute(s) a familiar is best at: what it feeds unless set otherwise. */
export function topAttrs(a: Attrs): AttrKey[] {
  const keys = ATTR_KEYS.filter((k) => k !== "ctl");
  const max = Math.max(...keys.map((k) => a[k]));
  if (max <= 0) return [];
  return keys.filter((k) => a[k] === max).slice(0, 2);
}

export interface Derived {
  own: Attrs;
  bonds: Attrs;
  attrs: Attrs;
  hpMax: number;
  manaMax: number;
  tethersTotal: number;
  tethersUsed: number;
  tethersFree: number;
}

export function derive(state: GameState): Derived {
  const own = state.sheet.attrs;
  const bonds = bondAttrs(state).total;
  const attrs = zeroAttrs();
  for (const k of ATTR_KEYS) attrs[k] = own[k] + bonds[k];
  const hpMax = HP_BASE + attrs.con * HP_PER_CON + state.sheet.hpBonus;
  const manaMax = MANA_BASE + attrs.int * MANA_PER_INT + state.sheet.manaBonus;
  const tethersTotal = attrs.ctl * TETHERS_PER_CTL;
  const tethersUsed = state.roster.filter(holdsTether).reduce((s, f) => s + f.tether, 0);
  return { own, bonds, attrs, hpMax, manaMax, tethersTotal, tethersUsed, tethersFree: tethersTotal - tethersUsed };
}

/** Keep current Health/Mana inside their (possibly changed) maxima. */
export function clampVitals(state: GameState): void {
  const d = derive(state);
  state.sheet.hp = Math.max(0, Math.min(state.sheet.hp, d.hpMax));
  state.sheet.mana = Math.max(0, Math.min(state.sheet.mana, d.manaMax));
}

export function fullRestore(state: GameState): void {
  const d = derive(state);
  state.sheet.hp = d.hpMax;
  state.sheet.mana = d.manaMax;
}
