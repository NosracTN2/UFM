// Side effects after a replay (second-model check, offscreen passes...). Later phases register here.

import type { ChatCache } from "./store";

type Hook = (c: ChatCache) => Promise<void> | void;
const hooks: Hook[] = [];

export function onAfterRecompute(h: Hook): void {
  hooks.push(h);
}

export async function afterRecompute(c: ChatCache): Promise<void> {
  for (const h of hooks) {
    try {
      await h(c);
    } catch {
      /* side effects never break the replay */
    }
  }
}
