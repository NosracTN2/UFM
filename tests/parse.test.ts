import { describe, expect, test } from "bun:test";
import { extractBlocks, parseBlock, parseDuration, parseLine, stripBlocks } from "../src/engine/parse";

describe("<ufm> parsing", () => {
  test("the design doc's example block", () => {
    const msg = `The stone answers.\n\n<ufm>
spend mana 15
form name="Shale" pillar=elemental element=earth form=automated
order Shale guard "the cave mouth"
kill enemy="Staff warden" level=17 by=Shale
lose "Puppet 2"
wound you "cracked rib" heal=10d
learn who="The Staff" fact="raises golems from stone"
time +1 day
</ufm>`;
    const blocks = extractBlocks(msg);
    expect(blocks.length).toBe(1);
    const ops = parseBlock(blocks[0]);
    expect(ops.map((o) => o.verb)).toEqual(["spend", "form", "order", "kill", "lose", "wound", "learn", "time"]);
    expect(ops[1].kv).toEqual({ name: "Shale", pillar: "elemental", element: "earth", form: "automated" });
    expect(ops[2].args).toEqual(["Shale", "guard", "the cave mouth"]);
    expect(ops[3].kv).toEqual({ enemy: "Staff warden", level: "17", by: "Shale" });
    expect(ops[5].args).toEqual(["you", "cracked rib"]);
    expect(ops[5].kv.heal).toBe("10d");
    expect(ops[7].args).toEqual(["+1", "day"]);
    expect(stripBlocks(msg)).toBe("The stone answers.");
  });

  test("forgiving: bullets, smart quotes, comments, blank lines", () => {
    const ops = parseBlock(`\n- order “Shale” dig “the trench”\n# a comment\n\n  * spend mana 5  `);
    expect(ops.length).toBe(2);
    expect(ops[0].args).toEqual(["Shale", "dig", "the trench"]);
    expect(ops[1].args).toEqual(["mana", "5"]);
  });

  test("apostrophes inside words survive", () => {
    const op = parseLine(`learn who="Mara" fact="the miner's son raises stone"`)!;
    expect(op.kv.fact).toBe("the miner's son raises stone");
    const op2 = parseLine(`order Shale guard the warden's door`)!;
    expect(op2.args).toEqual(["Shale", "guard", "the", "warden's", "door"]);
  });

  test("durations", () => {
    expect(parseDuration("10d")).toBe(240);
    expect(parseDuration("+1 day")).toBe(24);
    expect(parseDuration("6h")).toBe(6);
    expect(parseDuration("2 weeks")).toBe(336);
    expect(parseDuration("soon")).toBe(null);
  });
});
