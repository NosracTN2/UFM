// New-run setup: birthplace, first bond, Branch, name. Origin, the spread and sandbox.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { BIRTHPLACES, birthplaceDef, floorBand, pillarDef, RARITIES, rarityDef, STARTER_POOL } from "../shared/data";
import type { RunType } from "../shared/types";
import type { Client } from "./client";
import { button, clear, h, input, select } from "./dom";

type Method = "birthplace" | "random" | "pick" | "preset";

interface Draft {
  run: RunType;
  birthplace: string; // id or "custom"
  customText: string;
  customFloor: number;
  customPeople: string;
  method: Method;
  pillar: string;
  extra: string[];
  rarity: string;
  className: string;
  branchChoice: string; // set branch name or "__own"
  ownBranch: string;
  name: string;
}

export function openSetup(ctx: SpindleFrontendContext, client: Client, runHint?: string | null): void {
  const v = client.view;
  const chatId = client.activeChat;
  if (!chatId) return;
  const d: Draft = {
    run: (runHint === "spread" || runHint === "sandbox" ? runHint : v?.runHint ?? "origin") as RunType,
    birthplace: "mining",
    customText: "",
    customFloor: 1,
    customPeople: "",
    method: "birthplace",
    pillar: "elemental",
    extra: [],
    rarity: "rare",
    className: "",
    branchChoice: "Earth",
    ownBranch: "",
    name: "",
  };
  const rolls: Record<string, { value: string; locked: boolean }> = {};
  const modal = ctx.ui.showModal({ title: "A new Awakening", width: 560, maxHeight: 720, persistent: true });
  const body = h("div", { class: "ufl-root ufl-modal" });
  modal.root.append(body);

  const offRoll = client.subscribeMsg("roll", (m) => {
    if (m.chatId !== chatId) return;
    rolls[m.what] = { value: m.value, locked: m.locked };
    if (m.what === "pillar") {
      d.pillar = m.value;
      d.branchChoice = pillarDef(m.value)?.branches[0] ?? "__own";
    } else if (m.what === "birthplace") d.birthplace = m.value;
    else if (m.what === "rarity") d.rarity = m.value;
    draw();
  });
  modal.onDismiss(() => offRoll());

  const bp = () => birthplaceDef(d.birthplace);
  const floor = () => bp()?.floor ?? d.customFloor;
  const fits = () => (bp()?.fits ?? []).map((id) => pillarDef(id)!).filter(Boolean);
  const maxExtra = () => (d.run === "sandbox" ? 2 : d.run === "spread" ? Math.max(0, (rarityDef(d.rarity)?.maxPillars ?? 1) - 1) : 0);

  function choice(label: string, sub: string, on: boolean, onClick: () => void): HTMLElement {
    return h("button", { type: "button", class: `ufl-choice${on ? " on" : ""}`, onclick: onClick }, label, sub ? h("small", null, sub) : null);
  }

  function setPillar(id: string) {
    d.pillar = id;
    d.extra = d.extra.filter((x) => x !== id);
    const p = pillarDef(id);
    d.branchChoice = p?.branches[0] ?? "__own";
  }

  function draw(): void {
    clear(body);
    // 0 · Run type
    body.append(
      h("h4", { class: "ufl-h" }, "Run"),
      h(
        "div",
        { class: "ufl-grid", style: { gridTemplateColumns: "repeat(3, 1fr)" } },
        choice("Origin", "Ultimate Familiar Master: 50 Pillars behind [???]", d.run === "origin", () => ((d.run = "origin"), (d.extra = []), draw())),
        choice("The spread", "A derived class with rarity and Branch rate", d.run === "spread", () => ((d.run = "spread"), draw())),
        choice("Sandbox", "Origin, three Pillars open, no clock", d.run === "sandbox", () => ((d.run = "sandbox"), draw())),
      ),
    );

    // 1 · Birthplace
    const bpOpts = [...BIRTHPLACES.map((b) => ({ value: b.id, label: `${b.name} — ${b.people}` })), { value: "custom", label: "Describe your own…" }];
    body.append(
      h("h4", { class: "ufl-h" }, "1 · Birthplace", button("Reese's path", () => {
        d.birthplace = "mining";
        d.method = "preset";
        setPillar("elemental");
        d.branchChoice = "Earth";
        draw();
      }, { kind: "small", title: "Mining town · Elemental Creation · Earth" })),
      h(
        "div",
        { class: "ufl-row" },
        h("div", { class: "ufl-grow" }, select(bpOpts, d.birthplace, (val) => ((d.birthplace = val), d.method === "birthplace" && fits()[0] && setPillar(fits()[0].id), draw()))),
        button(rolls.birthplace ? (rolls.birthplace.locked ? "Rolled" : "Reroll") : "Roll one", () => client.send("roll", { what: "birthplace", reroll: !!rolls.birthplace }), {
          disabled: !!rolls.birthplace?.locked,
          title: rolls.birthplace?.locked ? "No rerolls (turn them on in settings)" : "Roll a birthplace",
        }),
      ),
    );
    if (d.birthplace === "custom") {
      body.append(
        h("label", { class: "ufl-label" }, "Where were you born?", h("textarea", { class: "ufl-input", oninput: (e: Event) => (d.customText = (e.target as HTMLTextAreaElement).value) }, d.customText)),
        h(
          "div",
          { class: "ufl-row" },
          h("label", { class: "ufl-label", style: { width: "110px" } }, "Floor", input(String(d.customFloor), (val) => (d.customFloor = Math.max(1, Math.min(100, Number(val) || 1))), { type: "number", min: 1, max: 100, onchange: () => draw() })),
          h("label", { class: "ufl-label ufl-grow" }, "Your people", input(d.customPeople, (val) => (d.customPeople = val), { placeholder: "e.g. non-human, salt-folk" })),
        ),
        h("div", { class: "ufl-sub" }, "The narrator builds this place and suggests which Pillars fit it."),
      );
    } else {
      const b = bp()!;
      body.append(
        h(
          "div",
          { class: "ufl-sub" },
          `Floor ${b.floor}${b.floorGameOnly ? " (game-only)" : ""} · ${b.band} band · start at Level ${floorBand(b.floor).min} · fits ${b.fits.map((f) => pillarDef(f)?.name).join(", ")}${b.registryDays ? ` · ${b.registryDays}-day Registry clock` : ""}`,
        ),
      );
    }

    // 2 · First bond
    body.append(h("h4", { class: "ufl-h" }, "2 · First bond"));
    const methods: [Method, string][] = [
      ["birthplace", "From your birthplace"],
      ["random", "Fully random"],
      ["pick", "Your pick"],
    ];
    body.append(
      h(
        "div",
        { class: "ufl-tabs" },
        methods.map(([m, label]) =>
          h("button", { type: "button", class: `ufl-tab${d.method === m ? " on" : ""}`, onclick: () => ((d.method = m), m === "birthplace" && fits()[0] && setPillar(fits()[0].id), draw()) }, label),
        ),
      ),
    );
    if (d.method === "birthplace" || d.method === "preset") {
      const list = fits().length ? fits() : STARTER_POOL;
      if (!fits().length) body.append(h("div", { class: "ufl-sub" }, "Your own birthplace: pick what fits it (the narrator will suggest too)."));
      body.append(h("div", { class: "ufl-scroll" }, list.map((p) => choice(p.name, `${p.familiars}${p.floors ? "" : " · beyond the Tower"}`, d.pillar === p.id, () => (setPillar(p.id), draw())))));
    } else if (d.method === "random") {
      const r = rolls.pillar;
      body.append(
        h(
          "div",
          { class: "ufl-row" },
          h("div", { class: "ufl-grow" }, r ? h("b", null, `The Tower woke: ${pillarDef(r.value)?.name}`) : h("span", { class: "ufl-sub" }, "Roll from the 49-Pillar starter pool. The Awakening window reveals it.")),
          button(r ? (r.locked ? "Rolled" : "Reroll") : "Roll", () => client.send("roll", { what: "pillar", reroll: !!r }), { kind: r ? undefined : "primary", disabled: !!r?.locked, title: r?.locked ? "No rerolls (turn them on in settings)" : "" }),
        ),
      );
    } else {
      const tower = STARTER_POOL.filter((p) => p.floors);
      const beyond = STARTER_POOL.filter((p) => !p.floors);
      const sel = h(
        "select",
        { class: "ufl-input", onchange: (e: Event) => (setPillar((e.target as HTMLSelectElement).value), draw()) },
        h("optgroup", { label: "The Tower's twelve" }, tower.map((p) => h("option", { value: p.id }, `${p.num}. ${p.name}`))),
        h("optgroup", { label: "Beyond the Tower" }, beyond.map((p) => h("option", { value: p.id }, `${p.num}. ${p.name}${p.gameOnly ? " (game-only sheet)" : ""}`))),
      );
      sel.value = d.pillar;
      body.append(sel);
    }
    const p = pillarDef(d.pillar)!;
    body.append(h("div", { class: "ufl-sub" }, `${p.name}: ${p.familiars}. Level 1 tools are humble: ${p.starter}.`));

    // Spread: rarity + extra Pillars + class name. Sandbox: two more Pillars.
    if (d.run === "spread") {
      body.append(
        h("h4", { class: "ufl-h" }, "Class"),
        h(
          "div",
          { class: "ufl-row" },
          h("div", { class: "ufl-grow" }, select(RARITIES.map((r) => ({ value: r.id, label: `${r.name} — a new Branch every ${r.levelsPerBranch} levels, up to ${r.maxPillars} Pillar(s)` })), d.rarity, (val) => ((d.rarity = val), (d.extra = d.extra.slice(0, maxExtra())), draw()))),
          button(rolls.rarity ? "Rolled" : "Roll rarity", () => client.send("roll", { what: "rarity", reroll: !!rolls.rarity }), { disabled: !!rolls.rarity?.locked }),
        ),
        h("label", { class: "ufl-label" }, "Class name (optional)", input(d.className, (val) => (d.className = val), { placeholder: p.className })),
        h("div", { class: "ufl-sub" }, "Each extra Pillar slows your Branch rate. Multiple Pillars are normal from Very rare up."),
      );
    }
    if (maxExtra() > 0) {
      body.append(h("h4", { class: "ufl-h" }, d.run === "sandbox" ? "Two more Pillars" : `Extra Pillars (up to ${maxExtra()})`));
      for (let i = 0; i < maxExtra(); i++) {
        const cur = d.extra[i] ?? "";
        body.append(
          select(
            [{ value: "", label: "—" }, ...STARTER_POOL.filter((x) => x.id !== d.pillar).map((x) => ({ value: x.id, label: `${x.num}. ${x.name}` }))],
            cur,
            (val) => {
              const next = [...d.extra];
              next[i] = val;
              d.extra = next.filter(Boolean);
              draw();
            },
          ),
        );
      }
    }

    // 3 · Branch
    body.append(h("h4", { class: "ufl-h" }, "3 · First Branch (No Mastery)"));
    body.append(
      h(
        "div",
        { class: "ufl-tabs" },
        p.branches.map((b) => h("button", { type: "button", class: `ufl-tab${d.branchChoice === b ? " on" : ""}`, onclick: () => ((d.branchChoice = b), draw()) }, b)),
        h("button", { type: "button", class: `ufl-tab${d.branchChoice === "__own" ? " on" : ""}`, onclick: () => ((d.branchChoice = "__own"), draw()) }, "Born from your birthplace…"),
      ),
    );
    if (d.branchChoice === "__own") body.append(input(d.ownBranch, (val) => (d.ownBranch = val), { placeholder: "e.g. Salt, Deep Stone, Lantern-light" }));
    const startLevel = floorBand(floor()).min;
    if (startLevel >= 10) body.append(h("div", { class: "ufl-sub" }, `A Level ${startLevel} start opens ${Math.floor(startLevel / 10)} more Branch(es) to match.`));

    // 4 · Name
    body.append(h("h4", { class: "ufl-h" }, "4 · Name"), input(d.name, (val) => (d.name = val), { placeholder: "Your character's name (default: You)" }));

    const ready = d.method !== "random" || !!rolls.pillar;
    body.append(
      h(
        "div",
        { class: "ufl-row", style: { marginTop: "6px" } },
        h("span", { class: "ufl-grow ufl-sub" }, `Start: Level ${startLevel} · ${p.name} · ${d.branchChoice === "__own" ? d.ownBranch || "your own Branch" : d.branchChoice}`),
        button("Cancel", () => modal.dismiss()),
        button("Awaken", submit, { kind: "primary", disabled: !ready || (d.branchChoice === "__own" && !d.ownBranch.trim()) }),
      ),
    );
  }

  async function submit(): Promise<void> {
    if (client.views.get(chatId!)?.started) {
      const { confirmed } = await ctx.ui.showConfirm({ title: "Replace this run?", message: "This chat already has a run. Starting over replaces the starting sheet; the change log in the chat stays.", variant: "warning", confirmLabel: "Replace" });
      if (!confirmed) return;
    }
    const setup = {
      run: d.run,
      name: d.name,
      birthplace: d.birthplace,
      customBirthplace: d.customText,
      people: d.customPeople,
      floor: floor(),
      pillar: d.pillar,
      extraPillars: d.extra,
      branch: d.branchChoice === "__own" ? d.ownBranch : d.branchChoice,
      rarity: d.run === "spread" ? d.rarity : undefined,
      className: d.className,
      method: d.method,
      seed: "",
    };
    client.send("setup", { setup });
    modal.dismiss();
  }

  draw();
}
