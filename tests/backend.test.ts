import { beforeAll, describe, expect, test } from "bun:test";
import { installFakeSpindle, settle } from "./fake-spindle";
import { setupEvent } from "./helpers";

const fake = installFakeSpindle();
const CHAT = "chat-1";

beforeAll(async () => {
  fake.files.set("chats/chat-1/player.json", { version: 1, enabled: true, runHint: "origin", events: [setupEvent()], pending: [], issued: {}, squads: [], suggestions: {}, offscreen: {}, voices: {} });
  fake.chats.set(CHAT, [
    { id: "g", role: "assistant", swipes: ['The Tower stirs. <ufm-setup run="origin"></ufm-setup>'], swipe_id: 0 },
    { id: "u1", role: "user", swipes: ["I press my hand to the stone."], swipe_id: 0 },
    {
      id: "a1",
      role: "assistant",
      swipes: [
        'Stone answers.\n<ufm>\nform name="Pebble" form=puppet element=earth\n</ufm>',
        'Stone answers twice.\n<ufm>\nform name="Grit" form=puppet\nform name="Dust" form=puppet\n</ufm>',
      ],
      swipe_id: 0,
    },
  ]);
  await import("../src/backend");
  await settle(50);
});

function lastState() {
  return [...fake.sent].reverse().find((m) => m.type === "state" && m.chatId === CHAT)?.view;
}

describe("backend with a fake host", () => {
  test("hello syncs the chat from the host and pushes state", async () => {
    await fake.front({ type: "hello", chatId: CHAT });
    const v = lastState();
    expect(v.started).toBe(true);
    expect(v.roster.map((f: any) => f.name)).toEqual(["Pebble"]);
    expect(v.sheet.mana).toBe(30);
  });

  test("headline numbers are mirrored into chat variables", () => {
    const vars = fake.chatVars.get(CHAT)!;
    expect(vars.mana).toBe("30");
    expect(vars.tethers).toBe("1");
    expect(vars.hp).toBe("100");
    expect(vars.level).toBe("1");
  });

  test("swiping replays from the log: the other swipe's familiars replace Pebble", async () => {
    const msgs = fake.chats.get(CHAT)!;
    msgs[2].swipe_id = 1;
    await fake.emit("MESSAGE_SWIPED", { chatId: CHAT, action: "navigated", swipeId: 1, message: { id: "a1", is_user: false, swipe_id: 1, swipes: msgs[2].swipes, index_in_chat: 2 } });
    await settle(300);
    expect(lastState().roster.map((f: any) => f.name)).toEqual(["Grit", "Dust"]);
    expect(fake.chatVars.get(CHAT)!.tethers).toBe("2");
  });

  test("deleting the reply rolls the familiars back", async () => {
    const msgs = fake.chats.get(CHAT)!;
    msgs.splice(2, 1);
    await fake.emit("MESSAGE_DELETED", { chatId: CHAT, messageId: "a1" });
    await settle(300);
    expect(lastState().roster.length).toBe(0);
    expect(fake.chatVars.get(CHAT)!.mana).toBe("35");
  });

  test("the interceptor injects state, orders and the tag reminder before the last user turn", async () => {
    const msgs = fake.chats.get(CHAT)!;
    msgs.push({ id: "a2", role: "assistant", swipes: ['<ufm>\nform name="Shale" form=puppet\norder Shale guard "the shaft"\n</ufm>'], swipe_id: 0 });
    msgs.push({ id: "u2", role: "user", swipes: ["What now?"], swipe_id: 0 });
    await fake.emit("MESSAGE_SENT", { chatId: CHAT, message: { id: "u2", is_user: true, swipe_id: 0, swipes: ["What now?"], index_in_chat: 3 } });
    await settle(300);
    const prompt = [
      { role: "system", content: "You are the Tower. Use <ufm> tags." },
      { role: "assistant", content: "The Tower stirs. <ufm-setup run=\"origin\"></ufm-setup>", __isChatHistory: true, sourceMessageId: "g" },
      { role: "user", content: "I press my hand to the stone.", __isChatHistory: true, sourceMessageId: "u1" },
      { role: "assistant", content: msgs[2].swipes[0], __isChatHistory: true, sourceMessageId: "a2" },
      { role: "user", content: "What now?", __isChatHistory: true, sourceMessageId: "u2" },
    ];
    const out = await fake.interceptor(prompt, { chatId: CHAT, generationType: "normal" });
    const msgsOut = out.messages;
    const injected = msgsOut[msgsOut.length - 2];
    expect(injected.role).toBe("system");
    expect(injected.content).toContain("[UFM STATE]");
    expect(injected.content).toContain("Shale");
    // A Puppet Golem has no mind: the order is rejected, and the narrator is told it didn't happen.
    expect(injected.content).toContain("REJECTED");
    expect(injected.content).toContain('order Shale guard "the shaft" — Shale has no mind');
    expect(injected.content).toContain("[UFM TAG]");
    expect(msgsOut[1].content).not.toContain("ufm-setup");
    expect(msgsOut[msgsOut.length - 1].content).toBe("What now?");
  });

  test("on a swipe, the state excludes the reply being replaced", async () => {
    const prompt = [
      { role: "system", content: "You are the Tower. Use <ufm> tags." },
      { role: "user", content: "I press my hand to the stone.", __isChatHistory: true, sourceMessageId: "u1" },
    ];
    const out = await fake.interceptor(prompt, { chatId: CHAT, generationType: "swipe" });
    const injected = out.messages.find((m: any) => m.role === "system" && String(m.content).includes("[UFM STATE]"));
    expect(injected.content).not.toContain("Shale");
    expect(injected.content).toContain("Mana 35/35");
  });

  test("{{ufm_state}} macro output is replaced in place, not duplicated", async () => {
    const macro = fake.macro("ufm_state");
    const text = await macro.handler({ chatId: CHAT, commit: true });
    expect(text).toContain("[UFM STATE]");
    const prompt = [
      { role: "system", content: `Scenario:\n${text}` },
      { role: "user", content: "What now?", __isChatHistory: true, sourceMessageId: "u2" },
    ];
    const out = await fake.interceptor(prompt, { chatId: CHAT, generationType: "normal" });
    const all = out.messages.map((m: any) => m.content).join("\n");
    expect(all.split("[UFM STATE]").length - 1).toBe(1);
  });

  test("chats that are not Familiar Ledger runs are left alone", async () => {
    const prompt = [{ role: "user", content: "hello", __isChatHistory: true, sourceMessageId: "x" }];
    const out = await fake.interceptor(prompt, { chatId: "other-chat", generationType: "normal" });
    expect(out).toEqual(prompt);
  });
});
