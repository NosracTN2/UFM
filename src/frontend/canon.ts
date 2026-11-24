// Settings: canon sync and the Read-up-to bookmark; portraits; HUD.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { Client } from "./client";
import { button, h, input, section, select } from "./dom";
import { addSettingsSection, toggle } from "./settings";

export function installCanonSettings(ctx: SpindleFrontendContext, client: Client): (() => void)[] {
  let files: string[] | null = null;
  let last = "";
  const cleanups = [
    client.subscribeMsg("canon_files", (m) => {
      files = m.files ?? [];
      client.notify();
    }),
    client.subscribeMsg("canon_result", (m) => {
      const r = m.result;
      last = `${r.total} entries from ${r.files} file(s): ${r.created} new, ${r.updated} updated, ${r.removed} removed, ${r.disabled} past your bookmark${r.attachedTo ? `, attached to ${r.attachedTo}` : ""}.`;
      client.notify();
    }),
  ];

  addSettingsSection((s, set) => {
    if (files === null) {
      files = [];
      ctx.sendToBackend({ type: "canon_files" });
    }
    let chapter = s.readUpTo == null ? "" : String(s.readUpTo);
    const field = input(chapter, (v) => (chapter = v), { type: "number", min: 0, placeholder: "all", style: { width: "110px" } });
    const apply = () => {
      const n = chapter.trim() === "" ? null : Math.max(0, Math.floor(Number(chapter)));
      set({ readUpTo: Number.isFinite(n as number) ? n : null });
    };
    field.addEventListener("change", apply);
    return section(
      "Canon",
      h(
        "label",
        { class: "ufl-label" },
        "Read up to: Ch.",
        h("div", { class: "ufl-row" }, field, button("Apply", apply, { kind: "small" }), s.readUpTo != null ? button("Read everything", () => set({ readUpTo: null }), { kind: "small" }) : null),
      ),
      h("div", { class: "ufl-sub" }, s.readUpTo == null ? "No bookmark: every canon entry is on." : `Entries from after Chapter ${s.readUpTo} are disabled so canon never gets ahead of you.`),
      h(
        "div",
        { class: "ufl-row", style: { marginTop: "6px" } },
        button("Sync canon world book", () => ctx.sendToBackend({ type: "canon_sync", characterId: ctx.getActiveChat()?.characterId ?? null }), { kind: "primary" }),
        button("Import a canon file…", async () => {
          const picked = await ctx.uploads.pickFile({ accept: [".md", "text/markdown", "text/plain"], multiple: true, maxSizeBytes: 2_000_000 });
          for (const f of picked) ctx.sendToBackend({ type: "canon_import", name: f.name, text: new TextDecoder().decode(f.bytes) });
        }),
      ),
      h("div", { class: "ufl-sub" }, files.length ? `Canon files: ${files.map((f) => f.replace(/^canon\//, "")).join(", ")}` : "No canon files yet: add Markdown files to docs/canon/ in the repo (then update the extension) or import one here. See docs/canon/README.md for the format."),
      last ? h("div", { class: "ufl-event" }, last) : null,
    );
  });

  addSettingsSection((s, set, { conns }) => {
    const image = conns.image;
    let style = s.portraits.style;
    const styleField = input(style, (v) => (style = v));
    styleField.addEventListener("change", () => set({ portraits: { ...s.portraits, style } }));
    return section(
      "Portraits and HUD",
      h(
        "label",
        { class: "ufl-label" },
        "Image connection for portraits",
        select([{ value: "", label: "Default image connection" }, ...image.map((c) => ({ value: c.id, label: c.name }))], s.portraits.connectionId ?? "", (v) => set({ portraits: { ...s.portraits, connectionId: v || null } })),
      ),
      h("label", { class: "ufl-label" }, "Portrait style", styleField),
      h("div", { class: "ufl-sub" }, "Generating costs whatever your image connection charges per image. Click a familiar's portrait in the panel to generate or upload one."),
      toggle("Floating HUD on phones", "A small Health / Mana / Tethers widget on narrow screens; tap it to open the Familiar panel.", s.hud, (v) => set({ hud: v })),
    );
  });
  return cleanups;
}
