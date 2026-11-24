// The <ufm> tag format, taught to the narrator. One source for the card, prompts and README.

export const TAG_OPS: { group: string; lines: string[] }[] = [
  {
    group: "Resources",
    lines: [
      "spend mana 8            (spells and skills; form/bind/raise lines charge their own cost)",
      "spend silver 5 | gain silver 20 | gain item \"rope\" qty=1 | drop item \"rope\"",
      "restore mana 10 | restore hp all | rest 8h",
    ],
  },
  {
    group: "Familiars",
    lines: [
      'form name="Shale" pillar=elemental element=earth form=puppet|automated|construct material="granite"',
      'bind name="Ash" species="ash wolf" stage=nascent strong=agi      (beasts: the soul must answer)',
      'raise name="Rot" kind=zombie|skeleton|spirit species="rat"',
      'make name="..." pillar=<pillar>                                  (any other Pillar\'s familiar)',
      'order Shale guard "the cave mouth"     (dig, carry, guard, follow, strike, scout, fetch, feed, hold, free)',
      "stance Shale press                     (hold, press, protect: Mid Mastery constructs)",
      'hand "Puppet 1" | hand none            (take hand: the player steers it directly)',
      'slumber Shale | wake Shale touch=yes | release Shale | lose "Puppet 2" reason="shattered"',
      'rename "Puppet 1" "Pebble"',
    ],
  },
  {
    group: "Fights and the body",
    lines: [
      'kill enemy="Staff warden" level=17 by=Shale     (by=you pays no XP; only bound familiars do)',
      'hurt you 12 | wound you "cracked rib" heal=10d | wound Shale "cracked arm" heal=3d | heal you "cracked rib"',
      "body exhaustion=+1 hunger=2 cold=0",
    ],
  },
  {
    group: "Growth",
    lines: [
      'practice branch="Earth" amount=light|solid|intense|breakthrough   (skill="Golem Forming" for a skill)',
      'skill branch="Earth" name="Stone Skin"           (a new skill inside a Branch)',
      'branch pillar=elemental name="Glass"              (a new Branch the player earned; the extension checks slots)',
      "stir pillar=beast warmth=warm | open pillar=beast heart=\"untainted\"",
      'resonance Ash up | evolve Ash path=shifter | art "Vessel Riding" | gift pillar=necromancy name="..." desc="..."',
      'trait Ash "keen nose"  (Borrowed Trait) | eat Rot cores=1 | forge Shale | essence Bones amount=solid',
      'mutate Rot "acid spit" | echo Wisp "Last skill" | turn name="Mara" by=you',
      'ride Ash | soul Ash | call Ash (Gatecalling) | feed Rot target="the warden\'s corpse"',
    ],
  },
  {
    group: "World",
    lines: [
      'learn who="The Staff" fact="raises golems from stone" via=told|overheard|seen',
      'see enemy="Staff warden" level=17 class="Warden" lineage="Human" rarity=Common',
      'npc name="Halvard" faction="The Staff" voice="clipped, dry" goal="find the golem-maker" | npc Halvard wound="lost an eye"',
      'time +1 day | time +6h | move floor=2 place="the gate town" | weather "cold rain"',
      'thread "Registry deadline" | thread close "Registry deadline"',
    ],
  },
];

export function tagReference(): string {
  return TAG_OPS.map((g) => `${g.group}:\n${g.lines.map((l) => `  ${l}`).join("\n")}`).join("\n");
}
