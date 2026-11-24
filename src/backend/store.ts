// Extension storage: one change log and one player store per chat, plus global settings.
// Storage is the source of truth; chat variables only mirror headline numbers.

import { DEFAULT_SETTINGS, emptyLog, emptyPlayer } from "../engine/replay";
import type { ChatLog, PlayerStore, ReplayResult, Settings } from "../shared/types";
import { errText, log, sp } from "./sp";

export interface ChatCache {
  chatId: string;
  log: ChatLog;
  player: PlayerStore;
  result: ReplayResult | null;
  userId?: string;
  /** Last values mirrored into chat variables. */
  vars: Record<string, string>;
  /** Last processed generation per message (second-model check). */
  checked: Set<string>;
}

const cache = new Map<string, ChatCache>();
let settings: Settings | null = null;

function safe(chatId: string): string {
  return chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function logPath(chatId: string): string {
  return `chats/${safe(chatId)}/log.json`;
}
export function playerPath(chatId: string): string {
  return `chats/${safe(chatId)}/player.json`;
}

export async function loadChat(chatId: string): Promise<ChatCache> {
  const hit = cache.get(chatId);
  if (hit) return hit;
  let lg = emptyLog();
  let pl = emptyPlayer();
  try {
    lg = { ...emptyLog(), ...(await sp().storage.getJson<ChatLog>(logPath(chatId), { fallback: emptyLog() })) };
    pl = { ...emptyPlayer(), ...(await sp().storage.getJson<PlayerStore>(playerPath(chatId), { fallback: emptyPlayer() })) };
  } catch (e) {
    log("warn", `could not read storage for ${chatId}: ${errText(e)}`);
  }
  const c: ChatCache = { chatId, log: lg, player: pl, result: null, vars: {}, checked: new Set() };
  // Another load may have raced us.
  const again = cache.get(chatId);
  if (again) return again;
  cache.set(chatId, c);
  return c;
}

export function peekChat(chatId: string): ChatCache | undefined {
  return cache.get(chatId);
}

export async function saveLog(c: ChatCache): Promise<void> {
  try {
    await sp().storage.setJson(logPath(c.chatId), c.log);
  } catch (e) {
    log("error", `saving log failed: ${errText(e)}`);
  }
}

export async function savePlayer(c: ChatCache): Promise<void> {
  try {
    await sp().storage.setJson(playerPath(c.chatId), c.player);
  } catch (e) {
    log("error", `saving player store failed: ${errText(e)}`);
  }
}

export async function getSettings(): Promise<Settings> {
  if (settings) return settings;
  try {
    const raw = await sp().storage.getJson<Partial<Settings>>("settings.json", { fallback: {} });
    settings = mergeSettings(raw);
  } catch {
    settings = mergeSettings({});
  }
  return settings;
}

export function mergeSettings(raw: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    check: { ...DEFAULT_SETTINGS.check, ...(raw.check ?? {}) },
    offscreen: { ...DEFAULT_SETTINGS.offscreen, ...(raw.offscreen ?? {}) },
    portraits: { ...DEFAULT_SETTINGS.portraits, ...(raw.portraits ?? {}) },
  };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const cur = await getSettings();
  settings = mergeSettings({
    ...cur,
    ...patch,
    check: { ...cur.check, ...(patch.check ?? {}) },
    offscreen: { ...cur.offscreen, ...(patch.offscreen ?? {}) },
    portraits: { ...cur.portraits, ...(patch.portraits ?? {}) },
  });
  await sp().storage.setJson("settings.json", settings);
  return settings;
}

export function allCached(): ChatCache[] {
  return [...cache.values()];
}

export function forgetChat(chatId: string): void {
  cache.delete(chatId);
}
