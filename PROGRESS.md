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
```

Layout:

- `src/shared/` — types, System math (`math.ts`, exactly the design doc's formulas), game data (`data.ts`: 50 Pillars, birthplaces, form costs, Soul Stages, resonance shares, arts, rarities; game-only values are flagged), seeded RNG.
- `src/engine/` — pure, testable: `parse.ts` (`<ufm>` lines), `ops.ts` (op handlers, validate-then-mutate), `replay.ts` (rebuild state from the log + player events), `progression.ts` (XP, level-ups, Threshold/Circle crossings, narrow tether), `derive.ts` (own + bond attributes, maxima, tethers), `render.ts` (prompt text), `view.ts` (frontend view model).
- `src/backend/` — `store.ts` (extension storage per chat), `sync.ts` (log from host messages/events → replay → push, chat vars), `interceptor.ts` (prompt injection + `{{ufm_state}}`), `protocol.ts` (frontend messages), `hooks.ts`/`modules.ts` (extension points for later phases).
- `src/frontend/` — `client.ts` (view store), `sheet.ts` (drawer tab), `dom.ts`, `styles.ts`, `ui.ts` (panel/modals mount point).
- `tests/` — `bun test`; `fake-spindle.ts` drives the real backend in-process.

Key design decisions:

- The log is the raw `<ufm>` block text per `messageId` + swipe index (`chats/<id>/log.json`). With `chat_mutation` granted the backend rebuilds it from `spindle.chat.getMessages` (exact order, active swipes, deletions); without it, from message events + the frontend tag interceptor.
- Player choices (setup, attribute points, accepted fixes) are player events anchored to `{msgId, swipe}` so they roll back with swipes/deletes (`chats/<id>/player.json`).
- Deterministic replay: all rolls are seeded from the run seed + message key.
- Interceptor computes state as of the last chat message actually in the prompt (a swipe excludes the reply being replaced) and replaces any `{{ufm_state}}` output in place instead of duplicating it.

## Phase status

- [x] **Phase 1 — State core.** Storage, parser, log keyed by msg+swipe, replay on swipe/edit/delete, System math (rate, xpToNext, killXp + gap factor, bound-familiar-only XP, level-ups, Circle event), narrow tether, `{{ufm_state}}` macro, interceptor, chat vars (@mana @mana_max @hp @hp_max @tethers @tethers_total @level @xp), drawer sheet tab. Verified with Lumiverse's real install scanner (clean).
- [ ] Phase 2 — Familiar panel, setup modal, narrator card.
- [ ] Phase 3 — Rule checks, second-model check, settings page.
- [ ] Phase 4 — Growth.
- [ ] Phase 5 — Living world.
- [ ] Phase 6 — Canon sync, portraits, HUD, polish, README.

## Next up

Phase 2: dock panel (`ctx.ui.requestDockPanel`, right edge), panel actions → pending orders + composer line (`ctx.composer.insertText`), bind pending orders to the user message on `MESSAGE_SENT`, setup modal writing a `setup` player event, `card/ufm-narrator.json`.
