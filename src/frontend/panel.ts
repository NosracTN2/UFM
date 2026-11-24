// The Familiar panel: top bar, roster cards, Form, squads and the last turn's results.
// Clicks never change state: each becomes a standing order the narrator must confirm.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { FamView, LedgerView } from "../engine/view";
import type { FormOption, FamChecks } from "../engine/panel";
import { ORDER_VERBS, STANCES } from "../shared/data";
import type { Client } from "./client";
import { bar, button, clear, empty, fmt, h, input, section, select } from "./dom";
import { promptText } from "./widgets";

type Tab = "roster" | "form" | "squads" | "turn";
type Filter = "all" | "active" | "slumbering" | "soul" | "lost" | "released";

interface PanelState {
  tab: Tab;
  filter: Filter;
  openOrder: string | null;
  form: { key: string; name: string; element: string; material: string; species: string; stage: string; strong: string };
  squadEdit: string | null;
  squadOrder: Record<string, { verb: string; target: string }>;
  orderDraft: Record<string, { verb: string; target: string }>;
}

const STATE_LABEL: Record<string, string> = { active: "Active", slumbering: "Slumbering", soul: "Carried in soul", lost: "Lost", released: "Released" };

export type CardExtra = (f: FamView, v: LedgerView, client: Client) => (HTMLElement | null)[];
const cardExtras: CardExtra[] = [];
export function addCardExtra(fn: CardExtra): void {
  cardExtras.push(fn);
}
export type PanelNotice = (v: LedgerView, client: Client) => (HTMLElement | null)[];
const notices: PanelNotice[] = [];
export function addPanelNotice(fn: PanelNotice): void {
  notices.push(fn);
}

export function createPanel(ctx: SpindleFrontendContext, client: Client, actions: { openSetup: () => void; openLevelUp: () => void }) {
  const ps: PanelState = {
    tab: "roster",
    filter: "all",
    openOrder: null,
    form: { key: "", name: "", element: "", material: "", species: "", stage: "nascent", strong: "" },
    squadEdit: null,
    squadOrder: {},
    orderDraft: {},
  };
  const root = h("div", { class: "ufl-root" });

  const act = (action: Record<string, unknown>) => client.send("action", { action });

  function render(): void {
    const scrollTop = root.parentElement?.scrollTop ?? 0;
    clear(root);
    const v = client.view;
    if (!client.activeChat) {
      root.append(empty("Open a chat to command your familiars."));
      return;
    }
    if (!v) {
      root.append(empty("Loading the ledger…"));
      return;
    }
    if (!v.started) {
      root.append(
        empty(
          v.enabled ? "Your Awakening is pending. Choose a birthplace and first bond." : "Familiar Ledger isn't running in this chat.",
          button("Start a run", actions.openSetup, { kind: "primary" }),
          v.perms.characters ? button("Install the narrator card", () => client.send("install_card")) : h("small", { class: "ufl-sub" }, "Tip: import card/ufm-narrator.json, or grant “characters” for one-click install."),
        ),
      );
      return;
    }
    root.append(topBar(v));
    for (const fn of notices) for (const el of fn(v, client)) if (el) root.append(el);
    if (v.pending.length) {
      root.append(
        section(
          "Queued for your next message",
          v.pending.map((o) => h("div", { class: "ufl-pending" }, h("span", { class: "ufl-grow" }, o.line), button("✕", () => client.send("cancel_order", { orderId: o.id }), { kind: "small", title: "Cancel this order" }))),
        ),
      );
    }
    if (v.last?.rejected.length) {
      root.append(
        section(
          "Dropped from the last reply",
          v.last.rejected.map((r) => h("div", { class: "ufl-warn" }, h("code", null, r.line), ` — ${r.reason}`)),
        ),
      );
    }
    const tabs: [Tab, string][] = [
      ["roster", `Roster (${v.counts.active ?? 0})`],
      ["form", "Form"],
      ["squads", "Squads"],
      ["turn", "Last turn"],
    ];
    root.append(
      h(
        "div",
        { class: "ufl-tabs" },
        tabs.map(([t, label]) =>
          h(
            "button",
            {
              type: "button",
              class: `ufl-tab${ps.tab === t ? " on" : ""}`,
              onclick: () => {
                ps.tab = t;
                render();
              },
            },
            label,
          ),
        ),
      ),
    );
    if (ps.tab === "roster") root.append(roster(v));
    else if (ps.tab === "form") root.append(formTab(v));
    else if (ps.tab === "squads") root.append(squadsTab(v));
    else root.append(turnTab(v));
    if (root.parentElement) root.parentElement.scrollTop = scrollTop;
  }

  function topBar(v: LedgerView): HTMLElement {
    const s = v.sheet;
    const d = v.derived;
    return h(
      "div",
      { class: "ufl-topbar" },
      bar("Health", s.hp, d.hpMax, "hp"),
      bar("Mana", s.mana, d.manaMax, "mana"),
      bar("Tethers", d.tethersUsed, d.tethersTotal, "teth"),
      bar(`Lv ${s.level} · XP`, s.xp, v.xpNext, "xp"),
      h(
        "div",
        { class: "ufl-row ufl-sub" },
        h("span", { class: "ufl-grow" }, `${v.circle} Circle, ${v.threshold} · Floor ${v.world.floor} · ${v.clock}`),
        s.unspent ? button(`+${s.unspent} points`, actions.openLevelUp, { kind: "small", title: "Place attribute points" }) : null,
      ),
    );
  }

  function roster(v: LedgerView): HTMLElement {
    const wrap = h("div", { class: "ufl-root", style: { padding: "0" } });
    const filters: [Filter, string][] = [
      ["all", "All"],
      ["active", "Active"],
      ["slumbering", "Slumbering"],
      ["soul", "In soul"],
      ["lost", "Lost"],
      ["released", "Released"],
    ];
    wrap.append(
      h(
        "div",
        { class: "ufl-tabs" },
        filters
          .filter(([f]) => f === "all" || f === "active" || (v.counts[f] ?? 0) > 0)
          .map(([f, label]) =>
            h(
              "button",
              {
                type: "button",
                class: `ufl-tab${ps.filter === f ? " on" : ""}`,
                onclick: () => {
                  ps.filter = f;
                  render();
                },
              },
              f === "all" ? label : `${label} ${v.counts[f] ?? 0}`,
            ),
          ),
      ),
    );
    const list = v.roster.filter((f) => (ps.filter === "all" ? f.state !== "lost" && f.state !== "released" : f.state === ps.filter));
    if (!list.length) {
      wrap.append(
        empty(
          v.roster.length ? "No familiars in this state." : "No familiars yet. Form, bind or raise your first one.",
          v.roster.length ? null : button("Open Form", () => ((ps.tab = "form"), render()), { kind: "primary" }),
        ),
      );
      return wrap;
    }
    for (const f of list) wrap.append(card(f, v));
    return wrap;
  }

  function card(f: FamView, v: LedgerView): HTMLElement {
    const checks = (v.extras.famChecks as Record<string, FamChecks> | undefined)?.[f.id];
    const gone = f.state === "lost" || f.state === "released";
    const initials = f.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const portrait = f.portrait ? h("img", { class: "ufl-portrait", src: f.portrait, alt: f.name }) : h("div", { class: "ufl-portrait" }, initials);
    const meta: string[] = [f.label];
    if (f.minded && f.level) meta.push(`Lv ${f.level}`);
    if (f.resonance !== "none") meta.push(`${f.resonance} resonance`);
    const status = f.inHand ? (v.sheet.riding ? "You are riding it" : "In your hand") : f.order ? `Order: ${f.order}` : f.control === "hand" ? "Stands still until guided" : "No order";
    const el = h(
      "div",
      { class: `ufl-card${f.inHand ? " hand" : ""}${gone ? " gone" : ""}${f.ready ? " ready" : ""}${f.kind === "vampire" ? " ufl-blood" : ""}` },
      h(
        "div",
        { class: "ufl-card-head" },
        portrait,
        h("div", { class: "ufl-grow" }, h("div", { class: "ufl-card-name" }, f.name), h("div", { class: "ufl-card-meta" }, meta.join(" · "))),
        h("span", { class: `ufl-badge ufl-badge-${f.state}` }, STATE_LABEL[f.state] ?? f.state),
        f.ready ? h("span", { class: "ufl-badge ufl-badge-ready", title: f.ready.label }, "Ready") : null,
      ),
      h("div", { class: "ufl-card-meta" }, `${f.tether} tether${f.tether === 1 ? "" : "s"} · ${status}${f.stance ? ` · stance ${f.stance}` : ""}`),
      h("div", { class: "ufl-card-meta" }, `Condition: ${f.condition}${f.place && f.state === "slumbering" ? ` · at ${f.place}` : ""}${f.kills ? ` · ${f.kills} kills, ${fmt(f.xpSent)} XP sent` : ""}`),
    );
    for (const fn of cardExtras) for (const x of fn(f, v, client)) if (x) el.append(x);
    if (gone || !checks) return el;

    const btn = (label: string, reason: string | null, onClick: () => void, title?: string) => button(label, onClick, { kind: "small", disabled: !!reason, title: reason ?? title });
    const row = h("div", { class: "ufl-card-actions" });
    if (f.state === "active") {
      if (f.control !== "hand") row.append(btn(f.control === "ask" ? "Ask" : "Order", checks.order, () => ((ps.openOrder = ps.openOrder === f.id ? null : f.id), render())));
      if (f.inHand) row.append(button("Let go", () => act({ kind: "hand", famId: null }), { kind: "small" }));
      else row.append(btn("Take hand", checks.hand, () => act({ kind: "hand", famId: f.id })));
      if (f.control === "stance") {
        row.append(
          select(
            [{ value: "", label: "Stance…" }, ...STANCES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))],
            "",
            (val) => val && act({ kind: "stance", famId: f.id, stance: val }),
            { disabled: !!checks.stance, title: checks.stance ?? "Stance", style: { width: "auto", minHeight: "24px", padding: "2px 6px" } },
          ),
        );
      }
      row.append(btn("Slumber", checks.slumber, () => act({ kind: "slumber", famId: f.id })));
    }
    if (f.state === "slumbering" || f.state === "soul") row.append(btn("Wake", checks.wake, () => act({ kind: "wake", famId: f.id }), "Needs your touch on its stone or water"));
    row.append(
      btn("Rename", null, async () => {
        const name = await promptText(ctx, `Rename ${f.name}`, "New name", f.name);
        if (name && name !== f.name) act({ kind: "rename", famId: f.id, name });
      }),
    );
    row.append(
      btn("Release", checks.release, async () => {
        const { confirmed } = await ctx.ui.showConfirm({ title: `Release ${f.name}?`, message: `The tether lets go for good. ${f.name} will no longer be yours.`, variant: "danger", confirmLabel: "Release" });
        if (confirmed) act({ kind: "release", famId: f.id });
      }),
    );
    el.append(row);
    if (ps.openOrder === f.id) el.append(orderEditor(f));
    return el;
  }

  function orderEditor(f: FamView): HTMLElement {
    const draft = (ps.orderDraft[f.id] ??= { verb: "guard", target: "" });
    const verbs = [...ORDER_VERBS];
    if (f.control !== "undead") verbs.splice(verbs.indexOf("feed"), 1);
    const send = () => {
      if (draft.verb === "feed") act({ kind: "feed", famId: f.id, target: draft.target });
      else act({ kind: "order", famId: f.id, verb: draft.verb, target: draft.target });
      ps.openOrder = null;
      draft.target = "";
      render();
    };
    const target = input(draft.target, (val) => (draft.target = val), { placeholder: draft.verb === "strike" ? "a named target" : draft.verb === "feed" ? "what it feeds on" : "where / what (optional)" });
    target.addEventListener("keydown", (e) => e.key === "Enter" && send());
    return h(
      "div",
      { class: "ufl-row" },
      select(verbs.map((x) => ({ value: x, label: x })), draft.verb, (val) => {
        draft.verb = val;
        render();
      }, { style: { width: "auto" } }),
      h("div", { class: "ufl-grow" }, target),
      button(f.control === "ask" ? "Ask" : "Send", send, { kind: "primary" }),
    );
  }

  function formTab(v: LedgerView): HTMLElement {
    const opts = (v.extras.formOptions as FormOption[] | undefined) ?? [];
    if (!opts.length) return empty("No open Pillar can make familiars yet.");
    if (!opts.some((o) => o.key === ps.form.key)) ps.form.key = (opts.find((o) => o.ok) ?? opts[0]).key;
    const o = opts.find((x) => x.key === ps.form.key)!;
    const elements = (v.extras.elements as string[] | undefined) ?? [];
    if (o.needsElement && !elements.map((e) => e.toLowerCase()).includes(ps.form.element.toLowerCase())) ps.form.element = elements[0] ?? "";
    const f = ps.form;
    const stage = o.stages?.find((s) => s.id === f.stage) ?? o.stages?.[0];
    const tether = stage ? stage.tether : o.tether;
    const cost = `${o.mana ? `${o.mana} Mana` : "No Mana"} · ${tether} tether${tether === 1 ? "" : "s"}`;
    const affordable = v.sheet.mana >= o.mana && v.derived.tethersFree >= tether;
    const blocked = !o.ok ? o.reason : !affordable ? `You have ${v.sheet.mana} Mana and ${v.derived.tethersFree} free tethers` : null;
    const groups = new Map<string, FormOption[]>();
    for (const x of opts) groups.set(x.pillarName, [...(groups.get(x.pillarName) ?? []), x]);
    const formSelect = h(
      "select",
      { class: "ufl-input", onchange: (e: Event) => ((f.key = (e.target as HTMLSelectElement).value), render()) },
      [...groups.entries()].map(([g, xs]) => h("optgroup", { label: g }, xs.map((x) => h("option", { value: x.key }, `${x.label}${x.ok ? "" : " (locked)"}`)))),
    );
    formSelect.value = f.key;
    return h(
      "div",
      { class: "ufl-section" },
      h("label", { class: "ufl-label" }, "Familiar", formSelect),
      h("div", { class: "ufl-sub" }, o.note),
      o.needsElement && elements.length
        ? h("label", { class: "ufl-label" }, "Element", select(elements.map((e) => ({ value: e.toLowerCase(), label: e })), f.element.toLowerCase(), (val) => ((f.element = val), render())))
        : null,
      o.needsElement ? h("label", { class: "ufl-label" }, "Material (optional)", input(f.material, (val) => (f.material = val), { placeholder: "granite, clay, river water…" })) : null,
      o.needsSpecies ? h("label", { class: "ufl-label" }, "Species / what it was", input(f.species, (val) => (f.species = val), { placeholder: "ash wolf, rat, crow…" })) : null,
      o.stages ? h("label", { class: "ufl-label" }, "Soul Stage", select(o.stages.map((s) => ({ value: s.id, label: `${s.name} — ${s.tether} tether(s)` })), f.stage, (val) => ((f.stage = val), render()))) : null,
      h("label", { class: "ufl-label" }, "Name (optional)", input(f.name, (val) => (f.name = val), { placeholder: "Shale" })),
      h(
        "div",
        { class: "ufl-row" },
        h("b", { class: "ufl-grow" }, cost),
        button(
          o.stages ? "Ask its soul" : "Form",
          () => {
            act({ kind: "form", pillar: o.pillar, form: o.form, name: f.name, element: o.needsElement ? f.element : undefined, material: f.material || undefined, species: f.species || undefined, stage: o.stages ? f.stage : undefined });
            f.name = "";
          },
          { kind: "primary", disabled: !!blocked, title: blocked ?? "Queue it for your next message" },
        ),
      ),
      blocked ? h("div", { class: "ufl-warn" }, blocked) : null,
    );
  }

  function squadsTab(v: LedgerView): HTMLElement {
    const wrap = h("div", { class: "ufl-root", style: { padding: "0" } });
    const active = v.roster.filter((f) => f.state === "active");
    wrap.append(
      h(
        "div",
        { class: "ufl-row" },
        h("span", { class: "ufl-grow ufl-sub" }, "Group familiars and give one order to all."),
        button("New squad", async () => {
          const name = await promptText(ctx, "New squad", "Squad name", "", "wall crew");
          if (name) client.send("squad", { op: "create", name, members: [] });
        }),
      ),
    );
    if (!v.squads.length) wrap.append(empty("No squads yet."));
    for (const s of v.squads) {
      const members = s.members.map((id) => v.roster.find((f) => f.id === id)).filter((f): f is FamView => !!f);
      const draft = (ps.squadOrder[s.id] ??= { verb: "guard", target: "" });
      const sec = section(
        s.name,
        h("div", { class: "ufl-sub" }, members.length ? members.map((m) => `${m.name}${m.state !== "active" ? ` (${m.state})` : ""}`).join(", ") : "No members"),
      );
      if (ps.squadEdit === s.id) {
        const chosen = new Set(s.members);
        sec.append(
          h(
            "div",
            { class: "ufl-scroll" },
            v.roster
              .filter((f) => f.state !== "lost" && f.state !== "released")
              .map((f) =>
                h(
                  "label",
                  { class: "ufl-row" },
                  h("input", { type: "checkbox", checked: chosen.has(f.id), onchange: (e: Event) => ((e.target as HTMLInputElement).checked ? chosen.add(f.id) : chosen.delete(f.id)) }),
                  f.name,
                ),
              ),
          ),
          h(
            "div",
            { class: "ufl-row" },
            button("Done", () => {
              client.send("squad", { op: "set", id: s.id, members: [...chosen] });
              ps.squadEdit = null;
            }, { kind: "primary" }),
            button("Delete squad", () => client.send("squad", { op: "delete", id: s.id }), { kind: "danger" }),
          ),
        );
      } else {
        const can = members.some((m) => m.state === "active");
        sec.append(
          h(
            "div",
            { class: "ufl-row" },
            select(ORDER_VERBS.filter((x) => x !== "feed").map((x) => ({ value: x, label: x })), draft.verb, (val) => (draft.verb = val), { style: { width: "auto" } }),
            h("div", { class: "ufl-grow" }, input(draft.target, (val) => (draft.target = val), { placeholder: "where / what" })),
            button("Order all", () => act({ kind: "squad_order", squadName: s.name, famIds: members.filter((m) => m.state === "active").map((m) => m.id), verb: draft.verb, target: draft.target }), { kind: "primary", disabled: !can }),
          ),
          button("Edit members", () => ((ps.squadEdit = s.id), render()), { kind: "small" }),
        );
      }
      wrap.append(sec);
    }
    if (!active.length && v.squads.length) wrap.append(h("div", { class: "ufl-sub" }, "No active familiars to order."));
    return wrap;
  }

  function turnTab(v: LedgerView): HTMLElement {
    const last = v.last;
    if (!last) return empty("No narrator reply yet.");
    return h(
      "div",
      { class: "ufl-root", style: { padding: "0" } },
      section("Applied", last.applied.length ? h("ul", { class: "ufl-list" }, last.applied.map((l) => h("li", { class: "ufl-code" }, l))) : h("div", { class: "ufl-sub" }, "Nothing changed.")),
      last.notes.length ? section("Ledger notes", h("ul", { class: "ufl-list" }, last.notes.map((n) => h("li", null, n)))) : null,
      last.events.length ? section("System", last.events.map((e) => h("div", { class: `ufl-event${e.big ? " big" : ""}` }, e.text))) : null,
      last.rejected.length ? section("Dropped", last.rejected.map((r) => h("div", { class: "ufl-warn" }, h("code", null, r.line), ` — ${r.reason}`))) : null,
    );
  }

  return { root, render };
}
