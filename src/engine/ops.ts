// Op handlers. Each handler validates first and mutates only when the line is legal;
// an illegal line throws Reject and the rest of the block still applies.

import { ATTR_KEYS, formDef, FORMS, pillarDef, REGEN_HP_PER_HOUR, REGEN_MANA_PER_HOUR, soulStage, type FormDef } from "../shared/data";
import { fmt, rate as rateOf } from "../shared/math";
import type { AttrKey, Attrs, Familiar, Op, Wound } from "../shared/types";
import { clean, type Ctx, findFam, isSelf, needFam, reject, Reject } from "./context";
import { clampVitals, derive, fullRestore } from "./derive";
import { num, parseDuration, yes } from "./parse";
import { gainXp, kill } from "./progression";

export type Handler = (op: Op, ctx: Ctx) => void;
export const HANDLERS: Record<string, Handler> = {};

const ALIASES: Record<string, string> = {
  spent: "spend",
  pay: "spend",
  paid: "spend",
  formed: "form",
  create: "form",
  created: "form",
  shape: "form",
  bound: "bind",
  tame: "bind",
  tamed: "bind",
  raised: "raise",
  summon: "make",
  summoned: "make",
  ordered: "order",
  command: "order",
  ask: "order",
  killed: "kill",
  slay: "kill",
  slew: "kill",
  lost: "lose",
  destroyed: "lose",
  died: "lose",
  dies: "lose",
  wounded: "wound",
  injure: "wound",
  injured: "wound",
  learned: "learn",
  learnt: "learn",
  told: "learn",
  slumbered: "slumber",
  sleep: "slumber",
  woke: "wake",
  awaken: "wake",
  released: "release",
  renamed: "rename",
  name: "rename",
  damage: "hurt",
  damaged: "hurt",
  hit: "hurt",
  healed: "heal",
  restored: "restore",
  regain: "restore",
  gained: "gain",
  got: "gain",
  found: "gain",
  dropped: "drop",
  use: "drop",
  used: "drop",
  moved: "move",
  travel: "move",
  go: "move",
  rested: "rest",
  sleeps: "rest",
  take: "hand",
  took: "hand",
};

export function canonVerb(v: string): string {
  const k = v.toLowerCase().replace(/[^a-z_]/g, "");
  return ALIASES[k] ?? k;
}

// ── helpers ────────────────────────────────────────────────────────────

function amount(op: Op, idx: number, key?: string): number | null {
  return num(op.args[idx]) ?? (key ? num(op.kv[key]) : null) ?? num(op.kv.amount) ?? num(op.kv.n);
}

function joinRest(op: Op, from: number): string {
  return op.args.slice(from).join(" ").trim();
}

function woundFrom(op: Op, labelIdx: number, ctx: Ctx): Wound {
  const label = op.kv.wound ?? op.kv.label ?? op.args[labelIdx] ?? "an injury";
  const healRaw = op.kv.heal ?? op.kv.heals ?? op.kv.time;
  const hours = healRaw && /^(story|never|until)/i.test(healRaw) ? null : parseDuration(healRaw);
  const sev = (op.kv.severity ?? "").toLowerCase();
  const severity: Wound["severity"] = sev === "grave" || sev === "serious" || sev === "light" ? sev : hours == null ? "serious" : hours > 24 * 14 ? "grave" : hours > 24 * 2 ? "serious" : "light";
  return { id: `${ctx.res.key}:${op.line}`, label, hoursLeft: hours, severity };
}

export function blankFamiliar(): Omit<Familiar, "id" | "name" | "pillar" | "kind" | "form"> {
  return {
    element: null,
    material: null,
    species: null,
    people: null,
    size: null,
    state: "active",
    tether: 1,
    manaCost: 0,
    order: null,
    stance: null,
    minded: false,
    level: 0,
    xp: 0,
    attrs: null,
    feeds: [],
    resonance: "none",
    stage: null,
    wounds: [],
    kills: 0,
    xpSent: 0,
    fuel: {},
    ready: null,
    path: null,
    traits: [],
    mutations: [],
    echoes: [],
    place: null,
    floor: 1,
    portrait: null,
    notes: "",
    unspent: 0,
  };
}

/** gameOnly: a minded familiar's starting attributes; its strengths get a head start. */
export function famBaseAttrs(strong: AttrKey[]): Attrs {
  const a: Attrs = { str: 3, con: 3, agi: 3, dex: 3, int: 3, ctl: 1 };
  for (const k of strong) a[k] += 4;
  return a;
}

export function parseAttrList(s: string | undefined): AttrKey[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .split(/[,+/ ]+/)
    .map((x) => x.slice(0, 3))
    .map((x) => (x === "con" ? "con" : x === "cnt" || x === "ctr" ? "ctl" : x))
    .filter((x): x is AttrKey => (ATTR_KEYS as string[]).includes(x));
}

export interface FormPlan {
  def: FormDef;
  pillar: string;
  mana: number;
  tether: number;
  stage: string | null;
}

/** Work out what a form/bind/raise/make line would cost, without touching state. */
export function planForm(op: Op, ctx: Ctx, verb: string): FormPlan {
  const s = ctx.state.sheet;
  let def: FormDef | undefined;
  if (verb === "bind") def = FORMS.beast;
  else if (verb === "raise") def = formDef(op.kv.kind ?? op.kv.form) ?? FORMS.zombie;
  else def = formDef(op.kv.form ?? op.kv.kind);
  const pillarArg = pillarDef(op.kv.pillar);
  if (!def) {
    const p = pillarArg ?? pillarDef(Object.keys(s.pillars).find((k) => s.pillars[k].status === "open"));
    def = formDef(p?.baseForm) ?? FORMS.familiar;
  }
  const pillar = pillarArg?.id ?? def.pillar ?? Object.keys(s.pillars).find((k) => s.pillars[k].status === "open") ?? "elemental";
  let tether = def.tether;
  let stage: string | null = null;
  if (def.kind === "beast") {
    const st = soulStage(op.kv.stage ?? "nascent");
    if (!st) reject(`unknown Soul Stage "${op.kv.stage}"`);
    stage = st.id;
    tether = st.tether;
  }
  return { def, pillar, mana: def.mana, tether, stage };
}

function shortBase(def: FormDef, op: Op): string {
  if (op.kv.species) return op.kv.species.replace(/\b\w/g, (c) => c.toUpperCase());
  if (def.id === "puppet") return "Puppet";
  if (def.id === "automated") return "Golem";
  return def.label;
}

function uniqueName(ctx: Ctx, base: string): string {
  for (let i = 1; i < 999; i++) {
    const n = `${base} ${i}`;
    if (!findFam(ctx.state, n)) return n;
  }
  return `${base} ${ctx.state.famSeq + 1}`;
}

// ── resources ──────────────────────────────────────────────────────────

HANDLERS.spend = (op, ctx) => {
  const s = ctx.state.sheet;
  const what = (op.args[0] ?? Object.keys(op.kv)[0] ?? "mana").toLowerCase();
  const n = amount(op, 1, what) ?? num(op.args[0]);
  if (n == null || n <= 0) reject("spend needs a positive amount");
  if (ctx.absorbed.has(op)) {
    ctx.note(`${op.raw}: already paid by the form line`);
    return;
  }
  if (what.startsWith("mana") || what === "mp") {
    if (n > s.mana) reject(`needs ${fmt(n)} Mana, you have ${fmt(s.mana)}`);
    s.mana -= n;
  } else if (what.startsWith("silver") || what === "coin" || what === "coins") {
    if (n > s.silver) reject(`needs ${fmt(n)} silver, you have ${fmt(s.silver)}`);
    s.silver -= n;
  } else if (what.startsWith("h") || what === "health") {
    s.hp = Math.max(0, s.hp - n);
  } else reject(`can't spend "${what}"`);
};

HANDLERS.gain = (op, ctx) => {
  const s = ctx.state.sheet;
  const what = (op.args[0] ?? "").toLowerCase();
  if (what === "item" || op.kv.item) {
    const name = op.kv.item ?? op.args[1];
    if (!name) reject("gain item needs a name");
    const qty = Math.max(1, num(op.kv.qty) ?? num(op.args[2]) ?? 1);
    const it = s.items.find((i) => i.name.toLowerCase() === name.toLowerCase());
    if (it) it.qty += qty;
    else s.items.push({ name, qty, note: op.kv.note });
    return;
  }
  const n = amount(op, 1, what);
  if (n == null || n <= 0) reject("gain needs a positive amount");
  if (what.startsWith("silver") || what.startsWith("coin")) s.silver += n;
  else if (what.startsWith("mana") || what.startsWith("h")) HANDLERS.restore(op, ctx);
  else if (what === "xp" || what === "experience") reject("the narrator never writes XP: report the kill and the extension pays it");
  else reject(`can't gain "${what}"`);
};

HANDLERS.restore = (op, ctx) => {
  const s = ctx.state.sheet;
  const d = derive(ctx.state);
  const what = (op.args[0] ?? "all").toLowerCase();
  const raw = op.args[1] ?? op.kv.amount ?? "all";
  const all = /^(all|full|max)$/i.test(raw) || what === "all";
  const n = all ? Infinity : num(raw);
  if (n == null || n <= 0) reject("restore needs an amount or 'all'");
  if (what === "all") {
    fullRestore(ctx.state);
    return;
  }
  if (what.startsWith("mana")) s.mana = Math.min(d.manaMax, s.mana + n);
  else if (what.startsWith("h")) s.hp = Math.min(d.hpMax, s.hp + n);
  else reject(`can't restore "${what}"`);
};

HANDLERS.hurt = (op, ctx) => {
  const who = op.args[0] ?? "you";
  if (isSelf(ctx.state, who)) {
    const n = num(op.args[1]) ?? num(op.kv.amount) ?? num(op.kv.hp);
    if (n == null || n <= 0) reject("hurt you needs an amount of Health");
    ctx.state.sheet.hp = Math.max(0, ctx.state.sheet.hp - n);
    if (ctx.state.sheet.hp === 0) ctx.event("info", "Your Health has reached 0.", true);
    return;
  }
  const f = needFam(ctx.state, who);
  const w = woundFrom({ ...op, kv: { ...op.kv, wound: op.kv.wound ?? op.args[1] ?? "battered" } }, 1, ctx);
  f.wounds.push(w);
};

HANDLERS.heal = (op, ctx) => {
  const who = op.args[0] ?? "you";
  const target = op.kv.wound ?? op.args[1];
  const n = num(target);
  if (isSelf(ctx.state, who)) {
    const s = ctx.state.sheet;
    if (n != null && /^\d/.test(target ?? "")) {
      s.hp = Math.min(derive(ctx.state).hpMax, s.hp + n);
      return;
    }
    healWound(s.wounds, target, ctx);
    return;
  }
  const f = needFam(ctx.state, who);
  healWound(f.wounds, target, ctx);
};

function healWound(wounds: Wound[], label: string | undefined, ctx: Ctx): void {
  if (wounds.length === 0) reject("no wounds to heal");
  if (!label || /^all$/i.test(label)) {
    wounds.splice(0, wounds.length);
    return;
  }
  const k = clean(label);
  const i = wounds.findIndex((w) => w.label.toLowerCase() === k || w.label.toLowerCase().includes(k) || k.includes(w.label.toLowerCase()));
  if (i < 0) reject(`no wound called "${label}"`);
  ctx.event("healed", `Healed: ${wounds[i].label}`);
  wounds.splice(i, 1);
}

HANDLERS.rest = (op, ctx) => {
  const h = parseDuration(op.args.join(" ") || op.kv.time || "");
  if (h) advanceTime(ctx, h);
  fullRestore(ctx.state);
  ctx.state.sheet.exhaustion = 0;
};

HANDLERS.drop = (op, ctx) => {
  const s = ctx.state.sheet;
  const name = op.kv.item ?? (op.args[0]?.toLowerCase() === "item" ? op.args[1] : op.args[0]);
  if (!name) reject("names no item");
  const it = s.items.find((i) => i.name.toLowerCase() === name.toLowerCase());
  if (!it) reject(`you carry no "${name}"`);
  const qty = Math.max(1, num(op.kv.qty) ?? 1);
  it.qty -= qty;
  if (it.qty <= 0) s.items.splice(s.items.indexOf(it), 1);
};

HANDLERS.body = (op, ctx) => {
  const s = ctx.state.sheet;
  const set = (k: "exhaustion" | "hunger" | "cold", v: string) => {
    const n = num(v);
    if (n == null) reject(`body ${k} needs a number`);
    s[k] = Math.max(0, Math.min(5, /^[+-]/.test(v) ? s[k] + n : n));
  };
  let any = false;
  for (const k of ["exhaustion", "hunger", "cold"] as const) {
    if (op.kv[k] != null) {
      set(k, op.kv[k]);
      any = true;
    }
  }
  if (!any && op.args[0]) {
    const k = op.args[0].toLowerCase() as "exhaustion" | "hunger" | "cold";
    if (!["exhaustion", "hunger", "cold"].includes(k)) reject(`unknown body track "${op.args[0]}"`);
    set(k, op.args[1] ?? "+1");
  } else if (!any) reject("body needs exhaustion=, hunger= or cold=");
};

// ── familiars ──────────────────────────────────────────────────────────

function makeFamiliar(op: Op, ctx: Ctx, verb: string): void {
  const st = ctx.state;
  const plan = planForm(op, ctx, verb);
  const d = derive(st);
  if (plan.mana > st.sheet.mana) reject(`${plan.def.label} costs ${plan.mana} Mana, you have ${fmt(st.sheet.mana)}`);
  if (plan.tether > d.tethersFree) reject(`${plan.def.label} needs ${plan.tether} tether${plan.tether === 1 ? "" : "s"}, ${d.tethersFree} free of ${d.tethersTotal}`);
  validateForm(op, ctx, plan);

  const requested = op.kv.name ?? (op.args[0] && !op.args[0].includes("=") ? op.args[0] : undefined);
  if (requested && findFam(st, requested)) reject(`a familiar named "${requested}" already stands`);
  const name = requested ?? uniqueName(ctx, shortBase(plan.def, op));
  const minded = plan.def.minded || yes(op.kv.minded);
  const strong = parseAttrList(op.kv.strong ?? op.kv.feeds);
  st.famSeq += 1;
  const f: Familiar = {
    ...blankFamiliar(),
    id: `f${st.famSeq}`,
    name,
    pillar: plan.pillar,
    kind: plan.def.kind,
    form: plan.def.id,
    element: op.kv.element ?? (plan.def.kind === "elemental" ? defaultElement(ctx) : null),
    material: op.kv.material ?? null,
    species: op.kv.species ?? null,
    people: op.kv.people ?? null,
    size: op.kv.size ?? plan.def.size,
    tether: plan.tether,
    manaCost: plan.mana,
    minded,
    level: minded ? Math.max(1, num(op.kv.level) ?? 1) : 0,
    attrs: minded ? famBaseAttrs(strong) : null,
    feeds: strong,
    resonance: minded ? "faint" : "none",
    stage: plan.stage ?? initialStage(plan.def),
    floor: st.world.floor,
    notes: op.kv.note ?? "",
  };
  if (minded && f.level > 1) for (let l = 2; l <= f.level; l++) f.unspent += rateOf(l);
  st.sheet.mana -= plan.mana;
  st.roster.push(f);
  ctx.note(`${f.name}: ${plan.def.label}${plan.mana ? `, ${plan.mana} Mana` : ""}, ${plan.tether} tether${plan.tether === 1 ? "" : "s"}`);
}

function initialStage(def: FormDef): string | null {
  if (def.kind === "zombie") return "cracked";
  if (def.kind === "skeleton" || def.kind === "spirit") return "raw";
  if (def.kind === "elemental") return "plain";
  if (def.kind === "vampire") return "Progenitor";
  return null;
}

function defaultElement(ctx: Ctx): string | null {
  const b = ctx.state.sheet.branches.find((x) => x.pillar === "elemental");
  return b ? b.name.toLowerCase() : null;
}

/** Phase 3 extends this with mastery, Pillar and floor-gate checks. */
export let validateForm: (op: Op, ctx: Ctx, plan: FormPlan) => void = () => {};
export function setFormValidator(fn: typeof validateForm): void {
  validateForm = fn;
}

HANDLERS.form = (op, ctx) => makeFamiliar(op, ctx, "form");
HANDLERS.bind = (op, ctx) => makeFamiliar(op, ctx, "bind");
HANDLERS.raise = (op, ctx) => makeFamiliar(op, ctx, "raise");
HANDLERS.make = (op, ctx) => makeFamiliar(op, ctx, "make");

HANDLERS.slumber = (op, ctx) => {
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  if (f.state === "slumbering") reject(`${f.name} already slumbers`);
  checkSlumber(f);
  f.state = "slumbering";
  f.order = null;
  f.place = ctx.state.world.place;
  f.floor = ctx.state.world.floor;
  if (ctx.state.sheet.hand === f.id) ctx.state.sheet.hand = null;
};

export let checkSlumber: (f: Familiar) => void = () => {};
export function setSlumberCheck(fn: typeof checkSlumber): void {
  checkSlumber = fn;
}

HANDLERS.wake = (op, ctx) => {
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  if (f.state === "active") reject(`${f.name} is already awake`);
  if (f.state !== "slumbering" && f.state !== "soul") reject(`${f.name} is ${f.state}`);
  const d = derive(ctx.state);
  if (f.state === "slumbering" && f.tether > d.tethersFree) reject(`waking ${f.name} needs ${f.tether} tether(s), ${d.tethersFree} free`);
  checkWake(op, ctx, f);
  f.state = "active";
};

export let checkWake: (op: Op, ctx: Ctx, f: Familiar) => void = () => {};
export function setWakeCheck(fn: typeof checkWake): void {
  checkWake = fn;
}

HANDLERS.release = (op, ctx) => {
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  f.state = "released";
  f.order = null;
  if (ctx.state.sheet.hand === f.id) ctx.state.sheet.hand = null;
  ctx.state.sheet.borrowed = ctx.state.sheet.borrowed.filter((b) => b.familiarId !== f.id);
};

HANDLERS.lose = (op, ctx) => {
  const first = (op.args[0] ?? "").toLowerCase();
  if (first === "item" || op.kv.item) return HANDLERS.drop({ ...op, args: op.args.slice(first === "item" ? 1 : 0) }, ctx);
  if (first === "silver" || first === "mana" || first === "health" || first === "hp") return HANDLERS.spend(op, ctx);
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  f.state = "lost";
  f.order = null;
  if (op.kv.reason) f.notes = op.kv.reason;
  if (ctx.state.sheet.hand === f.id) ctx.state.sheet.hand = null;
  ctx.state.sheet.borrowed = ctx.state.sheet.borrowed.filter((b) => b.familiarId !== f.id);
  ctx.event("lost", `${f.name} is lost${op.kv.reason ? ` (${op.kv.reason})` : ""}.`);
};

HANDLERS.rename = (op, ctx) => {
  const f = needFam(ctx.state, op.args[0] ?? op.kv.from, true);
  const to = op.kv.to ?? op.args[1];
  if (!to) reject("rename needs a new name");
  const clash = findFam(ctx.state, to);
  if (clash && clash.id !== f.id) reject(`"${to}" is already taken`);
  f.name = to;
};

HANDLERS.order = (op, ctx) => {
  const who = op.args[0] ?? op.kv.name;
  const verb = (op.args[1] ?? op.kv.order ?? "").toLowerCase();
  const target = op.kv.target ?? joinRest(op, 2);
  if (!verb) reject("order needs an order (dig, carry, guard, follow, strike, free)");
  const text = verb === "free" || verb === "none" ? null : [verb, target].filter(Boolean).join(" ");
  const targets = who && /^(all|everyone|every)$/i.test(who) ? ctx.state.roster.filter((f) => f.state === "active") : [needFam(ctx.state, who)];
  if (targets.length === 0) reject("no active familiars");
  for (const f of targets) {
    if (f.state !== "active") reject(`${f.name} is ${f.state}`);
    checkOrder(op, ctx, f, verb);
  }
  for (const f of targets) f.order = text;
};

export let checkOrder: (op: Op, ctx: Ctx, f: Familiar, verb: string) => void = () => {};
export function setOrderCheck(fn: typeof checkOrder): void {
  checkOrder = fn;
}

HANDLERS.stance = (op, ctx) => {
  const f = needFam(ctx.state, op.args[0] ?? op.kv.name);
  const st = (op.args[1] ?? op.kv.stance ?? "").toLowerCase();
  if (st !== "hold" && st !== "press" && st !== "protect") reject("stance is hold, press or protect");
  checkStance(op, ctx, f);
  f.stance = st;
};

export let checkStance: (op: Op, ctx: Ctx, f: Familiar) => void = () => {};
export function setStanceCheck(fn: typeof checkStance): void {
  checkStance = fn;
}

HANDLERS.hand = (op, ctx) => {
  const who = op.args[0] ?? op.kv.name;
  const s = ctx.state.sheet;
  if (!who || /^(none|release|off|free|back)$/i.test(who)) {
    s.hand = null;
    s.riding = false;
    return;
  }
  const f = needFam(ctx.state, who);
  if (f.state !== "active") reject(`${f.name} is ${f.state}`);
  checkHand(op, ctx, f);
  s.hand = f.id;
  s.riding = false;
};

export let checkHand: (op: Op, ctx: Ctx, f: Familiar) => void = () => {};
export function setHandCheck(fn: typeof checkHand): void {
  checkHand = fn;
}

// ── combat and consequences ────────────────────────────────────────────

HANDLERS.kill = (op, ctx) => {
  const st = ctx.state;
  const enemy = op.kv.enemy ?? op.kv.target ?? op.args[0] ?? "an enemy";
  const lvl = num(op.kv.level ?? op.kv.lvl ?? op.args[1]);
  if (lvl == null || lvl < 1) reject("kill needs the enemy's level (level=N)");
  const by = op.kv.by ?? op.args[2];
  recordKill(ctx, enemy, lvl);
  if (!by || isSelf(st, by)) {
    ctx.note(`${enemy} (Lv ${lvl}) fell by your own hand: no XP. Only kills by a bound familiar pay.`);
    return;
  }
  const f = needFam(st, by);
  if (f.state !== "active") reject(`${f.name} is ${f.state} and can't make a kill`);
  const [reach, spilled] = kill(ctx, lvl);
  st.sheet.narrow.spilled += spilled;
  f.kills += 1;
  f.xpSent += reach;
  famKill(ctx, f, lvl);
  ctx.note(`${f.name} killed ${enemy} (Lv ${lvl}): ${fmt(reach)} XP${spilled ? ` (${fmt(spilled)} spilled through the narrow tether)` : ""}`);
  gainXp(ctx, reach);
};

/** Phase 4: minded familiars climb the same Circles. Phase 5: enemy ledger. */
export let famKill: (ctx: Ctx, f: Familiar, enemyLevel: number) => void = () => {};
export function setFamKill(fn: typeof famKill): void {
  famKill = fn;
}
export let recordKill: (ctx: Ctx, enemy: string, level: number) => void = () => {};
export function setRecordKill(fn: typeof recordKill): void {
  recordKill = fn;
}

HANDLERS.wound = (op, ctx) => {
  const who = op.args[0] ?? op.kv.who ?? "you";
  const w = woundFrom(op, 1, ctx);
  if (isSelf(ctx.state, who)) ctx.state.sheet.wounds.push(w);
  else needFam(ctx.state, who).wounds.push(w);
};

HANDLERS.learn = (op, ctx) => {
  const who = op.kv.who ?? op.args[0];
  const fact = op.kv.fact ?? op.args[1];
  if (!who || !fact) reject('learn needs who="..." and fact="..."');
  learnFact(ctx, who, fact, op.kv.about ?? "you", op.kv.via ?? null);
};

export let learnFact: (ctx: Ctx, who: string, fact: string, about: string, via: string | null) => void = (ctx, who, fact, about) => {
  const st = ctx.state;
  const key = fact.trim().toLowerCase();
  let f = st.world.facts.find((x) => x.text.toLowerCase() === key);
  if (!f) {
    f = { id: `k${st.world.facts.length + 1}`, text: fact.trim(), about, holders: [], weight: 1 };
    st.world.facts.push(f);
  }
  const h = who.trim();
  if (!f.holders.some((x) => x.toLowerCase() === h.toLowerCase())) f.holders.push(h);
};
export function setLearnFact(fn: typeof learnFact): void {
  learnFact = fn;
}

// ── time and place ─────────────────────────────────────────────────────

export function advanceTime(ctx: Ctx, hours: number): void {
  const st = ctx.state;
  const w = st.world;
  w.elapsed += hours;
  const clock = (w.clocks[String(w.floor)] ??= { hours: 8, weather: null });
  clock.hours += hours;
  tickWounds(st.sheet.wounds, hours, ctx, "You");
  for (const f of st.roster) if (f.state !== "lost" && f.state !== "released") tickWounds(f.wounds, hours, ctx, f.name);
  const d = derive(st);
  st.sheet.mana = Math.min(d.manaMax, st.sheet.mana + Math.floor(d.manaMax * REGEN_MANA_PER_HOUR * hours));
  st.sheet.hp = Math.min(d.hpMax, st.sheet.hp + Math.floor(d.hpMax * REGEN_HP_PER_HOUR * hours));
  onTimePassed(ctx, hours);
}

export let onTimePassed: (ctx: Ctx, hours: number) => void = () => {};
export function setOnTimePassed(fn: typeof onTimePassed): void {
  onTimePassed = fn;
}

function tickWounds(wounds: Wound[], hours: number, ctx: Ctx, who: string): void {
  for (let i = wounds.length - 1; i >= 0; i--) {
    const w = wounds[i];
    if (w.hoursLeft == null) continue;
    w.hoursLeft -= hours;
    if (w.hoursLeft <= 0) {
      ctx.event("healed", `${who}: ${w.label} has healed.`);
      wounds.splice(i, 1);
    }
  }
}

HANDLERS.time = (op, ctx) => {
  let h = parseDuration(op.args.join(" ").replace(/^\+/, "")) ?? parseDuration(op.args[0]);
  if (h == null) {
    const d = num(op.kv.days) ?? num(op.kv.day);
    const hr = num(op.kv.hours) ?? num(op.kv.h);
    if (d != null || hr != null) h = (d ?? 0) * 24 + (hr ?? 0);
  }
  if (h == null || h <= 0) reject("time needs a duration (+6h, +1 day, +3d)");
  if (h > 24 * 365 * 5) reject("time skip too large");
  advanceTime(ctx, h);
};

HANDLERS.move = (op, ctx) => {
  const w = ctx.state.world;
  const floor = num(op.kv.floor);
  const place = op.kv.place ?? op.kv.to ?? op.args.join(" ").trim();
  if (floor == null && !place) reject("move needs floor= or place=");
  if (floor != null) {
    if (floor < 1 || floor > 100) reject("floors run 1 to 100");
    if (floor !== w.floor) {
      w.floor = floor;
      w.clocks[String(floor)] ??= { hours: 8, weather: null };
      onFloorChange(ctx, floor);
    }
  }
  if (place) w.place = place;
};

export let onFloorChange: (ctx: Ctx, floor: number) => void = () => {};
export function setOnFloorChange(fn: typeof onFloorChange): void {
  onFloorChange = fn;
}

HANDLERS.weather = (op, ctx) => {
  const w = ctx.state.world;
  const text = op.kv.weather ?? op.args.join(" ").trim();
  if (!text) reject("weather needs a description");
  (w.clocks[String(w.floor)] ??= { hours: 8, weather: null }).weather = text;
};

// ── block application ──────────────────────────────────────────────────

/** Mana a form line will charge, for matching an explicit "spend mana N" in the same block. */
function formManaCost(op: Op, ctx: Ctx): number | null {
  const v = canonVerb(op.verb);
  if (v !== "form" && v !== "bind" && v !== "raise" && v !== "make") return null;
  try {
    return planForm(op, ctx, v).mana;
  } catch {
    return null;
  }
}

export function applyOps(ctx: Ctx, ops: Op[]): void {
  // A "spend mana N" that matches a form line's cost is the payment for it, not a second charge.
  const spends = ops.filter((o) => canonVerb(o.verb) === "spend" && /^mana/i.test(o.args[0] ?? "mana"));
  for (const o of ops) {
    const c = formManaCost(o, ctx);
    if (!c) continue;
    const match = spends.find((s) => !ctx.absorbed.has(s) && num(s.args[1] ?? s.args[0]) === c);
    if (match) ctx.absorbed.add(match);
  }
  for (const op of ops) {
    const verb = canonVerb(op.verb);
    const h = HANDLERS[verb];
    if (!h) {
      ctx.res.rejected.push({ line: op.raw, reason: `unknown op "${op.verb}"` });
      continue;
    }
    try {
      h(op, ctx);
      ctx.res.applied.push(op.raw);
    } catch (e) {
      const reason = e instanceof Reject ? e.message : `error: ${(e as Error)?.message ?? e}`;
      ctx.res.rejected.push({ line: op.raw, reason });
    }
  }
  clampVitals(ctx.state);
}
