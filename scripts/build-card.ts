// Writes card/ufm-narrator.json from src/shared/card.ts.
import { buildCard } from "../src/shared/card";

const out = JSON.stringify(buildCard(), null, 2) + "\n";
await Bun.write(new URL("../card/ufm-narrator.json", import.meta.url), out);
console.log("wrote card/ufm-narrator.json");
