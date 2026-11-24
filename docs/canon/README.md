# Canon files

Put your bible and tracker here as Markdown files (`docs/canon/*.md`). On install
and update, Lumiverse copies this folder into the extension's storage; then
**Settings → Familiar Ledger → Canon → Sync canon world book** turns every entry
into a world book entry in "Ultimate Familiar Mastery — Canon", attached to the
narrator card. You can also import a single file from the same settings page
without touching the repo.

This README is never synced. Neither is any file whose name starts with `_`.

## Format

```markdown
---
chapter: 3          # defaults for every entry in this file (optional)
keys: Staff
---

# The Factions      (a file title; ignored if the file has ## sections)

## The Staff
keys: Staff, the Staff, wardens
chapter: 5
order: 40

Entry text the narrator sees when a key comes up…

## Floor 1 rules
always: yes
chapter: 0

Always-on text (constant entry), injected every turn.
```

- Each `## Heading` is one entry; its name is the heading.
- Metadata lines go right under the heading, before the text:
  - `keys:` comma-separated trigger words (default: the heading itself).
  - `chapter:` the chapter this entry first becomes true (its **from chapter**
    tag). `0` means it's safe from the start.
  - `always: yes` makes it an always-on entry.
  - `order:` insertion order (lower first; default 100).
- A file without `##` headings becomes one entry named after its `# Title` (or the file name).

## Spoilers

Set **Read up to: Ch. N** in the settings. Every entry tagged with a chapter
after N is disabled in the world book (not deleted); raise the bookmark as you
read and those entries switch back on. Entries you remove from these files are
removed from the world book on the next sync.

Precedence still holds: the written chapters beat the tracker, which beats the
bible, which beats the game's own rules.
