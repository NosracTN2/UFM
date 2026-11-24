// Text the narrator sees: a compact state block, standing orders and System events.

import { ATTR_KEYS, ATTR_SHORT, FACTIONS, floorBand, FORMS, masteryName, PILLARS, soulStage } from "../shared/data";
import { heat } from "./world";
import { circleName, fmt, thresholdName, thresholdsCrossed, xpToNext } from "../shared/math";
import type { Familiar, GameState, MsgResult, Order } from "../shared/types";
import { derive } from "./derive";

export const STATE_OPEN = "[UFM STATE]";
export const STATE_CLOSE = "[/UFM STATE]";

export function clockText(hours: number): string {
  const day = Math.floor(hours / 24) + 1;
  const h = Math.floor(hours % 24);
  const part = h < 5 ? "night" : h < 8 ? "dawn" : h < 12 ? "morning" : h < 14 ? "midday" : h < 18 ? "afternoon" : h < 21 ? "dusk" : "night";
  return `day ${day}, ${String(h).padStart(2, "0")}:00 (${part})`;
}

export function famLabel(f: Familiar): string {
  const def = FORMS[f.form];
  const base = def?.label ?? f.form;
  const bits: string[] = [];
  if (f.element) bits.push(f.element);
  if (f.material) bits.push(f.material);
  if (f.species) bits.push(f.species);
  const st = soulStage(f.stage);
  if (st) bits.push(`${st.name} Soul Stage`);
  return `${base}${bits.length ? ` (${bits.join(", ")})` : ""}`;
}

function famLine(state: GameState, f: Familiar): string {
  const parts = [`${f.name} — ${famLabel(f)}`];
  if (f.minded && f.level) parts.push(`Lv ${f.level}`);
  if (state.sheet.hand === f.id) parts.push(state.sheet.riding ? "you are riding it" : "in your hand");
  else if (f.order) parts.push(`order: ${f.order}`);
  else if (def(f)?.control === "hand") parts.push("stands still unless guided by hand");
  if (f.stance) parts.push(`stance: ${f.stance}`);
  if (f.resonance !== "none") parts.push(`${f.resonance} resonance`);
  if (f.kind !== "beast" && f.stage && f.kind !== "elemental") parts.push(f.kind === "vampire" ? `${f.stage} rank` : f.stage);
  if (f.kind === "elemental" && f.stage && f.stage !== "plain") parts.push(`${f.stage} core`);
  if (f.path) parts.push(f.path);
  if (f.mutations.length) parts.push(`mutations: ${f.mutations.join(", ")}`);
  if (f.echoes.length) parts.push(`Echoes: ${f.echoes.join(", ")}`);
  if (f.wounds.length) parts.push(`hurt: ${f.wounds.map((w) => w.label).join(", ")}`);
  if (f.ready) parts.push(`READY to change (${f.ready.label}) — only when the player triggers it`);
  parts.push(`${f.tether} tether${f.tether === 1 ? "" : "s"}`);
  return `- ${parts.join(" · ")}`;
}

function def(f: Familiar) {
  return FORMS[f.form];
}

function woundText(w: { label: string; hoursLeft: number | null }): string {
  if (w.hoursLeft == null) return `${w.label} (until it heals in the story)`;
  const d = w.hoursLeft / 24;
  return `${w.label} (heals in ${d >= 1 ? `${Math.ceil(d)}d` : `${Math.ceil(w.hoursLeft)}h`})`;
}

export function renderState(state: GameState): string {
  const s = state.sheet;
  const w = state.world;
  if (!state.started) {
    return `${STATE_OPEN}\nNo run has been set up yet. The player is choosing a birthplace and first bond in the setup window. Do not invent their sheet.\n${STATE_CLOSE}`;
  }
  const d = derive(state);
  const lines: string[] = [STATE_OPEN];
  lines.push(
    `${s.name} · ${s.className} · Level ${s.level} (${circleName(s.level)} Circle, ${thresholdName(s.level)}) · XP ${fmt(s.xp)}/${fmt(xpToNext(s.level))}`,
  );
  lines.push(
    `Health ${fmt(s.hp)}/${fmt(d.hpMax)} · Mana ${fmt(s.mana)}/${fmt(d.manaMax)} · Soul Tethers ${d.tethersUsed}/${d.tethersTotal} used · Silver ${fmt(s.silver)}`,
  );
  lines.push(
    `Attributes: ${ATTR_KEYS.map((k) => `${ATTR_SHORT[k]} ${d.attrs[k]}${d.bonds[k] ? ` (${d.own[k]} own + ${d.bonds[k]} from bonds)` : ""}`).join(" · ")}${s.unspent ? ` · ${s.unspent} unspent point(s), the player places them` : ""}`,
  );
  const clock = w.clocks[String(w.floor)];
  const band = floorBand(w.floor);
  lines.push(`Floor ${w.floor} enemy band: Level ${band.min}–${band.max} (Guardian at the top; Faction climbers bring their own level)`);
  lines.push(`Where: Floor ${w.floor}${w.place ? `, ${w.place}` : ""} · ${clockText(clock?.hours ?? 8)}${clock?.weather ? ` · ${clock.weather}` : ""}`);
  const body: string[] = s.wounds.map(woundText);
  if (s.exhaustion) body.push(`exhaustion ${s.exhaustion}/5`);
  if (s.hunger) body.push(`hunger ${s.hunger}/5`);
  if (s.cold) body.push(`cold ${s.cold}/5`);
  if (body.length) lines.push(`Body: ${body.join("; ")}`);

  const open = PILLARS.filter((p) => s.pillars[p.id]?.status === "open");
  const stirring = PILLARS.filter((p) => s.pillars[p.id]?.status === "stirring");
  const pillarText = open
    .map((p) => {
      const br = s.branches.filter((b) => b.pillar === p.id);
      return `${p.name}${br.length ? ` [${br.map((b) => `${b.name}: ${masteryName(b.tier)} ${Math.floor(b.pct)}%`).join("; ")}]` : ""}`;
    })
    .join(" | ");
  lines.push(`Pillars open: ${pillarText || "none"}`);
  if (stirring.length) lines.push(`Stirring: ${stirring.map((p) => `[???] line trembling ${s.pillars[p.id].stir ?? "faintly"} (${p.name}; the player only feels it)`).join("; ")}`);
  if (s.run !== "spread") lines.push(`Sealed: ${PILLARS.length - open.length - stirring.length} Pillars show only [???] on the window.`);
  const cross = s.branches.filter((b) => b.origin === "cross");
  if (cross.length) lines.push(`Cross-Pillar Branches: ${cross.map((b) => b.name).join(", ")}`);
  if (s.gifts.length) lines.push(`Gifts: ${s.gifts.map((g) => `${g.name} (${g.desc})`).join("; ")}`);
  const arts = Object.entries(s.arts).filter(([, v]) => v === "learned");
  if (arts.length) lines.push(`Tether arts learned: ${arts.map(([k]) => k.replace(/_/g, " ")).join(", ")}`);
  if (s.borrowed.length) lines.push(`Borrowed traits: ${s.borrowed.map((b) => b.trait).join(", ")}`);
  const slots = Math.max(0, Math.floor(s.branchProgress) - s.branchesEarned);
  if (slots) lines.push(`Branch slots open: ${slots} (name a new Branch with the branch op only when the player earns one in the story)`);
  const artsOpen = Math.max(0, thresholdsCrossed(s.level) - Object.values(s.arts).filter((v) => v === "learned").length);
  if (artsOpen) lines.push(`Tether arts waiting: ${artsOpen} (one is learned in a story moment that fits: art "Name")`);

  const hand = s.hand ? state.roster.find((f) => f.id === s.hand) : null;
  if (hand) {
    lines.push(
      s.riding
        ? `RIDING: the player is riding ${hand.name}. Their typed actions are ${hand.name}'s actions; narrate through ${hand.name}'s senses.`
        : `HAND: the player holds ${hand.name} by hand. Their typed actions steer it directly; narrate the puppet's senses instead of theirs. Their other puppets stand still.`,
    );
  }
  const active = state.roster.filter((f) => f.state === "active");
  const soul = state.roster.filter((f) => f.state === "soul");
  const sleeping = state.roster.filter((f) => f.state === "slumbering");
  const gone = state.roster.filter((f) => f.state === "lost" || f.state === "released");
  lines.push(active.length ? `Familiars active:\n${active.map((f) => famLine(state, f)).join("\n")}` : "Familiars active: none");
  if (soul.length) lines.push(`Carried in soul: ${soul.map((f) => f.name).join(", ")}`);
  if (sleeping.length) lines.push(`Slumbering (0 tethers, woken by touch): ${sleeping.map((f) => `${f.name}${f.place ? ` at ${f.place}` : ""}`).join(", ")}`);
  if (gone.length) lines.push(`Gone (never use them): ${gone.map((f) => `${f.name} (${f.state})`).join(", ")}`);
  if (s.items.length) lines.push(`Carrying: ${s.items.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(", ")}`);
  const ht = heat(state);
  const hot = Object.entries(ht.byFaction).filter(([, v]) => v > 0);
  if (hot.length || ht.decree00) lines.push(`Heat (from what they know): ${hot.map(([k, v]) => `${FACTIONS.find((f) => f.id === k)?.name ?? k} ${v}`).join(" · ") || "none"}${ht.decree00 ? ` · Decree 00 pressure ${ht.decree00}` : ""}`);
  const threads = w.threads.filter((t) => t.open);
  if (threads.length) lines.push(`Open threads: ${threads.map((t) => t.text).join("; ")}`);
  lines.push(STATE_CLOSE);
  return lines.join("\n");
}

export function renderOrders(state: GameState, fresh: Order[]): string {
  const standing = state.roster.filter((f) => f.state === "active" && f.order);
  if (!standing.length && !fresh.length) return "";
  const out: string[] = ["[UFM ORDERS]"];
  if (standing.length) out.push(`Standing orders in effect (familiars keep at these until told otherwise): ${standing.map((f) => `${f.name} — ${f.order}`).join("; ")}.`);
  if (fresh.length) {
    out.push("The player gave these commands through the familiar panel this turn. Narrate each one happening (or failing for a reason inside the story), then confirm what actually happened in your <ufm> block:");
    for (const o of fresh) out.push(`- ${o.directive}${o.expect ? `  → confirm with: ${o.expect}` : ""}`);
  }
  out.push("[/UFM ORDERS]");
  return out.join("\n");
}

export function renderSystem(last: MsgResult | null, extra: string[] = []): string {
  const out: string[] = [];
  if (last) {
    const ev = last.events.filter((e) => (e.kind !== "info" || e.big) && !e.text.startsWith("__"));
    if (ev.length) {
      out.push("The extension computed these from your last change log. Show them in the story at the right moment, as System windows (blockquotes) where it fits. Use these exact numbers:");
      for (const e of ev) out.push(`- ${e.big ? "MAJOR: " : ""}${e.text}`);
    }
    if (last.rejected.length) {
      out.push("These lines from your last tag were REJECTED by the rules and did not happen. If your prose implied them, treat them as attempts that failed:");
      for (const r of last.rejected) out.push(`- ${r.line} — ${r.reason}`);
    }
  }
  out.push(...extra);
  return out.length ? `[UFM SYSTEM]\n${out.join("\n")}\n[/UFM SYSTEM]` : "";
}

export const TAG_REMINDER =
  "[UFM TAG] End this reply with a <ufm>…</ufm> block, one op per line, listing every change that happened in it (spend, form, bind, raise, order, kill enemy=\"…\" level=N by=Name, lose, wound, heal, learn who=\"…\" fact=\"…\", time +Nh, move floor=N place=\"…\"). Never write XP, levels or stat totals: the extension computes them. Write <ufm></ufm> if nothing changed.";
