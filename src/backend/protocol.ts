// Messages from the frontend. Panel actions never change state directly: they are queued as
// standing orders (Phase 2); only your own choices (setup, attribute points) are player events.

import { newId } from "../shared/rng";
import type { Anchor, PlayerEvent, Settings } from "../shared/types";
import { can, errText, log, sp } from "./sp";
import { type ChatCache, getSettings, loadChat, savePlayer, saveLog, updateSettings } from "./store";
import { ingestMessage, makeView, recompute, resyncNow, scheduleResync } from "./sync";

export type FrontMsg = { type: string; chatId?: string; [k: string]: any };
type Handler = (msg: FrontMsg, c: ChatCache | null, userId: string) => Promise<void> | void;
const handlers: Record<string, Handler> = {};

export function onFront(type: string, h: Handler): void {
  handlers[type] = h;
}

export function reply(userId: string | undefined, payload: unknown): void {
  try {
    sp().sendToFrontend(payload, userId);
  } catch (e) {
    log("warn", `reply failed: ${errText(e)}`);
  }
}

export function toast(kind: "success" | "warning" | "error" | "info", message: string, userId?: string): void {
  try {
    sp().toast[kind](message, { title: "Familiar Ledger", userId });
  } catch {
    /* ignore */
  }
}

/** Player events hang off the newest message (and its active swipe) so they roll back with it. */
export function latestAnchor(c: ChatCache): Anchor | null {
  const last = [...c.log.messages].sort((a, b) => a.index - b.index).at(-1);
  return last ? { msgId: last.id, swipe: last.swipe } : null;
}

export async function addPlayerEvent(c: ChatCache, kind: PlayerEvent["kind"], data: unknown, anchor: Anchor | null = latestAnchor(c)): Promise<void> {
  c.player.events.push({ id: newId("ev"), anchor, kind, data, ts: Date.now() });
  c.player.enabled = true;
  await savePlayer(c);
  await recompute(c);
}

export async function handleFrontend(payload: unknown, userId: string): Promise<void> {
  const msg = payload as FrontMsg;
  if (!msg || typeof msg.type !== "string") return;
  const h = handlers[msg.type];
  if (!h) return;
  try {
    let c: ChatCache | null = null;
    if (msg.chatId) {
      c = await loadChat(msg.chatId);
      c.userId = userId || c.userId;
    }
    await h(msg, c, userId);
  } catch (e) {
    log("error", `${msg.type} failed: ${errText(e)}`);
    toast("error", `${msg.type}: ${errText(e)}`, userId);
  }
}

// ── Phase 1 handlers ───────────────────────────────────────────────────

onFront("hello", async (msg, c, userId) => {
  reply(userId, { type: "settings", settings: await getSettings() });
  if (c) await resyncNow(c.chatId, true);
});

onFront("get_state", async (msg, c, userId) => {
  if (!c) return;
  if (!c.result) await resyncNow(c.chatId, true);
  const view = makeView(c, await getSettings());
  if (view) reply(userId, { type: "state", chatId: c.chatId, view });
});

/** The frontend saw (and hid) a <ufm> block. With chat_mutation the host read is exact; otherwise fold it in. */
onFront("tag", async (msg, c) => {
  if (!c || !msg.messageId || msg.isUser) return;
  if (can("chat_mutation")) {
    scheduleResync(c.chatId);
    return;
  }
  const known = c.log.messages.find((m) => m.id === msg.messageId);
  const changed = ingestMessage(c.log, { id: msg.messageId, role: "assistant", swipe_id: known?.swipe ?? 0, content: String(msg.full ?? `<ufm>${msg.content ?? ""}</ufm>`) }, false);
  if (changed) {
    await saveLog(c);
    await recompute(c);
  }
});

onFront("setup_tag", async (msg, c) => {
  if (!c) return;
  const run = ["origin", "spread", "sandbox"].includes(msg.run) ? msg.run : "origin";
  if (!c.player.enabled || c.player.runHint !== run) {
    c.player.enabled = true;
    c.player.runHint = run;
    await savePlayer(c);
    await recompute(c);
  }
});

onFront("enable", async (msg, c) => {
  if (!c) return;
  c.player.enabled = msg.enabled !== false;
  await savePlayer(c);
  await recompute(c);
});

onFront("alloc", async (msg, c, userId) => {
  if (!c?.result) return;
  const points = msg.points ?? {};
  const total = Object.values(points).reduce((s: number, v) => s + (Number(v) || 0), 0);
  if (total <= 0) return;
  if (total > c.result.state.sheet.unspent) {
    toast("warning", `Only ${c.result.state.sheet.unspent} point(s) to place.`, userId);
    return;
  }
  await addPlayerEvent(c, "alloc", { points });
});

onFront("settings_get", async (_m, _c, userId) => {
  reply(userId, { type: "settings", settings: await getSettings() });
});

onFront("settings_set", async (msg, c, userId) => {
  const s = await updateSettings((msg.patch ?? {}) as Partial<Settings>);
  reply(userId, { type: "settings", settings: s });
  if (c) await recompute(c);
});
