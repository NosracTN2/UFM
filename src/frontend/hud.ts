// Phone HUD: Health, Mana, Tethers in a small floating widget. Tap to open the panel.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { Client } from "./client";
import { bar, clear, h } from "./dom";

export function isPhone(ctx: SpindleFrontendContext): boolean {
  try {
    if (ctx.client?.getInfo().isMobile) return true;
  } catch {
    /* older hosts */
  }
  return window.innerWidth < 760;
}

export function mountHud(ctx: SpindleFrontendContext, client: Client, openPanel: () => void): (() => void)[] {
  let widget: ReturnType<SpindleFrontendContext["ui"]["createFloatWidget"]> | null = null;
  try {
    widget = ctx.ui.createFloatWidget({
      width: 150,
      height: 84,
      initialPosition: { x: Math.max(8, window.innerWidth - 162), y: 72 },
      snapToEdge: true,
      tooltip: "Familiar Ledger",
      chromeless: true,
    });
  } catch {
    return [];
  }
  const w = widget;
  const root = h("div", { class: "ufl-root", style: { padding: "0", height: "100%" } });
  w.root.append(root);
  const draw = () => {
    const v = client.view;
    const show = !!v?.started && client.settings?.hud !== false && isPhone(ctx);
    w.setVisible(show);
    if (!show || !v) return;
    clear(root);
    root.append(
      h(
        "div",
        { class: "ufl-hud", onclick: openPanel, role: "button", "aria-label": "Open the Familiar panel" },
        h("div", { style: { fontSize: "10px", opacity: ".8", lineHeight: "12px" } }, `Lv ${v.sheet.level} · Floor ${v.world.floor}`),
        bar("HP", v.sheet.hp, v.derived.hpMax, "hp"),
        bar("Mana", v.sheet.mana, v.derived.manaMax, "mana"),
        bar("Tethers", v.derived.tethersUsed, v.derived.tethersTotal, "teth"),
      ),
    );
  };
  const onResize = () => draw();
  window.addEventListener("resize", onResize);
  draw();
  return [client.subscribe(draw), () => window.removeEventListener("resize", onResize), () => w.destroy()];
}
