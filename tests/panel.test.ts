import { describe, expect, test } from "bun:test";
import { buildOrder, famChecks, formOptions, ActionError } from "../src/engine/panel";
import { DEFAULT_SETTINGS } from "../src/engine/replay";
import { buildCard } from "../src/shared/card";
import { chat, run, withSetup } from "./helpers";

const S = DEFAULT_SETTINGS;

describe("panel checks and orders", () => {
  test("form options cover the open Pillar and show costs", () => {
    const { state } = run(chat([]));
    const opts = formOptions(state, S);
    const puppet = opts.find((o) => o.form === "puppet")!;
    expect(puppet.mana).toBe(5);
    expect(puppet.tether).toBe(1);
    expect(puppet.ok).toBe(true);
    expect(opts.every((o) => o.pillar === "elemental")).toBe(true);
  });

  test("an unaffordable form is locked with the reason", () => {
    const r = run(chat([{ role: "assistant", swipes: [["spend mana 30"]] }]));
    const opts = formOptions(r.state, S);
    const auto = opts.find((o) => o.form === "automated")!;
    expect(auto.ok).toBe(false);
    expect(auto.reason).toContain("costs 15 Mana");
  });

  test("a form click becomes an order with the op the narrator must confirm", () => {
    const { state } = run(chat([]));
    const o = buildOrder(state, S, { kind: "form", pillar: "elemental", form: "puppet", name: "Pebble", element: "earth" });
    expect(o.line).toBe("» Form: Puppet Golem of earth named Pebble.");
    expect(o.expect).toBe('form name="Pebble" pillar=elemental form=puppet element=earth');
    expect(o.directive).toContain("5 Mana, 1 tether");
    expect(state.roster.length).toBe(0); // never changes state directly
  });

  test("illegal actions are refused before they're queued", () => {
    const r = run(chat([{ role: "assistant", swipes: [["spend mana 33"]] }]));
    expect(() => buildOrder(r.state, S, { kind: "form", pillar: "elemental", form: "puppet" })).toThrow(ActionError);
  });

  test("card actions: orders, hand, slumber, rename, squads", () => {
    const r = run(chat([{ role: "assistant", swipes: [[`form name="Pebble" form=puppet\nform name="Grit" form=puppet`]] }]));
    const st = r.state;
    const pebble = st.roster[0];
    // Puppets can't take orders (no mind); make them Automated Golems for the order checks.
    expect(() => buildOrder(st, S, { kind: "order", famId: pebble.id, verb: "guard", target: "x" })).toThrow("no mind");
    expect(buildOrder(st, S, { kind: "hand", famId: pebble.id }).expect).toBe('hand "Pebble"');
    for (const f of st.roster) f.form = "automated";
    expect(() => buildOrder(st, S, { kind: "hand", famId: pebble.id })).toThrow("only a Puppet Golem");
    expect(buildOrder(st, S, { kind: "order", famId: pebble.id, verb: "guard", target: "the cave mouth" }).expect).toBe('order "Pebble" guard "the cave mouth"');
    expect(buildOrder(st, S, { kind: "slumber", famId: pebble.id }).expect).toBe('slumber "Pebble"');
    expect(buildOrder(st, S, { kind: "rename", famId: pebble.id, name: "Stone" }).expect).toBe('rename "Pebble" "Stone"');
    const sq = buildOrder(st, S, { kind: "squad_order", famIds: st.roster.map((f) => f.id), squadName: "wall crew", verb: "dig", target: "the trench" });
    expect(sq.expect.split("\n")).toEqual(['order "Pebble" dig "the trench"', 'order "Grit" dig "the trench"']);
    const checks = famChecks(st, S);
    expect(checks[pebble.id].slumber).toBe(null);
    expect(checks[pebble.id].wake).toBe("not slumbering");
  });

  test("beast Pillars bind (no Mana, tethers by Soul Stage)", () => {
    const r = run(chat([]), withSetup({ birthplace: "greattree", pillar: "beast", branch: "Pack Bond" }));
    const opts = formOptions(r.state, S);
    const beast = opts.find((o) => o.form === "beast")!;
    expect(beast.mana).toBe(0);
    expect(beast.stages?.map((s) => s.tether).slice(0, 3)).toEqual([1, 3, 5]);
    const o = buildOrder(r.state, S, { kind: "form", pillar: "beast", form: "beast", name: "Ash", species: "ash wolf", stage: "nascent" });
    expect(o.expect).toBe('bind name="Ash" pillar=beast species="ash wolf" stage=nascent');
  });
});

describe("narrator card", () => {
  test("card/ufm-narrator.json is generated from src/shared/card.ts", async () => {
    const onDisk = await Bun.file(new URL("../card/ufm-narrator.json", import.meta.url)).json();
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(buildCard())));
  });

  test("one greeting per run type, each opening the setup window", () => {
    const d = buildCard().data;
    const greetings = [d.first_mes, ...d.alternate_greetings];
    expect(greetings.map((g) => /<ufm-setup run="(\w+)">/.exec(g)?.[1])).toEqual(["origin", "spread", "sandbox"]);
    expect(d.scenario).toBe("{{ufm_state}}");
    expect(d.system_prompt).toContain("<ufm>");
    expect(d.system_prompt.match(/Facet/g)?.length).toBe(1); // only in "never use the word"

    expect(d.post_history_instructions.split("\n").length).toBe(3);
  });
});
