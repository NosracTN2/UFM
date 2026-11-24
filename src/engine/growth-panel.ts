// Panel orders for growth: trigger an evolution, carry in soul, Gatecall, ride.

import "./growth";
import { ActionError, famById, makeOrder, quote, setGrowthOrder } from "./panel";
import { readiness } from "./growth";

setGrowthOrder((state, _settings, a, check) => {
  if (a.kind === "evolve") {
    const f = famById(state, a.famId);
    const ready = readiness(state, f);
    if (!ready) throw new ActionError(`${f.name} isn't ready to change yet.`);
    if (ready.options.length && !a.path) throw new ActionError(`Choose: ${ready.options.join(" or ")}.`);
    const expect = `evolve ${quote(f.name)}${a.path ? ` path=${quote(a.path)}` : ""}`;
    check([expect]);
    return makeOrder(
      "evolve",
      `» ${f.name}: evolve${a.path ? ` (${a.path})` : ""}.`,
      `{{user}} triggers ${f.name}'s change: ${ready.label}${a.path ? `, taking the ${a.path}` : ""}. Narrate it as a scene, an event in the story, not a menu click.`,
      expect,
    );
  }
  const f = famById(state, (a as { famId: string }).famId);
  const n = quote(f.name);
  if (a.kind === "soul") {
    check([`soul ${n}`]);
    return makeOrder("soul", `» ${f.name}: into my soul.`, `{{user}} draws ${f.name} into their soul (Soul Menagerie); it travels with them, safe, still bound.`, `soul ${n}`);
  }
  if (a.kind === "call") {
    check([`call ${n}`]);
    return makeOrder("call", `» Call ${f.name}.`, `{{user}} calls ${f.name} to them${f.state === "soul" ? " out of their soul" : " from afar (Gatecalling)"}.`, `call ${n}`);
  }
  if (a.kind === "ride") {
    check([`ride ${n}`]);
    return makeOrder("ride", `» Ride ${f.name}.`, `{{user}} rides ${f.name} (Vessel Riding): their typed actions are ${f.name}'s actions; narrate through its senses.`, `ride ${n}`);
  }
  throw new ActionError("Not available.");
});
