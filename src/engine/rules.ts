// The rule layer: Pillar open, floor gates, mastery tier, touch range, control by kind.
// Installed into the op handlers' hooks, so the narrator's tag and the panel's buttons
// are judged by exactly the same checks.

import { FLOOR_FORBIDS, FORMS, masteryName, ORDER_VERBS, pillarDef } from "../shared/data";
import type { Familiar, GameState } from "../shared/types";
import { type Ctx, reject } from "./context";
import { yes } from "./parse";
import { setFormValidator, setHandCheck, setOrderCheck, setSlumberCheck, setStanceCheck, setWakeCheck } from "./ops";

export function pillarLabel(state: GameState, id: string): string {
  const p = pillarDef(id);
  if (!p) return id;
  const st = state.sheet.pillars[id]?.status;
  return st === "open" || state.sheet.run === "sandbox" ? p.name : "a sealed Pillar ([???])";
}

export function floorForbids(state: GameState, pillar: string): boolean {
  return (FLOOR_FORBIDS[state.world.floor] ?? []).includes(pillar);
}

export function branchTier(state: GameState, pillar: string, element?: string | null): { tier: number; name: string | null } {
  const branches = state.sheet.branches.filter((b) => b.pillar === pillar || b.cross?.includes(pillar));
  if (element) {
    const b = branches.find((x) => x.name.toLowerCase() === element.toLowerCase());
    return b ? { tier: b.tier, name: b.name } : { tier: -1, name: null };
  }
  if (!branches.length) return { tier: -1, name: null };
  const best = branches.reduce((a, b) => (b.tier > a.tier ? b : a));
  return { tier: best.tier, name: best.name };
}

function control(f: Familiar): string {
  return FORMS[f.form]?.control ?? (f.minded ? "ask" : "order");
}

export function installRules(): void {
  setFormValidator((op, ctx, plan) => {
    const st = ctx.state;
    const p = st.sheet.pillars[plan.pillar];
    const name = pillarDef(plan.pillar)?.name ?? plan.pillar;
    if (!p || p.status !== "open") reject(`${pillarLabel(st, plan.pillar)} isn't open`);
    if (floorForbids(st, plan.pillar)) reject(`Floor ${st.world.floor}'s Conquest Requirements forbid ${name}`);
    if (plan.def.kind === "elemental") {
      const element = op.kv.element ?? st.sheet.branches.find((b) => b.pillar === "elemental")?.name;
      if (!element) reject("no Element Branch open");
      const t = branchTier(st, "elemental", element);
      if (t.tier < 0) reject(`the ${element[0].toUpperCase()}${element.slice(1)} Branch isn't open (Elements are Elemental Creation's Branches)`);
      if (t.tier < plan.def.minTier) reject(`${plan.def.label} needs ${masteryName(plan.def.minTier)} in ${t.name} (you have ${masteryName(t.tier)})`);
    } else if (plan.def.minTier > 0) {
      const t = branchTier(st, plan.pillar);
      if (t.tier < plan.def.minTier) reject(`${plan.def.label} needs ${masteryName(plan.def.minTier)} in a ${name} Branch (best: ${masteryName(Math.max(0, t.tier))})`);
    }
  });

  setWakeCheck((op, ctx, f) => {
    const w = ctx.state.world;
    if (f.state !== "slumbering") return;
    if (yes(op.kv.call) || yes(op.kv.gatecall)) return; // Gatecalling (checked by the call op)
    if (f.floor !== w.floor) reject(`${f.name} slumbers on Floor ${f.floor}; you're on Floor ${w.floor}`);
    const here = !f.place || !w.place || f.place.toLowerCase() === w.place.toLowerCase();
    if (!here && !yes(op.kv.touch)) reject(`${f.name} slumbers at ${f.place}: waking needs your touch on its ${f.element ?? "body"}`);
  });

  setOrderCheck((op, ctx, f, verb) => {
    const c = control(f);
    if (c === "hand") reject(`${f.name} has no mind: a Puppet Golem moves only while you guide it by hand`);
    if (verb === "feed" && c !== "undead") reject(`only the dead feed (${f.name} is ${FORMS[f.form]?.label ?? f.form})`);
    if (verb === "strike" && !(op.kv.target ?? op.args.slice(2).join(" ").trim())) reject("strike needs a named target");
    if (!f.minded && c !== "undead" && !ORDER_VERBS.includes(verb as never)) reject(`${f.name} follows only simple orders (${ORDER_VERBS.join(", ")})`);
    void ctx;
  });

  setStanceCheck((_op, _ctx, f) => {
    if (control(f) !== "stance") reject(`only Mid Mastery constructs take a stance (${f.name} is ${FORMS[f.form]?.label ?? f.form})`);
  });

  setHandCheck((_op, ctx, f) => {
    if (control(f) !== "hand") reject(`only a Puppet Golem is taken by hand${ctx.state.sheet.arts.vessel_riding === "learned" ? " (use ride for Vessel Riding)" : ""}`);
    const s = ctx.state.sheet;
    if (s.hand && s.hand !== f.id) {
      const skilled = s.branches.some((b) => b.skills.some((k) => /switch|hand/i.test(k.name)));
      if (!skilled) ctx.note(`Switching hands to ${f.name} costs a moment: it's a skill you haven't learned yet.`);
    }
  });

  setSlumberCheck((f) => {
    if (f.kind !== "elemental" && f.kind !== "construct" && f.kind !== "domain") {
      reject(`${f.name} can't be put to slumber: only elementals and constructs slumber (carry others in your soul, or release them)`);
    }
  });
}

export type { Ctx };
