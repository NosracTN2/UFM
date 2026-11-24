// Rule-check suggestions and manual fixes in the panel.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { Client } from "./client";
import { button, h, section } from "./dom";
import { addPanelNotice } from "./panel";
import { promptText } from "./widgets";

export function installCheckUi(ctx: SpindleFrontendContext): void {
  addPanelNotice((v, client: Client) => {
    if (!v.suggestions.length) return [];
    const items = v.suggestions.flatMap(({ key, items }) =>
      items.map((s) =>
        h(
          "div",
          { class: "ufl-pending", style: { flexDirection: "column", alignItems: "stretch" } },
          s.op ? h("code", { class: "ufl-code" }, s.op) : null,
          h("div", { class: "ufl-sub" }, s.why),
          h(
            "div",
            { class: "ufl-row" },
            s.op ? button("Apply", () => client.send("suggestion", { key, id: s.id, action: "accept" }), { kind: "small" }) : null,
            button(s.op ? "Edit…" : "Add a fix…", async () => {
              const line = await promptText(ctx, "Fix the change log", "One tag line (e.g. lose \"Puppet 2\")", s.op);
              if (line) client.send("suggestion", { key, id: s.id, action: "accept", op: line });
            }, { kind: "small" }),
            button("Dismiss", () => client.send("suggestion", { key, id: s.id, action: "dismiss" }), { kind: "small" }),
          ),
        ),
      ),
    );
    return [section("Rule check: possibly missed", ...items)];
  });
}

export async function manualFix(ctx: SpindleFrontendContext, client: Client): Promise<void> {
  const line = await promptText(ctx, "Fix the last reply", "Tag line(s) to add, one per line is fine with “;”", "", 'lose "Puppet 2"');
  if (line) client.send("amend", { lines: line.split(/\s*;\s*/).join("\n") });
}
