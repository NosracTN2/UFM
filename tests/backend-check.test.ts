import { beforeAll, describe, expect, test } from "bun:test";
import { installFakeSpindle, settle } from "./fake-spindle";
import { setupEvent } from "./helpers";

const fake = installFakeSpindle();
const CHAT = "chat-check";

beforeAll(async () => {
  fake.files.set("chats/chat-check/player.json", { version: 1, enabled: true, runHint: "origin", events: [setupEvent()], pending: [], issued: {}, squads: [], suggestions: {}, offscreen: {}, voices: {} });
  fake.chats.set(CHAT, [{ id: "u1", role: "user", swipes: ["Make two puppets."], swipe_id: 0 }]);
  await import("../src/backend");
  await settle(50);
});

const lastState = () => [...fake.sent].reverse().find((m) => m.type === "state" && m.chatId === CHAT)?.view;

describe("second-model rule check", () => {
  test("settings toggle the check", async () => {
    await fake.front({ type: "settings_set", chatId: CHAT, patch: { check: { enabled: true, mode: "quiet", connectionId: null } } });
    const s = [...fake.sent].reverse().find((m) => m.type === "settings").settings;
    expect(s.check.enabled).toBe(true);
    expect(s.narrowTether).toBe(true);
  });

  test("a fresh reply is checked; a missed change becomes a suggestion, not a change", async () => {
    fake.spindle.generate.quiet = async (input: any) => {
      fake.generated.push(input);
      return { content: '[{"op":"lose \\"Grit\\"","why":"Grit crumbles in the last paragraph"}]' };
    };
    const reply = 'Two puppets rise. Then Grit crumbles to sand.\n<ufm>\nform name="Pebble" form=puppet\nform name="Grit" form=puppet\n</ufm>';
    fake.chats.get(CHAT)!.push({ id: "a1", role: "assistant", swipes: [reply], swipe_id: 0 });
    await fake.emit("GENERATION_ENDED", { chatId: CHAT, messageId: "a1", content: reply });
    await settle(500);
    expect(fake.generated.length).toBe(1);
    expect(fake.generated[0].messages[1].content).toContain("Grit crumbles");
    const v = lastState();
    expect(v.roster.filter((f: any) => f.state === "active").length).toBe(2);
    expect(v.suggestions[0].items[0].op).toBe('lose "Grit"');
  });

  test("accepting applies the fix as an amendment anchored to that reply", async () => {
    const s = lastState().suggestions[0];
    await fake.front({ type: "suggestion", chatId: CHAT, key: s.key, id: s.items[0].id, action: "accept" });
    const v = lastState();
    expect(v.roster.find((f: any) => f.name === "Grit").state).toBe("lost");
    expect(v.suggestions.length).toBe(0);
  });

  test("the amendment rolls back with its reply", async () => {
    const msgs = fake.chats.get(CHAT)!;
    msgs[1].swipes.push("A different reply.\n<ufm>\nform name=\"Dust\" form=puppet\n</ufm>");
    msgs[1].swipe_id = 1;
    await fake.emit("MESSAGE_SWIPED", { chatId: CHAT, action: "added", swipeId: 1, message: { id: "a1", is_user: false, swipe_id: 1, swipes: msgs[1].swipes, index_in_chat: 1 } });
    await settle(400);
    const v = lastState();
    expect(v.roster.map((f: any) => `${f.name}:${f.state}`)).toEqual(["Dust:active"]);
  });

  test("a manual fix line for the last reply", async () => {
    await fake.front({ type: "amend", chatId: CHAT, lines: 'wound you "scraped palm" heal=1d' });
    expect(lastState().sheet.wounds[0].label).toBe("scraped palm");
  });
});
