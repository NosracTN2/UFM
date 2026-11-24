// Per-message apply context shared by op handlers.

import type { Familiar, GameEventKind, GameState, MsgResult, Op, Settings } from "../shared/types";

export class Reject extends Error {}

export function reject(reason: string): never {
  throw new Reject(reason);
}

export interface Ctx {
  state: GameState;
  settings: Settings;
  res: MsgResult;
  /** Seed for rolls made by this message. */
  seed: string;
  /** Mana lines in this block already paid by a form line. */
  absorbed: Set<Op>;
  event(kind: GameEventKind, text: string, big?: boolean): void;
  note(text: string): void;
}

export function makeCtx(state: GameState, settings: Settings, res: MsgResult): Ctx {
  return {
    state,
    settings,
    res,
    seed: `${state.seed}:${res.key}`,
    absorbed: new Set(),
    event(kind, text, big) {
      res.events.push({ kind, text, big });
    },
    note(text) {
      res.notes.push(text);
    },
  };
}

const SELF = new Set(["you", "me", "self", "myself", "player", "i", "origin", "master"]);

export function isSelf(state: GameState, ref: string | undefined): boolean {
  if (!ref) return false;
  const k = clean(ref);
  return SELF.has(k) || k === clean(state.sheet.name);
}

export function clean(s: string): string {
  return s.trim().replace(/^["']|["']$/g, "").toLowerCase();
}

/** Resolve a familiar by name or id. Bound familiars win over lost or released ones. */
export function findFam(state: GameState, ref: string | undefined, includeGone = false): Familiar | undefined {
  if (!ref) return undefined;
  const k = clean(ref);
  const pool = state.roster.filter((f) => includeGone || (f.state !== "lost" && f.state !== "released"));
  const ordered = [...pool].sort((a, b) => goneRank(a) - goneRank(b));
  return (
    ordered.find((f) => f.name.toLowerCase() === k) ??
    ordered.find((f) => f.id === k) ??
    uniq(ordered.filter((f) => f.name.toLowerCase().startsWith(k))) ??
    uniq(ordered.filter((f) => k.length >= 3 && f.name.toLowerCase().includes(k)))
  );
}

function goneRank(f: Familiar): number {
  return f.state === "lost" || f.state === "released" ? 1 : 0;
}

function uniq<T>(xs: T[]): T | undefined {
  return xs.length === 1 ? xs[0] : undefined;
}

export function needFam(state: GameState, ref: string | undefined, includeGone = false): Familiar {
  if (!ref) reject("names no familiar");
  const f = findFam(state, ref, includeGone);
  if (!f) {
    const gone = findFam(state, ref, true);
    if (gone) reject(`${gone.name} is ${gone.state}`);
    reject(`no bound familiar named "${ref}"`);
  }
  return f;
}
