// Drawer tab: your character sheet, exactly as the extension holds it.

import { ATTR_KEYS, ATTR_NAMES } from "../shared/data";
import type { LedgerView } from "../engine/view";
import type { Client } from "./client";
import { bar, button, clear, empty, fmt, h, section } from "./dom";

export type SheetExtra = (v: LedgerView, client: Client) => (HTMLElement | null)[];
const extraSections: SheetExtra[] = [];
export function addSheetSection(fn: SheetExtra): void {
  extraSections.push(fn);
}

export function renderSheet(root: HTMLElement, client: Client, actions: { openSetup: () => void; openLevelUp: () => void }): void {
  clear(root);
  const v = client.view;
  if (!client.activeChat) {
    root.append(empty("Open a chat to see your sheet."));
    return;
  }
  if (!v) {
    root.append(empty("Loading the ledger…"));
    return;
  }
  if (!v.started) {
    root.append(
      empty(
        v.enabled ? "No run yet. Choose your birthplace and first bond to begin." : "Familiar Ledger is not running in this chat. Start a run to turn it on.",
        button("Start a run", actions.openSetup, { kind: "primary" }),
      ),
    );
    return;
  }
  const s = v.sheet;
  const d = v.derived;

  root.append(
    h(
      "section",
      { class: "ufl-section" },
      h("p", { class: "ufl-title" }, s.name),
      h("div", { class: "ufl-sub" }, s.className),
      h("div", { class: "ufl-sub" }, `Level ${v.levelText}`),
      bar("XP", s.xp, v.xpNext, "xp"),
      bar("Health", s.hp, d.hpMax, "hp"),
      bar("Mana", s.mana, d.manaMax, "mana"),
      bar("Tethers", d.tethersUsed, d.tethersTotal, "teth"),
      h("div", { class: "ufl-sub" }, `Next Threshold at Level ${v.nextThreshold} · Silver ${fmt(s.silver)}`),
    ),
  );

  const attrRows = ATTR_KEYS.map((k) =>
    h(
      "div",
      { class: "ufl-stat", title: ATTR_NAMES[k] },
      h("small", null, ATTR_NAMES[k]),
      h("b", null, String(d.attrs[k])),
      h("small", null, d.bonds[k] ? `${d.own[k]} own + ${d.bonds[k]} from bonds` : `${d.own[k]} own`),
    ),
  );
  root.append(
    section(
      "Attributes",
      h("div", { class: "ufl-grid" }, attrRows),
      s.unspent
        ? h("div", { class: "ufl-row", style: { marginTop: "6px" } }, h("span", { class: "ufl-grow" }, `${s.unspent} unspent point${s.unspent === 1 ? "" : "s"}`), button("Place points", actions.openLevelUp, { kind: "primary" }))
        : null,
      d.bondsBy.length ? h("div", { class: "ufl-sub", style: { marginTop: "6px" } }, `From bonds: ${d.bondsBy.map((b) => `${b.name} (${Object.entries(b.attrs).map(([k, n]) => `+${n} ${k}`).join(", ")})`).join("; ")}`) : null,
      h("div", { class: "ufl-sub", style: { marginTop: "4px" } }, "Constitution +10 Health · Intelligence +5 Mana · Control 5 Soul Tethers"),
    ),
  );

  const w = v.world;
  const body: string[] = s.wounds.map((x) => `${x.label}${x.hoursLeft != null ? ` (${Math.ceil(x.hoursLeft / 24)}d)` : ""}`);
  if (s.exhaustion) body.push(`exhaustion ${s.exhaustion}/5`);
  if (s.hunger) body.push(`hunger ${s.hunger}/5`);
  if (s.cold) body.push(`cold ${s.cold}/5`);
  root.append(
    section(
      "Where and how",
      h(
        "dl",
        { class: "ufl-kv" },
        h("dt", null, "Place"),
        h("dd", null, `Floor ${w.floor}${w.place ? ` · ${w.place}` : ""}`),
        h("dt", null, "Clock"),
        h("dd", null, `${v.clock}${w.clocks[String(w.floor)]?.weather ? ` · ${w.clocks[String(w.floor)]!.weather}` : ""}`),
        h("dt", null, "Body"),
        h("dd", null, body.length ? body.join("; ") : "sound"),
        h("dt", null, "Born"),
        h("dd", null, `${s.birthplace} · ${s.people}`),
        h("dt", null, "Carrying"),
        h("dd", null, s.items.length ? s.items.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(", ") : "nothing tracked"),
      ),
    ),
  );

  const open = v.pillars.filter((p) => p.status === "open");
  const stirring = v.pillars.filter((p) => p.status === "stirring");
  const pillarList = h("div", null);
  const showAll = h("details", null, h("summary", { class: "ufl-sub" }, s.run === "spread" ? "All Pillars" : "All 50 Pillars"));
  for (const p of v.pillars) {
    const blocked = (v.extras.blockedPillars as string[] | undefined)?.includes(p.id);
    showAll.append(
      h(
        "div",
        { class: `ufl-pillar ${p.status}${blocked ? " blocked" : ""}`, title: blocked ? "Forbidden on this floor" : "" },
        h("span", { class: "num" }, `${p.num}`),
        h("span", { class: "ufl-grow" }, p.status === "stirring" ? `[???] trembles ${p.stir ?? ""}` : p.display),
      ),
    );
  }
  for (const p of open) {
    pillarList.append(
      h(
        "div",
        { class: "ufl-pillar open" },
        h("span", { class: "num" }, `${p.num}`),
        h(
          "div",
          { class: "ufl-grow" },
          p.name + (p.first ? " (first bond)" : ""),
          h("ul", { class: "ufl-list" }, p.branches.map((b) => h("li", { class: "ufl-sub" }, `${b.name} — ${b.mastery} ${b.pct}%`))),
        ),
      ),
    );
  }
  root.append(
    section(
      "Pillars",
      pillarList,
      stirring.length ? h("div", { class: "ufl-sub" }, `Stirring: ${stirring.map((p) => `[???] (${p.stir ?? "faint"})`).join(", ")}`) : null,
      showAll,
    ),
  );

  for (const fn of extraSections) for (const el of fn(v, client)) if (el) root.append(el);

  if (v.recentEvents.length || v.recentRejected.length) {
    root.append(
      section(
        "Recent System events",
        v.recentEvents.slice(-6).map((e) => h("div", { class: `ufl-event${e.big ? " big" : ""}` }, e.text)),
        v.recentRejected.slice(-6).map((r) => h("div", { class: "ufl-warn" }, h("code", null, r.line), ` — ${r.reason}`)),
      ),
    );
  }
}
