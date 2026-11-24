import { beforeAll, describe, expect, test } from "bun:test";
import { installFakeSpindle, settle } from "./fake-spindle";
import { setupEvent } from "./helpers";

const fake = installFakeSpindle();
const CHAT = "chat-world";

beforeAll(async () => {
  fake.files.set("chats/chat-world/player.json", { version: 1, enabled: true, runHint: "origin", events: [setupEvent()], pending: [], issued: {}, squads: [], suggestions: {}, offscreen: {}, voices: {} });
  fake.chats.set(CHAT, [
    { id: "a0", role: "assistant", swipes: ['Halvard watches.\n<ufm>\nnpc name="Halvard" faction="The Staff" voice="clipped, dry" goal="find the golem-maker"\nlearn who="Halvard" fact="raises golems from stone" via=seen\n</ufm>'], swipe_id: 0 },
  ]);
  await import("../src/backend");
  await settle(50);
  await fake.front({ type: "hello", chatId: CHAT });
});

const lastState = () => [...fake.sent].reverse().find((m) => m.type === "state" && m.chatId === CHAT)?.view;

describe("living world through the backend", () => {
  test("the World view carries heat, the ledger and people", () => {
    const w = lastState().extras.world;
    expect(w.heat.find((x: any) => x.id === "staff").heat).toBe(3);
    expect(w.whoKnows[0].holders[0]).toEqual({ name: "Halvard", alive: true, faction: "staff" });
    expect(w.npcs[0].voice).toBe("clipped, dry");
  });

  test("a time skip runs the offscreen pass; Halvard comes back changed", async () => {
    await fake.front({ type: "settings_set", chatId: CHAT, patch: { offscreen: { enabled: true, connectionId: null }, cutaways: true, check: { enabled: false, mode: "quiet", connectionId: null } } });
    fake.spindle.generate.quiet = async (input: any) => {
      fake.generated.push(input);
      return { content: '[{"npc":"Halvard","kind":"rank","text":"promoted to warden-captain"},{"npc":"Nobody","text":"ignored"}]' };
    };
    const before = fake.generated.length;
    const reply = "Three days pass in the dark of the mine.\n<ufm>\ntime +3d\n</ufm>";
    fake.chats.get(CHAT)!.push({ id: "a1", role: "assistant", swipes: [reply], swipe_id: 0 });
    await fake.emit("GENERATION_ENDED", { chatId: CHAT, messageId: "a1", content: reply });
    await settle(600);
    expect(fake.generated.length).toBe(before + 1);
    expect(fake.generated.at(-1).messages[1].content).toContain("Halvard (The Staff)");
    const n = lastState().extras.world.npcs.find((x: any) => x.name === "Halvard");
    expect(n.rank).toBe("promoted to warden-captain");
    expect(n.news).toEqual(["promoted to warden-captain"]);
  });

  test("when Halvard is in the scene, the prompt carries his voice, what he knows and what changed", async () => {
    fake.chats.get(CHAT)!.push({ id: "u2", role: "user", swipes: ["Halvard is at the door."], swipe_id: 0 });
    const prompt = [
      { role: "system", content: "Tower <ufm>" },
      { role: "assistant", content: "Three days pass.", __isChatHistory: true, sourceMessageId: "a1" },
      { role: "user", content: "Halvard is at the door.", __isChatHistory: true, sourceMessageId: "u2" },
    ];
    const out = await fake.interceptor(prompt, { chatId: CHAT, generationType: "normal", isDryRun: true });
    const sys = out.messages.find((m: any) => String(m.content).includes("[UFM SYSTEM]")).content;
    expect(sys).toContain("- Halvard: voice: clipped, dry");
    expect(sys).toContain("knows about {{user}}: raises golems from stone");
    expect(sys).toContain('CHANGED since last seen: promoted to warden-captain — show it, then write npc "Halvard" seen=yes');
    expect(sys).toContain("<ufm-cutaway");
  });
});
