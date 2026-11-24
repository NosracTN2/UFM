import { describe, expect, test } from "bun:test";
import { derive } from "../src/engine/derive";
import { artSlots, branchSlots } from "../src/engine/growth";
import { emptyPlayer } from "../src/engine/replay";
import { chat, run, setupEvent, withSetup } from "./helpers";

const lines = (text: string, p = withSetup(), settings = {}) => run(chat([{ role: "assistant", swipes: [[text]] }]), p, settings);
const sandbox = (floor = 15, extra = ["beast", "blood"]) => withSetup({ run: "sandbox", birthplace: "custom", floor, pillar: "elemental", extraPillars: extra, branch: "Earth" });
const NO_NARROW = { narrowTether: false };

describe("mastery", () => {
  test("practice raises mastery %, tiers turn at 100% and unlock the Automated Golem", () => {
    const r = lines(`practice branch=Earth amount=breakthrough\npractice branch=Earth amount=breakthrough\npractice branch=Earth amount=breakthrough\npractice branch=Earth amount=breakthrough\nform name="Shale" form=automated element=earth`);
    const earth = r.state.sheet.branches[0];
    expect(earth.tier).toBe(1);
    expect(r.state.roster[0].form).toBe("automated");
    expect(r.last?.events.some((e) => e.text.includes("Earth reaches Low Mastery"))).toBe(true);
  });

  test("caps rise as you climb: Low is the cap below Level 15", () => {
    const r = lines(Array(12).fill("practice branch=Earth amount=breakthrough").join("\n"));
    expect(r.state.sheet.branches[0].tier).toBe(1);
    expect(r.state.sheet.branches[0].pct).toBe(100);
  });

  test("skills have their own tracks inside a Branch", () => {
    const r = lines(`skill branch=Earth name="Hand Switching"\npractice branch=Earth skill="Hand Switching" amount=intense`);
    expect(r.state.sheet.branches[0].skills[0]).toEqual({ name: "Hand Switching", tier: 0, pct: 10 });
  });
});

describe("levels, Thresholds and what they unlock", () => {
  // killXp(49, 1) = 142,100 → Level 16 with 7,100 XP into it.
  const bigKill = `form name="Pebble" form=puppet\nkill enemy="Seam beast" level=49 by=Pebble`;

  test("Gifts arrive at Level 15, one tether art per Threshold crossed", () => {
    const r = lines(bigKill, withSetup(), NO_NARROW);
    expect(r.state.sheet.level).toBe(16);
    expect(r.state.sheet.gifts.map((g) => g.name)).toEqual(["Affinity"]);
    expect(artSlots(r.state)).toBe(1);
    const learned = lines(`${bigKill}\nart "Vessel Riding"\nart "Unison"`, withSetup(), NO_NARROW);
    expect(learned.state.sheet.arts.vessel_riding).toBe("learned");
    expect(learned.last?.rejected[0].reason).toContain("no tether art to learn yet");
  });

  test("a start past Level 15 begins with its Gifts", () => {
    const r = run(chat([]), withSetup({ birthplace: "graveyard", pillar: "necromancy", branch: "Raised Flesh" }));
    expect(r.state.sheet.gifts.map((g) => g.name)).toEqual(["The Dead's Craft"]);
  });

  test("the Origin earns Branch slots; the narrator names the Branch", () => {
    const r = lines(`${bigKill}\nbranch pillar=elemental name="Glass"`, withSetup(), NO_NARROW);
    expect(r.state.sheet.branches.map((b) => b.name)).toEqual(["Earth", "Glass"]);
    expect(branchSlots(r.state)).toBe(0);
    const early = lines(`branch pillar=elemental name="Glass"`);
    expect(early.last?.rejected[0].reason).toContain("no Branch slot yet (one every 10 levels)");
  });

  test("the spread rolls new Branches at its rarity's pace, slowed by extra Pillars", () => {
    const p = withSetup({ run: "spread", rarity: "veryrare", extraPillars: ["beast"], pillar: "elemental", branch: "Earth" });
    const r = lines(bigKill, p, NO_NARROW);
    // Very rare: 6 levels per Branch, x1.5 for a second Pillar = 9. Fifteen level-ups → one rolled Branch.
    expect(r.state.sheet.branches.filter((b) => b.origin === "rolled").length).toBe(1);
    expect(r.last?.events.some((e) => e.kind === "branch_rolled")).toBe(true);
  });

  test("minded familiars climb the same Circles on their own kills", () => {
    const r = lines(`bind name="Ash" species="ash wolf"\nkill enemy="boar" level=12 by=Ash`, sandbox(1), NO_NARROW);
    const ash = r.state.roster[0];
    // killXp(12, 1) = 2,500 → Ash reaches Level 2 with 1,500 XP and 1 point to place.
    expect(ash.level).toBe(2);
    expect(ash.unspent).toBe(1);
  });
});

describe("Pillars", () => {
  test("stir, then open on the right floor with the heart or deed named", () => {
    const p = withSetup();
    expect(lines(`stir pillar=beast warmth=warm`, p).state.sheet.pillars.beast).toMatchObject({ status: "stirring", stir: "warm" });
    expect(lines(`open pillar=beast heart="untainted"`, p).last?.rejected[0].reason).toBe("Beast Taming opens on Floors 7–100, not Floor 1");
    expect(lines(`move floor=7\nopen pillar=beast`, p).last?.rejected[0].reason).toContain('say the heart or deed');
    const ok = lines(`move floor=7\nopen pillar=beast heart="untainted"`, p);
    expect(ok.state.sheet.pillars.beast.status).toBe("open");
    expect(ok.last?.events.find((e) => e.kind === "pillar")?.text).toContain("Crossover into Elemental Creation");
    expect(lines(`open pillar=genesis deed="x"`, p).last?.rejected[0].reason).toBe("Genesis waits beyond the Tower");
  });

  test("cross-Pillar Branches once two Pillars both reach Mid Mastery", () => {
    const p = sandbox(15, ["necromancy", "beast"]);
    // 4 breakthroughs reach Low; at Low each is worth half, so 8 more reach Mid.
    const mid = (b: string) => Array(12).fill(`practice branch="${b}" amount=breakthrough`).join("\n");
    const no = lines(`branch name="Bone Golems" cross=elemental,necromancy`, p);
    expect(no.last?.rejected[0].reason).toContain("at Mid Mastery");
    const yes = lines(`${mid("Earth")}\n${mid("Raised Flesh")}\nbranch name="Bone Golems" cross=elemental,necromancy`, p);
    expect(yes.state.sheet.branches.find((b) => b.name === "Bone Golems")?.cross).toEqual(["elemental", "necromancy"]);
  });
});

describe("Bond Feedback and Resonance", () => {
  test("a share of a minded familiar's attributes flows back, by Resonance; mindless ones give nothing", () => {
    const p = sandbox(15);
    p.events.push({ id: "fa", anchor: { msgId: "m0", swipe: 0 }, kind: "fam_alloc", data: { famId: "f1", points: { agi: 25 } }, ts: 9 });
    const r = lines(`bind name="Ash" species="ash wolf" level=20 strong=agi\nform name="Pebble" form=puppet\nresonance Ash up\nresonance Ash up`, p);
    const ash = r.state.roster[0];
    expect(ash.attrs!.agi).toBe(32); // 3 + 4 strong + 25 placed
    expect(ash.resonance).toBe("deep");
    const d = derive(r.state);
    expect(d.bonds.agi).toBe(6); // 20% of 32
    expect(d.attrs.agi).toBe(d.own.agi + 6);
  });

  test("no Bond Feedback below Level 15 or for the spread", () => {
    const r = lines(`bind name="Ash" species="ash wolf" strong=agi\nresonance Ash up`, sandbox(3));
    expect(derive(r.state).bonds.agi).toBe(0);
  });

  test("mindless familiars have no Resonance", () => {
    expect(lines(`form name="Pebble" form=puppet\nresonance Pebble up`).last?.rejected[0].reason).toContain("no mind");
  });
});

describe("evolution: ready, then you trigger it", () => {
  test("a beast is ready at its stage's level; evolving costs more tethers and takes a path", () => {
    const p = sandbox(15);
    const r = lines(`bind name="Ash" species="ash wolf" level=10`, p);
    expect(r.state.roster[0].ready?.options).toEqual(["bigger monstrous form", "humanoid shifter form"]);
    const e = lines(`bind name="Ash" species="ash wolf" level=10\nevolve Ash path=shifter`, p);
    expect(e.state.roster[0]).toMatchObject({ stage: "awakened", tether: 3, path: "humanoid shifter form", ready: null });
    expect(lines(`bind name="Ash" species="ash wolf"\nevolve Ash`, p).last?.rejected[0].reason).toBe("Ash isn't ready to change yet");
  });

  test("zombies grow by eating cores; mutations are their own", () => {
    const p = sandbox(15, ["necromancy"]);
    const r = lines(`raise name="Rot" kind=zombie species=rat\neat Rot cores=3\nevolve Rot path="mutation"\nmutate Rot "acid spit"`, p);
    expect(r.state.roster[0]).toMatchObject({ stage: "dull", mutations: ["acid spit"] });
  });

  test("elementals: Core Forging", () => {
    const r = lines(`form name="Pebble" form=puppet\nforge Pebble\nforge Pebble\nforge Pebble\nevolve Pebble`);
    expect(r.state.roster[0].stage).toBe("compressed");
  });
});

describe("kinds and tether arts", () => {
  test("vampires: Progenitor turned by you, Pure turned by your Progenitor", () => {
    const r = lines(`turn name="Mara" by=you\nturn name="Ines" by=Mara`, sandbox(15));
    expect(r.state.roster.map((f) => `${f.name}:${f.stage}:${f.tether}`)).toEqual(["Mara:Progenitor:3", "Ines:Pure:2"]);
  });

  test("Borrowed Traits need the Gift, Deep Resonance and a slot", () => {
    const p = sandbox(15);
    const base = `bind name="Ash" species="ash wolf"\nform name="Pebble" form=puppet`;
    expect(lines(`${base}\ntrait Ash "keen nose"`, withSetup()).last?.rejected.at(-1)?.reason).toContain("no bound familiar named");
    expect(lines(`${base}\ntrait Ash "keen nose"`, p).last?.rejected[0].reason).toBe("borrowing needs Deep Resonance (Ash is faint)");
    const deep = lines(`${base}\nresonance Ash up\nresonance Ash up\ntrait Ash "keen nose"\ntrait Ash "thick fur"`, p);
    expect(deep.state.sheet.borrowed.map((b) => b.trait)).toEqual(["keen nose"]);
    expect(deep.last?.rejected[0].reason).toContain("no free Borrowed Trait slot (one per Threshold: 1)");
  });

  test("Soul Menagerie and Gatecalling", () => {
    const p = withSetup();
    p.events.push({ id: "x", anchor: null, kind: "amend", data: { ops: [] }, ts: 2 });
    const r = lines(`form name="Pebble" form=puppet\nsoul Pebble`, p);
    expect(r.last?.rejected[0].reason).toContain("Soul Menagerie");
  });

  test("starting fresh: no setup, no state", () => {
    const r = run(chat([]), emptyPlayer());
    expect(r.state.started).toBe(false);
    void setupEvent;
  });
});
