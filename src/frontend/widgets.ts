// Small reusable modal helpers built on ctx.ui.showModal.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { button, h, input } from "./dom";

export function promptText(ctx: SpindleFrontendContext, title: string, label: string, value = "", placeholder = ""): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const modal = ctx.ui.showModal({ title, width: 380 });
    let cur = value;
    const field = input(value, (v) => (cur = v), { placeholder });
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      resolve(v);
      modal.dismiss();
    };
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish(cur.trim() || null);
    });
    modal.root.append(
      h(
        "div",
        { class: "ufl-root ufl-modal" },
        h("label", { class: "ufl-label" }, label, field),
        h("div", { class: "ufl-row" }, h("span", { class: "ufl-grow" }), button("Cancel", () => finish(null)), button("OK", () => finish(cur.trim() || null), { kind: "primary" })),
      ),
    );
    modal.onDismiss(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    });
    setTimeout(() => field.focus(), 30);
  });
}

export function toast(ctx: SpindleFrontendContext, text: string): void {
  // Frontend has no toast API of its own; ask the backend to show one.
  ctx.sendToBackend({ type: "toast", text });
}
