// Settings page: Settings → Familiar Ledger (or the Extensions settings area on older hosts).

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { Settings } from "../shared/types";
import type { Client } from "./client";
import { clear, empty, h, section, select } from "./dom";

export type SettingsSection = (s: Settings, set: (patch: Partial<Settings>) => void, extra: { conns: Conns; client: Client }) => HTMLElement | null;
const sections: SettingsSection[] = [];
export function addSettingsSection(fn: SettingsSection): void {
  sections.push(fn);
}

export interface Conns {
  llm: { id: string; name: string }[];
  decision: { id: string; name: string }[];
}

export function toggle(label: string, help: string, on: boolean, onChange: (v: boolean) => void): HTMLElement {
  return h(
    "label",
    { class: "ufl-row", style: { alignItems: "flex-start", cursor: "pointer", margin: "4px 0", flexWrap: "nowrap" } },
    h("input", { type: "checkbox", checked: on, style: { marginTop: "3px" }, onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked) }),
    h("div", { class: "ufl-grow" }, h("div", null, label), help ? h("div", { class: "ufl-sub" }, help) : null),
  );
}

export function mountSettings(ctx: SpindleFrontendContext, client: Client): (() => void)[] {
  const root = h("div", { class: "ufl-root" });
  const cleanups: (() => void)[] = [];
  let conns: Conns = { llm: [], decision: [] };
  try {
    if (ctx.ui.registerSettingsTab) {
      const tab = ctx.ui.registerSettingsTab({
        id: "familiar_ledger",
        title: "Familiar Ledger",
        shortName: "Ledger",
        description: "Rules, the rule check, living world and canon settings for Ultimate Familiar Mastery",
        keywords: ["ufm", "narrow tether", "rule check", "canon", "familiar"],
        position: "bottom",
      });
      tab.root.append(root);
      cleanups.push(tab.onActivate(() => refresh()), () => tab.destroy());
    } else {
      ctx.ui.mount("settings_extensions").append(root);
      cleanups.push(() => root.remove());
    }
  } catch {
    return cleanups;
  }

  const set = (patch: Partial<Settings>) => client.send("settings_set", { patch });
  const refresh = () => {
    client.send("settings_get");
    client.send("connections");
  };
  cleanups.push(
    client.subscribeMsg("connections", (m) => {
      conns = { llm: m.llm ?? [], decision: m.decision ?? [] };
      render();
    }),
  );
  cleanups.push(client.subscribe(() => render()));

  function render(): void {
    clear(root);
    const s = client.settings;
    if (!s) {
      root.append(empty("Loading settings…"));
      return;
    }
    root.append(
      section(
        "Rules",
        toggle("Narrow tether (Origin runs)", "Below Level 15 most kill XP spills: a random 10–30% reaches you, revealed at the First Threshold.", s.narrowTether, (v) => set({ narrowTether: v })),
        toggle("Allow rerolls in setup", "Off: a random birthplace, rarity or first bond is final.", s.rerolls, (v) => set({ rerolls: v })),
        h(
          "label",
          { class: "ufl-label" },
          "Keep the <ufm> tag in the last N replies sent to the model (older ones are trimmed to save tokens)",
          select(["0", "1", "2", "3", "5"].map((x) => ({ value: x, label: x })), String(s.historyTags), (v) => set({ historyTags: Number(v) }), { style: { width: "90px" } }),
        ),
      ),
    );
    const modeOpts = [
      { value: "quiet", label: "Quiet generation (suggests exact fix lines)" },
      { value: "decision", label: "Decision model (flags likely misses)" },
    ];
    const list = s.check.mode === "decision" ? conns.decision : conns.llm;
    root.append(
      section(
        "Second-model rule check",
        toggle("Check each reply", "A cheap model reads every new reply and asks whether anything died, arrived or changed that the tag missed. It suggests fixes in the Familiar panel; nothing is applied until you accept.", s.check.enabled, (v) => set({ check: { ...s.check, enabled: v } })),
        h("label", { class: "ufl-label" }, "How", select(modeOpts, s.check.mode, (v) => set({ check: { ...s.check, mode: v as Settings["check"]["mode"], connectionId: null } }))),
        h(
          "label",
          { class: "ufl-label" },
          "Connection",
          select([{ value: "", label: s.check.mode === "decision" ? "Default Decision connection" : "Active connection" }, ...list.map((c) => ({ value: c.id, label: c.name }))], s.check.connectionId ?? "", (v) =>
            set({ check: { ...s.check, connectionId: v || null } }),
          ),
        ),
        !list.length
          ? h(
              "div",
              { class: "ufl-sub" },
              s.check.mode === "decision"
                ? "No Decision connections found (needs the “decisions” permission and a saved Decision connection)."
                : client.view?.perms.generation === false
                  ? "Connections appear here once the “generation” permission is granted."
                  : "No other connections found; the active one is used.",
            )
          : null,
      ),
    );
    for (const fn of sections) {
      const el = fn(s, set, { conns, client });
      if (el) root.append(el);
    }
  }

  refresh();
  render();
  return cleanups;
}
