// Growth UI: the sheet's Growth section, per-kind familiar cards, Evolve, familiar attribute windows.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { GrowthView } from "../backend/growth-view";
import type { FamChecks } from "../engine/panel";
import type { FamView, LedgerView } from "../engine/view";
import { ATTR_KEYS, ATTR_SHORT, ELEMENTAL_CORES, ESSENCE_GRADES, VAMPIRE_RANKS, ZOMBIE_GRADES } from "../shared/data";
import { xpToNext } from "../shared/math";
import type { AttrKey } from "../shared/types";
import type { Client } from "./client";
import { bar, button, clear, h, section } from "./dom";
import { addCardExtra } from "./panel";
import { addSheetSection } from "./sheet";

export function installGrowthUi(ctx: SpindleFrontendContext): void {
  addSheetSection((v) => {
    const g = v.extras.growth as GrowthView | undefined;
    if (!g) return [];
    const s = v.sheet;
    const rate = Number.isInteger(g.branchRate) ? String(g.branchRate) : g.branchRate.toFixed(1);
    const progress = Math.round((g.branchProgress % 1) * 100);
    return [
      section(
        "Growth",
        h("div", null, `A new Branch every ${rate} level${g.branchRate === 1 ? "" : "s"}${s.run === "spread" ? " (rarity budget; extra Pillars slow it)" : " (the Origin: faster with every Pillar opened)"} · ${progress}% to the next`),
        g.branchSlots ? h("div", { class: "ufl-event" }, `${g.branchSlots} Branch slot${g.branchSlots === 1 ? "" : "s"} open: the narrator names a new Branch when you earn it.`) : null,
        g.crossPairs.length ? h("div", { class: "ufl-event" }, `Cross-Pillar Branches unlocked: ${g.crossPairs.map(([a, b]) => `${a} × ${b}`).join(", ")}`) : null,
        h("div", { class: "ufl-sub" }, g.bondFeedback ? "Bond Feedback is live: bound minded familiars feed your attributes." : s.run === "spread" ? "Bond Feedback is the Origin's alone." : "Bond Feedback wakes at Level 15."),
      ),
      section(
        "Gifts and Borrowed Traits",
        s.gifts.length ? h("ul", { class: "ufl-list" }, s.gifts.map((x) => h("li", null, h("b", null, x.name), ` — ${x.desc}`))) : h("div", { class: "ufl-sub" }, "One per open Pillar, from Level 15."),
        g.borrowedSlots ? h("div", { class: "ufl-sub" }, `Borrowed Traits ${s.borrowed.length}/${g.borrowedSlots}: ${s.borrowed.map((b) => b.trait).join(", ") || "none yet (needs Deep Resonance)"}`) : null,
      ),
      section(
        `Tether arts${g.artSlots ? ` · ${g.artSlots} to learn` : ""}`,
        h(
          "ul",
          { class: "ufl-list" },
          g.arts.map((a) => h("li", { class: a.learned ? "" : "ufl-sub" }, a.learned ? "✦ " : "· ", h("b", null, a.name), ` — ${a.desc}${a.learned ? "" : " (locked)"}`)),
        ),
        h("div", { class: "ufl-sub" }, `One new art per Threshold crossed, learned in a story moment that fits. Next Threshold: Level ${g.nextThreshold}.`),
      ),
    ];
  });

  addCardExtra((f, v, client) => {
    const out: (HTMLElement | null)[] = [];
    const raw = f.raw;
    if (f.minded && raw.attrs) {
      out.push(bar(`Lv ${f.level} · XP`, raw.xp, xpToNext(Math.max(1, f.level)), "xp"));
      out.push(
        h(
          "div",
          { class: "ufl-card-meta" },
          ATTR_KEYS.filter((k) => k !== "ctl").map((k) => `${ATTR_SHORT[k]} ${raw.attrs![k]}`).join(" · "),
          raw.feeds.length ? ` · feeds your ${raw.feeds.map((k) => ATTR_SHORT[k]).join(" & ")}` : "",
        ),
      );
      if (raw.unspent > 0) out.push(button(`Place ${raw.unspent} point${raw.unspent === 1 ? "" : "s"}`, () => openFamLevelUp(ctx, client, f), { kind: "small" }));
    }
    const growthLine = kindLine(f);
    if (growthLine) out.push(h("div", { class: "ufl-card-meta" }, growthLine));
    if (f.kind === "vampire") out.push(bloodWindow(f, v));
    if (f.ready && f.state !== "lost" && f.state !== "released") {
      out.push(
        h(
          "div",
          { class: "ufl-pending" },
          h("span", { class: "ufl-grow" }, `Ready: ${f.ready.label}`),
          button("Trigger in the story…", () => chooseEvolution(ctx, client, f), { kind: "small" }),
        ),
      );
    }
    const checks = (v.extras.famChecks as Record<string, FamChecks> | undefined)?.[f.id];
    const learned = (id: string) => (v.extras.growth as GrowthView | undefined)?.arts.find((a) => a.id === id)?.learned;
    if (checks) {
      const row = h("div", { class: "ufl-card-actions" });
      const add = (label: string, reason: string | null, kind: string, title: string) => row.append(button(label, () => client.send("action", { action: { kind, famId: f.id } }), { kind: "small", disabled: !!reason, title: reason ?? title }));
      if (learned("soul_menagerie") && f.state === "active") add("Into soul", checks.soul, "soul", "Soul Menagerie: carry it in your soul");
      if ((learned("gatecalling") && f.state === "slumbering") || f.state === "soul") add("Call", checks.call, "call", f.state === "soul" ? "Bring it out of your soul" : "Gatecalling: summon it from afar");
      if (learned("vessel_riding") && f.state === "active" && !f.inHand) add("Ride", checks.ride, "ride", "Vessel Riding: become its body");
      if (row.childNodes.length) out.push(row);
    }
    return out;
  });
}

function kindLine(f: FamView): string | null {
  const r = f.raw;
  if (f.kind === "beast") return [r.stage ? `Soul Stage: ${f.stage}` : null, r.path ? `Path: ${r.path}` : null, r.traits.length ? `Traits: ${r.traits.join(", ")}` : null].filter(Boolean).join(" · ");
  if (f.kind === "elemental") {
    const core = ELEMENTAL_CORES.find((c) => c.id === r.stage);
    return `Core: ${core?.name ?? "plain"} · forged ${r.fuel.forge ?? 0}${r.path ? ` · ${r.path}` : ""}`;
  }
  if (f.kind === "zombie") {
    const g = ZOMBIE_GRADES.find((c) => c.id === r.stage);
    return `Core: ${g?.name ?? "cracked"} · cores eaten ${r.fuel.cores ?? 0}${r.mutations.length ? ` · mutations: ${r.mutations.join(", ")}` : ""}`;
  }
  if (f.kind === "skeleton" || f.kind === "spirit") {
    const g = ESSENCE_GRADES.find((c) => c.id === r.stage);
    return `${g?.name ?? "Raw"} · essence ${r.fuel.essence ?? 0}${r.echoes.length ? ` · Echoes: ${r.echoes.join(", ")}` : ""}`;
  }
  return null;
}

/** The vampire's blood-red window: rank by closeness to you, bloodline skills, and who stands below. */
function bloodWindow(f: FamView, v: LedgerView): HTMLElement {
  const rank = f.raw.stage ?? "Progenitor";
  const idx = VAMPIRE_RANKS.indexOf(rank);
  const lower = v.roster.filter((x) => x.kind === "vampire" && x.id !== f.id && VAMPIRE_RANKS.indexOf(x.raw.stage ?? "") > idx && x.state !== "lost");
  return h(
    "div",
    { class: "ufl-section ufl-blood" },
    h("div", { class: "ufl-h" }, "Blood window"),
    h(
      "div",
      { class: "ufl-row" },
      VAMPIRE_RANKS.map((r, i) => h("span", { class: "ufl-badge", style: i === idx ? { borderColor: "#b3202e", color: "#ff8a95", fontWeight: "700" } : { opacity: i < idx ? ".5" : ".8" } }, r)),
    ),
    h("div", { class: "ufl-card-meta" }, `Bloodline skills: ${f.raw.traits.filter((t) => /bloodline|blood/i.test(t)).join(", ") || "graded by bloodline name as they appear"}`),
    lower.length ? h("div", { class: "ufl-card-meta" }, `Can lean on the Systems of: ${lower.map((x) => `${x.name} (${x.raw.stage})`).join(", ")}`) : null,
  );
}

function chooseEvolution(ctx: SpindleFrontendContext, client: Client, f: FamView): void {
  const ready = f.ready!;
  if (!ready.options.length) {
    client.send("action", { action: { kind: "evolve", famId: f.id } });
    return;
  }
  const modal = ctx.ui.showModal({ title: `${f.name}: ${ready.label}`, width: 400 });
  modal.root.append(
    h(
      "div",
      { class: "ufl-root ufl-modal" },
      h("div", { class: "ufl-sub" }, "Every evolution is an event. Pick the path; the change happens when the narrator tells it."),
      ready.options.map((o) =>
        h(
          "button",
          {
            type: "button",
            class: "ufl-choice",
            onclick: () => {
              client.send("action", { action: { kind: "evolve", famId: f.id, path: o } });
              modal.dismiss();
            },
          },
          o[0].toUpperCase() + o.slice(1),
        ),
      ),
    ),
  );
}

export function openFamLevelUp(ctx: SpindleFrontendContext, client: Client, f: FamView): void {
  const raw = f.raw;
  if (!raw.attrs || raw.unspent <= 0) return;
  const total = raw.unspent;
  const pts: Record<AttrKey, number> = { str: 0, con: 0, agi: 0, dex: 0, int: 0, ctl: 0 };
  const modal = ctx.ui.showModal({ title: `${f.name}: place ${total} point${total === 1 ? "" : "s"}`, width: 400 });
  const body = h("div", { class: "ufl-root ufl-modal" });
  modal.root.append(body);
  const left = () => total - ATTR_KEYS.reduce((s, k) => s + pts[k], 0);
  const draw = () => {
    clear(body);
    body.append(h("div", { class: "ufl-sub" }, `${left()} left. What it's best at is what it feeds you through Bond Feedback.`));
    for (const k of ATTR_KEYS.filter((x) => x !== "ctl")) {
      body.append(
        h(
          "div",
          { class: "ufl-row" },
          h("div", { class: "ufl-grow" }, h("b", null, ATTR_SHORT[k]), ` ${raw.attrs![k]}${pts[k] ? ` → ${raw.attrs![k] + pts[k]}` : ""}`),
          button("−", () => ((pts[k] = Math.max(0, pts[k] - 1)), draw()), { kind: "small", disabled: !pts[k] }),
          h("b", { style: { width: "26px", textAlign: "center" } }, String(pts[k])),
          button("+", () => ((pts[k] += 1), draw()), { kind: "small", disabled: !left() }),
        ),
      );
    }
    body.append(h("div", { class: "ufl-row" }, h("span", { class: "ufl-grow" }), button("Cancel", () => modal.dismiss()), button("Place", () => (client.send("fam_alloc", { famId: f.id, points: pts }), modal.dismiss()), { kind: "primary", disabled: left() === total })));
  };
  draw();
}
