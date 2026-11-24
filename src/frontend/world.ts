// World UI: the World tab, the enemy window, motive cutaways, and living-world settings.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { EnemyView } from "../engine/world";
import type { LedgerView } from "../engine/view";
import type { Npc } from "../shared/types";
import type { Client } from "./client";
import { bar, button, clear, empty, fmt, h, section, select } from "./dom";
import { addPanelNotice } from "./panel";
import { addSettingsSection, toggle } from "./settings";

interface WorldView {
  band: { min: number; max: number };
  heat: { id: string; name: string; heat: number }[];
  decree00: number;
  whoKnows: { text: string; about: string; weight: number; holders: { name: string; alive: boolean; faction: string | null }[] }[];
  npcs: Npc[];
  enemy: EnemyView | null;
  enemies: (EnemyView | null)[];
  threads: { id: string; text: string; open: boolean }[];
  offscreenPending: boolean;
}

const ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21V5l4-2 4 2v16"/><path d="M5 21h14M11 9h2M11 13h2M11 17h2"/></svg>';

export function enemyCard(e: EnemyView, onClose?: () => void): HTMLElement {
  const fog = (v: string | null) => (e.fogged ? "▒▒▒ (fogged)" : (v ?? "—"));
  return h(
    "div",
    { class: "ufl-section", style: { borderColor: e.circleAbove ? "var(--ufl-danger)" : undefined } },
    h("div", { class: "ufl-h" }, `Window · ${e.name}`, onClose ? button("✕", onClose, { kind: "small" }) : null),
    h(
      "dl",
      { class: "ufl-kv" },
      h("dt", null, "Level"),
      h("dd", null, `${e.level}${e.circleAbove ? " — a Circle above you" : ""}`),
      h("dt", null, "Class"),
      h("dd", null, e.className ?? "—"),
      h("dt", null, "Lineage"),
      h("dd", null, fog(e.lineage)),
      h("dt", null, "Rarity"),
      h("dd", null, fog(e.rarity)),
      h("dt", null, "If a familiar kills it"),
      h("dd", null, `${fmt(e.payByFamiliar)} XP`),
    ),
    h("div", { class: "ufl-sub" }, `Floor ${e.floor} band: Level ${e.band.min}–${e.band.max}.${e.notes ? ` ${e.notes}.` : ""}`),
  );
}

function renderWorld(root: HTMLElement, client: Client): void {
  clear(root);
  const v = client.view;
  const w = v?.extras.world as WorldView | undefined;
  if (!v?.started || !w) {
    root.append(empty(client.activeChat ? "The world fills in once your run starts." : "Open a chat to see the Tower."));
    return;
  }
  const clock = v.world.clocks[String(v.world.floor)];
  root.append(
    section(
      `Floor ${v.world.floor}`,
      h("div", null, `${v.world.place || "somewhere"} · ${v.clock}${clock?.weather ? ` · ${clock.weather}` : ""}`),
      h("div", { class: "ufl-sub" }, `Enemy band: Level ${w.band.min}–${w.band.max}; its Guardian sits at the top. Faction climbers bring their own level.`),
      Object.keys(v.world.clocks).length > 1 ? h("div", { class: "ufl-sub" }, `Other floor clocks: ${Object.entries(v.world.clocks).filter(([f]) => Number(f) !== v.world.floor).map(([f, c]) => `Floor ${f} day ${Math.floor(c.hours / 24) + 1}`).join(" · ")}`) : null,
      w.offscreenPending ? h("div", { class: "ufl-event" }, "The Tower is moving offscreen…") : null,
    ),
  );
  if (w.enemy) root.append(enemyCard(w.enemy));
  const maxHeat = Math.max(10, ...w.heat.map((x) => x.heat), w.decree00);
  root.append(
    section(
      "Heat",
      w.heat.map((x) => bar(x.name, x.heat, maxHeat, "hp")),
      bar("Decree 00", w.decree00, maxHeat, "teth"),
      h("div", { class: "ufl-sub" }, "Heat comes from what they know. Kill every witness and they still don't know."),
    ),
  );
  root.append(
    section(
      "Who knows what",
      w.whoKnows.length
        ? h(
            "ul",
            { class: "ufl-list" },
            w.whoKnows.map((k) =>
              h(
                "li",
                null,
                h("div", null, k.text, h("span", { class: "ufl-sub" }, k.about !== "you" ? ` (about ${k.about})` : "")),
                h(
                  "div",
                  { class: "ufl-sub" },
                  k.holders.map((x, i) => h("span", { style: x.alive ? {} : { textDecoration: "line-through" }, title: x.alive ? "" : "dead: it died with them" }, `${i ? ", " : ""}${x.name}`)),
                ),
              ),
            ),
          )
        : h("div", { class: "ufl-sub" }, "No one knows anything about you. Yet."),
    ),
  );
  const people = [...w.npcs].sort((a, b) => Number(b.alive) - Number(a.alive));
  root.append(
    section(
      `People met (${people.length})`,
      people.length
        ? people.map((n) =>
            h(
              "div",
              { class: "ufl-card", style: n.alive ? {} : { opacity: ".55" } },
              h("div", { class: "ufl-card-name" }, `${n.name}${n.alive ? "" : " (dead)"}`, h("span", { class: "ufl-sub" }, [n.faction, n.rank].filter(Boolean).length ? ` · ${[n.faction, n.rank].filter(Boolean).join(", ")}` : "")),
              n.voice ? h("div", { class: "ufl-card-meta" }, `Voice: ${n.voice}`) : h("div", { class: "ufl-card-meta" }, "No voice notes yet"),
              n.wounds.length ? h("div", { class: "ufl-card-meta" }, `Wounds: ${n.wounds.join(", ")}`) : null,
              n.grudges.length ? h("div", { class: "ufl-card-meta" }, `Grudges: ${n.grudges.join(", ")}`) : null,
              n.news.length ? h("div", { class: "ufl-event" }, `Changed since you saw them (they'll show it): ${n.news.join(" ")}`) : null,
              n.goal ? h("details", null, h("summary", { class: "ufl-sub" }, "What they want offscreen (you know, your character doesn't)"), h("div", { class: "ufl-card-meta" }, n.goal)) : null,
            ),
          )
        : h("div", { class: "ufl-sub" }, "No one tracked yet. The narrator records people with the npc line."),
    ),
  );
  const open = w.threads.filter((t) => t.open);
  const closed = w.threads.filter((t) => !t.open);
  root.append(section("Threads", open.length ? h("ul", { class: "ufl-list" }, open.map((t) => h("li", null, t.text))) : h("div", { class: "ufl-sub" }, "No open threads."), closed.length ? h("div", { class: "ufl-sub" }, `Closed: ${closed.map((t) => t.text).join("; ")}`) : null));
  const seen = w.enemies.filter((e): e is EnemyView => !!e);
  if (seen.length > 1) root.append(section("Enemies seen", h("ul", { class: "ufl-list" }, seen.map((e) => h("li", null, `${e.name} · Lv ${e.level}${e.className ? ` · ${e.className}` : ""}${e.notes ? ` · ${e.notes}` : ""}`)))));
}

export function mountWorldUi(ctx: SpindleFrontendContext, client: Client): (() => void)[] {
  const cleanups: (() => void)[] = [];
  const tab = ctx.ui.registerDrawerTab({ id: "world", title: "Tower — World", shortName: "World", description: "Floors, heat, who knows what, people met", keywords: ["ufm", "heat", "npc", "faction", "floor"], iconSvg: ICON });
  const root = h("div", { class: "ufl-root" });
  tab.root.append(root);
  const draw = () => renderWorld(root, client);
  cleanups.push(client.subscribe(draw), tab.onActivate(() => client.refreshActive()), () => tab.destroy());
  draw();

  // Motive cutaways: marked as something you know and your character doesn't.
  const injected = new Map<string, Element>();
  cleanups.push(
    ctx.messages.registerTagInterceptor({ tagName: "ufm-cutaway", removeFromMessage: true }, (p) => {
      if (p.isStreaming || !p.messageId) return;
      const key = `${p.messageId}:${p.content.length}:${p.attrs?.who ?? ""}`;
      if (injected.has(key)) return;
      const who = p.attrs?.who ?? "someone";
      const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
      const html = `<div class="ufl-cutaway"><div class="ufl-cutaway-h">Cutaway · ${esc(who)} · you know this, your character doesn't</div><div>${esc(p.content.trim()).replace(/\n/g, "<br>")}</div></div>`;
      let tries = 0;
      const place = () => {
        const bubble = ctx.dom.findMessageElement?.(p.messageId!);
        if (!bubble) {
          if (tries++ < 10) setTimeout(place, 150);
          return;
        }
        injected.set(key, ctx.dom.inject(bubble, html, "beforeend"));
      };
      place();
    }),
  );
  cleanups.push(() => {
    for (const el of injected.values()) ctx.dom.uninject?.(el);
  });
  return cleanups;
}

export function installWorldUi(): void {
  const hidden = new Set<string>();
  addPanelNotice((v: LedgerView, client: Client) => {
    const w = v.extras.world as WorldView | undefined;
    if (!w?.enemy || hidden.has(`${v.chatId}:${w.enemy.id}:${w.enemy.level}`)) return [];
    const key = `${v.chatId}:${w.enemy.id}:${w.enemy.level}`;
    return [
      enemyCard(w.enemy, () => {
        hidden.add(key);
        client.notify();
      }),
    ];
  });

  addSettingsSection((s, set, { conns }) =>
    section(
      "Living world",
      toggle(
        "Offscreen lives",
        "On time skips (12h+) and floor changes, a cheap background call updates each tracked person and faction: new wound, rank, grudge, news, a decision made without you. They come back changed.",
        s.offscreen.enabled,
        (v) => set({ offscreen: { ...s.offscreen, enabled: v } }),
      ),
      h(
        "label",
        { class: "ufl-label" },
        "Connection for offscreen lives",
        select([{ value: "", label: "Active connection" }, ...conns.llm.map((c) => ({ value: c.id, label: c.name }))], s.offscreen.connectionId ?? "", (v) => set({ offscreen: { ...s.offscreen, connectionId: v || null } })),
      ),
      toggle("Motive cutaways", "When an NPC makes a big choice, the narrator may show a short scene from their head, marked in the chat as something you know and your character doesn't.", s.cutaways, (v) => set({ cutaways: v })),
    ),
  );
}
