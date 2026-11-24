import { beforeAll, describe, expect, test } from "bun:test";
import { installFakeSpindle, settle } from "./fake-spindle";

const fake = installFakeSpindle();
const CHAT = "chat-p";
const created: any = { characters: [], books: [], entries: [] };

beforeAll(async () => {
  fake.spindle.characters = { create: async (x: any) => (created.characters.push(x), { id: "c1", ...x }) };
  fake.spindle.world_books = {
    create: async (x: any) => (created.books.push(x), { id: "wb1", ...x }),
    entries: { create: async (id: string, x: any) => (created.entries.push({ id, ...x }), { id: `e${created.entries.length}`, ...x }) },
  };
  fake.toasts.length = 0;
  fake.chats.set(CHAT, [{ id: "g", role: "assistant", swipes: ['<ufm-setup run="spread"></ufm-setup>'], swipe_id: 0 }]);
  await import("../src/backend");
  await settle(50);
});

const lastOf = (type: string) => [...fake.sent].reverse().find((m) => m.type === type && (!m.chatId || m.chatId === CHAT));

describe("setup, orders and squads through the backend", () => {
  test("the greeting's <ufm-setup> marks the chat and its run type", async () => {
    await fake.front({ type: "hello", chatId: CHAT });
    const v = lastOf("state").view;
    expect(v.enabled).toBe(true);
    expect(v.started).toBe(false);
    expect(v.runHint).toBe("spread");
  });

  test("setup writes the starting sheet and queues the Awakening", async () => {
    await fake.front({ type: "setup", chatId: CHAT, setup: { run: "spread", name: "Iri", birthplace: "mining", pillar: "elemental", extraPillars: ["beast"], branch: "Earth", rarity: "veryrare", className: "Stonecaller", method: "pick" } });
    const v = lastOf("state").view;
    expect(v.started).toBe(true);
    expect(v.sheet.className).toBe("Stonecaller (Very rare)");
    expect(v.pillars.filter((p: any) => p.status === "open").map((p: any) => p.id)).toEqual(["elemental", "beast"]);
    expect(v.pending[0].kind).toBe("awakening");
    expect(lastOf("order_line").line).toContain("Awakening");
    expect(v.extras.branchRate).toBe(9); // Very rare: 6 levels per Branch, slowed 1.5x by a second Pillar
  });

  test("a panel action is queued, not applied, and its line goes to the composer", async () => {
    await fake.front({ type: "action", chatId: CHAT, action: { kind: "form", pillar: "elemental", form: "puppet", name: "Pebble", element: "earth" } });
    const v = lastOf("state").view;
    expect(v.roster.length).toBe(0);
    expect(v.pending.map((o: any) => o.kind)).toEqual(["awakening", "form"]);
    const line = lastOf("order_line");
    expect(line.line).toBe("» Form: Puppet Golem of earth named Pebble.");
    await fake.front({ type: "order_inserted", chatId: CHAT, orderId: line.orderId });
  });

  test("an unaffordable action is refused with a toast", async () => {
    const before = fake.toasts.length;
    await fake.front({ type: "action", chatId: CHAT, action: { kind: "form", pillar: "beast", form: "beast", species: "wolf", stage: "sovereign" } });
    expect(fake.toasts.length).toBe(before + 1);
    expect(lastOf("action_refused").reason).toContain("needs 8 tethers");
  });

  test("sending binds queued orders to the user message and injects them; a deleted line cancels its order", async () => {
    const msgs = fake.chats.get(CHAT)!;
    msgs.push({ id: "u1", role: "user", swipes: ["I wake.\n» Awakening: A Floor 1 frontier mining town · Elemental Creation (Earth)."], swipe_id: 0 });
    // The player deleted the Form line from the composer before sending.
    const prompt = [
      { role: "system", content: "Tower. <ufm>" },
      { role: "assistant", content: '<ufm-setup run="spread"></ufm-setup>', __isChatHistory: true, sourceMessageId: "g" },
      { role: "user", content: msgs[1].swipes[0], __isChatHistory: true, sourceMessageId: "u1" },
    ];
    const out = await fake.interceptor(prompt, { chatId: CHAT, generationType: "normal", isDryRun: false });
    const injected = out.messages.find((m: any) => String(m.content).includes("[UFM ORDERS]"));
    expect(injected.content).toContain("AWAKENING");
    expect(injected.content).not.toContain("Pebble");
    await settle(100);
    expect(lastOf("state").view.pending.length).toBe(0);
    // A swipe of the reply re-injects the same issued orders.
    const again = await fake.interceptor(prompt, { chatId: CHAT, generationType: "swipe", isDryRun: false });
    expect(again.messages.some((m: any) => String(m.content).includes("AWAKENING"))).toBe(true);
    // A later turn that doesn't end on that user message does not.
    const later = [...prompt, { role: "assistant", content: "…", __isChatHistory: true, sourceMessageId: "a1" }];
    const cont = await fake.interceptor(later, { chatId: CHAT, generationType: "continue", isDryRun: false });
    expect(cont.messages.some((m: any) => String(m.content).includes("AWAKENING"))).toBe(false);
  });

  test("cancelling a queued order removes it and its composer line", async () => {
    await fake.front({ type: "action", chatId: CHAT, action: { kind: "form", pillar: "elemental", form: "puppet", name: "Grit", element: "earth" } });
    const id = lastOf("state").view.pending[0].id;
    await fake.front({ type: "cancel_order", chatId: CHAT, orderId: id });
    expect(lastOf("state").view.pending.length).toBe(0);
    expect(lastOf("remove_line").line).toContain("Grit");
  });

  test("squads are kept per chat", async () => {
    await fake.front({ type: "squad", chatId: CHAT, op: "create", name: "wall crew" });
    const sq = lastOf("state").view.squads[0];
    expect(sq.name).toBe("wall crew");
    await fake.front({ type: "squad", chatId: CHAT, op: "set", id: sq.id, members: ["f1"] });
    expect(lastOf("state").view.squads[0].members).toEqual(["f1"]);
  });

  test("random first bond: no rerolls unless turned on", async () => {
    await fake.front({ type: "roll", chatId: CHAT, what: "pillar" });
    const first = lastOf("roll");
    expect(first.locked).toBe(true);
    await fake.front({ type: "roll", chatId: CHAT, what: "pillar", reroll: true });
    expect(lastOf("roll").value).toBe(first.value);
  });

  test("one-click narrator card install creates the rules world book and the character", async () => {
    await fake.front({ type: "install_card", chatId: CHAT });
    expect(created.books.length).toBe(1);
    expect(created.entries.length).toBeGreaterThan(10);
    expect(created.characters[0].name).toBe("Ultimate Familiar Mastery");
    expect(created.characters[0].world_book_ids).toEqual(["wb1"]);
    expect(created.characters[0].alternate_greetings.length).toBe(2);
  });
});
