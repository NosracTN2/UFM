// Phase 2: panel actions become standing orders; setup writes the starting sheet; squads; card install.

import { ActionError, buildOrder, famChecks, formOptions, type Action } from "../engine/panel";
import type { SetupData } from "../engine/state";
import { buildCard, RULE_ENTRIES } from "../shared/card";
import { BIRTHPLACES, birthplaceDef, levelsPerBranch, pillarDef, RARITIES, rarityDef, STARTER_POOL } from "../shared/data";
import { newId, pick } from "../shared/rng";
import type { Order, RunType } from "../shared/types";
import { onFront, reply, toast } from "./protocol";
import { can, errText, sp } from "./sp";
import { type ChatCache, getSettings, savePlayer } from "./store";
import { addViewExtras, recompute } from "./sync";

async function queue(c: ChatCache, order: Order, userId: string): Promise<void> {
  c.player.pending.push(order);
  c.player.enabled = true;
  await savePlayer(c);
  await recompute(c);
  reply(userId, { type: "order_line", chatId: c.chatId, orderId: order.id, line: order.line });
}

export function registerActions(): void {
  addViewExtras((c, settings) => {
    if (!c.result) return {};
    const st = c.result.state;
    if (!st.started) return {};
    const held = Object.values(st.sheet.pillars).filter((p) => p.status === "open").length;
    return {
      formOptions: formOptions(st, settings),
      famChecks: famChecks(st, settings),
      elements: st.sheet.branches.filter((b) => b.pillar === "elemental").map((b) => b.name),
      branchRate: levelsPerBranch(st.sheet.run, st.sheet.rarity, held),
      rolls: c.player.rolls ?? {},
    };
  });

  onFront("action", async (msg, c, userId) => {
    if (!c?.result?.state.started) {
      toast("warning", "Start a run first.", userId);
      return;
    }
    const settings = await getSettings();
    try {
      const order = buildOrder(c.result.state, settings, msg.action as Action);
      await queue(c, order, userId);
    } catch (e) {
      if (e instanceof ActionError) {
        toast("warning", e.message, userId);
        reply(userId, { type: "action_refused", chatId: c.chatId, reason: e.message });
      } else throw e;
    }
  });

  onFront("order_inserted", async (msg, c) => {
    if (!c) return;
    const o = c.player.pending.find((x) => x.id === msg.orderId);
    if (o) {
      (o as Order & { inComposer?: boolean }).inComposer = true;
      await savePlayer(c);
    }
  });

  onFront("cancel_order", async (msg, c, userId) => {
    if (!c) return;
    const o = c.player.pending.find((x) => x.id === msg.orderId);
    c.player.pending = c.player.pending.filter((x) => x.id !== msg.orderId);
    await savePlayer(c);
    await recompute(c);
    if (o) reply(userId, { type: "remove_line", chatId: c.chatId, line: o.line });
  });

  onFront("roll", async (msg, c, userId) => {
    if (!c) return;
    const settings = await getSettings();
    const what = String(msg.what ?? "pillar");
    c.player.rolls ??= {};
    const existing = c.player.rolls[what];
    if (existing && !(msg.reroll && settings.rerolls)) {
      reply(userId, { type: "roll", chatId: c.chatId, what, value: existing, locked: !settings.rerolls });
      return;
    }
    const n = Object.keys(c.player.rolls).length + (c.player.rollCount ?? 0);
    c.player.rollCount = (c.player.rollCount ?? 0) + 1;
    const seed = `${c.chatId}:${what}:${n}:${Date.now()}`;
    let value = "";
    if (what === "pillar") value = pick(seed, STARTER_POOL).id;
    else if (what === "birthplace") value = pick(seed, BIRTHPLACES).id;
    else if (what === "rarity") value = pick(seed, RARITIES.flatMap((r, i) => Array(RARITIES.length - i).fill(r.id) as string[]));
    else if (what.startsWith("pillar")) value = pick(seed, STARTER_POOL).id;
    c.player.rolls[what] = value;
    await savePlayer(c);
    reply(userId, { type: "roll", chatId: c.chatId, what, value, locked: !settings.rerolls });
  });

  onFront("setup", async (msg, c, userId) => {
    if (!c) return;
    const setup = normalizeSetup(msg.setup as SetupData, c.chatId);
    c.player.events = c.player.events.filter((e) => e.kind !== "setup");
    c.player.events.push({ id: newId("setup"), anchor: null, kind: "setup", data: setup, ts: Date.now() });
    c.player.pending = [];
    c.player.issued = {};
    c.player.enabled = true;
    c.player.runHint = setup.run;
    const p = pillarDef(setup.pillar)!;
    const bp = birthplaceDef(setup.birthplace);
    const where = bp?.name ?? setup.customBirthplace ?? `Floor ${setup.floor}`;
    const extra = (setup.extraPillars ?? []).map((x) => pillarDef(x)?.name).filter(Boolean);
    const awakening: Order = {
      id: newId("o"),
      kind: "awakening",
      line: `» Awakening: ${where} · ${p.name} (${setup.branch}).`,
      directive:
        `AWAKENING: narrate {{user}}'s Awakening. Birthplace: ${where} (Floor ${bp?.floor ?? setup.floor ?? 1}). ` +
        `The Tower wakes ${p.name}${extra.length ? ` together with ${extra.join(" and ")}` : ""} in them, with the ${setup.branch} Branch at No Mastery. ` +
        `Show it in a full System window (blockquote): name, class, Level, Health, Mana, Soul Tethers and the Pillar list${setup.run === "origin" ? ` — ${p.name} open, the other 49 as [???]` : ""}, exactly as in [UFM STATE]. ` +
        `The ceiling is the Pillar's; the floor is humble: ${p.starter}. Don't form or bind anything unless {{user}} chooses to.`,
      expect: "",
      ts: Date.now(),
    };
    c.player.pending.push(awakening);
    await savePlayer(c);
    await recompute(c);
    reply(userId, { type: "order_line", chatId: c.chatId, orderId: awakening.id, line: awakening.line });
    toast("success", "Your run is set. Send your first message to Awaken.", userId);
  });

  onFront("squad", async (msg, c) => {
    if (!c) return;
    const op = String(msg.op);
    if (op === "create") {
      const name = String(msg.name ?? "").trim() || `Squad ${c.player.squads.length + 1}`;
      c.player.squads.push({ id: newId("sq"), name, members: Array.isArray(msg.members) ? msg.members : [] });
    } else if (op === "delete") {
      c.player.squads = c.player.squads.filter((s) => s.id !== msg.id);
    } else if (op === "set") {
      const s = c.player.squads.find((x) => x.id === msg.id);
      if (s) {
        if (Array.isArray(msg.members)) s.members = msg.members;
        if (typeof msg.name === "string" && msg.name.trim()) s.name = msg.name.trim();
      }
    }
    await savePlayer(c);
    await recompute(c);
  });

  onFront("install_card", async (_msg, _c, userId) => {
    if (!can("characters")) {
      toast("warning", 'Grant the "characters" permission to install the narrator card, or import card/ufm-narrator.json by hand.', userId);
      return;
    }
    const card = buildCard().data;
    let bookIds: string[] = [];
    if (can("world_books")) {
      try {
        const book = await sp().world_books.create({ name: card.character_book.name, description: card.character_book.description, metadata: { ufm_familiar_ledger: { kind: "rules" } } });
        for (const e of RULE_ENTRIES) {
          await sp().world_books.entries.create(book.id, {
            key: e.keys,
            content: e.content,
            comment: e.name,
            constant: e.constant,
            order_value: e.order,
            extensions: { ufm_chapter: e.chapter, ufm_source: "bible" },
          });
        }
        bookIds = [book.id];
      } catch (e) {
        toast("warning", `World book not created: ${errText(e)}`, userId);
      }
    }
    const created = await sp().characters.create({
      name: card.name,
      description: card.description,
      personality: card.personality,
      scenario: card.scenario,
      first_mes: card.first_mes,
      mes_example: card.mes_example,
      creator_notes: card.creator_notes,
      system_prompt: card.system_prompt,
      post_history_instructions: card.post_history_instructions,
      alternate_greetings: card.alternate_greetings,
      tags: card.tags,
      creator: card.creator,
      world_book_ids: bookIds,
      extensions: card.extensions,
    });
    toast("success", `Installed "${created.name}"${bookIds.length ? " with its rules world book" : ""}. Start a chat with it to begin.`, userId);
  });
}

export function normalizeSetup(raw: SetupData, chatId: string): SetupData {
  const run: RunType = raw?.run === "spread" || raw?.run === "sandbox" ? raw.run : "origin";
  const pillar = pillarDef(raw?.pillar)?.id ?? "elemental";
  if (pillar === "ufm") throw new Error("Ultimate Familiar Mastery is a capstone, not a starting bond.");
  const extra = (raw?.extraPillars ?? []).map((p) => pillarDef(p)?.id).filter((p): p is string => !!p && p !== pillar && p !== "ufm");
  const bp = birthplaceDef(raw?.birthplace);
  const floor = bp?.floor ?? Math.max(1, Math.min(100, Math.round(Number(raw?.floor) || 1)));
  const branch = (raw?.branch ?? "").trim() || pillarDef(pillar)!.branches[0] || "First Branch";
  return {
    run,
    name: (raw?.name ?? "").trim() || "You",
    birthplace: bp ? bp.id : "custom",
    customBirthplace: bp ? undefined : (raw?.customBirthplace ?? "").trim() || `A place on Floor ${floor}`,
    people: (raw?.people ?? "").trim() || undefined,
    floor,
    pillar,
    extraPillars: run === "sandbox" ? extra.slice(0, 2) : run === "spread" ? extra.slice(0, Math.max(0, (rarityDef(raw?.rarity)?.maxPillars ?? 1) - 1)) : [],
    branch,
    rarity: run === "spread" ? (raw?.rarity ?? "rare") : undefined,
    className: run === "spread" ? (raw?.className ?? "").trim() || undefined : undefined,
    method: raw?.method ?? "pick",
    seed: raw?.seed || `${chatId}:${Date.now().toString(36)}`,
  };
}
