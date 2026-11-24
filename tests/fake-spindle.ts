// A small in-memory stand-in for the Spindle backend API, enough to drive the real backend modules.

export interface FakeMsg {
  id: string;
  role: "user" | "assistant" | "system";
  swipes: string[];
  swipe_id: number;
}

export function installFakeSpindle(opts: { perms?: string[] } = {}) {
  const files = new Map<string, unknown>();
  const chats = new Map<string, FakeMsg[]>();
  const chatVars = new Map<string, Record<string, string>>();
  const sent: any[] = [];
  const toasts: string[] = [];
  const events = new Map<string, ((p: any, u?: string) => void)[]>();
  let interceptor: any = null;
  const macros = new Map<string, any>();
  let frontendHandler: any = null;
  const perms = new Set(opts.perms ?? ["interceptor", "generation", "chat_mutation", "ui_panels"]);
  const generated: any[] = [];

  const spindle: any = {
    host: { capabilities: {} },
    permissions: { has: (p: string) => perms.has(p), onChanged: () => () => {}, getGranted: async () => [...perms] },
    frontendCapabilities: { declare: () => () => {} },
    log: { info: () => {}, warn: () => {}, error: (m: string) => console.error(m) },
    toast: { success: (m: string) => toasts.push(m), warning: (m: string) => toasts.push(m), error: (m: string) => toasts.push(m), info: (m: string) => toasts.push(m) },
    storage: {
      getJson: async (p: string, o?: { fallback?: unknown }) => (files.has(p) ? structuredClone(files.get(p)) : o?.fallback),
      setJson: async (p: string, v: unknown) => void files.set(p, structuredClone(v)),
      read: async (p: string) => String(files.get(p) ?? ""),
      write: async (p: string, v: string) => void files.set(p, v),
      list: async (prefix = "") => [...files.keys()].filter((k) => k.startsWith(prefix)),
      exists: async (p: string) => files.has(p),
      delete: async (p: string) => void files.delete(p),
    },
    chat: {
      getMessages: async (chatId: string) =>
        (chats.get(chatId) ?? []).map((m, i) => ({
          id: m.id,
          role: m.role,
          is_user: m.role === "user",
          swipe_id: m.swipe_id,
          swipes: m.swipes,
          content: m.swipes[m.swipe_id],
          index_in_chat: i,
        })),
    },
    variables: {
      chat: {
        set: async (chatId: string, k: string, v: string) => {
          const o = chatVars.get(chatId) ?? {};
          o[k] = v;
          chatVars.set(chatId, o);
        },
        get: async (chatId: string, k: string) => chatVars.get(chatId)?.[k] ?? "",
      },
    },
    registerMacro: (def: any) => macros.set(def.name, def),
    updateMacroValue: () => {},
    registerInterceptor: (fn: any) => {
      interceptor = fn;
      return () => {};
    },
    on: (ev: string, fn: any) => {
      if (!events.has(ev)) events.set(ev, []);
      events.get(ev)!.push(fn);
      return () => {};
    },
    onFrontendMessage: (fn: any) => {
      frontendHandler = fn;
      return () => {};
    },
    sendToFrontend: (p: any) => sent.push(p),
    generate: { quiet: async (input: any) => { generated.push(input); return { content: "[]" }; } },
    connections: { list: async () => [] },
    modal: { open: async () => ({ dismissedBy: "user" }) },
  };
  (globalThis as any).spindle = spindle;

  return {
    spindle,
    files,
    chats,
    chatVars,
    sent,
    toasts,
    generated,
    macro: (name: string) => macros.get(name),
    get interceptor() {
      return interceptor;
    },
    emit: async (ev: string, payload: any) => {
      for (const fn of events.get(ev) ?? []) fn(payload, "user1");
      await settle();
    },
    front: async (payload: any) => {
      await frontendHandler(payload, "user1");
      await settle();
    },
    perms,
  };
}

export async function settle(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
