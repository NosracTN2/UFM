import { describe, expect, test } from "bun:test";
import { enemyView, heat } from "../src/engine/world";
import { chat, run, withSetup } from "./helpers";

const lines = (text: string, p = withSetup()) => run(chat([{ role: "assistant", swipes: [[text]] }]), p);

describe("enemy windows and floor bands", () => {
  test("the Origin sees the full window; a familiar kill's XP is shown", () => {
    const r = lines(`see enemy="Staff warden" level=17 class="Warden" lineage="Human" rarity=Common`);
    const e = enemyView(r.state, r.state.world.lastEnemy)!;
    expect(e).toMatchObject({ name: "Staff warden", level: 17, className: "Warden", lineage: "Human", rarity: "Common", fogged: false });
    expect(e.payByFamiliar).toBe(killXp17at1());
    expect(lines(`see enemy="Iron knight" level=55`).state.world.enemies.iron_knight.level).toBe(55);
    expect(enemyView(lines(`see enemy="Iron knight" level=55`).state, "iron_knight")!.circleAbove).toBe(true);
  });

  test("ordinary Awakened (the spread) see a fogged window", () => {
    const r = lines(`see enemy="Staff warden" level=17 class="Warden" lineage="Human" rarity=Common`, withSetup({ run: "spread", rarity: "rare" }));
    const e = enemyView(r.state, r.state.world.lastEnemy)!;
    expect(e.fogged).toBe(true);
    expect(e.lineage).toBe(null);
    expect(e.rarity).toBe(null);
  });

  test("changing floors announces the new floor's band", () => {
    const r = lines(`move floor=12 place="the gate"`);
    expect(r.last?.events.find((e) => e.kind === "world")?.text).toBe("Floor 12: enemies here run Level 12–16; its Guardian sits at the top.");
  });
});

function killXp17at1(): number {
  // killXp(17, 1): 17*100*2*(1+1.6)/100 = 88.4 -> 88 -> 8,800
  return 8800;
}

describe("who knows what", () => {
  test("heat is derived from what each faction knows", () => {
    const r = lines(`learn who="The Staff" fact="raises golems from stone" via=seen\nlearn who="The Witch" fact="lives in the mining town"`);
    const h = heat(r.state);
    expect(h.byFaction.staff).toBe(3);
    expect(h.byFaction.witch).toBe(2);
    expect(h.byFaction.mane).toBe(0);
  });

  test("facts spread only through ops; kill every witness and the Staff still doesn't know", () => {
    const base = `npc name="Halvard" faction="The Staff" voice="clipped, dry"\nlearn who="Halvard" fact="commands earth elementals" via=seen`;
    expect(heat(lines(base).state).byFaction.staff).toBe(3);
    const dead = lines(`${base}\nnpc Halvard dead=yes`);
    expect(heat(dead.state).byFaction.staff).toBe(0);
    expect(dead.state.world.facts[0].holders).toEqual(["npc:halvard"]);
    const told = lines(`${base}\nlearn who="The Staff" fact="commands earth elementals" via=told\nnpc Halvard dead=yes`);
    expect(heat(told.state).byFaction.staff).toBe(3);
  });

  test("Origin-level secrets feed Decree 00", () => {
    const r = lines(`learn who="The Registry" fact="is the Origin, the Ultimate Familiar Master"`);
    expect(heat(r.state).decree00).toBe(5);
  });
});

describe("people and threads", () => {
  test("NPC records: voice, wounds, grudges, goals; a kill by name marks them dead", () => {
    const r = lines(`npc name="Mara Venn" faction="The Dagger" voice="soft, never finishes sentences" goal="find the golem-maker"\nnpc "Mara Venn" wound="burned hand" grudge="the miner shamed her"\nform name="Pebble" form=puppet\nkill enemy="Mara Venn" level=2 by=Pebble`);
    const n = r.state.world.npcs.mara_venn;
    expect(n).toMatchObject({ faction: "dagger", voice: "soft, never finishes sentences", wounds: ["burned hand"], grudges: ["the miner shamed her"], alive: false });
  });

  test("threads open and close", () => {
    const r = lines(`thread "Registry deadline"\nthread "The missing miners"\nthread close "Registry deadline"`);
    expect(r.state.world.threads.map((t) => `${t.text}:${t.open}`)).toEqual(["Registry deadline:false", "The missing miners:true"]);
  });

  test("offscreen updates apply at the message that triggered them and roll back with it", () => {
    const p = withSetup();
    p.offscreen["m1#0"] = [{ npc: "Halvard", kind: "wound", text: "lost an eye in a raid" }];
    const log = chat([
      { role: "assistant", swipes: [[`npc name="Halvard" faction="The Staff"`]] },
      { role: "assistant", swipes: [["time +2d"], ["time +1h"]], swipe: 0 },
    ]);
    const r = run(log, p);
    expect(r.state.world.npcs.halvard).toMatchObject({ wounds: ["lost an eye in a raid"], news: ["lost an eye in a raid"] });
    log.messages[1].swipe = 1;
    expect(run(log, p).state.world.npcs.halvard.wounds).toEqual([]);
    const seen = run(chat([{ role: "assistant", swipes: [[`npc name="Halvard" faction="The Staff"`]] }, { role: "assistant", swipes: [["time +2d"]] }, { role: "assistant", swipes: [[`npc Halvard seen=yes`]] }]), p);
    expect(seen.state.world.npcs.halvard.news).toEqual([]);
  });

  test("a long time skip marks the message for an offscreen pass", () => {
    const r = lines("time +3d");
    expect(r.last?.events.some((e) => e.text === "__offscreen:time:72")).toBe(true);
    expect(lines("time +2h").last?.events.some((e) => e.text.startsWith("__offscreen"))).toBe(false);
  });
});
