// Growth reactions to a level-up; the growth module registers its hooks here.

import type { Ctx } from "./context";

type LevelHook = (ctx: Ctx, from: number, to: number) => void;
const hooks: LevelHook[] = [];

export function addLevelUpHook(h: LevelHook): void {
  hooks.push(h);
}

export function onLevelUp(ctx: Ctx, from: number, to: number): void {
  for (const h of hooks) h(ctx, from, to);
}

type SetupHook = (ctx: Ctx) => void;
const setupHooks: SetupHook[] = [];

/** Runs once after the starting sheet is written (a higher-floor start begins past Level 15). */
export function addSetupHook(h: SetupHook): void {
  setupHooks.push(h);
}

export function onSetup(ctx: Ctx): void {
  for (const h of setupHooks) h(ctx);
}
