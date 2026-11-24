import { beforeAll, describe, expect, test } from "bun:test";
import { installFakeSpindle, settle } from "./fake-spindle";
import { setupEvent } from "./helpers";

const fake = installFakeSpindle();
const CHAT = "chat-canon";
const books = new Map<string, any>();
const entries = new Map<string, any>();
const chars = new Map<string, any>();
let seq = 0;

beforeAll(async () => {
  fake.spindle.world_books = {
    get: async (id: string) => books.get(id) ?? null,
    list: async () => ({ data: [...books.values()], total: books.size }),
    create: async (x: any) => {
      const b = { id: `wb${++seq}`, ...x };
      books.set(b.id, b);
      return b;
    },
    entries: {
      list: async (bookId: string, o: any = {}) => {
        const all = [...entries.values()].filter((e) => e.world_book_id === bookId);
        return { data: all.slice(o.offset ?? 0, (o.offset ?? 0) + (o.limit ?? 50)), total: all.length };
      },
      create: async (bookId: string, x: any) => {
        const e = { id: `e${++seq}`, world_book_id: bookId, disabled: false, ...x };
        entries.set(e.id, e);
        return e;
      },
      update: async (id: string, x: any) => {
        const e = { ...entries.get(id), ...x };
        entries.set(id, e);
        return e;
      },
      delete: async (id: string) => entries.delete(id),
    },
  };
  chars.set("narr", { id: "narr", name: "Ultimate Familiar Mastery", world_book_ids: ["rules"], extensions: { ufm_familiar_ledger: { card: "narrator" } } });
  fake.spindle.characters = {
    get: async (id: string) => chars.get(id) ?? null,
    list: async () => ({ data: [...chars.values()], total: chars.size }),
    update: async (id: string, x: any) => {
      const c = { ...chars.get(id), ...x };
      chars.set(id, c);
      return c;
    },
  };
  fake.files.set("canon/README.md", "# never synced");
  fake.files.set("canon/factions.md", "## The Staff\nkeys: Staff\nchapter: 2\n\nThe Staff keep order.\n\n## The Dagger\nchapter: 9\n\nThe Dagger waits.\n\n## Floor 1 law\nalways: yes\n\nNo stone rises in the street.");
  fake.files.set("chats/chat-canon/player.json", { version: 1, enabled: true, runHint: "origin", events: [setupEvent()], pending: [], issued: {}, squads: [], suggestions: {}, offscreen: {}, voices: {} });
  fake.chats.set(CHAT, [{ id: "a0", role: "assistant", swipes: ['<ufm>\nform name="Pebble" form=puppet\n</ufm>'], swipe_id: 0 }]);
  await import("../src/backend");
  await settle(50);
});

const canonEntries = () => [...entries.values()].filter((e) => e.extensions?.ufm_source === "canon");
const lastMsg = (type: string) => [...fake.sent].reverse().find((m) => m.type === type);

describe("canon world book", () => {
  test("sync builds the book from canon files, tags chapters and attaches it to the narrator", async () => {
    await fake.front({ type: "settings_set", patch: { readUpTo: 5 } });
    await fake.front({ type: "canon_sync", characterId: "narr" });
    const r = lastMsg("canon_result").result;
    expect(r).toMatchObject({ files: 1, total: 3, created: 3, disabled: 1, attachedTo: "Ultimate Familiar Mastery" });
    const byName = Object.fromEntries(canonEntries().map((e) => [e.comment, e]));
    expect(byName["The Staff"]).toMatchObject({ key: ["Staff"], disabled: false, extensions: { ufm_chapter: 2 } });
    expect(byName["The Dagger"].disabled).toBe(true);
    expect(byName["Floor 1 law"].constant).toBe(true);
    expect(chars.get("narr").world_book_ids).toEqual(["rules", r && [...books.keys()][0]]);
  });

  test("raising the bookmark switches entries back on without re-reading files", async () => {
    await fake.front({ type: "settings_set", patch: { readUpTo: 10 } });
    await settle(50);
    expect(canonEntries().every((e) => e.disabled === false)).toBe(true);
  });

  test("re-sync updates and removes entries that left the files; imported files join in", async () => {
    fake.files.set("canon/factions.md", "## The Staff\nkeys: Staff, wardens\nchapter: 2\n\nThe Staff keep order, harder now.");
    await fake.front({ type: "canon_import", name: "aethelgard.md", text: "# Aethelgard\n\nThe white city." });
    await fake.front({ type: "canon_sync", characterId: "narr" });
    const r = lastMsg("canon_result").result;
    expect(r).toMatchObject({ total: 2, created: 1, updated: 1, removed: 2 });
    expect(canonEntries().map((e) => e.comment).sort()).toEqual(["Aethelgard", "The Staff"]);
  });
});

describe("portraits", () => {
  test("a generated portrait is shown on the familiar's card", async () => {
    fake.spindle.imageGen = { generate: async (x: any) => ({ imageUrl: "https://img.example/pebble.png", imageDataUrl: "", model: "m", provider: "p", prompt: x.prompt }) };
    await fake.front({ type: "hello", chatId: CHAT });
    await fake.front({ type: "portrait_generate", chatId: CHAT, famId: "f1" });
    const v = [...fake.sent].reverse().find((m) => m.type === "state" && m.chatId === CHAT).view;
    expect(v.roster[0].portrait).toBe("https://img.example/pebble.png");
  });
});
