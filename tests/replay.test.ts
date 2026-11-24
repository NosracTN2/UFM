import { describe, expect, test } from "bun:test";
import { derive } from "../src/engine/derive";
import { renderState } from "../src/engine/render";
import { chat, run, withSetup } from "./helpers";

describe("setup", () => {
  test("mining-town Origin starts at Level 1 with one Pillar and one Branch", () => {
    const { state } = run(chat([]));
    const s = state.sheet;
    expect(state.started).toBe(true);
    expect(s.level).toBe(1);
    expect(s.className).toBe("Ultimate Familiar Master (Origin)");
    expect(s.pillars.elemental.status).toBe("open");
    expect(Object.values(s.pillars).filter((p) => p.status === "open").length).toBe(1);
    expect(s.branches.map((b) => b.name)).toEqual(["Earth"]);
    const d = derive(state);
    expect(d.hpMax).toBe(100);
    expect(d.manaMax).toBe(35);
    expect(d.tethersTotal).toBe(5);
    expect(s.hp).toBe(100);
    expect(s.mana).toBe(35);
    expect(s.narrow.pct).toBeGreaterThanOrEqual(10);
    expect(s.narrow.pct).toBeLessThanOrEqual(30);
  });

  test("a higher-floor birthplace starts higher, with level-up bonuses and more Branches", () => {
    const { state } = run(chat([]), withSetup({ birthplace: "graveyard", pillar: "necromancy", branch: "Raised Flesh" }));
    const s = state.sheet;
    expect(s.level).toBe(30);
    expect(s.unspent).toBeGreaterThan(29);
    // Necromancy has three set Branches; a Floor 30 start opens all of them.
    expect(s.branches.length).toBe(3);
    expect(state.world.floor).toBe(30);
  });
});

describe("change log replay", () => {
  test("forming a puppet costs 5 Mana and 1 tether; a matching spend line is not charged twice", () => {
    const log = chat([
      { role: "user" },
      { role: "assistant", swipes: [[`spend mana 5\nform name="Pebble" form=puppet element=earth`]] },
    ]);
    const r = run(log);
    const f = r.state.roster[0];
    expect(f.name).toBe("Pebble");
    expect(r.state.sheet.mana).toBe(30);
    expect(derive(r.state).tethersUsed).toBe(1);
    expect(r.last?.rejected).toEqual([]);
  });

  test("a golem you can't afford doesn't appear", () => {
    const log = chat([
      { role: "assistant", swipes: [["spend mana 30", `form name="Shale" form=automated`]] },
    ]);
    const r = run(log);
    expect(r.state.roster.length).toBe(0);
    expect(r.last?.rejected[0].reason).toContain("costs 15 Mana");
  });

  test("tethers cap the roster", () => {
    const lines = Array.from({ length: 6 }, (_, i) => `form name="P${i}" form=puppet`).join("\n");
    const r = run(chat([{ role: "assistant", swipes: [[lines]] }]));
    expect(r.state.roster.length).toBe(5);
    expect(r.last?.rejected[0].reason).toContain("tether");
  });

  test("swipes roll back cleanly", () => {
    const log = chat([
      { role: "user" },
      { role: "assistant", swipes: [[`form name="Pebble" form=puppet`], [`form name="Grit" form=puppet\nform name="Dust" form=puppet`]], swipe: 1 },
    ]);
    const r1 = run(log);
    expect(r1.state.roster.map((f) => f.name)).toEqual(["Grit", "Dust"]);
    log.messages[1].swipe = 0;
    const r0 = run(log);
    expect(r0.state.roster.map((f) => f.name)).toEqual(["Pebble"]);
  });

  test("deleting a message removes its effects", () => {
    const log = chat([
      { role: "assistant", swipes: [[`form name="Pebble" form=puppet`]], id: "a" },
      { role: "assistant", swipes: [[`lose "Pebble"`]], id: "b" },
    ]);
    expect(run(log).state.roster[0].state).toBe("lost");
    log.messages = log.messages.filter((m) => m.id !== "b");
    expect(run(log).state.roster[0].state).toBe("active");
  });

  test("only kills by a bound familiar pay XP", () => {
    const log = chat([
      { role: "assistant", swipes: [[`form name="Pebble" form=puppet\nkill enemy="rat" level=3 by=you\nkill enemy="Staff warden" level=3 by=Pebble`]] },
    ]);
    const r = run(log, undefined, { narrowTether: false });
    // killXp(3, 1) = round(3*100*1*1.2/100)*100 = 400
    expect(r.state.sheet.xp).toBe(400);
    expect(r.state.roster[0].kills).toBe(1);
    expect(r.state.roster[0].xpSent).toBe(400);
  });

  test("the narrow tether lets only a share through below Level 15", () => {
    const log = chat([{ role: "assistant", swipes: [[`form name="Pebble" form=puppet\nkill enemy="warden" level=3 by=Pebble`]] }]);
    const r = run(log);
    const pct = r.state.sheet.narrow.pct;
    expect(r.state.sheet.xp).toBe(Math.round((400 * pct) / 100));
    expect(r.state.sheet.narrow.spilled).toBe(400 - Math.round((400 * pct) / 100));
  });

  test("level-ups add rate points, 10x/5x rate max Health/Mana and fully restore", () => {
    const log = chat([
      { role: "assistant", swipes: [[`form name="Pebble" form=puppet\nhurt you 40\nkill enemy="captain" level=12 by=Pebble`]] },
    ]);
    const r = run(log, undefined, { narrowTether: false });
    const s = r.state.sheet;
    // killXp(12, 1) = 12*100*1*2.1 = 2520 -> 2500. Level 1 needs 1000, Level 2 needs 2000: reach Level 2 with 1500.
    expect(s.level).toBe(2);
    expect(s.xp).toBe(1500);
    expect(s.unspent).toBe(1);
    const d = derive(r.state);
    expect(d.hpMax).toBe(110);
    expect(d.manaMax).toBe(40);
    expect(s.hp).toBe(110);
    expect(r.last?.events.some((e) => e.kind === "level")).toBe(true);
  });

  test("crossing a Circle fires a big event", () => {
    const p = withSetup({ birthplace: "custom", floor: 49, pillar: "elemental", branch: "Earth" });
    const log = chat([{ role: "assistant", swipes: [[`form name="Titan" form=puppet\nkill enemy="Guardian" level=60 by=Titan`]] }]);
    const r = run(log, p, { narrowTether: false });
    expect(r.state.sheet.level).toBe(50);
    expect(r.last?.events.find((e) => e.kind === "circle")?.big).toBe(true);
  });

  test("time heals wounds and floors keep their own clocks", () => {
    const log = chat([
      { role: "assistant", swipes: [[`wound you "cracked rib" heal=2d\ntime +1 day`]] },
      { role: "assistant", swipes: [["move floor=2 place=\"the gate\"", "time +30h"]] },
    ]);
    const r = run(log);
    expect(r.state.sheet.wounds.length).toBe(0);
    expect(r.state.world.clocks["1"].hours).toBe(8 + 24);
    expect(r.state.world.clocks["2"].hours).toBe(8 + 30);
  });

  test("unknown ops and bad lines are dropped without losing the rest", () => {
    const r = run(chat([{ role: "assistant", swipes: [[`gain xp 5000\nfrobnicate\nform name="Pebble" form=puppet`]] }]));
    expect(r.state.roster.length).toBe(1);
    expect(r.last?.rejected.length).toBe(2);
    expect(r.state.sheet.xp).toBe(0);
  });

  test("player allocations anchored to a swipe vanish when that swipe is swiped away", () => {
    const p = withSetup({ birthplace: "custom", floor: 3 });
    p.events.push({ id: "a1", anchor: { msgId: "m0", swipe: 0 }, kind: "alloc", data: { points: { ctl: 2 } }, ts: 5 });
    const log = chat([{ role: "assistant", swipes: [[""], [""]], swipe: 0 }]);
    expect(derive(run(log, p).state).tethersTotal).toBe(15);
    log.messages[0].swipe = 1;
    expect(derive(run(log, p).state).tethersTotal).toBe(5);
  });

  test("state block renders headline numbers", () => {
    const r = run(chat([{ role: "assistant", swipes: [[`form name="Pebble" form=puppet`, `hand Pebble`]] }]));
    const text = renderState(r.state);
    expect(text).toContain("Mana 30/35");
    expect(text).toContain("Soul Tethers 1/5");
    expect(text).toContain("HAND: the player holds Pebble");
  });
});
