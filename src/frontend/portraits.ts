// Portrait menu on familiar cards: generate with your image connection, upload, or remove.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { FamView } from "../engine/view";
import type { Client } from "./client";

function toDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

export async function portraitMenu(ctx: SpindleFrontendContext, client: Client, f: FamView, e: MouseEvent): Promise<void> {
  const v = client.view;
  const items = [
    { key: "gen", label: "Generate portrait", disabled: v?.perms.image_gen === false },
    { key: "up", label: "Upload image…" },
    ...(f.portrait ? [{ key: "rm", label: "Remove portrait", danger: true }] : []),
  ];
  let selected: string | null = null;
  try {
    selected = (await ctx.ui.showContextMenu({ position: { x: e.clientX, y: e.clientY }, items })).selectedKey;
  } catch {
    selected = "up";
  }
  if (selected === "gen") client.send("portrait_generate", { famId: f.id });
  else if (selected === "rm") client.send("portrait_clear", { famId: f.id });
  else if (selected === "up") {
    const [file] = await ctx.uploads.pickFile({ accept: ["image/png", "image/jpeg", "image/webp", "image/gif"], maxSizeBytes: 6_000_000 });
    if (file) client.send("portrait_upload", { famId: f.id, filename: file.name, dataUrl: toDataUrl(file.bytes, file.mimeType || "image/png") });
  }
}
