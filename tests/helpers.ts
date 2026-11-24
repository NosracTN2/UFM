import { DEFAULT_SETTINGS, emptyLog, emptyPlayer, replay } from "../src/engine/replay";
import type { SetupData } from "../src/engine/state";
import type { ChatLog, PlayerStore, Settings } from "../src/shared/types";

export function setupEvent(over: Partial<SetupData> = {}) {
  const data: SetupData = {
    run: "origin",
    name: "Tamsin",
    birthplace: "mining",
    pillar: "elemental",
    branch: "Earth",
    method: "preset",
    seed: "test-seed",
    ...over,
  };
  return { id: "setup", anchor: null, kind: "setup" as const, data, ts: 1 };
}

/** Build a chat: each entry is [role, blocks-per-swipe, activeSwipe]. */
export function chat(entries: Array<{ role: "user" | "assistant"; swipes?: string[][]; swipe?: number; id?: string }>): ChatLog {
  const log = emptyLog();
  entries.forEach((e, i) => {
    const id = e.id ?? `m${i}`;
    log.messages.push({ id, role: e.role, swipe: e.swipe ?? 0, index: i });
    if (e.swipes) {
      log.blocks[id] = {};
      e.swipes.forEach((bodies, s) => (log.blocks[id][String(s)] = bodies));
    }
  });
  return log;
}

export function run(log: ChatLog, player?: PlayerStore, settings: Partial<Settings> = {}) {
  const p = player ?? withSetup();
  return replay(log, p, { ...DEFAULT_SETTINGS, ...settings }, { seed: "test-seed" });
}

export function withSetup(over: Partial<SetupData> = {}): PlayerStore {
  const p = emptyPlayer();
  p.events.push(setupEvent(over));
  p.enabled = true;
  return p;
}
