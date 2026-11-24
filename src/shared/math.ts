// System math, exactly as written in docs/DESIGN.md ("System math").
// The narrator never does arithmetic; every number in the game comes from here.

/** Points per level (the "rate"). */
export function rate(level: number): number {
  const circle = Math.floor(level / 50); // 0 Stone, 1 Iron, 2 Silver...
  const n = level < 50 ? level : level % 50;
  const step =
    level < 50
      ? n <= 14
        ? 1
        : n <= 24
          ? 2
          : n <= 34
            ? 3
            : n <= 44
              ? 4
              : 5
      : n <= 9
        ? 1
        : n <= 19
          ? 2
          : n <= 29
            ? 3
            : n <= 39
              ? 4
              : 5;
  return step * 10 ** circle;
}

export const xpToNext = (level: number): number => level * 1000 * rate(level);

/** Kill experience: only kills by a bound familiar count (the caller enforces that). */
export function killXp(enemyLevel: number, yourLevel: number): number {
  const gap = enemyLevel - yourLevel;
  const factor = gap >= 0 ? 1 + gap / 10 : Math.max(0, 1 + gap / 10);
  return Math.round((enemyLevel * 100 * rate(enemyLevel) * factor) / 100) * 100;
}

const CIRCLE_NAMES = ["Stone", "Iron", "Silver", "Gold"];

export function circleIndex(level: number): number {
  return Math.floor(level / 50);
}

export function circleName(level: number): string {
  const i = circleIndex(level);
  return CIRCLE_NAMES[i] ?? `Circle ${i + 1} [???]`;
}

/** 1..5 within the Circle: which Threshold band the level sits in. */
export function thresholdStep(level: number): number {
  return rate(level) / 10 ** circleIndex(level);
}

const THRESHOLD_NAMES = ["first Threshold", "second Threshold", "third Threshold", "fourth Threshold", "the Seam"];

export function thresholdName(level: number): string {
  return THRESHOLD_NAMES[thresholdStep(level) - 1];
}

/** "16 · Stone Circle, second Threshold" */
export function levelLabel(level: number): string {
  return `${level} · ${circleName(level)} Circle, ${thresholdName(level)}`;
}

/** How many Threshold lines lie between Level 1 and this level (15 → 1, 25 → 2, 50 → 5). */
export function thresholdsCrossed(level: number): number {
  return circleIndex(level) * 5 + (thresholdStep(level) - 1);
}

/** First level of the band after this one. */
export function nextThresholdLevel(level: number): number {
  let l = level + 1;
  const start = thresholdsCrossed(level);
  while (thresholdsCrossed(l) === start) l++;
  return l;
}

/** Total XP needed to climb from Level 1 to `level` (used for checks and starting sheets). */
export function totalXpTo(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
