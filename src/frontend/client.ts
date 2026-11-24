// Client-side store: the latest view per chat, settings, and which chat is open.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { LedgerView } from "../engine/view";
import type { Settings } from "../shared/types";

type Listener = () => void;

export class Client {
  views = new Map<string, LedgerView>();
  settings: Settings | null = null;
  activeChat: string | null = null;
  private listeners = new Set<Listener>();
  private handlers = new Map<string, ((msg: any) => void)[]>();

  constructor(public ctx: SpindleFrontendContext) {}

  get view(): LedgerView | null {
    return this.activeChat ? (this.views.get(this.activeChat) ?? null) : null;
  }

  send(type: string, data: Record<string, unknown> = {}): void {
    this.ctx.sendToBackend({ type, chatId: this.activeChat ?? undefined, ...data });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (e) {
        console.error("[familiar-ledger] render failed", e);
      }
    }
  }

  on(type: string, fn: (msg: any) => void): void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(fn);
  }

  receive(msg: any): void {
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "state" && msg.chatId && msg.view) {
      this.views.set(msg.chatId, msg.view);
      if (msg.view.settings) this.settings = msg.view.settings;
      if (msg.chatId === this.activeChat) this.notify();
    } else if (msg.type === "settings") {
      this.settings = msg.settings;
      this.notify();
    }
    for (const fn of this.handlers.get(msg.type) ?? []) fn(msg);
  }

  /** Re-read the open chat; ask the backend for its state when it changes. */
  refreshActive(force = false): void {
    let id: string | null = null;
    try {
      id = this.ctx.getActiveChat()?.chatId ?? null;
    } catch {
      id = null;
    }
    if (id !== this.activeChat || force) {
      this.activeChat = id;
      if (id) this.send(this.views.has(id) && !force ? "get_state" : "hello");
      this.notify();
    }
  }
}
