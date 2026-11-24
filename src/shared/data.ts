// Game data. Values from docs/DESIGN.md are bible; anything marked gameOnly is the
// labelled game-rules layer, which the novel overrules whenever it shows the real thing.

import type { AttrKey, Attrs, FamKind, MasteryTier, Resonance, Stance } from "./types";

export const ATTR_KEYS: AttrKey[] = ["str", "con", "agi", "dex", "int", "ctl"];
export const ATTR_NAMES: Record<AttrKey, string> = {
  str: "Strength",
  con: "Constitution",
  agi: "Agility",
  dex: "Dexterity",
  int: "Intelligence",
  ctl: "Control",
};
export const ATTR_SHORT: Record<AttrKey, string> = { str: "Str", con: "Con", agi: "Agi", dex: "Dex", int: "Int", ctl: "Control" };

/** gameOnly: a Level 1 Awakened's attributes. */
export const BASE_ATTRS: Attrs = { str: 5, con: 5, agi: 5, dex: 5, int: 5, ctl: 1 };
/** gameOnly: Health = 50 + Con x 10 + level bonuses. Mana = 10 + Int x 5 + level bonuses. */
export const HP_BASE = 50;
export const MANA_BASE = 10;
/** Bible: Constitution +10 Health, Intelligence +5 Mana, Control 5 Soul Tethers. */
export const HP_PER_CON = 10;
export const MANA_PER_INT = 5;
export const TETHERS_PER_CTL = 5;

export const MASTERY_NAMES = ["No", "Low", "Mid", "High", "Peak"] as const;
export function masteryName(t: number): string {
  return `${MASTERY_NAMES[Math.max(0, Math.min(4, t))]} Mastery`;
}
export function parseMastery(s: string | undefined): MasteryTier | null {
  if (!s) return null;
  const i = MASTERY_NAMES.findIndex((n) => n.toLowerCase() === s.toLowerCase().replace(/ ?mastery$/, ""));
  return i >= 0 ? (i as MasteryTier) : null;
}

/** gameOnly: mastery caps rise as you climb. */
export function masteryCap(level: number): MasteryTier {
  if (level < 15) return 1;
  if (level < 50) return 2;
  if (level < 100) return 3;
  return 4;
}

/** gameOnly: practice adds mastery %; higher tiers move slower. */
export const PRACTICE_PCT: Record<string, number> = { light: 2, solid: 5, intense: 10, breakthrough: 25 };

export const RESONANCE_ORDER: Resonance[] = ["none", "faint", "steady", "deep", "kindred", "soulbound"];
/** Bible: Bond Feedback share by Resonance. */
export const RESONANCE_SHARE: Record<Resonance, number> = {
  none: 0,
  faint: 0.05,
  steady: 0.1,
  deep: 0.2,
  kindred: 0.35,
  soulbound: 0.5,
};

export interface SoulStageDef {
  id: string;
  name: string;
  tether: number;
  gameOnly: boolean;
  /** gameOnly: familiar level needed before evolution can be triggered. */
  readyAt: number;
}
/** Bible: Nascent 1, Awakened 3, Spirit 5; higher stages are [???] in the bible. */
export const SOUL_STAGES: SoulStageDef[] = [
  { id: "nascent", name: "Nascent", tether: 1, gameOnly: false, readyAt: 0 },
  { id: "awakened", name: "Awakened", tether: 3, gameOnly: false, readyAt: 10 },
  { id: "spirit", name: "Spirit", tether: 5, gameOnly: false, readyAt: 25 },
  { id: "sovereign", name: "Sovereign", tether: 8, gameOnly: true, readyAt: 50 },
  { id: "primordial", name: "Primordial", tether: 12, gameOnly: true, readyAt: 100 },
];
export function soulStage(id: string | null | undefined): SoulStageDef | undefined {
  if (!id) return undefined;
  return SOUL_STAGES.find((s) => s.id === id.toLowerCase());
}

/** gameOnly: zombie core grades, grown by eating other zombies' cores. */
export const ZOMBIE_GRADES = [
  { id: "cracked", name: "Cracked core", cores: 0 },
  { id: "dull", name: "Dull core", cores: 3 },
  { id: "clear", name: "Clear core", cores: 8 },
  { id: "bright", name: "Bright core", cores: 15 },
  { id: "living", name: "Living core (life, memories and old abilities return)", cores: 30 },
];
/** gameOnly: refined bone and soul essence for skeletons and spirits. */
export const ESSENCE_GRADES = [
  { id: "raw", name: "Raw", essence: 0 },
  { id: "refined", name: "Refined", essence: 5 },
  { id: "greater", name: "Greater (commands lesser dead)", essence: 15 },
];
/** Bible: vampire ranks, stronger the closer they stand to you. */
export const VAMPIRE_RANKS = ["Progenitor", "Pure", "Royal", "Noble", "Common Blood", "Thrall"];
/** gameOnly: elemental core path. */
export const ELEMENTAL_CORES = [
  { id: "plain", name: "Plain core", forged: 0 },
  { id: "compressed", name: "Compressed core", forged: 3 },
  { id: "mineral", name: "Rare-mineral core", forged: 6 },
  { id: "true", name: "True elemental (commands its element)", forged: 10 },
];

export type Control = "hand" | "order" | "stance" | "ask" | "undead";

export interface FormDef {
  id: string;
  label: string;
  pillar: string | null;
  kind: FamKind;
  mana: number;
  tether: number;
  minTier: MasteryTier;
  minded: boolean;
  control: Control;
  size: string | null;
  gameOnly: boolean;
  note: string;
}

export const FORMS: Record<string, FormDef> = {
  puppet: { id: "puppet", label: "Puppet Golem", pillar: "elemental", kind: "elemental", mana: 5, tether: 1, minTier: 0, minded: false, control: "hand", size: "up to 2.5 ft", gameOnly: false, note: "Guided by hand" },
  automated: { id: "automated", label: "Automated Golem", pillar: "elemental", kind: "elemental", mana: 15, tether: 1, minTier: 1, minded: false, control: "order", size: "up to 6 ft", gameOnly: false, note: "Simple orders; Low Mastery" },
  construct: { id: "construct", label: "Mid Mastery construct", pillar: "elemental", kind: "elemental", mana: 30, tether: 1, minTier: 2, minded: false, control: "stance", size: "up to 9 ft", gameOnly: true, note: "Makes its own tactical calls" },
  beast: { id: "beast", label: "Bound beast", pillar: "beast", kind: "beast", mana: 0, tether: 1, minTier: 0, minded: true, control: "ask", size: null, gameOnly: false, note: "It costs will; its soul has to answer" },
  zombie: { id: "zombie", label: "Zombie", pillar: "necromancy", kind: "zombie", mana: 10, tether: 1, minTier: 0, minded: false, control: "undead", size: null, gameOnly: true, note: "Obedient, hungry, grows by what it devours" },
  skeleton: { id: "skeleton", label: "Skeleton", pillar: "necromancy", kind: "skeleton", mana: 10, tether: 1, minTier: 0, minded: false, control: "undead", size: null, gameOnly: true, note: "Refined bone" },
  spirit: { id: "spirit", label: "Spirit", pillar: "necromancy", kind: "spirit", mana: 15, tether: 1, minTier: 1, minded: true, control: "undead", size: null, gameOnly: true, note: "Keeps Echoes" },
  thrall: { id: "thrall", label: "Mind-thrall", pillar: "mind", kind: "thrall", mana: 10, tether: 1, minTier: 0, minded: true, control: "order", size: null, gameOnly: true, note: "Set in full when Mind Dominion opens" },
  vampire: { id: "vampire", label: "Vampire", pillar: "blood", kind: "vampire", mana: 0, tether: 3, minTier: 0, minded: true, control: "order", size: null, gameOnly: true, note: "Turned by your blood" },
  demon: { id: "demon", label: "Demon", pillar: "infernal", kind: "demon", mana: 20, tether: 2, minTier: 0, minded: true, control: "order", size: null, gameOnly: true, note: "Bound by circle and terms" },
  sworn: { id: "sworn", label: "Sworn vassal", pillar: "oath", kind: "sworn", mana: 0, tether: 1, minTier: 0, minded: true, control: "ask", size: null, gameOnly: true, note: "A willing person sworn to you" },
  domain: { id: "domain", label: "Bound place", pillar: "domain", kind: "domain", mana: 0, tether: 3, minTier: 0, minded: false, control: "order", size: null, gameOnly: true, note: "A place bound as one familiar" },
  rune: { id: "rune", label: "Rune construct", pillar: "rune", kind: "construct", mana: 25, tether: 1, minTier: 1, minded: false, control: "order", size: null, gameOnly: true, note: "Rune-cored" },
  dragon: { id: "dragon", label: "Wyrm", pillar: "wyrm", kind: "dragon", mana: 0, tether: 5, minTier: 0, minded: true, control: "ask", size: null, gameOnly: true, note: "A pact, not a leash" },
  primordial: { id: "primordial", label: "Primordial", pillar: "primordial", kind: "primordial", mana: 0, tether: 8, minTier: 0, minded: true, control: "ask", size: null, gameOnly: true, note: "One of the Tower's first things" },
  familiar: { id: "familiar", label: "Familiar", pillar: null, kind: "other", mana: 10, tether: 1, minTier: 0, minded: false, control: "order", size: null, gameOnly: true, note: "Base form of this Pillar" },
};

export function formDef(id: string | undefined): FormDef | undefined {
  if (!id) return undefined;
  const k = id.toLowerCase().replace(/[^a-z]/g, "");
  if (FORMS[k]) return FORMS[k];
  if (k.startsWith("puppet")) return FORMS.puppet;
  if (k.startsWith("auto")) return FORMS.automated;
  if (k === "shifter" || k === "monster" || k === "monstrous") return FORMS.beast;
  return undefined;
}

export interface PillarDef {
  id: string;
  num: number;
  name: string;
  kind: FamKind;
  familiars: string;
  /** Floors where it can open inside the Tower; null = beyond the Tower ([???] in play). */
  floors: [number, number] | null;
  heart: string | null;
  branches: string[];
  starter: string;
  baseForm: string;
  gift: { name: string; desc: string } | null;
  className: string;
  gameOnly: boolean;
}

const P = (p: PillarDef) => p;

/** The 50 Ability Pillars. 1–12 can open inside the Tower; 13–49 wait beyond it; 50 is the capstone. */
export const PILLARS: PillarDef[] = [
  P({ id: "elemental", num: 1, name: "Elemental Creation", kind: "elemental", familiars: "Elementals and golems", floors: [1, 100], heart: null, branches: ["Earth", "Water", "Fire", "Air"], starter: "a Puppet Golem of your Element, up to 2.5 ft, guided by hand", baseForm: "puppet", gift: { name: "Affinity", desc: "A feel for and resistance to each Element you command" }, className: "Golemancer", gameOnly: false }),
  P({ id: "beast", num: 2, name: "Beast Taming", kind: "beast", familiars: "Beasts", floors: [7, 100], heart: "an untainted heart", branches: ["Guided Evolution", "Lineage", "Pack Bond"], starter: "a small beast whose soul answers yours (Nascent)", baseForm: "beast", gift: { name: "Borrowed Traits", desc: "Carry one tamed beast's trait at reduced strength; needs Deep Resonance; one slot per Threshold" }, className: "Beast Tamer", gameOnly: false }),
  P({ id: "necromancy", num: 3, name: "Necromancy", kind: "zombie", familiars: "The dead", floors: [10, 100], heart: "a hardened heart", branches: ["Raised Flesh", "Bone Refining", "Soul Essence"], starter: "a raised rat or crow, small and hungry", baseForm: "zombie", gift: { name: "The Dead's Craft", desc: "Hold a raised dead's skill or memory while it stands" }, className: "Necromancer", gameOnly: false }),
  P({ id: "mind", num: 4, name: "Mind Dominion", kind: "thrall", familiars: "Mind-thralls", floors: [21, 39], heart: null, branches: ["Thrall Binding", "Parasite Worms", "Flayer Lineage"], starter: "a parasite worm the size of a thread", baseForm: "thrall", gift: null, className: "Mind Lord", gameOnly: false }),
  P({ id: "blood", num: 5, name: "Blood Bonding", kind: "vampire", familiars: "Vampires", floors: [21, 39], heart: null, branches: ["Turning", "Chain of Command", "Bloodline"], starter: "a bat-sized blood-thing that drinks from your hand", baseForm: "vampire", gift: null, className: "Blood Sire", gameOnly: false }),
  P({ id: "infernal", num: 6, name: "Infernal Summoning", kind: "demon", familiars: "Demons", floors: [21, 39], heart: null, branches: ["Circles", "Pact Terms", "Hellfire"], starter: "an imp no bigger than a cat, bound by a chalk circle", baseForm: "demon", gift: null, className: "Summoner", gameOnly: false }),
  P({ id: "oath", num: 7, name: "Oathbinding", kind: "sworn", familiars: "Willing peoples sworn to you", floors: [25, 25], heart: null, branches: ["Sworn Vassals", "Oath Terms", "Banner"], starter: "one person who swears to you of their own will", baseForm: "sworn", gift: null, className: "Oathkeeper", gameOnly: false }),
  P({ id: "domain", num: 8, name: "Living Domain", kind: "domain", familiars: "Places bound as one familiar", floors: [40, 100], heart: null, branches: ["Room Binding", "Halls", "Domain Will"], starter: "a single room that knows you", baseForm: "domain", gift: null, className: "Domain Lord", gameOnly: false }),
  P({ id: "spirit", num: 9, name: "Spirit Calling", kind: "spirit", familiars: "Nature and ancestor spirits", floors: [41, 100], heart: null, branches: ["Nature Spirits", "Ancestor Spirits", "Offerings"], starter: "a wisp of a stream spirit", baseForm: "spirit", gift: null, className: "Spirit Caller", gameOnly: false }),
  P({ id: "rune", num: 10, name: "Rune Artifice", kind: "construct", familiars: "Rune-cored constructs", floors: [41, 100], heart: null, branches: ["Rune Cores", "Inscription", "Frames"], starter: "a palm-sized rune construct that hops", baseForm: "rune", gift: null, className: "Runewright", gameOnly: false }),
  P({ id: "wyrm", num: 11, name: "Wyrm Pact", kind: "dragon", familiars: "Dragons", floors: [41, 100], heart: null, branches: ["Wyrm Bond", "Hoard Right", "Draconic Tongue"], starter: "a hatchling wyrm the length of your forearm", baseForm: "dragon", gift: null, className: "Wyrm Rider", gameOnly: false }),
  P({ id: "primordial", num: 12, name: "Primordial Calling", kind: "primordial", familiars: "The Tower's primordials", floors: [95, 100], heart: null, branches: ["First Names", "Old Calling"], starter: "a mote of something older than the floor", baseForm: "primordial", gift: null, className: "Primordial Caller", gameOnly: false }),
  // ── Beyond the Tower ([???] in play unless you start with one) ──
  P({ id: "spellbinding", num: 13, name: "Spellbinding", kind: "construct", familiars: "Spells given a body", floors: null, heart: null, branches: ["Bound Spells", "Glyph Shells"], starter: "a single bound spark that orbits your hand", baseForm: "familiar", gift: null, className: "Spellbinder", gameOnly: true }),
  P({ id: "verdant", num: 14, name: "Verdant Shaping", kind: "other", familiars: "Plant beings", floors: null, heart: null, branches: ["Rootwork", "Bloom", "Thorn"], starter: "a sapling that walks on its roots", baseForm: "familiar", gift: null, className: "Verdant Shaper", gameOnly: true }),
  P({ id: "discipleship", num: 15, name: "Discipleship", kind: "sworn", familiars: "Students who become bonded", floors: null, heart: null, branches: ["Teaching", "Lineage of Students"], starter: "one student who chooses you as teacher", baseForm: "sworn", gift: null, className: "Master", gameOnly: true }),
  P({ id: "lycanthropy", num: 16, name: "Lycanthropy", kind: "beast", familiars: "Shifters and wolf-kin", floors: null, heart: null, branches: ["Moon Pack", "Turning Bite"], starter: "a wolf-pup that shifts when you do", baseForm: "beast", gift: null, className: "Packlord", gameOnly: true }),
  P({ id: "mycelial", num: 17, name: "Mycelial Binding", kind: "other", familiars: "Fungal networks and spore-things", floors: null, heart: null, branches: ["Spore", "Network"], starter: "a fist of mycelium that feels the dark", baseForm: "familiar", gift: null, className: "Mycelian", gameOnly: true }),
  P({ id: "shadow", num: 18, name: "Shadow Shaping", kind: "spirit", familiars: "Shadows given will", floors: null, heart: null, branches: ["Shade", "Umbral Step"], starter: "your own shadow, a beat late", baseForm: "familiar", gift: null, className: "Shadow Shaper", gameOnly: true }),
  P({ id: "dungeon", num: 19, name: "Dungeon Mastery", kind: "domain", familiars: "Dungeons and their spawn", floors: null, heart: null, branches: ["Corridors", "Spawn", "Traps"], starter: "a crawlspace that breathes when you do", baseForm: "domain", gift: null, className: "Dungeon Master", gameOnly: true }),
  P({ id: "rift", num: 20, name: "Rift Calling", kind: "other", familiars: "Things from the rifts", floors: null, heart: null, branches: ["Tears", "Riftborn"], starter: "a hand-sized rift that something peeks out of", baseForm: "familiar", gift: null, className: "Riftcaller", gameOnly: true }),
  P({ id: "brood", num: 21, name: "Brood Mothering", kind: "beast", familiars: "Broods and swarms", floors: null, heart: null, branches: ["Clutch", "Swarm", "Hive Mind"], starter: "a single larva that knows your scent", baseForm: "beast", gift: null, className: "Brood Mother", gameOnly: true }),
  P({ id: "hexcraft", num: 22, name: "Hexcraft", kind: "spirit", familiars: "Hexed familiars and curses with a body", floors: null, heart: null, branches: ["Curse", "Fetish"], starter: "a black cat that carries your small curses", baseForm: "familiar", gift: null, className: "Hexer", gameOnly: true }),
  P({ id: "deep", num: 23, name: "Deep Calling", kind: "beast", familiars: "Drowned things of the deep", floors: null, heart: null, branches: ["Tide", "Drowned", "Abyss"], starter: "a minnow-sized drowned thing, not a leviathan", baseForm: "beast", gift: null, className: "Deep Caller", gameOnly: true }),
  P({ id: "usurping", num: 24, name: "Usurping Bond", kind: "other", familiars: "Other people's familiars, taken", floors: null, heart: null, branches: ["Theft", "Severing"], starter: "a merchant's exotic pet, stolen", baseForm: "familiar", gift: null, className: "Usurper", gameOnly: true }),
  P({ id: "world", num: 25, name: "World Binding", kind: "domain", familiars: "Floors and worlds themselves", floors: null, heart: null, branches: ["Pulse", "Weather", "Ley"], starter: "the first pulse of your home floor (every floor is a planet of its own)", baseForm: "domain", gift: null, className: "World Binder", gameOnly: true }),
  P({ id: "tower", num: 26, name: "Tower Binding", kind: "domain", familiars: "The tower you were born in", floors: null, heart: null, branches: ["Stair", "Stone Voice", "Moving Halls"], starter: "a faint bond with your birth-tower: a stair that settles under your foot, a warning tremor through the stone, a new line on your window you can't read yet", baseForm: "domain", gift: null, className: "Tower-Bound", gameOnly: true }),
  P({ id: "genesis", num: 27, name: "Genesis", kind: "other", familiars: "New creatures of your making", floors: null, heart: null, branches: ["First Spark", "Design"], starter: "one tiny new creature, not a species", baseForm: "familiar", gift: null, className: "Genesist", gameOnly: true }),
  P({ id: "sovereign", num: 28, name: "Sovereign Binding", kind: "sworn", familiars: "Realms, laws, a court across worlds", floors: null, heart: null, branches: ["Court", "Law", "Realm"], starter: "a single herald who answers only to your word", baseForm: "sworn", gift: null, className: "Sovereign", gameOnly: true }),
  P({ id: "doll", num: 29, name: "Doll Binding", kind: "construct", familiars: "Dolls and marionettes that take a soul", floors: null, heart: null, branches: ["Strings", "Porcelain"], starter: "a rag doll that turns its head toward you", baseForm: "familiar", gift: null, className: "Dollmaker", gameOnly: true }),
  P({ id: "totem", num: 30, name: "Totem Carving", kind: "spirit", familiars: "Carved totems that wake", floors: null, heart: null, branches: ["Carving", "Animal Totems"], starter: "a thumb-sized carved owl that blinks", baseForm: "familiar", gift: null, className: "Totem Carver", gameOnly: true }),
  P({ id: "chimera", num: 31, name: "Chimera Grafting", kind: "beast", familiars: "Grafted hybrid beasts", floors: null, heart: null, branches: ["Graft", "Splice"], starter: "a mouse with a lizard's tail that you grafted yourself", baseForm: "beast", gift: null, className: "Grafter", gameOnly: true }),
  P({ id: "homunculus", num: 32, name: "Homunculus Brewing", kind: "construct", familiars: "Vat-born servants", floors: null, heart: null, branches: ["Vats", "Tinctures"], starter: "a homunculus the size of a thumb, in a jar", baseForm: "familiar", gift: null, className: "Alchemist", gameOnly: true }),
  P({ id: "arms", num: 33, name: "Arms Binding", kind: "construct", familiars: "Living weapons and armor", floors: null, heart: null, branches: ["Blade Soul", "Living Mail"], starter: "a knife that turns in your hand toward danger", baseForm: "familiar", gift: null, className: "Armsbinder", gameOnly: true }),
  P({ id: "mirror", num: 34, name: "Mirror Binding", kind: "spirit", familiars: "Reflections that step out of glass", floors: null, heart: null, branches: ["Reflection", "Glass Road"], starter: "your reflection, which waves first", baseForm: "familiar", gift: null, className: "Mirrorwright", gameOnly: true }),
  P({ id: "dream", num: 35, name: "Dream Weaving", kind: "spirit", familiars: "Creatures pulled from dreams", floors: null, heart: null, branches: ["Sleepwalk", "Nightmare"], starter: "a moth from last night's dream", baseForm: "familiar", gift: null, className: "Dreamweaver", gameOnly: true }),
  P({ id: "fae", num: 36, name: "Fae Bargaining", kind: "other", familiars: "Fae bound by bargain", floors: null, heart: null, branches: ["Bargain", "Glamour"], starter: "a sprite who owes you one small favour", baseForm: "familiar", gift: null, className: "Bargainer", gameOnly: true }),
  P({ id: "celestial", num: 37, name: "Celestial Pact", kind: "other", familiars: "Winged heralds of high places", floors: null, heart: null, branches: ["Herald", "Halo"], starter: "a sparrow of white light", baseForm: "familiar", gift: null, className: "Herald", gameOnly: true }),
  P({ id: "star", num: 38, name: "Star Binding", kind: "other", familiars: "Fallen star-motes", floors: null, heart: null, branches: ["Starfall", "Constellation"], starter: "a mote of starlight in a jar", baseForm: "familiar", gift: null, className: "Starbinder", gameOnly: true }),
  P({ id: "storm", num: 39, name: "Storm Herding", kind: "beast", familiars: "Cloud and lightning beasts", floors: null, heart: null, branches: ["Cloud", "Thunder"], starter: "a cloud-lamb that crackles when stroked", baseForm: "beast", gift: null, className: "Storm Herder", gameOnly: true }),
  P({ id: "lantern", num: 40, name: "Lantern Binding", kind: "spirit", familiars: "Wisps and lights", floors: null, heart: null, branches: ["Wisp", "Beacon"], starter: "a candle-wisp that follows your breath", baseForm: "familiar", gift: null, className: "Lanternkeeper", gameOnly: true }),
  P({ id: "crystal", num: 41, name: "Crystal Singing", kind: "construct", familiars: "Crystal beings grown by song", floors: null, heart: null, branches: ["Resonant Song", "Lattice"], starter: "a crystal sprout that hums back", baseForm: "familiar", gift: null, className: "Crystal Singer", gameOnly: true }),
  P({ id: "name", num: 42, name: "Name Binding", kind: "other", familiars: "Anything whose true name you learn", floors: null, heart: null, branches: ["True Names", "Unnaming"], starter: "a beetle whose true name you overheard", baseForm: "familiar", gift: null, className: "Namer", gameOnly: true }),
  P({ id: "ink", num: 43, name: "Ink Binding", kind: "construct", familiars: "Drawn creatures stepping off the page", floors: null, heart: null, branches: ["Sketch", "Illumination"], starter: "an ink-drawn fox that lives on paper", baseForm: "familiar", gift: null, className: "Inkbinder", gameOnly: true }),
  P({ id: "song", num: 44, name: "Song Calling", kind: "spirit", familiars: "Beings of sound", floors: null, heart: null, branches: ["Chorus", "Echo-Song"], starter: "a hum that keeps the tune you taught it", baseForm: "familiar", gift: null, className: "Songcaller", gameOnly: true }),
  P({ id: "stitch", num: 45, name: "Flesh Stitching", kind: "zombie", familiars: "Stitched flesh constructs", floors: null, heart: null, branches: ["Suture", "Graftwork"], starter: "a stitched hand that crawls", baseForm: "familiar", gift: null, className: "Stitcher", gameOnly: true }),
  P({ id: "hoard", num: 46, name: "Hoard Binding", kind: "construct", familiars: "Mimics and hoard-guardians", floors: null, heart: null, branches: ["Mimic", "Hoard"], starter: "a coin purse with teeth", baseForm: "familiar", gift: null, className: "Hoardkeeper", gameOnly: true }),
  P({ id: "plague", num: 47, name: "Plague Binding", kind: "other", familiars: "Living sicknesses", floors: null, heart: null, branches: ["Contagion", "Cure"], starter: "a fever that obeys you", baseForm: "familiar", gift: null, className: "Plaguebinder", gameOnly: true }),
  P({ id: "hour", num: 48, name: "Hour Binding", kind: "other", familiars: "Creatures of time", floors: null, heart: null, branches: ["Moment", "Echo of Hours"], starter: "a second that you can make wait", baseForm: "familiar", gift: null, className: "Hourbinder", gameOnly: true }),
  P({ id: "mask", num: 49, name: "Mask Binding", kind: "spirit", familiars: "Masks that hold borrowed faces", floors: null, heart: null, branches: ["Face", "Persona"], starter: "a wooden mask that remembers one face", baseForm: "familiar", gift: null, className: "Maskbinder", gameOnly: true }),
  P({ id: "ufm", num: 50, name: "Ultimate Familiar Mastery", kind: "other", familiars: "All of them", floors: null, heart: null, branches: [], starter: "", baseForm: "familiar", gift: null, className: "Ultimate Familiar Master", gameOnly: false }),
];

export const STARTER_POOL = PILLARS.filter((p) => p.id !== "ufm");

export function pillarDef(id: string | undefined | null): PillarDef | undefined {
  if (!id) return undefined;
  const k = id.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  return (
    PILLARS.find((p) => p.id === k) ??
    PILLARS.find((p) => p.name.toLowerCase() === k) ??
    PILLARS.find((p) => String(p.num) === k) ??
    PILLARS.find((p) => p.name.toLowerCase().startsWith(k)) ??
    PILLARS.find((p) => k.length >= 4 && p.name.toLowerCase().includes(k))
  );
}

/** gameOnly: the kingdom floor and its Conquest Requirements. */
export const KINGDOM_FLOOR = 25;
export const FLOOR_FORBIDS: Record<number, string[]> = {
  [KINGDOM_FLOOR]: ["mind", "blood", "necromancy"],
};

/** gameOnly: enemy level band of a floor; its Guardian sits at the top. */
export function floorBand(floor: number): { min: number; max: number } {
  const f = Math.max(1, floor);
  return { min: f, max: f + 3 + Math.floor(f / 8) };
}

export interface BirthplaceDef {
  id: string;
  name: string;
  people: string;
  human: boolean;
  floor: number;
  band: string;
  fits: string[];
  /** gameOnly: days before the Factions start hearing about you. */
  noticeDays: number;
  registryDays: number | null;
  floorGameOnly: boolean;
}

export const BIRTHPLACES: BirthplaceDef[] = [
  { id: "mining", name: "A Floor 1 frontier mining town", people: "Human", human: true, floor: 1, band: "Lowest", fits: ["elemental"], noticeDays: 20, registryDays: null, floorGameOnly: false },
  { id: "aethelgard", name: "Aethelgard, the white city", people: "Human, magi-tech raised", human: true, floor: 1, band: "Lowest", fits: ["rune", "spellbinding"], noticeDays: 30, registryDays: 30, floorGameOnly: false },
  { id: "greattree", name: "A great-tree people of a wild floor", people: "Non-human, long-lived", human: false, floor: 7, band: "Low", fits: ["beast", "verdant"], noticeDays: 40, registryDays: null, floorGameOnly: true },
  { id: "mountain", name: "A mountain house of teachers", people: "Non-human", human: false, floor: 5, band: "Low", fits: ["discipleship"], noticeDays: 40, registryDays: null, floorGameOnly: true },
  { id: "moonlit", name: "A moonlit floor of wolf-folk", people: "Non-human, wolf-folk", human: false, floor: 13, band: "Low–mid", fits: ["lycanthropy", "beast"], noticeDays: 35, registryDays: null, floorGameOnly: true },
  { id: "sunless", name: "A sunless cavern floor", people: "Non-human", human: false, floor: 15, band: "Low–mid", fits: ["mycelial", "shadow"], noticeDays: 45, registryDays: null, floorGameOnly: true },
  { id: "breathing", name: "A floor of caves that breathe", people: "Non-human", human: false, floor: 24, band: "Mid", fits: ["dungeon", "rift"], noticeDays: 30, registryDays: null, floorGameOnly: true },
  { id: "hive", name: "A hive-city of insect-folk", people: "Non-human, insect-folk", human: false, floor: 27, band: "Mid", fits: ["brood"], noticeDays: 25, registryDays: null, floorGameOnly: true },
  { id: "graveyard", name: "A graveyard-city floor", people: "Non-human", human: false, floor: 30, band: "Mid", fits: ["necromancy", "hexcraft"], noticeDays: 25, registryDays: null, floorGameOnly: true },
  { id: "drowned", name: "A sea floor of drowned ruins", people: "Non-human", human: false, floor: 33, band: "Mid", fits: ["deep"], noticeDays: 35, registryDays: null, floorGameOnly: true },
];

export function birthplaceDef(id: string | undefined | null): BirthplaceDef | undefined {
  if (!id) return undefined;
  return BIRTHPLACES.find((b) => b.id === id);
}

export const FACTIONS: { id: string; name: string; keys: string[] }[] = [
  { id: "mane", name: "The Mane", keys: ["mane"] },
  { id: "staff", name: "The Staff", keys: ["staff"] },
  { id: "witch", name: "The Witch", keys: ["witch"] },
  { id: "dagger", name: "The Dagger", keys: ["dagger"] },
  { id: "registry", name: "The Registry", keys: ["registry", "decree"] },
  { id: "founders", name: "The Founders", keys: ["founder"] },
];

export function factionOf(name: string | null | undefined): string | null {
  if (!name) return null;
  const k = name.toLowerCase();
  for (const f of FACTIONS) if (f.keys.some((key) => k.includes(key))) return f.id;
  return null;
}

export interface ArtDef {
  id: string;
  name: string;
  desc: string;
}
/** Bible: the tether arts. The bible leaves their order open: one new art per Threshold crossed. */
export const TETHER_ARTS: ArtDef[] = [
  { id: "tether_weaving", name: "Tether Weaving", desc: "Braid tethers to hold more with less strain" },
  { id: "soul_menagerie", name: "Soul Menagerie", desc: "Carry familiars in your soul (adds the 'carried in soul' state)" },
  { id: "vessel_riding", name: "Vessel Riding", desc: "Upgrades Take hand into fully riding a familiar" },
  { id: "unison", name: "Unison", desc: "Act as one with a familiar" },
  { id: "gatecalling", name: "Gatecalling", desc: "Summon a familiar to you from afar" },
  { id: "sovereigns_presence", name: "Sovereign's Presence", desc: "Your familiars stand firmer near you" },
  { id: "trait_sharing", name: "Trait Sharing", desc: "Share one familiar's trait with another" },
];
export function artDef(s: string | undefined): ArtDef | undefined {
  if (!s) return undefined;
  const k = s.toLowerCase().replace(/[^a-z]/g, "");
  return TETHER_ARTS.find((a) => a.id.replace(/_/g, "") === k || a.name.toLowerCase().replace(/[^a-z]/g, "") === k);
}

export interface RarityDef {
  id: string;
  name: string;
  /** gameOnly: levels per new Branch with one Pillar. */
  levelsPerBranch: number;
  maxPillars: number;
}
/** gameOnly: rarity is your strength budget. */
export const RARITIES: RarityDef[] = [
  { id: "common", name: "Common", levelsPerBranch: 12, maxPillars: 1 },
  { id: "uncommon", name: "Uncommon", levelsPerBranch: 10, maxPillars: 1 },
  { id: "rare", name: "Rare", levelsPerBranch: 8, maxPillars: 1 },
  { id: "veryrare", name: "Very rare", levelsPerBranch: 6, maxPillars: 2 },
  { id: "epic", name: "Epic", levelsPerBranch: 5, maxPillars: 2 },
  { id: "legendary", name: "Legendary", levelsPerBranch: 4, maxPillars: 3 },
  { id: "mythic", name: "Mythic", levelsPerBranch: 3, maxPillars: 3 },
];
export function rarityDef(id: string | null | undefined): RarityDef | undefined {
  if (!id) return undefined;
  const k = id.toLowerCase().replace(/[^a-z]/g, "");
  return RARITIES.find((r) => r.id === k || r.name.toLowerCase().replace(/[^a-z]/g, "") === k);
}

/** gameOnly: levels per Branch. The spread: rarity budget, slowed by each extra Pillar.
 *  The Origin sits outside the budget: faster with every Pillar opened. */
export function levelsPerBranch(run: string, rarity: string | null, pillarsHeld: number): number {
  if (run === "spread") {
    const r = rarityDef(rarity) ?? RARITIES[2];
    return r.levelsPerBranch * (1 + 0.5 * Math.max(0, pillarsHeld - 1));
  }
  return Math.max(2, Math.round(10 / Math.max(1, pillarsHeld)));
}

export const ORDER_VERBS = ["dig", "carry", "guard", "follow", "strike", "free", "hold", "scout", "feed", "fetch", "build", "wait"];
export const STANCES: Stance[] = ["hold", "press", "protect"];

/** gameOnly: hourly recovery while time passes. */
export const REGEN_MANA_PER_HOUR = 0.05;
export const REGEN_HP_PER_HOUR = 0.02;
