// Browser harness: the real backend (against the fake host) + the real built frontend in a page
// with a stand-in ctx. Run: bun run build && bun tests/harness/server.ts  → http://localhost:4417
import { installFakeSpindle, settle } from "../fake-spindle";

const fake = installFakeSpindle();
const CHAT = "harness-chat";
fake.chats.set(CHAT, [{ id: "g", role: "assistant", swipes: ['The Tower is quiet tonight.\n<ufm-setup run="origin"></ufm-setup>'], swipe_id: 0 }]);
await import("../../src/backend");

const root = new URL("../../", import.meta.url).pathname;
let msgSeq = 0;

const server = Bun.serve({
  port: Number(process.env.HARNESS_PORT ?? 4417),
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/") return new Response(Bun.file(`${root}tests/harness/harness.html`), { headers: { "content-type": "text/html" } });
    if (url.pathname === "/frontend.js") return new Response(Bun.file(`${root}dist/frontend.js`), { headers: { "content-type": "text/javascript" } });
    if (url.pathname === "/send" && req.method === "POST") {
      await fake.front(await req.json());
      return Response.json({ ok: true });
    }
    if (url.pathname === "/poll") {
      const from = Number(url.searchParams.get("from") ?? 0);
      return Response.json({ next: fake.sent.length, msgs: fake.sent.slice(from), toasts: fake.toasts.slice(-5) });
    }
    if (url.pathname === "/chat") return Response.json(fake.chats.get(CHAT));
    // Simulate the user sending a message and the narrator replying.
    if (url.pathname === "/turn" && req.method === "POST") {
      const { user, reply } = await req.json();
      const msgs = fake.chats.get(CHAT)!;
      if (user) {
        const id = `u${++msgSeq}`;
        msgs.push({ id, role: "user", swipes: [user], swipe_id: 0 });
        await fake.emit("MESSAGE_SENT", { chatId: CHAT, message: { id, is_user: true, swipe_id: 0, swipes: [user], index_in_chat: msgs.length - 1 } });
        // Run the interceptor like a real generation would.
        const prompt = msgs.map((m) => ({ role: m.role, content: m.swipes[m.swipe_id], __isChatHistory: true, sourceMessageId: m.id }));
        const out = await fake.interceptor([{ role: "system", content: "Tower <ufm>" }, ...prompt], { chatId: CHAT, generationType: "normal", isDryRun: false });
        (globalThis as any).__lastPrompt = out;
      }
      if (reply) {
        const id = `a${++msgSeq}`;
        msgs.push({ id, role: "assistant", swipes: [reply], swipe_id: 0 });
        await fake.emit("GENERATION_ENDED", { chatId: CHAT, messageId: id, content: reply });
      }
      await settle(250);
      return Response.json({ ok: true, prompt: (globalThis as any).__lastPrompt });
    }
    return new Response("not found", { status: 404 });
  },
});
console.log(`harness on http://localhost:${server.port}`);
