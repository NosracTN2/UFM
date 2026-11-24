Ultimate Familiar Mastery — Playable Lumiverse Design
The goal
You play the Ultimate Familiar Master: the Origin class, all 50 Pillars sealed behind [???], Decree 00 waiting for you at the Registry. The AI narrates the Tower, and a Spindle extension holds every number and lets you command your familiars from a panel. Other starts (a derived-class Awakened, a sandbox) are there when you want a different run.
The ground rule: the extension owns the numbers, the AI owns the story. Code does the math on mana, tethers, XP and levels. The AI proposes what happened, the extension checks it against the rules, and only legal changes stick. A golem you can't afford doesn't appear, and a beast you never bound can't show up in a fight.
Two outputs come out of this:
• The card + world book: a narrator card ("the Tower") with alternate starts, plus a world book of canon lore and rules.
• The extension (working name: Familiar Ledger): the state engine, the familiar panel and the rule checks.
Spoiler rule. This doc uses only the rules from the bible you wrote and the core System math. Chapter events, people and places stay out. The game gets a Read up to: Ch. N setting so canon lore never gets ahead of where you are in the book.
Starting your run
You build your own Origin instead of copying Reese's start. Reese's start (a miner, Earth, a Heartstone) fit him; yours comes from where you were born and which bond the Tower wakes in you.
The whole start fits on one alternate greeting: the extension opens a setup modal, then hands the narrator your Awakening.
1 · Birthplace. Pick from a list, roll one, or describe your own and let the narrator build it. Your birthplace sets your floor, your people, your starting level (the bottom of that floor's level band, since natives grow up at their floor's strength), how soon the Factions notice you, and which 1–3 Pillars fit that place.
Birthplace (examples, game-only)
People
Level band
Fits
A Floor 1 frontier mining town
Human
Lowest
Elemental Creation
Aethelgard, the white city
Human, magi-tech raised
Lowest; 30-day Registry clock
Rune Artifice, Spellbinding
A great-tree people of a wild floor
Non-human, long-lived
Low
Beast Taming, Verdant Shaping
A mountain house of teachers
Non-human
Low
Discipleship
A moonlit floor of wolf-folk
Non-human
Low–mid
Lycanthropy, Beast Taming
A sunless cavern floor
Non-human
Low–mid
Mycelial Binding, Shadow Shaping
A floor of caves that breathe
Non-human
Mid
Dungeon Mastery, Rift Calling
A hive-city of insect-folk
Non-human
Mid
Brood Mothering
A graveyard-city floor
Non-human
Mid
Necromancy, Hexcraft
A sea floor of drowned ruins
Non-human
Mid
Deep Calling
Describe your own
yours
from the floor you pick
narrator suggests
2 · First bond. Three ways to choose, plus a preset:
• From your birthplace: pick one of the Pillars it suggests.
• Fully random: the extension rolls from the starter pool and the Awakening window reveals it. No rerolls unless you turn them on.
• Your pick: any Pillar in the pool.
• Reese's path sits in the list as a preset: mining town, Elemental Creation, Earth.
The starter pool is 49 Pillars: everything except #50, Ultimate Familiar Mastery, the only Pillar that is purely a capstone. Every other Pillar is a full subclass and works from Level 1 with humble tools: a Usurping Bond start steals a merchant's exotic pet, a World Binding start feels the first pulse of your home floor (every floor is a planet of its own).
A Tower Binding start makes the tower you were born in your first familiar. At Level 1 the bond is faint: a stair that settles under your foot, a warning tremor through the stone, a new line on your window you can't read yet. It grows into halls that move for you and a window the tower helps write. Claiming a tower at Floor 100 is separate and open to anyone; this is the personal bond with the being itself.
3 · Awakening. Whatever you roll, you start with one Pillar and one Branch at No Mastery: either one of its set Branches or one born from your birthplace. A higher-floor birthplace starts you with more Branches already open, to match your higher level. A Genesis start makes one tiny new creature, not a species; a Deep Calling start binds a minnow-sized drowned thing, not a leviathan. The ceiling is the Pillar's; the floor is always humble. The other 49 show [???] and open later by place plus heart, exactly as in the book.
The other runs:
• The spread: a derived-class Awakened instead of the Origin. Rarity is your strength budget: it sets how often you gain new Branches as you climb, and each extra Pillar slows them down (one Pillar with fast Branches, or two with slow ones; multiple Pillars are normal from Very rare up). You're a specialist going deep where the Origin goes wide. The extension tracks your Branch rate and rolls new Branches at that pace. Here the Origin exists somewhere, hunted.
• Sandbox: freeform Origin with three Pillars open and no clock.
What being the Origin means in play
• Your Pillars stack. Each new Pillar opens with a crossover into every Pillar you hold, so old familiars get better, not shelved. And you sit outside the rarity budget: your Branches come faster with every Pillar you open, more per floor as you go.
• Bond Feedback is yours alone from Level 15: your closest familiars make you stronger.
• Derived classes learn from you, and you from them. When you see one do something new, you can take it as a Branch with practice.
• Everyone wants you. The Founders' grip on Floor 1 exists to own or end your spread, so heat never really drops.
How Lumiverse splits the work
The card and world book tell the narrator who it is and what the world is; the extension sits on both sides of every reply. It feeds the current state in before the model writes, then reads the model's change log after.
The loop runs once per message. The highlighted box is the only place numbers live; the model never edits them directly.
The pillars
Five design pillars cover everything the game has to keep straight, and each one maps to a record in the next section. (These are design pillars, not the 50 Ability Pillars inside the story.)
• The System keeps your numbers honest: windows show what the extension holds, nothing the AI made up.
• Familiars is the heart of play: every golem, beast and undead has a cost, a state and an order.
• Growth is slow and earned, like the novel: one major unlock per floor, mastery measured in percent.
• The World keeps the Factions' hunt real: the Registry, Decree 00 and a heat score that rises when you're seen raising stone.
• People and bonds stops NPCs from teleporting in: the narrator only uses people who are there or could plausibly walk in.
The foundation is the novel's own voice (grounded fantasy terms, System windows as blockquotes, no tech jargon) and its precedence order.
What to track
Four records hold the whole game: your sheet, one card per familiar, the world, and a log of changes per message. Everything else is derived.
Your sheet
Field
Example
Notes
Name, class
You · Ultimate Familiar Master (Origin)
The spread run: a derived class + rarity instead
Level / Circle
16 · Stone Circle, second Threshold
The Threshold sets points per level
XP
4,000 / 32,000
level × 1,000 × points rate
Health / Mana
current / max
Level-up adds 10 / 5 × points rate, full restore
Attributes
Str, Con, Agi, Dex, Int, Control
Shown as own + from bonds (Bond Feedback)
Soul Tethers
used / total
total = Control × 5
Pillars
50 rows: sealed · stirring · open
A stirring line trembles warm or cold
Branches and skills
per Pillar; each skill a tier + %
Elements are Elemental Creation's Branches
Gifts
one per open Pillar, from Level 15
Borrowed Trait slots: one per Threshold
Tether arts
locked · learned
Grow with Control, Resonance and Thresholds
Body
wounds, exhaustion, hunger, cold
Carry over until they heal in the story
Location / time
floor, place, the floor's own day count
Each floor keeps its own clock
Silver, gear, items
list
Only tracked things exist
Heat
per faction, plus Decree 00
Tied to what each faction knows (Living world)
Each familiar
Field
Values
Name, portrait
your choice
Pillar
whichever of the 50 made it
People / species
every kind spans many peoples and species, and keeps something of what it was
Form and size
Puppet Golem, Automated Golem, beast form, shifter form, zombie, skeleton, spirit
State
Active · Slumbering · Lost · Released
Tether cost
1 per elemental; beasts by Soul Stage (Nascent 1, Awakened 3, Spirit 5)
Orders
dig · carry · guard · follow · strike a target · free
Level / Circle
beasts and minded familiars climb the same Circles you do
Attributes
minded familiars only; plus which of yours it feeds
Resonance
none · Faint · Steady · Deep · Kindred · Soulbound
Stage / core
beasts: Soul Stage; zombies: core grade; elementals: core
Body
wounds and cracks carry over
Kills / XP sent
running total
Growth fuel
mastery %, cores eaten, essence, bond, by type
The world: floor and its enemy level band, place, the floor's clock and weather, faction heat, every NPC met (voice notes, wounds, what they want offscreen), a who-knows-what ledger, open threads.
The change log: every AI message carries a list of operations (spend mana, form, slumber, lose, gain XP). State is rebuilt by replaying that log, so swipes, edits and deletes roll back cleanly instead of leaving ghost golems behind.
System math
Every number in the game comes from a handful of bible formulas, so the extension computes all of it and the AI never does arithmetic. The narrator only reports what happened (who killed what, what was formed); the extension turns that into XP, levels and stats.
Circles and Thresholds
Circle
Levels
Thresholds
Points per level
Stone
1–49
1–14, 15–24, 25–34, 35–44, the Seam 45–49
1, 2, 3, 4, 5
Iron
50–99
50–59 … the Seam 90–99
10, 20, 30, 40, 50
Silver
100–149
same pattern
100 … 500
Gold and up
every 50 levels
same pattern
×10 each Circle
// points per level (the "rate")
function rate(level) {
  const circle = Math.floor(level / 50)          // 0 Stone, 1 Iron, 2 Silver...
  const n = level < 50 ? level : level % 50
  const step = level < 50
    ? (n <= 14 ? 1 : n <= 24 ? 2 : n <= 34 ? 3 : n <= 44 ? 4 : 5)
    : (n <= 9 ? 1 : n <= 19 ? 2 : n <= 29 ? 3 : n <= 39 ? 4 : 5)
  return step * 10 ** circle
}
const xpToNext = (level) => level * 1000 * rate(level)

// kill experience: only kills by a bound familiar count
function killXp(enemyLevel, yourLevel) {
  const gap = enemyLevel - yourLevel
  const factor = gap >= 0 ? 1 + gap / 10 : Math.max(0, 1 + gap / 10)
  return Math.round(enemyLevel * 100 * rate(enemyLevel) * factor / 100) * 100
}
• Level up: + rate attribute points, +10 × rate max Health, +5 × rate max Mana, full restore. One point is always worth the same: Constitution +10 Health, Intelligence +5 Mana, Control 5 Soul Tethers.
• Checks against the bible: 30,000 XP to leave Level 15, 500,000 at 50, 10,000,000 at 100. At Level 15, a Level 30 captain kill pays 22,500.
• Crossing a Circle gets a full window and a whole explanation scene. The Seam is the hardest stretch before it.
• Narrow tether (Origin runs): below Level 15 most kill XP spills. The bible leaves the amount open, so the game default is that a random 10–30% reaches you, revealed at the First Threshold. It's a setting you can switch off.
Bond Feedback (from Level 15)
A share of each bound familiar's attributes flows back to you, live, into the matching attribute (a fast beast feeds Agility, a stone titan Strength and Constitution). It's lost if the familiar dies or is released, and you can't redirect it.
Resonance
Share
None (puppets, Automated Golems, mindless dead)
0%
Faint
5%
Steady
10%
Deep
20%
Kindred
35%
Soulbound
50%
So a Steady beast with 40 Agility adds +4 to yours, and a huge golem army adds nothing. Your closest companions are your strength, which is exactly the feel of the book.
Familiar costs
Familiar
Mana
Tethers
Notes
Puppet Golem
5
1
Up to 2.5 ft, guided by hand
Automated Golem
15
1
Up to 6 ft, simple orders; Low Mastery
Slumbering elemental
0
0
Woken free by touch
Bound beast
0 ("it costs will")
Nascent 1 · Awakened 3 · Spirit 5 · higher [???]
Its soul has to answer; you can't grab it
Pillars in play
A Pillar is one way of getting familiars, and twelve of the 50 can open inside this Tower. In the game each one is a module: its own panel tab, its own resource if it has one, and its own growth rules, switched on when it opens.
#
Pillar
Familiars
Opens on
1
Elemental Creation
Elementals and golems
Floor 1
2
Beast Taming
Beasts
Floor 7
3
Necromancy
The dead
Floor 10
4
Mind Dominion
Mind-thralls
Floors 21–39
5
Blood Bonding
Vampires
Floors 21–39
6
Infernal Summoning
Demons
Floors 21–39
7
Oathbinding
Willing peoples sworn to you
The kingdom floor, 21–39
8
Living Domain
Places bound as one familiar
Floor 40
9
Spirit Calling
Nature and ancestor spirits
Floors 41–100
10
Rune Artifice
Rune-cored constructs
Floors 41–100
11
Wyrm Pact
Dragons
Floors 41–100
12
Primordial Calling
The Tower's primordials
Near Floor 100
The other 38 stay [???] in the game, the same as on your window.
How a Pillar opens. Sealed → stirring → open. Opening needs the place and the person: the right floor plus a heart condition or a deed (an untainted heart for Beast Taming, a hardened one for Necromancy). The extension checks the floor; the narrator judges the heart or deed and says so in the tag. A stirring Pillar's [???] line trembles warm or cold near the kind of thing it governs, sometimes long before it opens.
Your first Pillar breaks the timing, nothing else does. Whatever woke at your Awakening is open from Level 1. The rest keep their canon timing: the Tower's twelve open on their floors, and the 38 beyond the Tower wait for what lies past it.
Branches. Each Pillar grows through Branches (Elements are Elemental Creation's Branches), and each Branch holds skills with their own mastery tracks: No → Low → Mid → High → Peak. Mastery caps rise as you climb. Each Pillar has a few set Branches, but they're never the only ones: others grow from your beginning and how you play, so the narrator can propose a new Branch when you earn one and the extension records it. Two runs with the same Pillar can grow very different trees.
Stacking, the Origin's edge. When a new Pillar opens you get its base form plus a crossover into every Pillar you hold. Once two Pillars both reach Mid Mastery, Branches carry between them: Elemental Creation plus Necromancy makes bone golems; Chain of Command from Blood Bonding can command undead hordes. The panel shows unlocked combinations as their own Form options.
Gifts (from Level 15). Each open Pillar gives you something of its familiars.
Pillar
Gift
Elemental Creation
Affinity: a feel for and resistance to each Element you command
Beast Taming
Borrowed Traits: carry one tamed beast's trait at reduced strength; needs Deep Resonance; one slot per Threshold
Necromancy
The Dead's Craft: hold a raised dead's skill or memory while it stands
Later Pillars
Set when they open
The tether arts work across every Pillar and grow with Control, Resonance and Thresholds rather than floors: Tether Weaving, Soul Menagerie, Vessel Riding, Unison, Gatecalling, Sovereign's Presence and Trait Sharing. The bible leaves their order open, so the game's rule is one new art per Threshold crossed, learned in a story moment that fits. Several map straight onto panel buttons: Vessel Riding upgrades Take hand into fully riding a familiar, Soul Menagerie adds a "carried in your soul" state to the roster, and Gatecalling adds a summon-from-afar button.
Floors that block Pillars. Some floors' Conquest Requirements forbid certain Pillars (the kingdom floor allows no Mind Dominion, Blood Bonding or Necromancy). The extension greys those Pillars out on that floor.
Familiar control
How much you control a familiar depends on its type and your mastery, straight from canon. The panel gives each kind the controls that fit it, and every other Pillar's familiars get controls from that Pillar's module.
Kind
How it obeys
What the panel gives you
Puppet Golem (No Mastery)
No mind; moves only while you guide it by hand
Take hand on one puppet at a time; the rest stand still. Switching hands is a skill, not free
Automated Golem (Low Mastery)
Follows one simple order on its own, literally
Order picker: dig, carry, guard, follow, strike a named target
Mid Mastery constructs
Makes its own tactical calls in a fight
Orders plus a stance: hold, press, protect you
Beasts
Bound, not owned; acts on its own nature and its bond with you
Ask, not order. Bond decides how readily it listens
Undead
Obedient, hungry, grows by what it devours
Orders plus feeding targets
The panel (dock on desktop, bottom sheet on phone)
• Top bar: Health, Mana, Tethers used/total, Level and XP.
• Roster: one card per familiar with portrait, state badge, tether cost, condition and current order. Filter by Active, Slumbering, Lost.
• Form: pick element, material and form. The button shows the cost and greys out if you can't afford it in Mana or tethers.
• Card actions: Slumber, Wake (only if you're touching its stone or water), Release, Give order, Take hand, Rename.
• Squads: group familiars ("wall crew", "ambush") and give one order to all.
How a click reaches the story. A panel action never changes the world by itself. It becomes a standing order that the extension injects into the next prompt ("Shale guards the cave mouth"), and it's added to your message as a short line you can see. The AI has to narrate it; the extension then confirms the result from the AI's change log. So you can play entirely by typing, entirely by clicking, or mix the two.
Taking hand is the fun one. While you hold a puppet, your typed actions steer it directly ("I walk the puppet along the ledge"), and the AI narrates the puppet's senses instead of yours.
Evolution and growth paths
The bible now says how each kind of familiar grows, and every path is different. Exact thresholds and costs are still open, so the game fills them in a labelled game-rules layer that the novel overrules whenever it shows the real thing.
What the bible already fixes (you wrote this part)
Kind
Grows by
What it becomes
Elementals
Mastery, Core Forging (compressing a core, rare-mineral cores), rare minerals
True elementals: they stop being just bodies of their element and command it on their own; humanoid and sentient at High Mastery
Beasts
Levels on the Circles plus five Soul Stages: Nascent → Awakened → Spirit → Sovereign → Primordial; guided evolution; Lineage (eggs, breeding, bloodlines)
Bigger monstrous forms or humanoid shifter forms; strange, huge, up to living landscapes; every evolution is an event
Zombies
No System: a gem or crystal core, grown by eating other zombies' cores
Mutations of their own; infectious; a developed core brings back life, memories and old abilities in varying degrees
Skeletons, spirits
Refined bone and soul essence; spirits keep Echoes (a slain foe's last skill)
Greater dead command lesser dead
Vampires
A blood-red sub-System grown from yours
Ranks: Progenitor (turned by you) → Pure → Royal → Noble → Common Blood → Thrall; stronger the closer they stand to you
Mind-thralls
Mind-flayer-like beings and parasite worms
Set in full when Mind Dominion opens
Vampire familiars get their own window in the panel: blood red, showing what matters to a vampire, with skills graded by bloodline name, and rank controls that let higher vampires lean on lower ones' Systems.
The game-rules frame (the shape, not the answers)
1.  Fuel: each path has a resource the extension counts: mastery % for elementals, levels and bond for beasts, cores eaten for zombies, essence for skeletons and spirits.
2.  Threshold: when the fuel crosses a line, the familiar's card glows "ready to change". Nothing happens on its own.
3.  The moment: you trigger it in the story, and the AI narrates it as a scene, not a menu click.
4.  A choice: where the bible allows branches (bigger monstrous form vs. humanoid shifter form for beasts), you pick.
5.  A cost: tethers go up with stage, so stronger familiars mean fewer of them.
Precedence. Written chapters beat the tracker, which beats the bible, which beats game rules. When the novel shows how something really works, the game's version is swapped for it.
Still gated: canon people, places and events stay behind your Read up to bookmark; the 38 Pillars beyond the Tower stay [???]; Soul Stage tether costs above Spirit stay [???] until the novel sets them, or the game invents them and marks them game-only.
Living world
The bible's living-world rules become game features, so the Tower keeps moving whether or not you're looking. Each one is a small record the extension keeps and feeds to the narrator.
Feature
What the extension does
What you feel in play
Enemy level bands
Each floor has a level band on the Circles; its Guardian sits at the top; Faction climbers bring their own level
Floors get scarier as you go; a Circle above you is a different kind of threat
Full windows
You see every enemy's window natively (Level, Class, Lineage, Rarity); ordinary Awakened see a fogged one
Scouting matters, and knowing more than everyone else is your edge
Peoples
Above Floor 1 the natives are non-human peoples; humans are climbers, captives or rare outsiders
Each floor feels foreign
Offscreen lives
On a time skip or floor change, a cheap background call updates each tracked NPC and faction: new wound, rank, grudge, news, a decision made without you
People come back changed, and some have plans for you
Who knows what
A ledger of facts and who holds them; facts spread only through something that happened (told, overheard, seen)
Heat comes from what they know: kill every witness and the Staff still doesn't know your Element
Motive cutaways (optional)
When an NPC makes a big choice, the narrator may show a short scene from their head, marked as something you know but your character doesn't
Dramatic irony, and dread
The body keeps score
Wounds, exhaustion, hunger and cold sit on your sheet and your familiars' cards with healing times
A broken arm still hurts three scenes later
Time passes
Each floor keeps its own clock; time skips tick healing, supplies and offscreen lives
Days actually go by
Distinct voices
The first time an NPC speaks, a short voice sheet is written to the world book
Characters stop sounding like the narrator
Character card and world book
The card is a narrator, not a person: "the Tower" runs the world, voices every NPC and writes the System windows. Your persona is your character.
Card field
What goes in it
Name
Ultimate Familiar Mastery
Description
The premise: the Tower, the false utopia of Floor 1, the Four Factions, the Registry and the Purge, and the fact that summoning was unknown until recently, so people react to rising stone with real fear
Personality
The narrator's voice: grounded, punchy in action, rich when explaining the System; matches your Style & Pacing Guide
Scenario
{{ufm_state}}: a macro the extension fills with your current sheet, roster and standing orders
First message + alternates
One per run (Origin, the spread, sandbox); the Origin one opens the setup modal
Example messages
Two short exchanges showing a System window as a blockquote and the change-log tag in use
System prompt
GM rules: never change numbers on your own; report every change in the tag; honour standing orders; no tech jargon; never "Facet"; NPCs only where they plausibly are
Post-history instructions
A three-line reminder of the tag format, seen right before each reply
Creator notes
Setup steps, recommended model and settings, extension link, changelog (never sent to the AI)
World book
• Always on: System rules and terms, the mastery tier table, Circles and Thresholds, the tether math.
• Keyword entries: each Faction (Mane, Staff, Witch, Dagger), Aethelgard, the frontier mining towns, the Tower and its floors, the Registry and Decree 00, Soul Stages, each familiar type.
• Canon sync (later): entries generated from the bible and tracker, cut off at your Read up to chapter, so nothing past your bookmark leaks in.
Spindle extension plan
The extension is built in five phases, and the game is playable after Phase 2. Each phase uses Spindle APIs that exist today.
The change-log tag. The AI ends each reply with a block like this. The extension hides it from the chat, checks it, and applies what's legal.
<ufm>
spend mana 15
form name="Shale" pillar=elemental element=earth form=automated
order Shale guard "the cave mouth"
kill enemy="Staff warden" level=17 by=Shale
lose "Puppet 2"
wound you "cracked rib" heal=10d
learn who="The Staff" fact="raises golems from stone"
time +1 day
</ufm>
Line-based instead of JSON because models get it right more often, and a bad line can be skipped without throwing away the rest.
The narrator never writes XP or stat numbers. It reports the kill, the enemy's level and which familiar dealt it, and the extension does the math, so a kill by your own hand correctly pays nothing.
Build phases
1.  State core and System math. Sheet and roster in extension storage; the change log keyed by message and swipe, replayed on swipe, edit or delete; the Circle, XP and kill formulas; level-ups and Circle crossings; the {{ufm_state}} macro and the interceptor. A drawer tab shows the sheet.
2.  Familiar panel. Dock panel roster, Form / Slumber / Wake / Release / Order / Take hand, squads, cost checks, standing orders. Playable here.
3.  Rule checks. Every tag line is checked against the rules (Mana, tethers, mastery tier, touch range, floor gates for Pillars). Illegal lines are dropped and the panel flags them. An optional cheap second-model check catches deaths or arrivals the tag missed.
4.  Growth. Bond Feedback as live from bonds attributes, Resonance steps, Soul Stages, Gifts, tether arts, Pillar stirring and opening, cross-Pillar Branches, and one module per familiar kind (zombie cores, vampire windows).
5.  Living world. Floor level bands, the who-knows-what ledger, the offscreen-lives background pass, wounds and floor clocks, NPC voice sheets.
6.  Canon sync and polish. World book builder from the bible and tracker cut at your bookmark; familiar portraits; a small floating HUD for phone.
Permissions it asks for
Permission
Used for
interceptor
Injecting state and standing orders into each prompt
generation
Generation events, plus the optional second-model check
ui_panels
The dock panel and floating HUD (drawer tab and input-bar buttons need none)
world_books
Canon sync in Phase 5
tools (optional)
Letting models that support function calls act through tools instead of the tag
Chat variables need no permission. The extension mirrors a few headline numbers there (@mana, @tethers) so other extensions and macros can read them, but its own storage is the source of truth.
Open questions for Carson
[x] Who you play: the Ultimate Familiar Master, with the spread and sandbox as alternates
[x] How a run starts: birthplace, then a first bond from your start, at random, or by choice
[x] Sovereign Binding. Make it the big ruling Pillar (realms, laws, a court across worlds), clearly apart from Oathbinding's sworn vassals?
[ ] A first mind. Puppets send back nothing through Bond Feedback. Should every start include one familiar with a mind (your own Heartstone, in whatever form your Pillar makes), or do you earn it like Reese did?
[ ] Pillar sheets. Each of the 42 starter Pillars needs a first Branch, costs and a Gift before it can be rolled. I'd write them as game-only; should they also become reference for the novel? You'd know them before you read them.
[ ] Narrow tether. Keep the early XP spill below Level 15 in Origin runs, or switch it off?
[ ] Your reading bookmark, for the Read up to setting.
[ ] Models. Which model narrates, and which cheap one runs the rule check and offscreen lives.
[ ] Portraits. Generate familiar portraits (costs per image) or upload your own.
Sources
• Spindle overview
• Manifest (spindle.json)
• Prompt interceptors
• Variables
• Events
• LLM tools
• Generation
• Decision models
• World books
• UI placement
• Message tags
• Creating characters
• Canon Story Bible (v5)
