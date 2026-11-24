# Familiar Ledger

A [Lumiverse](https://lumiverse.chat) Spindle extension (`ufm_familiar_ledger`) that turns
*Ultimate Familiar Mastery* into a playable RP.

**The extension owns every number; the narrator owns the story.** The Tower narrator
ends each reply with a short `<ufm>` change log ("form a golem", "Shale killed a Level 17
warden", "a day passes"). The extension hides that block, checks every line against the
rules, applies only the legal ones, and does all the math itself: Mana, Soul Tethers, XP,
levels, Circles and Thresholds, mastery, Bond Feedback, heat. A golem you can't afford
doesn't appear; a beast you never bound can't show up in a fight. Swipes, edits and deletes
roll back cleanly because the whole game is rebuilt by replaying the log.

You can play entirely by typing, entirely by clicking the Familiar panel, or both.

The full design is in [`docs/DESIGN.md`](docs/DESIGN.md).

---

## Install

1. In Lumiverse, open the drawer → **Extensions** (the Spindle panel).
2. Click **Add Extension**, then paste this repo's URL into **Install from Source**:

   ```
   https://github.com/NosracTN2/UFM
   ```

   If a **Branch** selector appears, pick the branch that holds the extension (`main`
   once it's merged there).
3. Review the requested permissions and click **Install**. Lumiverse builds `src/` with
   Bun automatically; there's no build step for you.
4. New extensions start **disabled**: flip the **Enable** toggle, then grant permissions.

### Permissions

| Permission | What it's for | Needed? |
|---|---|---|
| `interceptor` | Injects your sheet, standing orders and System results before each reply | **Yes** |
| `chat_mutation` | Reads the chat's messages so every swipe/edit/delete replays exactly | **Strongly recommended** (without it the log is kept from events, less exactly) |
| `ui_panels` | The Familiar panel (right edge; a bottom sheet on phones) and the phone HUD | Recommended (without it the panel becomes a drawer tab) |
| `generation` | The optional rule check and offscreen lives (cheap background calls) | Optional |
| `decisions` | Rule check through a Decision model instead | Optional |
| `characters` | One-click install of the narrator card; attaching the canon book to it | Optional |
| `world_books` | The narrator's rules book and the canon world book | Optional |
| `image_gen`, `images` | Generated / uploaded familiar portraits | Optional |

Chat variables (`@mana`, `@mana_max`, `@hp`, `@hp_max`, `@tethers`, `@tethers_total`,
`@level`, `@xp`) need no permission; the extension mirrors its numbers there so other
extensions and macros can read them. Its own storage stays the source of truth.

## Update

Open **Extensions** and press **Update** on the Familiar Ledger card (or **Update All**).
Lumiverse pulls the latest source and rebuilds it. Your runs are kept: each chat's change
log, choices and settings live in the extension's storage. Files in `docs/canon/` are
copied into storage again on every update, so new canon is one **Sync** away.

If you changed `card/ufm-narrator.json` and want the new card, install it again (it
creates a new character; delete the old one if you like).

---

## Start a run

1. **Get the narrator card.** Either open the **Familiar panel** and click **Install the
   narrator card** (needs `characters`; with `world_books` it also creates the rules world
   book), or import [`card/ufm-narrator.json`](card/ufm-narrator.json) through
   **Characters → Import**.
2. **Start a chat** with *Ultimate Familiar Mastery*. Swipe the first message to choose
   the run:
   - **Origin** (default greeting): you are the Ultimate Familiar Master, all 50 Pillars
     behind `[???]`, one bond woken by where you were born.
   - **The spread**: a derived-class Awakened with a rarity that sets your Branch rate;
     the Origin exists somewhere, hunted.
   - **Sandbox**: a freeform Origin with three Pillars open and no clock.
3. **The setup window opens by itself.** Choose:
   - **Birthplace** — from the list, *Roll one*, or *Describe your own* (pick its floor).
     It sets your floor, people, starting level (the bottom of that floor's band) and
     which Pillars fit. *Reese's path* fills in mining town · Elemental Creation · Earth.
   - **First bond** — from your birthplace, fully random from the 49-Pillar starter pool
     (no rerolls unless you turn them on in settings), or your pick.
   - **First Branch** — one of the Pillar's set Branches, or one born from your birthplace.
   - **Name**, then **Awaken**.
4. An `» Awakening …` line is placed in your message box. Send it (add whatever you like)
   and the Tower narrates your Awakening with a full System window.

You can reopen setup any time from the panel or the input bar's Extras menu
(**New run (setup)**); it replaces the starting sheet for that chat.

## Playing

- **Familiar panel** (right edge; bottom sheet on phones): Health, Mana, Tethers, Level/XP
  at the top; your roster as cards with state badge, tether cost, condition and order,
  filterable by Active / Slumbering / In soul / Lost / Released.
  - **Form** shows each option's cost and greys out what you can't afford or haven't
    mastered, with the reason.
  - Card actions: **Order** (or **Ask**, for beasts), **Take hand**, **Stance**,
    **Slumber**, **Wake** (needs your touch), **Rename**, **Release**; and once learned,
    **Into soul**, **Call**, **Ride**. **Squads** give one order to a group.
  - A click never changes anything by itself: it becomes a standing order injected into
    your next message, with a visible `»` line in your text. The narrator narrates it and
    confirms it in the tag. Delete the line before sending to cancel it, or press ✕.
- **Ledger** drawer tab: your sheet — attributes as *own + from bonds*, all 50 Pillar rows,
  Branches with mastery %, Gifts and Borrowed Traits, tether arts, body, place and clock.
- **World** drawer tab: floor band, heat per faction and Decree 00, who knows what, people
  met (voice notes, wounds, grudges; their offscreen goals behind a spoiler), threads.
- **Level-ups**: the extension pays XP only for kills by a bound familiar. Place your
  attribute points with **+N points** (and your minded familiars' with **Place points**
  on their cards). Below Level 15, Origin runs feel the *narrow tether* (only 10–30% of
  kill XP reaches you; revealed at the First Threshold; can be switched off).
- **Evolution**: when a familiar's growth crosses a line its card glows **Ready**. Nothing
  happens until you trigger it in the story (**Trigger in the story…**, then pick the path).
- **Mistakes**: lines the rules drop are listed in the panel with the reason, and the
  narrator is told they didn't happen. If the narrator *missed* something, open
  **Last turn → Fix this reply…** and add the line yourself; it rolls back with that reply.

### The change-log tag

The narrator writes one op per line at the end of each reply (the card teaches it):

```
<ufm>
form name="Shale" pillar=elemental element=earth form=automated
order Shale guard "the cave mouth"
kill enemy="Staff warden" level=17 by=Shale
lose "Puppet 2"
wound you "cracked rib" heal=10d
learn who="The Staff" fact="raises golems from stone"
time +1 day
</ufm>
```

It never writes XP, levels or totals; it reports what happened and the extension does the
math. The full op list lives in [`src/shared/tagref.ts`](src/shared/tagref.ts) and in the
card's system prompt. `{{ufm_state}}` (the card's scenario) prints your current sheet,
roster and standing orders.

## Settings

**Settings → Familiar Ledger** (on older hosts: the Extensions settings area):

- **Rules**: narrow tether on/off, rerolls in setup, how many recent replies keep their tag
  in the prompt.
- **Second-model rule check**: a cheap model (quiet generation or a Decision model) reads
  each new reply and asks whether anything died, arrived or changed that the tag missed.
  It only suggests fixes in the panel; nothing applies until you accept.
- **Living world**: offscreen lives (on time skips of 12h+ and floor changes, a background
  call updates each tracked person and faction; they come back changed) and motive
  cutaways (marked in the chat as *you know this, your character doesn't*).
- **Canon**: **Read up to: Ch. N**, **Sync canon world book**, **Import a canon file…**
- **Portraits and HUD**: image connection and style for portraits (click a portrait on a
  card to generate, upload or remove one); the floating HUD on phones.

## Canon sync

Put your bible and tracker in [`docs/canon/`](docs/canon/README.md) as Markdown: each
`## Heading` is an entry with optional `keys:`, `chapter:` (its *from chapter* tag),
`always: yes` and `order:` lines. Update the extension (or import a file in settings),
then press **Sync canon world book**: entries are created or updated in *Ultimate Familiar
Mastery — Canon*, attached to the narrator card, and everything past your **Read up to**
bookmark is disabled until you get there.

## Game rules vs. the book

Every number the bible fixes is used exactly (the Circle/Threshold rates, XP to level,
kill XP with its gap factor, level-up bonuses, tether costs, Resonance shares). Where the
bible leaves things open, the game fills them in a labelled *game-only* layer in
[`src/shared/data.ts`](src/shared/data.ts) (starting attributes, floor bands, mastery caps,
higher Soul Stage costs, the 21 invented Pillars beyond the Tower, …). Precedence: written
chapters beat the tracker, which beats the bible, which beats game rules — change the data
file when the novel shows the real thing.

## Troubleshooting

- **No panel.** Grant `ui_panels` (or look for the *Familiars* drawer tab), and check the
  extension is enabled.
- **Numbers don't move.** Check `interceptor` and `chat_mutation` are granted, then open
  the panel's **Last turn** tab: it shows what was applied and what was dropped and why.
- **Raw `<ufm>` text shows in the chat.** The frontend hasn't loaded yet; reload the page.
- **The narrator forgets the tag.** Keep the card's system prompt and post-history
  instructions on; a stronger instruction-following model helps. **Fix this reply…**
  covers the odd miss; the rule check can catch them for you.

## Development

```bash
bun install
bun test            # engine + the real backend driven against a fake Spindle host
npx tsc --noEmit    # typecheck
bun run build       # dist/ (gitignored; Lumiverse builds src/ itself)
bun run card        # regenerate card/ufm-narrator.json from src/shared/card.ts
```

Browser harness (real backend + real built frontend in Chromium with a stand-in host):

```bash
bun run build && bun tests/harness/server.ts &     # http://localhost:4417
node --experimental-strip-types tests/harness/drive.ts ./shots
```

See [`PROGRESS.md`](PROGRESS.md) for the architecture and phase notes.
