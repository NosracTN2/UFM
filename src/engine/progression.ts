// XP, level-ups, Threshold and Circle crossings.

import { circleIndex, circleName, fmt, killXp, levelLabel, rate, thresholdName, thresholdsCrossed, xpToNext } from "../shared/math";
import type { Ctx } from "./context";
import { fullRestore } from "./derive";
import { onLevelUp } from "./growth-hooks";

/** Narrow tether applies to Origin runs below Level 15 (a setting you can switch off). */
export function narrowTetherActive(ctx: Ctx): boolean {
  const s = ctx.state.sheet;
  return ctx.settings.narrowTether && s.run !== "spread" && s.level < 15;
}

/** Kill XP for you, after the narrow tether. Returns [reaches you, spilled]. */
export function kill(ctx: Ctx, enemyLevel: number): [number, number] {
  const full = killXp(enemyLevel, ctx.state.sheet.level);
  if (!narrowTetherActive(ctx)) return [full, 0];
  const reach = Math.round((full * ctx.state.sheet.narrow.pct) / 100);
  return [reach, full - reach];
}

export function gainXp(ctx: Ctx, amount: number): void {
  const s = ctx.state.sheet;
  if (amount <= 0) return;
  s.xp += amount;
  let guard = 0;
  while (s.xp >= xpToNext(s.level) && guard++ < 500) {
    s.xp -= xpToNext(s.level);
    levelUp(ctx);
  }
}

export function levelUp(ctx: Ctx): void {
  const s = ctx.state.sheet;
  const from = s.level;
  const to = from + 1;
  const r = rate(to);
  s.level = to;
  s.unspent += r;
  s.hpBonus += 10 * r;
  s.manaBonus += 5 * r;
  fullRestore(ctx.state);
  ctx.event(
    "level",
    `Level ${from} → ${to} (${levelLabel(to)}): +${r} attribute point${r === 1 ? "" : "s"}, +${fmt(10 * r)} max Health, +${fmt(5 * r)} max Mana, full restore.`,
  );
  if (circleIndex(to) > circleIndex(from)) {
    ctx.event(
      "circle",
      `CIRCLE CROSSED: you enter the ${circleName(to)} Circle at Level ${to}. Points per level are now ${r}. This deserves a full System window and a whole explanation scene.`,
      true,
    );
  } else if (thresholdsCrossed(to) > thresholdsCrossed(from)) {
    ctx.event("threshold", `Threshold crossed: Level ${to} opens the ${thresholdName(to)} of the ${circleName(to)} Circle (${r} points per level).`);
  }
  if (from < 15 && to >= 15 && s.run !== "spread" && ctx.settings.narrowTether) {
    ctx.event(
      "reveal",
      `First Threshold reached: the narrow tether is revealed. Below Level 15 only ${s.narrow.pct}% of kill XP reached you; ${fmt(s.narrow.spilled)} XP spilled.`,
      true,
    );
  }
  onLevelUp(ctx, from, to);
}
