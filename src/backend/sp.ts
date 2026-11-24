// Access to the backend `spindle` global, read lazily so tests can install a fake.

import type { SpindleAPI } from "lumiverse-spindle-types";

export function sp(): SpindleAPI {
  return (globalThis as unknown as { spindle: SpindleAPI }).spindle;
}

export function can(permission: string): boolean {
  try {
    return sp().permissions.has(permission as never);
  } catch {
    return false;
  }
}

export function hostCap(name: string): boolean {
  try {
    return (sp().host?.capabilities?.[name] ?? 0) >= 1;
  } catch {
    return false;
  }
}

export function log(level: "info" | "warn" | "error", msg: string): void {
  try {
    sp().log[level](`[familiar-ledger] ${msg}`);
  } catch {
    /* logging must never break the game */
  }
}

export function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
