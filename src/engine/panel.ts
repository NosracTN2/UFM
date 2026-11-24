// Panel logic: turn a click into a standing order, and decide which buttons are live.
// Every check is a dry run of the exact op the narrator would confirm, against a copy of
// the state, so the panel and the rule engine can never disagree.

import { FORMS, formDef, PILLARS, pillarDef, SOUL_STAGES, STANCES, type FormDef } from "../shared/data";
import type { Familiar, GameState, Order, Settings } from "../shared/types";
import { makeCtx } from "./context";
import { applyOps } from "./ops";
import { parseLine } from "./parse";

export function dryRun(state: GameState, settings: Settings, lines: string[]): { ok: boolean; reason: string | null } {
  const copy: GameState = structuredClone(state);
  const res = { key: "dry", msgId: "dry", swipe: 0, applied: [], notes: [], rejected: [] as { line: string; reason: string }[], events: [] };
  const ctx = makeCtx(copy, settings, res);
  const ops = lines.map((l, i) => parseLine(l, i)).filter((o): o is NonNullable<typeof o> => !!o);
  applyOps(ctx, ops);
  return res.rejected.length ? { ok: false, reason: res.rejected[0].reason } : { ok: true, reason: null };
}

const q = (s: string) => `"${s.replace(/"/g, "'")}"`;

export interface FormOption {
  key: string;
  pillar: string;
  pillarName: string;
  form: string;
  label: string;
  mana: number;
  tether: number;
  note: string;
  needsElement: boolean;
  needsSpecies: boolean;
  kinds: string[] | null;
  stages: { id: string; name: string; tether: number }[] | null;
  ok: boolean;
  reason: string | null;
}

function formsForPillar(pid: string): FormDef[] {
  const list = Object.values(FORMS).filter((f) => f.pillar === pid);
  if (list.length) return list;
  const p = pillarDef(pid);
  const base = formDef(p?.baseForm);
  return [base ? { ...base, pillar: pid } : { ...FORMS.familiar, pillar: pid }];
}

/** Form options for every open Pillar, each checked against the rules. */
export function formOptions(state: GameState, settings: Settings): FormOption[] {
  const s = state.sheet;
  const open = PILLARS.filter((p) => s.pillars[p.id]?.status === "open");
  const out: FormOption[] = [];
  const element = s.branches.find((b) => b.pillar === "elemental")?.name.toLowerCase() ?? "earth";
  for (const p of open) {
    const forms = p.id === "necromancy" ? [FORMS.zombie, FORMS.skeleton, FORMS.spirit] : formsForPillar(p.id);
    for (const f of forms) {
      const probe = probeLine(f, p.id, { name: "Probe Familiar", element, species: "probe", stage: "nascent", kind: f.id });
      const r = dryRun(state, settings, [probe]);
      out.push({
        key: `${p.id}:${f.id}`,
        pillar: p.id,
        pillarName: p.name,
        form: f.id,
        label: f.label,
        mana: f.mana,
        tether: f.kind === "beast" ? SOUL_STAGES[0].tether : f.tether,
        note: f.note,
        needsElement: f.kind === "elemental",
        needsSpecies: f.kind === "beast" || f.kind === "zombie" || f.kind === "skeleton" || f.kind === "vampire",
        kinds: null,
        stages: f.kind === "beast" ? SOUL_STAGES.map((st) => ({ id: st.id, name: st.name + (st.gameOnly ? " (game-only)" : ""), tether: st.tether })) : null,
        ok: r.ok,
        reason: r.reason,
      });
    }
  }
  return out;
}

export interface FormRequest {
  pillar: string;
  form: string;
  name?: string;
  element?: string;
  material?: string;
  species?: string;
  stage?: string;
  strong?: string;
}

function probeLine(f: FormDef, pillar: string, r: { name: string; element?: string; material?: string; species?: string; stage?: string; kind?: string; strong?: string }): string {
  const bits: string[] = [];
  if (f.kind === "beast") bits.push("bind", `name=${q(r.name)}`, `pillar=${pillar}`, `species=${q(r.species || "beast")}`, `stage=${r.stage || "nascent"}`);
  else if (f.pillar === "necromancy") bits.push("raise", `name=${q(r.name)}`, `kind=${f.id}`, r.species ? `species=${q(r.species)}` : "");
  else bits.push("form", `name=${q(r.name)}`, `pillar=${pillar}`, `form=${f.id}`);
  if (f.kind === "elemental" && r.element) bits.push(`element=${r.element.toLowerCase()}`);
  if (r.material) bits.push(`material=${q(r.material)}`);
  if (r.species && f.kind !== "beast" && f.pillar !== "necromancy") bits.push(`species=${q(r.species)}`);
  if (r.strong) bits.push(`strong=${r.strong}`);
  return bits.filter(Boolean).join(" ");
}

export type Action =
  | ({ kind: "form" } & FormRequest)
  | { kind: "slumber" | "wake" | "release" | "soul" | "call" | "ride"; famId: string }
  | { kind: "hand"; famId: string | null }
  | { kind: "order"; famId: string; verb: string; target?: string }
  | { kind: "stance"; famId: string; stance: string }
  | { kind: "rename"; famId: string; name: string }
  | { kind: "feed"; famId: string; target: string }
  | { kind: "evolve"; famId: string; path?: string }
  | { kind: "squad_order"; famIds: string[]; squadName: string; verb: string; target?: string }
  | { kind: "custom"; text: string };

export class ActionError extends Error {}

function fam(state: GameState, id: string): Familiar {
  const f = state.roster.find((x) => x.id === id);
  if (!f) throw new ActionError("That familiar is not on your roster.");
  return f;
}

function asks(f: Familiar): boolean {
  return FORMS[f.form]?.control === "ask";
}

function orderLines(f: Familiar, verb: string, target: string): { directive: string; expect: string; text: string } {
  const v = verb.toLowerCase();
  const text = v === "free" ? "is free to act" : `${v}${target ? ` ${target}` : ""}`;
  const directive = asks(f)
    ? `{{user}} asks ${f.name} to ${v === "free" ? "do as it likes" : text} (a beast is asked, not ordered; its bond decides how readily it listens).`
    : `{{user}} orders ${f.name}: ${text}.`;
  const expect = `order ${q(f.name)} ${v}${target ? ` ${q(target)}` : ""}`;
  return { directive, expect, text };
}

let seq = 0;
function mk(kind: string, line: string, directive: string, expect: string): Order {
  seq += 1;
  return { id: `o${Date.now().toString(36)}${seq}`, kind, line, directive, expect, ts: Date.now() };
}

/** Build the standing order for a panel action, after checking it against the rules. */
export function buildOrder(state: GameState, settings: Settings, a: Action): Order {
  const check = (lines: string[]) => {
    const r = dryRun(state, settings, lines);
    if (!r.ok) throw new ActionError(r.reason ?? "not allowed");
  };
  switch (a.kind) {
    case "form": {
      const f = formDef(a.form);
      const p = pillarDef(a.pillar);
      if (!f || !p) throw new ActionError("Pick a Pillar and a form.");
      const name = a.name?.trim() || undefined;
      const probe = probeLine(f, p.id, { name: name ?? "Unnamed Familiar", element: a.element, material: a.material, species: a.species, stage: a.stage, strong: a.strong });
      check([probe]);
      const expect = name ? probe : probe.replace(/ name="Unnamed Familiar"/, "");
      const what = [f.label, a.element && f.kind === "elemental" ? `of ${a.element.toLowerCase()}` : "", a.material ? `(${a.material})` : "", a.species ? `— ${a.species}` : ""].filter(Boolean).join(" ");
      const cost = f.kind === "beast" ? `no Mana, ${SOUL_STAGES.find((x) => x.id === (a.stage || "nascent"))?.tether ?? 1} tether(s), its soul must answer` : `${f.mana} Mana, ${f.tether} tether${f.tether === 1 ? "" : "s"}`;
      const verb = f.kind === "beast" ? "Bind" : f.pillar === "necromancy" ? "Raise" : "Form";
      return mk(
        "form",
        `» ${verb}: ${what}${name ? ` named ${name}` : ""}.`,
        `{{user}} ${verb === "Bind" ? "tries to bind" : verb === "Raise" ? "raises" : "forms"} a ${what}${name ? ` named "${name}"` : ""} (${cost}).${verb === "Bind" ? " The beast's soul has to answer; it can refuse." : ""}`,
        expect,
      );
    }
    case "slumber": {
      const f = fam(state, a.famId);
      check([`slumber ${q(f.name)}`]);
      return mk("slumber", `» ${f.name}: slumber.`, `{{user}} lets ${f.name} sink into slumber where it stands (it frees its tether).`, `slumber ${q(f.name)}`);
    }
    case "wake": {
      const f = fam(state, a.famId);
      check([`wake ${q(f.name)}`]);
      return mk("wake", `» Wake ${f.name}.`, `{{user}} touches ${f.name}'s ${f.element ?? "body"} and wakes it.`, `wake ${q(f.name)} touch=yes`);
    }
    case "release": {
      const f = fam(state, a.famId);
      check([`release ${q(f.name)}`]);
      return mk("release", `» Release ${f.name}.`, `{{user}} releases ${f.name}: the tether lets go, for good.`, `release ${q(f.name)}`);
    }
    case "hand": {
      if (a.famId == null) return mk("hand", "» Let go of the puppet.", "{{user}} lets go of the puppet they were guiding by hand; it stands still.", "hand none");
      const f = fam(state, a.famId);
      check([`hand ${q(f.name)}`]);
      return mk("hand", `» Take hand: ${f.name}.`, `{{user}} takes ${f.name} by hand. From now on their typed actions steer it directly; narrate its senses instead of theirs.`, `hand ${q(f.name)}`);
    }
    case "order": {
      const f = fam(state, a.famId);
      const target = (a.target ?? "").trim();
      const o = orderLines(f, a.verb, target);
      check([o.expect]);
      return mk("order", `» ${f.name}: ${o.text}.`, o.directive, o.expect);
    }
    case "squad_order": {
      const fams = a.famIds.map((id) => fam(state, id)).filter((f) => f.state === "active");
      if (!fams.length) throw new ActionError("No active familiars in that squad.");
      const target = (a.target ?? "").trim();
      const parts = fams.map((f) => orderLines(f, a.verb, target));
      check(parts.map((p) => p.expect));
      return mk(
        "squad_order",
        `» ${a.squadName}: ${parts[0].text}.`,
        `{{user}} gives the squad "${a.squadName}" (${fams.map((f) => f.name).join(", ")}) one order: ${parts[0].text}.`,
        parts.map((p) => p.expect).join("\n"),
      );
    }
    case "stance": {
      const f = fam(state, a.famId);
      if (!STANCES.includes(a.stance as never)) throw new ActionError("Stance is hold, press or protect.");
      check([`stance ${q(f.name)} ${a.stance}`]);
      return mk("stance", `» ${f.name}: stance ${a.stance}.`, `{{user}} sets ${f.name}'s stance: ${a.stance}${a.stance === "protect" ? " (protect {{user}})" : ""}.`, `stance ${q(f.name)} ${a.stance}`);
    }
    case "rename": {
      const f = fam(state, a.famId);
      const to = a.name.trim();
      if (!to) throw new ActionError("Give it a name.");
      check([`rename ${q(f.name)} ${q(to)}`]);
      return mk("rename", `» ${f.name} is named ${to}.`, `{{user}} names ${f.name} "${to}".`, `rename ${q(f.name)} ${q(to)}`);
    }
    case "feed": {
      const f = fam(state, a.famId);
      const target = a.target.trim();
      if (!target) throw new ActionError("Name what it should feed on.");
      check([`order ${q(f.name)} feed ${q(target)}`]);
      return mk("feed", `» ${f.name}: feed on ${target}.`, `{{user}} sets ${f.name} to feed on ${target}.`, `order ${q(f.name)} feed ${q(target)}`);
    }
    case "soul":
    case "call":
    case "ride":
    case "evolve":
      return growthOrder(state, settings, a, check);
    case "custom": {
      const text = a.text.trim();
      if (!text) throw new ActionError("Write the command.");
      return mk("custom", `» ${text}`, `{{user}} commands: ${text}`, "");
    }
  }
}

/** Phase 4 fills in arts and evolution orders. */
export let growthOrder: (state: GameState, settings: Settings, a: Action, check: (lines: string[]) => void) => Order = () => {
  throw new ActionError("Not available yet.");
};
export function setGrowthOrder(fn: typeof growthOrder): void {
  growthOrder = fn;
}
export { mk as makeOrder, q as quote, fam as famById };

export interface FamChecks {
  slumber: string | null;
  wake: string | null;
  release: string | null;
  hand: string | null;
  order: string | null;
  stance: string | null;
  soul: string | null;
  call: string | null;
  ride: string | null;
}

/** Why each card action is unavailable (null = allowed). */
export function famChecks(state: GameState, settings: Settings): Record<string, FamChecks> {
  const out: Record<string, FamChecks> = {};
  const why = (lines: string[]) => dryRun(state, settings, lines).reason;
  for (const f of state.roster) {
    if (f.state === "lost" || f.state === "released") continue;
    const n = q(f.name);
    out[f.id] = {
      slumber: f.state === "active" ? why([`slumber ${n}`]) : "not active",
      wake: f.state === "slumbering" || f.state === "soul" ? why([`wake ${n}`]) : "not slumbering",
      release: why([`release ${n}`]),
      hand: f.state === "active" ? why([`hand ${n}`]) : "not active",
      order: f.state === "active" ? why([`order ${n} guard "here"`]) : "not active",
      stance: f.state === "active" ? why([`stance ${n} hold`]) : "not active",
      soul: f.state === "active" ? why([`soul ${n}`]) : f.state === "soul" ? "already carried" : "not active",
      call: f.state !== "active" ? why([`call ${n}`]) : "already here",
      ride: f.state === "active" ? why([`ride ${n}`]) : "not active",
    };
  }
  return out;
}
