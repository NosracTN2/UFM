// Familiar portraits: generate one with the user's image connection, or upload your own.

import { famLabel } from "../engine/render";
import { pillarDef } from "../shared/data";
import { onFront, toast } from "./protocol";
import { can, errText, sp } from "./sp";
import { getSettings, savePlayer } from "./store";
import { recompute } from "./sync";

export function registerPortraits(): void {
  onFront("portrait_generate", async (msg, c, userId) => {
    const f = c?.result?.state.roster.find((x) => x.id === msg.famId);
    if (!c || !f) return;
    if (!can("image_gen")) {
      toast("warning", 'Grant "image_gen" to generate portraits (or upload one).', userId);
      return;
    }
    const settings = await getSettings();
    const prompt = [
      settings.portraits.style,
      `portrait of a familiar named ${f.name}: ${famLabel(f)}`,
      f.path ? `in its ${f.path}` : "",
      f.element ? `made of ${f.material ?? f.element}` : "",
      f.people ? `of the ${f.people}` : "",
      `bound through ${pillarDef(f.pillar)?.name ?? f.pillar}`,
      f.mutations.length ? `mutations: ${f.mutations.join(", ")}` : "",
      "single subject, centered, no text, no frame",
    ]
      .filter(Boolean)
      .join(", ");
    toast("info", `Painting ${f.name}…`, userId);
    try {
      const r = await sp().imageGen.generate({ prompt, connection_id: settings.portraits.connectionId ?? undefined, owner_chat_id: c.chatId, includeDataUrl: false });
      const url = r.imageUrl ?? (r.imageId ? (await sp().images.get(r.imageId).catch(() => null))?.url : null) ?? r.imageDataUrl;
      if (!url) throw new Error("no image came back");
      c.player.portraits = { ...(c.player.portraits ?? {}), [f.id]: { url, form: f.form, name: f.name } };
      await savePlayer(c);
      await recompute(c);
    } catch (e) {
      toast("error", `Portrait failed: ${errText(e)}`, userId);
    }
  });

  onFront("portrait_upload", async (msg, c, userId) => {
    const f = c?.result?.state.roster.find((x) => x.id === msg.famId);
    const dataUrl = String(msg.dataUrl ?? "");
    if (!c || !f || !dataUrl.startsWith("data:image/")) return;
    let url = dataUrl;
    if (can("images")) {
      const img = await sp().images.uploadFromDataUrl(dataUrl, String(msg.filename ?? `${f.name}.png`));
      url = img.url;
    } else if (dataUrl.length > 400_000) {
      toast("warning", 'That image is large; grant "images" to store it properly, or pick a smaller one.', userId);
      return;
    }
    c.player.portraits = { ...(c.player.portraits ?? {}), [f.id]: { url, form: f.form, name: f.name } };
    await savePlayer(c);
    await recompute(c);
  });

  onFront("portrait_clear", async (msg, c) => {
    if (!c?.player.portraits?.[msg.famId]) return;
    delete c.player.portraits[msg.famId];
    await savePlayer(c);
    await recompute(c);
  });
}
