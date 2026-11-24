import { describe, expect, test } from "bun:test";
import { parseSuggestions } from "../src/backend/check";
import { derive } from "../src/engine/derive";
import { chat, run, withSetup } from "./helpers";

const one = (lines: string, p = withSetup()) => run(chat([{ role: "assistant", swipes: [[lines]] }]), p);

describe("rule checks", () => {
  test("an Automated Golem needs Low Mastery", () => {
    const r = one(`form name="Shale" form=automated element=earth`);
    expect(r.state.roster.length).toBe(0);
    expect(r.last?.rejected[0].reason).toBe("Automated Golem needs Low Mastery in Earth (you have No Mastery)");
  });

  test("Elements are Branches: no Fire Branch, no fire golem", () => {
    const r = one(`form name="Ember" form=puppet element=fire`);
    expect(r.last?.rejected[0].reason).toContain("Fire Branch isn't open");
  });

  test("a sealed Pillar can't make familiars (and stays [???])", () => {
    const r = one(`bind name="Ash" species="ash wolf"`);
    expect(r.state.roster.length).toBe(0);
    expect(r.last?.rejected[0].reason).toBe("a sealed Pillar ([???]) isn't open");
  });

  test("floor gates: the kingdom floor forbids Necromancy", () => {
    const p = withSetup({ birthplace: "graveyard", pillar: "necromancy", branch: "Raised Flesh" });
    const ok = one(`raise name="Rot" kind=zombie species=rat`, p);
    expect(ok.state.roster.length).toBe(1);
    const blocked = one(`move floor=25 place="the kingdom"\nraise name="Rot" kind=zombie species=rat`, p);
    expect(blocked.state.roster.length).toBe(0);
    expect(blocked.last?.rejected[0].reason).toContain("Conquest Requirements forbid Necromancy");
  });

  test("touch range for waking a slumbering elemental", () => {
    const base = `form name="Pebble" form=puppet\nslumber Pebble\nmove place="the upper shaft"`;
    expect(one(`${base}\nwake Pebble`).last?.rejected[0].reason).toContain("waking needs your touch");
    expect(one(`${base}\nwake Pebble touch=yes`).state.roster[0].state).toBe("active");
    expect(one(`${base}\nmove place="${"A Floor 1 frontier mining town"}"\nwake Pebble`).state.roster[0].state).toBe("active");
    expect(one(`form name="Pebble" form=puppet\nslumber Pebble\nmove floor=2\nwake Pebble touch=yes`).last?.rejected[0].reason).toContain("slumbers on Floor 1");
  });

  test("slumbering frees the tether; waking needs one back", () => {
    const r = one(`form name="Pebble" form=puppet\nslumber Pebble`);
    expect(derive(r.state).tethersUsed).toBe(0);
  });

  test("control by kind: puppets are guided by hand, stances are for Mid constructs, only the dead feed", () => {
    const r = one(`form name="Pebble" form=puppet\norder Pebble dig "the trench"\nstance Pebble press\nhand Pebble`);
    expect(r.last?.rejected.map((x) => x.reason)).toEqual([
      "Pebble has no mind: a Puppet Golem moves only while you guide it by hand",
      "only Mid Mastery constructs take a stance (Pebble is Puppet Golem)",
    ]);
    expect(r.state.sheet.hand).toBe(r.state.roster[0].id);
    const z = one(`raise name="Rot" kind=zombie species=rat\norder Rot feed "the warden's corpse"\norder Rot strike`, withSetup({ birthplace: "graveyard", pillar: "necromancy", branch: "Raised Flesh" }));
    expect(z.state.roster[0].order).toBe("feed the warden's corpse");
    expect(z.last?.rejected[0].reason).toBe("strike needs a named target");
  });

  test("Soul Stage tether costs: Nascent 1, Awakened 3, Spirit 5; beasts can't slumber", () => {
    const p = withSetup({ birthplace: "greattree", pillar: "beast", branch: "Pack Bond" });
    const r = one(`bind name="Ash" species="ash wolf" stage=awakened\nslumber Ash`, p);
    expect(r.state.roster[0].tether).toBe(3);
    expect(r.last?.rejected[0].reason).toContain("can't be put to slumber");
    const big = one(`bind name="Elder" species="elder elk" stage=spirit\nbind name="Ash" species="ash wolf"`, p);
    // Floor 7 start: Control 1 -> 5 tethers. Spirit (5) fits; nothing is left for a Nascent (1).
    expect(big.state.roster.map((f) => f.tether)).toEqual([5]);
    expect(big.last?.rejected[0].reason).toContain("needs 1 tether, 0 free of 5");
  });
});

describe("second-model suggestions", () => {
  test("parses a JSON array out of a chatty answer", () => {
    const raw = 'Sure. Here you go:\n```json\n[{"op":"lose \\"Puppet 2\\"","why":"it shattered"},{"op":"","why":"x"}]\n```';
    expect(parseSuggestions(raw)).toEqual([{ op: 'lose "Puppet 2"', why: "it shattered" }]);
    expect(parseSuggestions("nothing missing")).toEqual([]);
  });
});
