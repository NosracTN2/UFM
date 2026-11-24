// Growth data for the panel and sheet, plus the familiar attribute-window handler.

import { bondFeedbackActive } from "../engine/derive";
import { artSlots, borrowedSlots, branchSlots, crossPairs, openPillars } from "../engine/growth";
import { levelsPerBranch, pillarDef, TETHER_ARTS } from "../shared/data";
import { nextThresholdLevel } from "../shared/math";
import { addPlayerEvent, onFront, toast } from "./protocol";
import { addViewExtras } from "./sync";

export interface GrowthView {
  arts: { id: string; name: string; desc: string; learned: boolean }[];
  artSlots: number;
  nextThreshold: number;
  branchSlots: number;
  branchRate: number;
  branchProgress: number;
  borrowedSlots: number;
  crossPairs: [string, string][];
  bondFeedback: boolean;
}

export function registerGrowthView(): void {
  addViewExtras((c) => {
    const st = c.result?.state;
    if (!st?.started) return {};
    const s = st.sheet;
    const growth: GrowthView = {
      arts: TETHER_ARTS.map((a) => ({ id: a.id, name: a.name, desc: a.desc, learned: s.arts[a.id] === "learned" })),
      artSlots: artSlots(st),
      nextThreshold: nextThresholdLevel(s.level),
      branchSlots: branchSlots(st),
      branchRate: levelsPerBranch(s.run, s.rarity, openPillars(st).length),
      branchProgress: s.branchProgress,
      borrowedSlots: borrowedSlots(st),
      crossPairs: crossPairs(st).map(([a, b]) => [pillarDef(a)?.name ?? a, pillarDef(b)?.name ?? b]),
      bondFeedback: bondFeedbackActive(st),
    };
    return { growth };
  });

  onFront("fam_alloc", async (msg, c, userId) => {
    const f = c?.result?.state.roster.find((x) => x.id === msg.famId);
    if (!c || !f) return;
    const total = Object.values(msg.points ?? {}).reduce((s: number, v) => s + (Number(v) || 0), 0);
    if (total <= 0) return;
    if (total > f.unspent) {
      toast("warning", `${f.name} has only ${f.unspent} point(s).`, userId);
      return;
    }
    await addPlayerEvent(c, "fam_alloc", { famId: f.id, points: msg.points });
  });
}
