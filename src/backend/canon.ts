// Canon sync: docs/canon/*.md (seeded into storage as canon/) → a world book whose entries carry
// a "from chapter" tag; "Read up to: Ch. N" disables everything past your bookmark.

import type { WorldBookEntryDTO } from "lumiverse-spindle-types";
import { type CanonEntry, isCanonFile, parseCanon, pastBookmark } from "../engine/canon";
import { slug } from "../shared/rng";
import { onFront, onSettingsChanged, reply, toast } from "./protocol";
import { can, errText, log, sp } from "./sp";
import { getSettings, updateSettings } from "./store";

const BOOK_NAME = "Ultimate Familiar Mastery — Canon";

async function allEntries(bookId: string): Promise<WorldBookEntryDTO[]> {
  const out: WorldBookEntryDTO[] = [];
  for (let offset = 0; offset < 20000; offset += 200) {
    const page = await sp().world_books.entries.list(bookId, { limit: 200, offset });
    out.push(...page.data);
    if (page.data.length < 200 || out.length >= page.total) break;
  }
  return out;
}

async function canonBook(): Promise<string> {
  const settings = await getSettings();
  if (settings.worldBookId) {
    const existing = await sp().world_books.get(settings.worldBookId).catch(() => null);
    if (existing) return existing.id;
  }
  const found = (await sp().world_books.list({ limit: 200 })).data.find((b) => b.name === BOOK_NAME);
  const book = found ?? (await sp().world_books.create({ name: BOOK_NAME, description: "Canon lore for the Tower, synced by Familiar Ledger from docs/canon. Entries past your Read-up-to bookmark are disabled.", metadata: { ufm_familiar_ledger: { kind: "canon" } } }));
  await updateSettings({ worldBookId: book.id });
  return book.id;
}

export async function readCanonFiles(): Promise<CanonEntry[]> {
  const files = (await sp().storage.list("canon/")).filter(isCanonFile).sort();
  const out: CanonEntry[] = [];
  for (const f of files) {
    try {
      out.push(...parseCanon(f, await sp().storage.read(f)));
    } catch (e) {
      log("warn", `canon file ${f}: ${errText(e)}`);
    }
  }
  return out;
}

export interface SyncResult {
  files: number;
  total: number;
  created: number;
  updated: number;
  removed: number;
  disabled: number;
  attachedTo: string | null;
}

export async function syncCanon(characterId?: string | null): Promise<SyncResult> {
  const settings = await getSettings();
  const entries = await readCanonFiles();
  const bookId = await canonBook();
  const existing = await allEntries(bookId);
  const byKey = new Map(existing.filter((e) => typeof e.extensions?.ufm_key === "string").map((e) => [e.extensions.ufm_key as string, e]));
  const res: SyncResult = { files: new Set(entries.map((e) => e.file)).size, total: entries.length, created: 0, updated: 0, removed: 0, disabled: 0, attachedTo: null };
  const seen = new Set<string>();
  for (const e of entries) {
    seen.add(e.key);
    const disabled = pastBookmark(e.chapter, settings.readUpTo);
    if (disabled) res.disabled += 1;
    const input = {
      key: e.keys,
      content: e.content,
      comment: e.name,
      constant: e.constant,
      order_value: e.order,
      disabled,
      extensions: { ufm_key: e.key, ufm_chapter: e.chapter, ufm_source: "canon", ufm_file: e.file },
    };
    const cur = byKey.get(e.key);
    if (cur) {
      await sp().world_books.entries.update(cur.id, input);
      res.updated += 1;
    } else {
      await sp().world_books.entries.create(bookId, input);
      res.created += 1;
    }
  }
  for (const [key, cur] of byKey) {
    if (!seen.has(key) && cur.extensions?.ufm_source === "canon") {
      await sp().world_books.entries.delete(cur.id);
      res.removed += 1;
    }
  }
  res.attachedTo = await attach(bookId, characterId);
  return res;
}

/** Attach the canon book to the narrator card (the current chat's character, or the one we installed). */
async function attach(bookId: string, characterId?: string | null): Promise<string | null> {
  if (!can("characters")) return null;
  try {
    let ch = characterId ? await sp().characters.get(characterId) : null;
    if (!ch || !(ch.extensions?.ufm_familiar_ledger || /ultimate familiar mastery/i.test(ch.name))) {
      const list = await sp().characters.list({ search: "Ultimate Familiar Mastery", limit: 20 });
      ch = list.data.find((c) => c.extensions?.ufm_familiar_ledger?.card === "narrator") ?? list.data[0] ?? null;
    }
    if (!ch) return null;
    if (!ch.world_book_ids.includes(bookId)) await sp().characters.update(ch.id, { world_book_ids: [...ch.world_book_ids, bookId] });
    return ch.name;
  } catch (e) {
    log("warn", `attaching the canon book failed: ${errText(e)}`);
    return null;
  }
}

/** Re-apply the bookmark without re-reading files. */
export async function applyBookmark(): Promise<number> {
  const settings = await getSettings();
  if (!settings.worldBookId || !can("world_books")) return 0;
  let changed = 0;
  for (const e of await allEntries(settings.worldBookId)) {
    const ch = Number(e.extensions?.ufm_chapter ?? 0);
    const want = pastBookmark(ch, settings.readUpTo);
    if (e.disabled !== want && e.extensions?.ufm_source === "canon") {
      await sp().world_books.entries.update(e.id, { disabled: want });
      changed += 1;
    }
  }
  return changed;
}

export function registerCanon(): void {
  onFront("canon_sync", async (msg, _c, userId) => {
    if (!can("world_books")) {
      toast("warning", 'Grant the "world_books" permission to build the canon world book.', userId);
      return;
    }
    const r = await syncCanon(msg.characterId ?? null);
    reply(userId, { type: "canon_result", result: r });
    toast(
      r.total ? "success" : "warning",
      r.total
        ? `Canon: ${r.total} entries from ${r.files} file(s) — ${r.created} new, ${r.updated} updated, ${r.removed} removed, ${r.disabled} past your bookmark${r.attachedTo ? `; attached to ${r.attachedTo}` : ""}.`
        : "No canon files found. Add Markdown files to docs/canon/ and update the extension, or import a file here.",
      userId,
    );
  });

  onFront("canon_import", async (msg, _c, userId) => {
    const name = slug(String(msg.name ?? "imported").replace(/\.md$/i, "")) || "imported";
    const text = String(msg.text ?? "");
    if (!text.trim()) return;
    if (text.length > 2_000_000) {
      toast("warning", "That file is too large (2 MB max).", userId);
      return;
    }
    await sp().storage.write(`canon/imported/${name}.md`, text);
    const n = parseCanon(`canon/imported/${name}.md`, text).length;
    toast("success", `Imported ${n} entr${n === 1 ? "y" : "ies"} from ${msg.name}. Click Sync to update the world book.`, userId);
    reply(userId, { type: "canon_files", files: (await sp().storage.list("canon/")).filter(isCanonFile) });
  });

  onFront("canon_files", async (_msg, _c, userId) => {
    let files: string[] = [];
    try {
      files = (await sp().storage.list("canon/")).filter(isCanonFile);
    } catch {
      files = [];
    }
    reply(userId, { type: "canon_files", files });
  });

  onSettingsChanged(async (patch, userId) => {
    if (patch.readUpTo === undefined) return;
    const n = await applyBookmark();
    if (n) toast("info", `Read-up-to bookmark applied: ${n} canon entr${n === 1 ? "y" : "ies"} switched.`, userId);
  });
}
