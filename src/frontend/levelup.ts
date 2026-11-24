// Level-up modal: place unspent attribute points.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { ATTR_KEYS, ATTR_NAMES } from "../shared/data";
import type { AttrKey } from "../shared/types";
import type { Client } from "./client";
import { button, clear, h } from "./dom";

const EFFECT: Partial<Record<AttrKey, string>> = { con: "+10 Health each", int: "+5 Mana each", ctl: "+5 Soul Tethers each" };

export function openLevelUp(ctx: SpindleFrontendContext, client: Client): void {
  const v = client.view;
  if (!v?.started) return;
  const total = v.sheet.unspent;
  if (total <= 0) {
    void ctx.ui.showConfirm({ title: "No points to place", message: "You have no unspent attribute points.", confirmLabel: "OK" });
    return;
  }
  const pts: Record<AttrKey, number> = { str: 0, con: 0, agi: 0, dex: 0, int: 0, ctl: 0 };
  const modal = ctx.ui.showModal({ title: `Place ${total} attribute point${total === 1 ? "" : "s"}`, width: 420 });
  const body = h("div", { class: "ufl-root ufl-modal" });
  modal.root.append(body);
  const left = () => total - ATTR_KEYS.reduce((s, k) => s + pts[k], 0);

  function draw(): void {
    clear(body);
    body.append(h("div", { class: "ufl-sub" }, `${left()} left. Points are yours to place; they roll back if the reply that earned them is swiped away.`));
    for (const k of ATTR_KEYS) {
      body.append(
        h(
          "div",
          { class: "ufl-row" },
          h("div", { class: "ufl-grow" }, h("b", null, ATTR_NAMES[k]), " ", h("span", { class: "ufl-sub" }, `${v!.derived.own[k]}${pts[k] ? ` → ${v!.derived.own[k] + pts[k]}` : ""}${EFFECT[k] ? ` · ${EFFECT[k]}` : ""}`)),
          button("−", () => ((pts[k] = Math.max(0, pts[k] - 1)), draw()), { kind: "small", disabled: pts[k] === 0 }),
          h("b", { style: { width: "26px", textAlign: "center" } }, String(pts[k])),
          button("+", () => ((pts[k] += 1), draw()), { kind: "small", disabled: left() === 0 }),
        ),
      );
    }
    body.append(
      h(
        "div",
        { class: "ufl-row" },
        h("span", { class: "ufl-grow" }),
        button("Cancel", () => modal.dismiss()),
        button("Place", () => {
          client.send("alloc", { points: pts });
          modal.dismiss();
        }, { kind: "primary", disabled: left() === total }),
      ),
    );
  }
  draw();
}
