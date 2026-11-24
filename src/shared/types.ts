// Core shapes for Familiar Ledger. The engine rebuilds GameState from scratch by
// replaying the change log, so these shapes are never migrated on disk: only the
// raw <ufm> blocks and the player's own events are stored.

export type AttrKey = "str" | "con" | "agi" | "dex" | "int" | "ctl";
export type Attrs = Record<AttrKey, number>;

/** 0 No, 1 Low, 2 Mid, 3 High, 4 Peak */
export type MasteryTier = 0 | 1 | 2 | 3 | 4;
export type Resonance = "none" | "faint" | "steady" | "deep" | "kindred" | "soulbound";
/** "soul" = carried in your soul (Soul Menagerie). */
export type FamState = "active" | "slumbering" | "soul" | "lost" | "released";
export type PillarStatus = "sealed" | "stirring" | "open";
export type RunType = "origin" | "spread" | "sandbox";
export type Stance = "hold" | "press" | "protect";

export type FamKind =
  | "elemental"
  | "beast"
  | "zombie"
  | "skeleton"
  | "spirit"
  | "vampire"
  | "thrall"
  | "demon"
  | "sworn"
  | "domain"
  | "construct"
  | "dragon"
  | "primordial"
  | "other";

export interface Wound {
  id: string;
  label: string;
  /** Hours of personal time left until healed; null = heals only when the story says so. */
  hoursLeft: number | null;
  severity: "light" | "serious" | "grave";
}

export interface Skill {
  name: string;
  tier: MasteryTier;
  pct: number;
}

export interface Branch {
  id: string;
  pillar: string;
  name: string;
  tier: MasteryTier;
  pct: number;
  skills: Skill[];
  origin: "set" | "birthplace" | "earned" | "rolled" | "cross" | "starting";
  cross?: [string, string];
  openedAtLevel: number;
}

export interface Item {
  name: string;
  qty: number;
  note?: string;
}

export interface Familiar {
  id: string;
  name: string;
  pillar: string;
  kind: FamKind;
  /** puppet, automated, construct, beast, shifter, zombie, skeleton, spirit, ... */
  form: string;
  element: string | null;
  material: string | null;
  species: string | null;
  people: string | null;
  size: string | null;
  state: FamState;
  tether: number;
  /** Mana paid when it was made. */
  manaCost: number;
  order: string | null;
  stance: Stance | null;
  minded: boolean;
  level: number;
  xp: number;
  attrs: Attrs | null;
  /** Which of your attributes it feeds through Bond Feedback. */
  feeds: AttrKey[];
  resonance: Resonance;
  /** Beasts: Soul Stage id. Zombies: core grade. Elementals: core. Vampires: rank. */
  stage: string | null;
  wounds: Wound[];
  kills: number;
  xpSent: number;
  /** Growth fuel by kind: mastery, cores, essence, bond, blood... */
  fuel: Record<string, number>;
  /** Set when fuel crosses a line; waits for you to trigger the change in the story. */
  ready: { label: string; options: string[] } | null;
  traits: string[];
  mutations: string[];
  echoes: string[];
  /** Where it slumbers (for the touch-range check on Wake). */
  place: string | null;
  floor: number;
  portrait: string | null;
  notes: string;
  /** Unspent attribute points for minded familiars. */
  unspent: number;
}

export interface Gift {
  pillar: string;
  name: string;
  desc: string;
}

export interface Sheet {
  name: string;
  className: string;
  run: RunType;
  rarity: string | null;
  people: string;
  birthplace: string;
  level: number;
  xp: number;
  hp: number;
  mana: number;
  /** Max Health / Mana gained from level-ups (10 / 5 x rate each). */
  hpBonus: number;
  manaBonus: number;
  /** Your own attributes (bonds are added on top, derived live). */
  attrs: Attrs;
  unspent: number;
  silver: number;
  items: Item[];
  wounds: Wound[];
  exhaustion: number;
  hunger: number;
  cold: number;
  pillars: Record<string, { status: PillarStatus; stir: "warm" | "cold" | null; openedAtLevel: number | null; first: boolean }>;
  branches: Branch[];
  /** Branch slots consumed beyond the starting set (Origin and spread). */
  branchesEarned: number;
  gifts: Gift[];
  borrowed: { familiarId: string; trait: string }[];
  arts: Record<string, "locked" | "learned">;
  hand: string | null;
  riding: boolean;
  narrow: { pct: number; spilled: number };
}

export interface Npc {
  id: string;
  name: string;
  faction: string | null;
  rank: string | null;
  voice: string | null;
  goal: string | null;
  wounds: string[];
  grudges: string[];
  notes: string[];
  floor: number | null;
  place: string | null;
  alive: boolean;
  lastSeenHours: number;
  /** Offscreen changes not yet shown in the story. */
  news: string[];
}

export interface Fact {
  id: string;
  text: string;
  about: string;
  holders: string[];
  weight: number;
}

export interface EnemyWindow {
  id: string;
  name: string;
  level: number;
  className: string | null;
  lineage: string | null;
  rarity: string | null;
  floor: number;
  notes: string | null;
}

export interface FloorClock {
  hours: number;
  weather: string | null;
}

export interface WorldState {
  floor: number;
  place: string;
  /** Personal elapsed hours (drives healing). */
  elapsed: number;
  clocks: Record<string, FloorClock>;
  npcs: Record<string, Npc>;
  facts: Fact[];
  enemies: Record<string, EnemyWindow>;
  lastEnemy: string | null;
  threads: { id: string; text: string; open: boolean }[];
}

export interface GameState {
  started: boolean;
  seed: string;
  sheet: Sheet;
  roster: Familiar[];
  world: WorldState;
  famSeq: number;
}

// ── Change log ─────────────────────────────────────────────────────────

export interface Op {
  verb: string;
  args: string[];
  kv: Record<string, string>;
  raw: string;
  line: number;
}

export interface MsgInfo {
  id: string;
  role: "user" | "assistant" | "system";
  swipe: number;
  index: number;
}

export interface ChatLog {
  version: 1;
  messages: MsgInfo[];
  /** msgId -> swipe -> raw <ufm> block bodies (in message order). */
  blocks: Record<string, Record<string, string[]>>;
}

export interface Anchor {
  msgId: string;
  swipe: number;
}

export type PlayerEventKind = "setup" | "alloc" | "fam_alloc" | "amend" | "evolve_choice";

export interface PlayerEvent {
  id: string;
  anchor: Anchor | null;
  kind: PlayerEventKind;
  data: any;
  ts: number;
}

export interface Order {
  id: string;
  kind: string;
  /** Human line added to your message. */
  line: string;
  /** Instruction for the narrator. */
  directive: string;
  /** The op the narrator is expected to confirm with. */
  expect: string;
  ts: number;
}

export interface Squad {
  id: string;
  name: string;
  members: string[];
}

export interface Suggestion {
  id: string;
  op: string;
  why: string;
  status: "open" | "accepted" | "dismissed";
}

export interface PlayerStore {
  version: 1;
  enabled: boolean;
  runHint: RunType | null;
  events: PlayerEvent[];
  pending: Order[];
  issued: Record<string, Order[]>;
  squads: Squad[];
  /** msgKey (msgId#swipe) -> second-model suggestions. */
  suggestions: Record<string, Suggestion[]>;
  /** NPC/faction offscreen updates produced by background passes, keyed by msgKey. */
  offscreen: Record<string, { npc: string; text: string }[]>;
  /** Voice sheets written the first time an NPC speaks (npc id -> note). */
  voices: Record<string, string>;
}

export interface Settings {
  narrowTether: boolean;
  rerolls: boolean;
  check: { enabled: boolean; mode: "quiet" | "decision"; connectionId: string | null };
  offscreen: { enabled: boolean; connectionId: string | null };
  cutaways: boolean;
  readUpTo: number | null;
  worldBookId: string | null;
  portraits: { connectionId: string | null; style: string };
  /** How many recent assistant messages keep their <ufm> block in the prompt. */
  historyTags: number;
  hud: boolean;
}

// ── Replay results ─────────────────────────────────────────────────────

export interface Rejection {
  line: string;
  reason: string;
}

export type GameEventKind =
  | "level"
  | "threshold"
  | "circle"
  | "art_unlock"
  | "branch_slot"
  | "branch_rolled"
  | "gift"
  | "ready"
  | "pillar"
  | "reveal"
  | "lost"
  | "healed"
  | "info";

export interface GameEvent {
  kind: GameEventKind;
  text: string;
  big?: boolean;
}

export interface MsgResult {
  key: string;
  msgId: string;
  swipe: number;
  applied: string[];
  notes: string[];
  rejected: Rejection[];
  events: GameEvent[];
}

export interface ReplayResult {
  state: GameState;
  results: MsgResult[];
  /** Results for the last assistant message only. */
  last: MsgResult | null;
}
