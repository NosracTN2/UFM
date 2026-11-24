# Familiar Ledger — progress

Lumiverse Spindle extension `ufm_familiar_ledger`. Design: `docs/DESIGN.md`.
API reference used: the Lumiverse developer docs (`developer-docs/docs/` in
github.com/prolix-oc/lumiverse — the same pages as docs.lumiverse.chat, which
is unreachable from the build sandbox) and `lumiverse-spindle-types@0.6.81`.

## How to work on it

```bash
bun install
bun test            # engine + backend-with-fake-host tests
npx tsc --noEmit    # typecheck
bun run build       # dist/ (gitignored; Lumiverse builds src/ itself on install/update)
bun run card        # regenerate card/ufm-narrator.json from src/shared/card.ts
```

Browser harness (real backend against the fake host + real built frontend in Chromium):

```bash
bun run build && bun tests/harness/server.ts &      # http://localhost:4417
node --experimental-strip-types tests/harness/drive.ts <screenshot-dir>
```

Layout:

- `src/shared/` — types, System math (`math.ts`, exactly the design doc's formulas), game data (`data.ts`: 50 Pillars, birthplaces, form costs, Soul Stages, resonance shares, arts, rarities; game-only values are flagged), seeded RNG.
- `src/engine/` — pure, testable: `parse.ts` (`<ufm>` lines), `ops.ts` (op handlers, validate-then-mutate), `replay.ts` (rebuild state from the log + player events), `progression.ts` (XP, level-ups, Threshold/Circle crossings, narrow tether), `derive.ts` (own + bond attributes, maxima, tethers), `render.ts` (prompt text), `view.ts` (frontend view model).
- `src/backend/` — `store.ts` (extension storage per chat), `sync.ts` (log from host messages/events → replay → push, chat vars), `interceptor.ts` (prompt injection + `{{ufm_state}}`), `protocol.ts` (frontend messages), `hooks.ts`/`modules.ts` (extension points for later phases).
- `src/engine/panel.ts` — panel logic: clicks → orders; every button's enabled/disabled reason is a dry run of the op the narrator would confirm.
- `src/backend/actions.ts` — action/setup/roll/squad/install_card handlers; panel data in the view (`extras`).
- `src/shared/card.ts` + `src/shared/tagref.ts` — narrator card and the tag reference (`card/ufm-narrator.json` is generated; a test keeps them in sync).
- `src/frontend/` — `client.ts` (view store), `sheet.ts` (drawer tab), `panel.ts` (dock panel), `setup.ts` (new-run modal), `levelup.ts`, `ui.ts` (mounts, composer lines, auto-setup), `dom.ts`, `styles.ts`.
- `tests/` — `bun test`; `fake-spindle.ts` drives the real backend in-process.

Key design decisions:

- The log is the raw `<ufm>` block text per `messageId` + swipe index (`chats/<id>/log.json`). With `chat_mutation` granted the backend rebuilds it from `spindle.chat.getMessages` (exact order, active swipes, deletions); without it, from message events + the frontend tag interceptor.
- Player choices (setup, attribute points, accepted fixes) are player events anchored to `{msgId, swipe}` so they roll back with swipes/deletes (`chats/<id>/player.json`).
- Deterministic replay: all rolls are seeded from the run seed + message key.
- Interceptor computes state as of the last chat message actually in the prompt (a swipe excludes the reply being replaced) and replaces any `{{ufm_state}}` output in place instead of duplicating it.

## Phase status

- [x] **Phase 1 — State core.** Storage, parser, log keyed by msg+swipe, replay on swipe/edit/delete, System math (rate, xpToNext, killXp + gap factor, bound-familiar-only XP, level-ups, Circle event), narrow tether, `{{ufm_state}}` macro, interceptor, chat vars (@mana @mana_max @hp @hp_max @tethers @tethers_total @level @xp), drawer sheet tab. Verified with Lumiverse's real install scanner (clean).
- [x] **Phase 2 — Familiar panel.** Right-edge dock (bottom sheet on mobile; drawer-tab fallback without `ui_panels`): top bar, roster cards with state filter, Form tab with costs (locked + reason when illegal), card actions (Order/Ask, Take hand/Let go, Stance, Slumber, Wake, Rename, Release), squads with group orders, last-turn view. Actions → pending orders + a visible line in the composer; bound to the user message in the interceptor (a line deleted from the composer cancels its order; swipes re-inject, later turns don't). Setup modal: Origin / the spread (rarity, extra Pillars, class name, Branch rate) / sandbox (three Pillars); birthplace list, roll or custom; first bond from birthplace / random (no rerolls unless enabled) / pick; Reese's preset; Branch set or birthplace-born. Narrator card (`card/ufm-narrator.json`) with 3 greetings, system prompt, post-history, examples, 16 rule/lore entries; one-click install (`characters` + `world_books`). Level-up modal. Verified in Chromium via the harness (desktop + phone).
- [x] **Phase 3 — Rule checks.** `src/engine/rules.ts` plugs into the op hooks: Pillar open (sealed ones stay [???]), floor gates (kingdom floor forbids Mind Dominion, Blood Bonding, Necromancy), mastery tier per form (Automated = Low, construct = Mid) in the Element Branch, Element Branch open, touch range / same floor for Wake, control by kind (puppets only by hand; stances only for Mid constructs; only the dead feed; strike needs a target; mindless familiars take simple orders), only elementals/constructs slumber, Soul Stage tether costs. Mana/tether affordability since Phase 1. Dropped lines show in the panel and are told to the narrator next turn. Second-model check (`src/backend/check.ts`): quiet generation (exact fix lines, dry-run validated) or a Decision model (flags likely misses); suggestions in the panel → Apply / Edit / Dismiss; accepted = `amend` player event anchored to that reply (rolls back with it); manual “Fix this reply…”. Settings page (`src/frontend/settings.ts`): narrow tether, rerolls, history tags, rule check on/off, mode, connection.
- [ ] Phase 4 — Growth.
- [ ] Phase 5 — Living world.
- [ ] Phase 6 — Canon sync, portraits, HUD, polish, README.

## Next up

Phase 4 (growth): `src/engine/growth.ts` registering growth ops (practice, skill, branch, stir, open, resonance, evolve, art, gift, trait, eat, forge, essence, mutate, echo, turn, ride, soul, call) and `onLevelUp` (art slots per Threshold, Branch progress/rolled Branches for the spread, Origin rate, Gifts at 15, Borrowed Trait slots, familiar levels); Bond Feedback is already derived in `derive.ts` (needs familiar attrs/feeds); level-up modal exists (extend for minded familiars' points); per-kind card sections in the panel (`addCardExtra`), vampire blood-red window.
