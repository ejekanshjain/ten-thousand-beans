# 10,000 Beans: Technical Plan

This plan turns the "Game 2: 10,000 Beans" section of `DESIGN.md` into a build. It builds on `@slop/shared` for drawing, physics, input, gestures, timers, chores, economy, replays, share cards, audio and UI. Builders tick the milestones in section 11 and keep the Code Map in section 12 current.

Every number below is a starting value for `src/game/tuning.ts`. The balance pass (M26) adjusts them. Round 1 of the critics' review is folded in; section 0 lists what changed and why.

## 0. Critique Decisions

Accepted, with the numbers now used in this plan:

- **No soft-locks at the count.** A harvest goes straight into the pot whenever the pot sits on the ground, and into the stew at the door. The jar only fills while you carry the pot.
- **Phone pinch in screen terms.** A grab needs two fingers down, the pinch closed below 75% of its start distance or under 100 CSS px, and a bean within 40 u of the tweezer tip. Release happens only when a finger lifts. The tip draws 50 CSS px above the pinch centre so fingers never cover the bean. Pickup beans are 20 by 12 u with a body radius of 9.
- **Capped losses per event.** One spill event sends at most 30 beans to the river, 5 to a drain and 10 to a puddle. The rest land loose or in the pile. A tip-over spills at most 600 beans: 200 loose and a 400-bean pile.
- **The dog is a fair hazard.** It barks 1.2s ahead and jumps. Stopping or counter-tilting saves you. A fail tips the pot with the replay and the dustpan. A dodge knocks exactly one bean under the doormat. Grandma's secret no longer depends on the tip.
- **Waits always overlap work.** Swollen beans dry on a rack on your back, so the gate never waits for them. A "Plant your packets" nudge shows when 3 or more packets wait. At the door Grandma counts as soon as nothing lies on the ground, down a drain or on the rack. She paces her count to end with the window box's running batch, and grows any packets the busy box can't take on her windowsill (audit round).
- **Gossip reaches most players.** Lines are shorter (10 to 18 letters). A hand-made stroke font places about 5 beans per letter, oriented along the strokes, so letters stay readable at phone scale. Scripted big hits guarantee a line. The secret reveals hangman style, so about 6 pages make it readable.
- **No dice-roll fails.** Wet patches never slip you at a stroll. Hurrying onto one starts a 0.35s "whoa" wobble that a counter-tilt or a stop saves. Cobbles bump in a left-right rhythm. The cat wiggles for 1s before every bat.
- **Set the pot down anywhere.** Pickup opens only within 150 u of a zone. Away from zones the pot sits on the ground in the walk view.
- **Feedback from M1.** The spill sound, shake, slow motion and caption arrive in M1. Every spill caption names the cause, such as "Hurried. 14 beans.". Each hazard brings its own sound and caption in its own milestone, and M24 becomes an audit. Each milestone checks its new actions at the iphone-se preset too.
- **Replays don't interrupt.** Small spills show a corner Replay chip that fades after 4s. Only a new biggest spill or a tip-over opens the replay by itself. The simulation pauses while it plays. Spills of 100 or more and tip-overs offer Share.
- **Plant with holds.** Tap a packet to select it, then hold on a dug hole for 600 ms.
- **Upgrade chores have teeth.** The Pigeon Net protects nothing until untangled, and it tangles when the first pigeon of a set-down arrives. Only Grippy Shoes owners get mud and the cleaning chore.
- **Pickup is cheaper and varied.** Tweezers grab a touching clump of up to 3 beans with more strain per bean. Hands scoop any cluster of 15 or more. Each stretch has one pickup twist. Streaks of 10, 25 and 50 get a caption and a bigger pop. The target is pickup under about 35% of an average run.
- **Tip-overs teeter first.** Past the tip angle the pot balances on one edge for 0.5s with a creak. A counter-tilt saves it with "Saved it!". The Taller Pot can't tip from outside forces alone.
- **A gag in the first 15 seconds.** The cat paws one bean off the rim while you watch, and that bean is your first pickup. The cat moves before the rug, its first grooming window is 3.5s, and the fridge knock is scripted once.
- **A learnable slosh.** The surface rocks at 1.1 swings a second with damping ratio 0.2. Keys turn the pot at 30°/s (rising to 75°/s while held since M27) and the angle holds on release, with a 4°/s auto-level. Every character hit has a visible side and an arrow. The low rim glows as it nears the spill line.
- **Drops warn first.** The tweezers tremble and creak past 70% strain, the held bean tints red, and the drop caption names the cause. The pot mouth highlights while you carry.
- **Faster regrowing.** A slot takes up to 3 packets. Holes stay dug after harvest. Each harvest has a small gag.
- **Skill pays.** The clean bonus pays in full at 5 spilled beans or fewer and half at 25 or fewer. Each dodged telegraphed event pays 5 coins with a caption (2 until M26).
- **A measured pacing model.** The table now has desktop and phone columns and a tip-over row. Pickup times get measured after M3. Parks allow 3 pigeons at once, and one shoo scatters the flock.
- **Lessons spread across the route.** Street: neighbours, cyclists, drains and gossip. Market: puddles and the drying rack. Park: pigeons and the window box. Hill: rain and Pour Off. The street shower is gone.
- **The lid holds most hits but can fail big.** With the lid on, a character hit throws a quarter of its splash (at least 1 bean). The ladder and the ambushes launch it with a clang and a full spill unless you lean against them, and you fetch it from where it lands. It always lands where the pot can reach it, even at a shut gate. A tip-over launches it too, but scatters half the loose beans (audit round).
- **Captions rotate.** Each caption has 4 to 6 versions without repeats, escalating Grandma lines by spill size, and a running score per cause.
- **No toll booths.** Walking back runs at stroll speed. The coat hanger can snag the duck, sock or key, with a caption.
- **Physics that can't strand beans.** Held beans leave the Matter world and move kinematically. Releases cap at 400 u/s. A release counts when the bean overlaps the pot circle. Walls are 100 u thick, bodies are clamped inside the play rect, and a bean out of reach for 2s respawns. One helper converts u/s to Matter units.
- **A bridge slide that moves.** Sleeping is off on the bridge, and the slide sets a target drift of 60 to 90 u/s at peak roll. A headless test checks it in M2.
- **One owner for bean state.** One function moves the ledger, the zone record and the body together. Body positions write back on every scene exit. Puddle and drying beans have positions and a kind.
- **Tilt gets exercised.** A dev motion stub runs the real `TiltAxis` path. A real-device HTTPS session is a manual check that needs approval for any tool.
- **Performance checked early.** Frame budgets get checked at M2, M5 and every stretch milestone. The next tile paints before it is needed.
- **Hold buttons.** One `HoldButton` handles pointer capture, cancel, blur and blocked input for Tilt, Jot It Down and Pour Off.
- **Stable tests.** Each system has its own random stream, so a new random call in one system doesn't shift the others.
- **A quiet HUD.** Counts show through `LiveText`. The timers array changes only when a timer starts or ends.
- **Canvas sizing.** The canvas cell is `relative min-h-0 min-w-0`, the canvas is `absolute inset-0 size-full`, tracks use `minmax(0, 1fr)`, and the whole grid is `touch-none`.
- **Camera-safe stamps.** `CachedLayer.stamp` resets the transform, so the camera passes its offset and shake into stamp coordinates and re-applies itself after each batch. No shared change.

Rejected or changed:

- **Font-raster glyph sampling is replaced by a stroke font.** A raster point cloud of 4 to 5 beans per letter doesn't read, and exact counts need a search that doesn't converge. Hand-made strokes give exact, readable counts with no font loading.
- **Pinch release at 1.4 times the grab gap: rejected.** Releasing only on finger lift is simpler and can't fire from finger roll.
- **A real phone check before ticking M3: changed to a manual check.** Agents can't hold a phone. Scripted pinches gate M3, and Ekansh runs the real-device pass.
- **The dog's impossible second jump: rejected.** An avoidable dog keeps every fail your own, and failing players still get the shareable tip.
- **A doorstep inset on the ending card: rejected.** The biggest spill alone is the stronger picture.
- **Cached boil frames per character: deferred.** Characters redraw live until a frame check shows they cost too much.
- **"The average bot finds 10 of 12 pages": lowered to 9, then to about 3 by M26's measurements, then raised to about 7 by M27.** A page needs one spill of 57 to 106 beans (47 to 91 since M27), and only character hits throw that many. M27's doubled characters and one ambush per middle stretch raised it. The front-loaded reveal makes the secret readable from 3 pages.
- **The duck returns flung beans on the bridge only.** Nowhere else can a bean be lost by flinging it.

## Departures From the Lead's Direction

- **Physics bodies exist only in Pickup mode.** Walk scenes are side-on and Pickup is top-down, so a body in the walk scene can't become the same body on the ground. Walk spills are cheap particles. Matter.js only simulates the one zone you are picking up, at most 200 bodies.
- **The HUD lives in reserved bars and rails around a canvas panel.** A floating overlay covers the play area on 3:4 tablets and some phones. A CSS grid with the canvas in its own cell can't overlap at any aspect ratio.
- **A seed packet holds up to 8 lost beans.** One packet per bean means 100 identical plantings. The audit round kept it: packets of 1 to 3 beans would mean 3 to 8 times as many, and a batch takes 9 (18 with the Bigger Window Box), so the door would need more batches. `DESIGN.md` says every lost bean comes back as a seed packet; its wording needs the lead's update.
- **Tweezers lift small clumps, and hands scoop any heap of 15 or more.** `DESIGN.md` says one bean at a time, with scoops only for the pile. Pickup is already 51% of the average desktop run and 58% on phones. M3's pinch bot averaged 1.7 beans a grab, so single-bean grabs would add up to about 25 min to an average run, push the middle stretches past 15 min each, and leave the Wider Tweezers little to speed up. The audit round kept the clumps; `DESIGN.md`'s Picking Up Beans needs the lead's update.
- **The clean bonus pays in tiers.** `DESIGN.md` pays it for a stretch "with no spills"; it pays in full at 5 spilled beans or fewer and half at 25 or fewer, so one stray bean doesn't cost the whole bonus. `DESIGN.md`'s Coins needs the lead's update.
- **The kitchen and Grandma's door are short bookends.** `DESIGN.md` gives every stretch 10 to 15 min. The kitchen (the tutorial and the cat) and the door (the dog and the count) take about 5 min each, and the five middle stretches 10 to 15. The 70 min desktop average sits inside the 1 to 2 hour target without padding them. The audit round kept them; `DESIGN.md`'s Length needs the lead's update, and real timed runs stay an Owner Follow-Up.
- **The window box is strapped to your back and grows in batches.** `DESIGN.md` says the 1-minute wait is shared across the whole box. A box on your back explains that and keeps it reachable.
- **Gossip uses a stroke font.** Beans line up along hand-made letter strokes, so a line's bean count is exact and readable at phone scale.
- **Rain stops when you set the pot down.** Rain is a walking hazard with a pour-off chore.
- **Grandma counts with captions and rising ticks, not speech synthesis.** Chrome's voices can call the network, which the hard rules forbid.
- **Scripted bots tune the slosh model in unit tests.** Seeded bots, including a keyboard bot, walk each stretch so spill budgets are checked by tests.
- **No shared changes are planned.** On-screen tilt buttons feed the game's own rate control. If a builder needs a shared helper later, they follow the shared-edit rules.

## 1. Player Experience

### First 5 Minutes

- **0:00 Start screen.** The title "10,000 Beans" in marker. Pitch: "Carry 10,000 beans across town. Pick up every one you spill." Story: "Grandma's family stew needs exactly 10,000 beans. She counts every one at the door." **Tap to Start** unlocks audio and asks iPhones for motion access.
- **0:05 Your kitchen.** A red enamel pot heaped with beans sits on the counter. The cat sits beside it and stares at you.
- **0:12 The first gag.** The cat slowly paws one bean off the rim. It bounces across the floor: "The cat regrets nothing." Caption: "Grandma counts every one. Pick it up."
- **0:20 First pickup.** The view drops to the kitchen floor, top-down. You drag the bean to the pot with tweezers. It pops in: "9,999 became 10,000 again."
- **0:45 First steps.** "Space picks up the pot. Hold W to walk. A and D tilt it." Phones read "Tap Pick Up. Hold your thumb down to walk. Tilt the phone." The bean surface visibly rocks with each step. Your eyebrows rise as the low rim starts to glow.
- **1:15 The cat at the kitchen door.** It sits in the doorway, awake, tail swishing. Caption: "Wait until it licks itself." It watches anything that moves, so it only starts grooming once you stand still for 3s. Its first grooming window lasts 3.5s. Walk in while it's awake and it swats about 60 beans out: "Cat swat. 60 beans. Grandma sat down."
- **1:30 The first gossip.** The swat beans spell "THE CAT KNOWS". Bean pickup stays locked until you hold **Jot It Down**.
- **2:00 Pickup with tricks.** Clumps of 2 or 3 beans come up together. Hold still on a cluster to cup your hands and scoop it.
- **2:45 Under the fridge.** The cat wiggles its bum for 1s, then bats one bean under the fridge. A bent coat hanger appears, and you fish it out.
- **3:30 The hall rug.** A curled rug edge gives a small bump. Hurrying over it spills up to about 40 beans, depending on where the sway is in its swing: "Hurried over the rug. 9 beans."
- **4:30 Out the front door.** "Kitchen clear." You walk out to the street corner.
- **5:00 First kiosk.** The editor of The Weekly Whisper buys "THE CAT KNOWS" for 19 coins. A careful kitchen also pays a clean bonus.

### The Middle

- **Street, about 5 to 16 min.** Neighbours step out from the left: "Ooh, what's in the pot?" Stop and hold level while they peek, or walk on and take an elbow. A bell rings behind you; stop or get startled. Potholes punish hurrying. Cobbles bump left, right, left in a rhythm you can read. A drain swallows a few beans and the coat hanger comes back. The first big spill slides into "MAYOR WEARS A WIG".
- **Market, about 16 to 27 min.** Puddles appear. Swollen beans go on the drying rack on your back and drop into the pot when dry. Crowds walk against you. Stallholders poke tasting spoons at the pot from the right. A man with a ladder swings round on a 4s rhythm, and a mistimed crossing sends 100 beans flying. They spell "LIFEGUARD CAN'T SWIM". In Pickup, shoppers' feet scuff beans around.
- **Park, about 27 to 40 min.** A kid shouts "Heads up!" and a dashed arc shows where the football will cross. Dogs jump at you. Hurrying onto wet grass starts a "whoa" wobble. Pigeons waddle in while the pot sits on the ground, and every bean they eat becomes a seed packet. You open the window box for the first time: dig, plant, water, and 1 minute later harvest a pod of beans with a face.
- **Hill, about 40 to 53 min.** Heavy rain fills the pot, and you learn **Pour Off**. Every spill on the slope rolls back to the bottom: "Gravity: 1. You: 0." Gusts are telegraphed by streaming leaves. In Pickup, the ground tilts and beans creep downhill.
- **Rope bridge, about 53 to 63 min.** The bridge sways on two sine waves and gusts push the pot. Up to 30 beans per spill fall into the river: "Bye, bean." During pickup the deck tilts, so loose beans slide toward the edges and you race them. Fling one in on purpose and a duck brings it back: "Grandma saw that."

### The Ending

- **63 min: Grandma's door.** A short garden path and four steps. Grandma Doris waits in the doorway with her small white dog.
- **The last step.** The dog barks, an arrow shows its side, and 1.2s later it jumps. Stop or counter-tilt and you make it: "Made it!" The dog's jump still knocks exactly one bean out, and it rolls under the doormat. Miss the window and the whole pot tips in slow motion: "Carried for 1:02:41. So close." Grandma: "Oh dear. Again." She hands you a dustpan.
- **The count.** Grandma counts out loud at an accelerating pace, with captions: "One.", "Two.", "Ooh, my knee.", "Lucky bean!" If a batch is still growing she pauses at the shortfall: "Still 16 short, dear." She carries on when you harvest. At 9,999 she stops: "One is missing."
- **The doormat.** The mat has a bump. Drag it up, find the bean, and drop it in the stew. "Ten thousand." She tastes it, says "Hmm.", and adds salt. The dog sneezes.
- **The secret.** The stew beans float into Grandma's secret, "GRANDMA TRAINED THE DOG", with one share of the letters for each gossip page you found. With 7 pages it reads "GR_NDM_ TR__N__ TH_ D_G". Grandma shrugs: "Every year, dear. It builds character."
- **Ending screen.** Stats, the secret as revealed, **Share**, and **Play Again**.

## 2. Scenes and Navigation

### Scene Graph

```text
Start -> Walk(kitchen)
Walk  <-> Pickup            Space or Set Down within 150 u of a spill zone
Walk  <-> Grounded          Space or Set Down anywhere else; the pot sits on the ground in the walk view
Pickup <-> Drain            tap the drain grate (fridge gap in the kitchen)
any   <-> Window Box        E or Window Box button; the world pauses
Walk(stretch end, gate open) -> Kiosk -> Walk(next stretch)
Walk(door, last step) -> Doorstep -> [Pickup(dustpan) after a tip] -> Count -> Doormat -> Ending
Modals over any scene: Settings, Notebook, Chores sheet (phone), Replay player
```

- **Walk:** side-on, the camera keeps you 180 u from the left edge of the design, so you see about 420 u ahead. Seven stretches: kitchen, street, market, park, hill, rope bridge, Grandma's door.
- **Grounded:** the walk view with the pot on the ground. **Pour Off**, net untangling and the jar work here.
- **Pickup:** top-down zoomed ground view of one spill zone, with the pot at the bottom centre.
- **Drain:** side-on view down the drain shaft with the coat hanger.
- **Window Box:** the box over a blurred copy of the last frame. Simulation pauses; real-time timers keep running.
- **Kiosk:** a static drawing of the newspaper kiosk with React panels for selling gossip, the shop and chores.
- **Doorstep, Count, Doormat:** scripted ending scenes on the door stretch.

### Layout

The design space is **600 x 800 logical units**, portrait. `useGameCanvas({ width: 600, height: 800, mode: 'contain' })` fits it into the canvas cell. Extra cell space shows more scenery through `viewport.view`. Gameplay only happens inside the 600 x 800 design.

`GameLayout` is used without `canvasRef`. Its children hold a CSS grid with `touch-none`: the HUD sits in the bars or rails, and the canvas sits in its own cell. The cell is `relative min-h-0 min-w-0 pointer-events-auto`, the canvas is `absolute inset-0 size-full`, and tracks use `minmax(0, 1fr)`, so the canvas's backing size can never grow its track. The cell has a wobbly ink border, like a comic panel.

Phone portrait (iPhone 12 Pro, 390 x 844, safe areas 47 top and 34 bottom):

```text
+--------------------------------------+  safe area 47 px
| Pot 9,874 | Behind 37 | 45c | Menu   |  top bar 56 px
| [slosh meter strip, 8 px]            |
+--------------------------------------+
|  canvas cell 390 x 611 px            |
|  design 390 x 520 px at scale 0.65   |
|  extra 91 px shows sky and ground    |
+--------------------------------------+
| [Tilt L] [Set Down] [Box] [Tilt R]   |  bottom bar 88 px, buttons 56 px
+--------------------------------------+  safe area 34 px
```

On an iPhone SE (375 x 667, 20 px top inset) the bars shrink to 52 and 76 px. The cell is 375 x 519 px and the design fits at scale 0.625. Tilt buttons only appear when motion is unavailable. Timers show as chips in the top bar. Chores collapse into a "Chores 2" chip that opens a sheet.

**As built (M25):** the top bar holds the counts, the slosh meter and a two-line next-step prompt, so it can't reach 52 px. It is 100 px on the iPhone 12 Pro and 95 px on the iPhone SE, where the prompt drops to 14 px text on screens under 700 px tall (the `short` variant). The slosh meter is 16 px tall on phones. The action bar is 64 px, or 70 px when the tilt buttons wrap to two lines. The iPhone SE cell is 375 x 502 to 508 px, so the design keeps its full 0.625 scale. Timers show as compact countdowns beside the meter, and chores show on phones only at the kiosk.

Desktop landscape (1280 x 800):

```text
+-----------+--------------------------------+-----------+
| LEFT 240  | canvas cell 800 x 800          | RIGHT 240 |
| Market    | design 600 x 800 at scale 1.0  | 45 coins  |
| Pot 9,874 | extra 100 px each side shows   | Timers    |
| Behind 37 | more street                    | Set Down  |
| Lost 4    |                                | Window    |
| Gossip 3  |                                |  Box (E)  |
| Slosh     |                                | Notebook  |
| Chores    |                                | Settings  |
+-----------+--------------------------------+-----------+
```

- The grid switches with Tailwind variants: rails at `landscape` and width 900 px or more, bars otherwise.
- Landscape phones under 500 px tall show a "Turn Your Phone Upright" note over the cell (the `sideways` variant). The note lets touches through, so the game still runs underneath.
- Speech bubbles, captions, side arrows and gate arrows are drawn on the canvas next to the thing they describe. They count as play-area art, not HUD.

## 3. Core Simulation Model

### Units and Conventions

- Lengths are logical units (u). Speeds are u/s everywhere, including physics. `game/units.ts` converts u/s to Matter's per-step velocity.
- Time steps are the fixed 60 Hz `update(dtMs)` from `startLoop`. Slow motion scales the simulation `dt`, never real-time timers.
- Angles are radians in code and degrees in this plan. Clockwise on screen is positive, so a positive pot angle lowers the right rim.
- "Right" is forward along the route.
- Each system draws from its own seeded stream, `rng(hash01(seed, streamIndex) * 2 ** 32)`, so bots, tests and dev replays stay deterministic when one system changes.

### Bean Ledger

Every bean is in exactly one place. All changes go through `move`, which throws on a fractional `n` or an overdraw.

```ts
export const PLACES = [
  'pot',
  'loose',
  'pile',
  'puddle',
  'drying',
  'drain',
  'packets',
  'growing',
  'regrown',
  'hidden'
] as const
export type Place = (typeof PLACES)[number]
export type Counts = Record<Place, number>
export const TOTAL_BEANS = 10_000

/** Moves n whole beans. Throws when n is not a whole number or `from` holds fewer. */
export function move(counts: Counts, from: Place, to: Place, n: number): void
```

| Place     | Meaning                                                                        |
| --------- | ------------------------------------------------------------------------------ |
| `pot`     | In the pot                                                                     |
| `loose`   | On the ground in a spill zone, including beans held in the tweezers or hands   |
| `pile`    | Zone overflow beyond 200 bodies, cleared in scoops                             |
| `puddle`  | Swollen beans on the ground                                                    |
| `drying`  | On the drying rack on your back                                                |
| `drain`   | Down a drain or under the fridge                                               |
| `packets` | Lost for good, waiting in seed packets                                         |
| `growing` | Planted in the window box                                                      |
| `regrown` | Harvested into the jar while you carry the pot; tipped in at the next set-down |
| `hidden`  | The doormat bean during the ending, always 0 or 1                              |

The invariant is `sum(counts) === 10,000` at every step. Zones hold per-zone counts and positions, and each zone-level place summed over zones equals the ledger count. Dev builds assert both after every event.

**One owner.** Every bean change in a zone goes through `zones.ts` functions (`spillInto`, `takeLoose`, `returnLoose`, `toPot`, `toPile`), which update the ledger and the zone record together. The Pickup world adds or removes the matching body in the same call. Dev hooks use the same functions. Body positions write back to the zone record on every scene exit.

### Walking

- Target speed: stopped 0, stroll **80 u/s**, hurry **170 u/s**, back **80 u/s**.
- Speed follows `v = damp(v, target, 2.2, dt)`, so a start from rest reaches 90% in about 1s.
- Forward acceleration `ax = (v - vPrev) / dt` drives the slosh at half strength (`ACCEL_SLOSH = 0.5`), so a stroll start rocks the beans without spilling.
- Stride is **75 u**. The step phase advances by `v / 75` steps per second. Body sway runs at half the step rate, `v / 150` Hz.
- Sway drive: `aSway = 160 * (v / 170) * sin(PI * stepPhase)` in u/s². (M1 raised it from 140 so a long hurry spills about 4 beans a second.)
- Terrain multipliers: uphill 0.7, bridge 0.85. Stairs cap speed at stroll and take one step per stair. Above the cap you slow to it fast while still walking; letting go slows you as usual. (M26 fixed a bug where the cap's damping held you at a stroll forever, so a player who hurried onto Grandma's steps couldn't stop for her dog.)
- Walking back is allowed inside a stretch, never into the previous one.

### Route

| #   | Stretch | Length  | Hazards and events                                                                                             | New lesson                        | Gossip slots | Pigeons          | Weather    |
| --- | ------- | ------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------ | ---------------- | ---------- |
| 1   | Kitchen | 1,500 u | The counter cat at 60, the cat at the kitchen door at 450, fridge gap, hall rug at 750                                                  | Tilt, pickup, gossip, coat hanger | 1            | None             | None       |
| 2   | Street  | 7,800 u | 6 neighbours, 4 cyclists, Mrs Pryce at 6,549, 4 potholes, 3 kerbs, cobbles from 2,400 to 3,200, 3 drains, 5 stairs down from 6,950      | Neighbours, cyclists, drains      | 2            | None             | None       |
| 3   | Market  | 7,800 u | Cobbles throughout, shoppers every 6 to 10s, 8 stall spoons, the ladder at 3,600, the sale at 6,610, 2 kerbs, 2 drains, 4 puddles       | Puddles and the drying rack       | 2            | None             | None       |
| 4   | Park    | 8,400 u | The kid's ball crossing 4 times, 4 dogs, Bruno at 7,000, 1 cyclist, 3 potholes, 4 wet patches, 2 puddles                                | Pigeons and the window box        | 3            | Every 15s, 3 max | None       |
| 5   | Hill    | 6,000 u | Slope from 1,000 to 2,800 at 12°, 3 potholes, gusts every 8 to 12s                                                                      | Rain and Pour Off                 | 2            | Every 40s        | Heavy rain |
| 6   | Bridge  | 4,000 u | Deck roll, gusts every 6 to 10s, 4° crosswind                                                                                           | River losses                      | 2            | Every 25s        | Wind       |
| 7   | Door    | 800 u   | Garden path, 4 steps up, the dog                                                                                                        | The final hazard                  | 0            | None             | None       |

M5 changed two positions. The kitchen grew from 1,000 to 1,200 u and the street stairs moved to 5,150 to 5,400, because a shut gate stops you 350 u before the stretch end. Every hazard must sit before that point, so you always cross it before the gate checks for beans behind you. `terrain.test.ts` checks this for every stretch.

M9 placed the street's characters and drains. Neighbours live at front doors 749, 3,549 and 4,949 (doors sit at 200 k + 149, where the terraced houses paint them), cyclists start coming up behind you once you pass 1,950 and 3,950, and drains sit at 2,700 and 4,500 on the street and 2,200 in the market. The same before-the-gate rule covers them.

M15 placed the park's: wet grass at 1,150, 2,950 and 4,650 (80 to 100 u wide), the kid's football crossing the path at 1,600 (kicked from 1,800, ahead of you) and 4,200 (from 4,000, behind you), dogs lying at 2,150 and 4,950, and the cyclist from 5,500.

M27 (Lead Decisions) kept those spots and added more after them. The street got neighbours at 1,549, 2,349 and 5,749, cyclists from 5,200 and 6,700, a pothole at 6,000, a kerb at 5,450 and a drain at 6,200, and its stairs moved to 6,950. The market got stalls at 1,150, 3,230, 4,270 and 5,830 (stalls sit at 260 k + 110, where the market paints them), a kerb at 7,000, a drain at 5,700 and a puddle at 6,200. The park got kicks crossing at 5,900 (from 6,100) and 7,650 (from 7,450), dogs at 6,400 and 7,850, a pothole at 7,350, wet grass at 6,700 and a puddle at 6,200. The hill got potholes at 4,300 and 5,200. Each middle stretch also has one ambush (section 3, "Ambushes").

Pure walking at stroll takes 15s to 80s per stretch. The first plan expected stops for events, walking back to zones and climbing the hill twice to bring walking to 1.5 to 5.5 min, but M26's bots take 0.2 to 2.4 min including all of those (section 5).

### Pot Tilt

- **Keys and tilt buttons use rate control.** A and D (or Left and Right, or the on-screen buttons) turn the target angle at **30°/s** as the key goes down, rising to **75°/s** over the first 0.2s of holding one way (M27, Lead Decisions). A 0.1s tap turns about 4°, and a turn back starts slow again. Releasing holds the angle, and an auto-level eases it back at **4°/s**. The target clamps at ±40°.
- **Device tilt is absolute.** `TiltAxis` with motion only (no keys, no `pointerRange`) gives `c` in -1..1 with `maxDegrees` 40, and `psiTarget = c * 40°`.
- Lag: `psi = damp(psi, psiTarget, 10, dt)`, a 100 ms time constant.
- Disturbances add on top: `psiEff = psi + bridgeRoll + lean + gustDrift + kickDecay`.
- Kicks from bumps decay with `damp(kick, 0, 4, dt)`.

### Slosh

The bean surface angle `sigma` is a damped spring in world space. It wants to sit at the angle set by your acceleration.

- Natural frequency `f0 = 1.1 Hz`, so `omega = 6.91 rad/s`. One swing takes 0.9s, slow enough to watch and answer.
- Damping ratio `zeta = 0.20`, or 0.26 with the Taller Pot.
- Effective gravity `G_EFF = 1600 u/s²`.
- Target angle `sigmaTarget = atan((ACCEL_SLOSH * ax + aSway) / G_EFF) + windPush`. Speeding up forward raises the back of the surface, so beans spill backwards.
- Bumps add straight to `sigmaVel`. A kick of `J` rad/s gives a first peak of about `0.8 * J / omega` radians.

Sway resonance makes "faster means more slosh" exact. Sway frequency is `v / 150` Hz: 0.53 Hz at stroll and 1.13 Hz at hurry, right on `f0`. Forced-oscillator gain is `1 / sqrt((1 - r²)² + (2 zeta r)²)` with `r = f / f0`:

| Speed         | r    | Gain | Forcing amplitude | Steady slosh |
| ------------- | ---- | ---- | ----------------- | ------------ |
| Stroll 80 u/s | 0.48 | 1.27 | 2.7°              | 3.4°         |
| Brisk 130 u/s | 0.79 | 2.0  | 4.4°              | 8.8°         |
| Hurry 170 u/s | 1.03 | 2.4  | 5.7°              | 13.7°        |

Resonance builds with a time constant of `1 / (zeta * omega) = 0.72s`. Measured in `slosh.test.ts`: a stroll from rest spills nothing, a 1.5s hurry spills about 3 beans, and 10s of hurrying spills about 45.

### Spilling

- Rim half-width `R = 56 u`. Pot depth is 80 u, so 125 beans fill 1 u.
- Margin `m = REPOSE + (10,000 - pot) / 125 - water + (assist ? 4 : 0)`. `REPOSE` is 9 u (M27 lowered it from 10 u so beans spill a little sooner), or 20 u with the Taller Pot.
- Relative angle `phi = sigma - psiEff`. Overflow depth `d = R * tan(min(|phi|, 60°)) - m`.
- Spill rate follows the weir law: `Q = 4 * d^1.5` beans/s when `d > 0`, capped at **90 beans/s** so a held tilt pours fast but not instantly. The Pot Lid caps `Q` at 6 beans/s until a hard hit or a tip-over launches it.
- Slow motion slows everything in the simulation, your tilt response included, so a pour you react to inside the slow-mo window still costs real time.
- Beans leave over the left rim when `phi > 0` and over the right rim when `phi < 0`.
- The low rim glows red from 70% of the spill angle, `atan(m / R)`, and pulses past it.

```ts
// One fixed 60 Hz step. Angles in radians, clockwise positive.
const target = Math.atan((T.ACCEL_SLOSH * ax + aSway) / T.G_EFF) + windPush
sigmaVel += (OMEGA ** 2 * (target - sigma) - 2 * zeta * OMEGA * sigmaVel) * dt
sigma += sigmaVel * dt
const phi = sigma - psiEff
const over = T.RIM_HALF * Math.tan(Math.min(Math.abs(phi), T.MAX_PHI)) - margin
if (over > 0) spillAcc += Math.min(rateCap, T.WEIR_K * over ** 1.5) * dt
else spillAcc = 0
const n = Math.min(counts.pot, Math.floor(spillAcc))
spillAcc -= n
if (n > 0) emitSpill(n, phi > 0 ? -1 : 1, over)
```

Worked numbers with a full pot (`m = 9`), before the 90 beans/s cap:

| Relative tilt | d (u) | Spill rate  |
| ------------- | ----- | ----------- |
| 9.1°          | 0     | 0 beans/s   |
| 15°           | 6.0   | 59 beans/s  |
| 25°           | 17.1  | 283 beans/s |
| 35°           | 30.2  | 664 beans/s |

### Spill Events and Causes

- A spill event starts with the first bean out and ends 0.6s after the last. It records its count, side and cause.
- The cause is the latest kick within 1.5s (its hazard name). Otherwise it is the pot tilt when `|psi|` passes 8° and leans the spill's way ("Tilted too far."), hurrying above 120 u/s ("Hurried."), or a hard start ("Started too fast.").
- Each bean plays `splat` per 10 beans. When an event passes 30 beans it plays `fail` once, shakes `min(12, n / 10)` u, and runs 0.3 time scale for 0.4s.
- At the event's end a caption names the cause and count, such as "Hurried. 14 beans.", with a Grandma line under it by size: under 10 "Grandma felt that.", 30 or more "Grandma sat down.", 100 or more "Grandma is updating her will.", a tip-over "Grandma heard that from across town." Each line has 4 to 6 versions that rotate without repeats (M24 fills them in).
- Scripted big hits launch a fixed splash on top of the slosh: cat swat 85, neighbour elbow 35, ladder 100, football 90 (M26 moved the cat from 60 and the elbow from 50). While a gossip slot is open the splash rises to the next line's need plus 8. A counter-tilt or partial dodge halves the splash.
- **How M20 built fail replays** (`replays.ts`, `scenes/film.ts`, `ui/Replay.tsx`): the walk view's design area records into a 3s ring of 240 x 320 frames at 24 fps (two sets of 72 frames, about 44 MB, however many spills a run has); only the walk view records, and a new stretch starts a fresh recording. When a spill event ends, its replay waits for every flying bean to land, then 1s more, and the runtime cuts the clip; leaving the walk view cuts it at once. Captions read "47 beans in 0.4s", "620 beans at once." for a tip, and "Carried for 1:02:41. So close." for the doorstep, with the cause and Grandma's line under the clip. Plan decisions: spills under 3 beans get no replay (there is nothing to see), and only a new biggest spill of 30 beans or more opens by itself, so the first 2-bean slosh doesn't interrupt. Small spills show a corner Replay chip for 4s, in the sky band above the design on phones and the cell's corner on desktop. Auto replays pause the game through the modal. 100 beans or more and tip-overs offer Share with a card of the clip's still. A replay still waiting when another spill ends merges into it, keeping the bigger spill's caption and every reason to open or share. The biggest spill's still is copied at 480 x 640 for the ending card. A tip-over now names the whole event "Tipped it." even when it started as a slosh.

### Hazards and Events

Terrain kicks scale with `(v / 80)²`, so hurrying over a pothole is 4.5 times worse than strolling. Character kicks are fixed, telegraphed and come from a visible side with an arrow. Stopping or timing avoids them, and a counter-tilt into the kick halves the spill. Each dodged telegraphed event pays 2 coins with a caption such as "Not today, ladder man.".

| Hazard        | Side        | sigma kick (rad/s)         | psi kick                                          | Telegraph and counter                                                                                                      |
| ------------- | ----------- | -------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Cobble step   | Alternating | 0.3, left then right       | 0                                                 | Visible cobbles; the rhythm follows your steps; walk slower                                                                |
| Pothole       | Forward     | 0.9                        | 0                                                 | Dark blob ahead; stroll peaks near 6°, no spill                                                                            |
| Kerb          | Back        | 0.7                        | 0                                                 | Visible edge                                                                                                               |
| Hall rug edge | Forward     | 0.4                        | 0                                                 | Visible curled edge; hurrying spills 5 to 15 beans                                                                         |
| Stair step    | Forward     | 0.6                        | 0                                                 | Speed capped at stroll                                                                                                     |
| Wet patch     | Either      | 2.4 if not saved           | 12°                                               | Shiny puddle patches; only above 90 u/s a 0.35s "whoa" wobble starts; counter-tilt or stop saves it; certain above 150 u/s |
| Cat swat      | Left        | 2.6 plus an 85-bean splash | 10°                                               | Kitchen door at 480; tail swish while awake; grooms after you stand still 3.0s; 3.5s first, then 2.4s; paw reach 70 u      |
| Neighbour     | Left        | 2.4 plus 35 if you walk on | 10°                                               | "Ooh, what's in the pot?"; stop and resist a 14°/s lean for 2.5s; the pull fades at 20°/s once they let go                 |
| Cyclist       | Behind      | 2.0 walking, 0.3 stopped   | ±8° jitter for 0.4s                               | Bell 1.5s before the pass                                                                                                  |
| Crowd shopper | Front       | 3.0                        | 12°                                               | Appears 2s ahead with "Excuse me!"; stopped gives 0.4                                                                      |
| Stall spoon   | Right       | 2.6                        | 10°                                               | Spoon out 1.2s of every 3s                                                                                                 |
| Ladder        | Right       | 3.5 plus a 100-bean splash | 18°                                               | "Mind your backs!"; 4s swing, 1.4s danger window                                                                           |
| Football      | Arc side    | 3.0 plus a 90-bean splash  | 15°                                               | "Heads up!"; 1.2s wind-up and a dashed arc to the crossing point                                                           |
| Park dog      | Left        | 2.8                        | 10°                                               | Bark 1s ahead; stopping makes it sit                                                                                       |
| Doorstep dog  | Right       | Tip if missed              | Tip if missed                                     | Bark and arrow 1.2s ahead; stop or counter-tilt                                                                            |
| Wind gust     | Gust side   | `windPush` 14° for 1s      | drift 15°/s for 1s                                | Leaves stream and wind rises 1.2s ahead                                                                                    |
| Bridge sway   | Both        | none                       | `7° sin(2 PI 0.32 t) + 3° sin(2 PI 0.71 t + 1.3)` | Visible deck roll; a steady 4° crosswind bias                                                                              |

Kick checks run in `terrain.test.ts` and `slosh.test.ts`: a pothole at stroll stays under the spill line, and a correct counter-tilt lowers the total spilled across the whole rocking. Measured in M5: a brisk 130 u/s walk into a pothole spills about 25 beans, because the sway has already built up near the spill line. A full hurry over cobbles is in step with the sway and spills about 27 beans a second, and a careful stroll over every ground hazard spills nothing. The rug dropped from 0.6 to 0.4 rad/s, since it is the tutorial bump; a full hurry over it still adds 0 to 40 beans depending on the sway's phase. A kick arrow over the pot shows which way the beans surge, and big kicks (0.8 rad/s or more) shake the screen and buzz the phone. Events trigger at route positions plus seeded timers (cyclists, gusts). Each event is a small state machine: `idle -> telegraph -> active -> cooldown`, with times in `tuning.ts`.

How M9 built the street's characters (`street.ts`):

- **Neighbours** step out of their front door once your pot comes within 350 u, say their line, and walk toward you at 60 u/s. They stop 120 u ahead of the pot's centre. Walking faster than 20 u/s when they arrive, or during the peek, gets the elbow: 2.8 rad/s, 10° and a splash thrown back over the rear rim (`splashFor`, so the first elbow throws 87 beans for "MAYOR WEARS A WIG"). Standing still starts the peek: a hand on the front rim pulls the pot forward at 14°/s for 2.5s, then lets go at 20°/s. Holding it level the whole time pays the dodge. Once they let go, a held counter-tilt tips the pot the other way, so the prompt says to level it again. Spills during the pull blame "Nosy neighbour.".
- **Cyclists** wait for you to pass their trigger, pause 0.4 to 2.6s (seeded), then ring. The bike reaches the pot exactly 1.5s after the bell, with a second ring at 0.6s and a "DING DING!" warning at the left edge until the bike is on screen. Walking faster than 20 u/s when it passes gets a 2.0 rad/s kick and an 8° shake for 0.4s ("Startled by a bike."); standing still gets 0.3 rad/s and the dodge.
- **Drains:** a bean landing on a 56 u grate goes down it, at most 5 per spill event, with a `drip` and "Down the drain.". In Pickup, a zone within 180 u of a route drain shows the grate where the mapping puts it, at y 250. Beans that landed on the grate start just below it, and a free bean over it slower than 40 u/s falls through with a sink. A released bean travels only about 40 u before air friction stops it, so in practice beans fall in when you drop or fling them onto the grate.
- **The market** (M12, `market.ts`): four stalls at 890, 1,930, 2,450 and 5,050 (stall centres the backdrop paints at 260 k + 110) poke a tasting spoon out for 1.2s of every 3s, each on its own seeded offset; the spoon shakes for 0.3s first. Entering the 50 u reach while it is out gets a 1.5 rad/s, 6° poke that throws beans forward ("Poked by a tasting spoon."); passing between pokes pays the dodge. The ladder man at 3,600 turns every 4s and sweeps the path for 1.4s, with the ladder turning broadside 0.4s before; a pot within 70 u of him during the sweep takes 3.5 rad/s, 18° and `splashFor(100)` thrown back ("Ladder to the pot.", plus a running "Ladder: 1. You: 0."). "Mind your backs!" shows during sweeps. Shoppers come every 480 to 800 u of forward progress between 500 and 5,300 (6 to 10s at a stroll; progress rather than time, so standing still or pacing can't farm their dodge coins), never within 350 u before a stall or the ladder and at least 240 u after one, say "Excuse me!" and reach you 2s later: walking gets a 1.8 rad/s, 8° bump, standing still a 0.4 nudge and the dodge. In market Pickup a pair of shoes crosses every 8s and scuffs each bean it passes 40 to 80 u along its way. Bots read the rhythms: they wait short of a reach until a gap leaves time to stroll across it.
- **The park** (M15, `park.ts`): the kid kicks once your pot is 136 u short of a crossing, where a stroll would carry it during the 1.2s wind-up ("Heads up!", a dashed red arc and a dashed ring on the path) and the 0.5s flight. A pot within 55 u of the crossing as the ball lands takes 3.0 rad/s, 15° and `splashFor(90)` thrown the way the ball flies, with a running "Kid: 1. You: 0."; stopping leaves you about 100 u short and pays the dodge. A dog lying in the grass barks once your pot passes it and reaches you 1s later: walking gets a 2.4 rad/s, 10° jump from behind, standing still gets a sitting dog and the dodge. Wet grass starts a 0.35s "whoa" when you step onto it faster than 90 u/s; slowing under 90 or leaning 5° against its side before it ends saves you ("Saved it!", paid once per patch), otherwise the pot lurches 2.4 rad/s and 12° that way ("Slipped on wet grass."). Alternate patches throw opposite ways. Section 0's "a counter-tilt or a stop saves it" overrides the table's "certain above 150 u/s": letting go of a full hurry needs about 0.29s to drop under 90, so above about 150 u/s only an instant reaction or a lean saves you, which is the same thing in practice. In park Pickup a dog comes 20s after it opens and every 35s after: it barks at an edge for 1.5s (a tap within 60 u sends it off), then dashes through the middle of the beans at 520 u/s, knocking beans within 70 u aside at 150 u/s and eating up to 2 that lie on its line ("Dog Tax" packets). Pickup's ground is grass with daisies. Bots heed the kid, the dogs and the whoa like other characters, and the careful and keyboard bots stop hurrying before wet grass.
- **Bots** roll their `heed` chance per event now, not once per run, and every bot leans fully against a character's pull, since a slow steady pull is easy to see. The average bot's `heed` rose from 0.3 to 0.5: a neighbour who walks up talking is easier to read than the plan's 0.3 assumed.

### Ambushes

M27 gave the street, market and park one hard encounter each (Lead Decisions), in `ambush.ts`. Mrs Pryce bursts out of her front door at 6,549, a sale stampedes out of the stall at 6,610, and Bruno the Great Dane wakes on his long lead by a bench at 7,000.

- They reach the walking line within **120 u** of their spot. They burst out once the pot's centre is **60 u** inside that reach, so the stop that dodges everyone else leaves you in it.
- An early tell starts 400 u before that: Mrs Pryce's curtain twitches with two eyes behind it, the stall puts up a SALE! sign, Bruno snores "Zzz". No caption names it.
- The shout comes with a caption naming the escape ("She grabs anyone near her gate. Hurry past! Hold Shift with W.") and a prompt. They come out to a spot just ahead of the pot, so you see them coming, and the arrow over the pot shows which way the beans would go.
- After **1.6s** they lunge. A pot still in reach takes a hit with a 3.2 rad/s kick, a 16° tilt and at least 70 beans, or the next gossip line's need plus 8. Leaning against it halves it, like every character hit. A pot out of reach earns a 5-coin dodge with its own lines and score ("Bruno: 0. You: 1."). From the shout until the lunge lands, Set Down is refused with "No time! Hurry past!", so dropping the pot is no escape (second audit round).
- Hurrying from the shout covers about 230 u in 1.6s and gets you clear. A stroll covers 128 u and doesn't. Unit tests check that a hurry 0.4s after the shout makes it and one 0.8s after doesn't. Hurrying costs a few beans of its own, so it is a trade.
- Bots don't know the trick, like a first-time player: careful bots always get hit and find exactly 3 pages, and average bots only escape when a random hurry happens to be on.

### Landing and Spill Zones

- Each spilled bean becomes a particle from the low rim. Launch `vx = side * (50 + 3d) + v`, `vy = -(60 + 5d)`, gravity 900 u/s². It lands 30 to 120 u away.
- The ledger moves the bean at emission time, using the landing point computed from the arc. The particle is visual only, and the zone shows the bean once its particle lands. Walk mode draws at most 160 particles.
- Landing classification, in order, with caps per spill event:
  1. Bridge: past the deck edge or 30% of beans go to `packets` as "River Tax", at most 30 per event.
  2. Hill slope: the bean lands at the hill start and rolls there visibly at 250 u/s.
  3. Drain grate span: `drain`, at most 5 per event.
  4. Puddle span: `puddle`, at most 10 per event.
  5. Otherwise `loose`, or `pile` once the zone holds 200 loose beans.
- A spill within **150 u** of a zone anchor joins that zone. Otherwise it starts a new zone.
- Top-down mapping: `px = 300 + (x - anchor) * 1.6`, clamped to 50..550. `py` is seeded in 140..560, away from the pot. Gossip overrides these positions.
- The walk scene draws each zone as stamped beans on the ground, a pile mound, and a marker with its count.

### Exit Gate

- "Behind" is the sum of `loose + pile + puddle + drain` over this stretch's zones. Drying beans ride with you, so they don't count.
- The stretch end is a gate drawn as a door, a crossing or a stile. With "Behind" above 0, walking into it plays `buzz`, wobbles the gate and shows "37 beans are still back there." with an arrow.
- The chore board holds "Pick up 37 beans" with `blocks: ['leave-stretch']`. Other blocking chores (clean the mud) use the same action.
- With nothing behind you, the buzz names what else holds the gate: "The lid's still back there. Go and fetch it." for the Pot Lid, or the first blocking chore's label (`gateRefusal`, audit round).

### Pickup Physics

- `createPhysics({ gravity: 0, enableSleeping: true })`. On the bridge sleeping is off and the slide is a per-body drift, not gravity.
- Bean bodies: `Bodies.circle(x, y, 9)` with `frictionAir 0.12`, `restitution 0.25`, `density 0.0015`. They draw as 20 by 12 u bean stamps at the body angle.
- The play rect is x 20..580, y 20..780. Static walls 100 u thick sit outside it. Each step clamps any body that escaped back inside, and a bean outside the rect for 2s respawns next to the pot.
- The pot is a static circle of radius 62 at (300, 700) with its own collision category.
- **Tweezers.** Pressing within 28 u of a bean grabs it plus touching beans within 22 u of it, up to 3 (5 with Wider Tweezers). Held beans leave the Matter world and follow the tip kinematically.
- **Release.** A held bean whose centre is within 71 u of the pot centre (overlapping the pot) goes in: `toPot`. The `pop` pitch rises 4% per bean in a streak, capped at 1.6. Streaks of 10, 25 and 50 get a caption and a bigger pop. Any other release puts the bean back with its velocity capped at 400 u/s.
- **Strain and drops.** Strain is the larger of `JoltMeter({ pointerRef: 9000 })` and carry speed over 1,400 u/s, times 1.25 per extra bean in a clump.
  - Past 0.7 the tweezers tremble, creak (`rattle`, quiet) and the held bean tints red.
  - At 1.0 the beans drop with their velocity: "Too jerky." or "Too fast."
  - Each carry has a 5% "slippery bean" roll. The bean wiggles for 0.4s first. Keeping the pointer under 120 u/s during the wiggle saves it; otherwise "Butterfingers."
- **Phone pinch.** Two fingers down show open tweezers with the tip 50 CSS px above the pinch centre. A grab fires when the pinch closes below 0.75 of its start distance or under 100 CSS px, with a bean within 40 u of the tip. The tip carries the beans. Lifting either finger releases them. Taps (shoo, grate, harvest) resolve on release, with under 12 u of travel and no second finger.
- **Assist Mode** allows a one-finger drag with a 36 u grab radius. `JoltMeter` already reads jolts 40% weaker in Assist Mode.
- The pot mouth glows while beans are held.
- Telemetry records each pickup's duration for the balance pass.

### Scoops

- **Desktop:** press and hold still for 0.35s on the pile mound or on a cluster of 15 or more beans within 50 u, and cupped hands appear. Drag them to the pot. A quick press-drag stays the tweezers.
- **Phones:** a one-finger drag that starts on the pile or a cluster, moving 12 u with no second finger down, scoops.
- Hands carry `k` beans: from the pile `k = 25 + floor(pile / 40)`; from a cluster, up to 25 of the beans within 50 u. Grandma's dustpan: `k = 200 + floor(pile / 10)`.
- Scoops to clear a pile `p0`: `N = c * ln(1 + p0 / (a * c))`, with `a` the base and `c` the divisor. A 400-bean tip pile takes 14 hand scoops. A 9,800-bean doorstep pile takes 17 dustpan scoops.
- Dragging faster than 700 u/s drops 1 bean every 120 ms onto the ground as a loose body, or back to the pile when 200 bodies exist.
- Releasing outside the pot drops the whole scoop with a `splat`: pile beans back on the pile, cluster beans as bodies.

### Pickup Twists

Each stretch's Pickup has one twist, so the 500th bean doesn't feel like the 5th:

| Stretch | Twist                                                                                   |
| ------- | --------------------------------------------------------------------------------------- |
| Kitchen | The cat wiggles for 1s and bats a bean under the fridge (scripted once, then every 20s) |
| Street  | Drain grates swallow slow beans                                                         |
| Market  | Shoppers' feet cross every 8s and scuff beans 40 to 80 u                                |
| Park    | Pigeons and dogs                                                                        |
| Hill    | The ground tilts; resting beans creep downhill at 6 u/s                                 |
| Bridge  | The deck rolls; beans slide 60 to 90 u/s at peak roll toward the edges                  |
| Door    | Grandma's dustpan                                                                       |

### Puddles and the Drying Rack

- Puddle beans draw 1.5 times larger, paler and shiny. A loose bean dropped into a puddle swells.
- Released over the pot, a swollen bean bounces off the rim: "Too swollen. Put it on the rack."
- Released on the drying rack icon at the bottom left of Pickup, it moves to `drying` and starts its own `startTimer('Bean drying', 60_000)`. The rack shows "Drying 3".
- Drying beans ride on your back. When a bean's timer ends, it drops into the pot with a `pop` wherever you are. The gate ignores them.
- How M11 built it: puddles are route spans (the market's three at 1,300, 2,850 and 4,050, the park's one at 3,350). A bean landing in one swells, at most 10 per spill event, and lands inside the puddle's top-down ellipse (y 225, at least 50 u half-wide). In Pickup, dry beans that landed on the ellipse start just below it; a dry free bean resting in a puddle (slower than 40 u/s) swells, "That bean is swimming now.". Swollen beans are bodies of radius 12 that never spell gossip. The pot bounces them back out with a `boing`. The rack shows whenever the zone has a puddle or swollen beans, glows while you carry one, and shows its beans and "Drying N". The zone record keeps swollen beans among its positioned beans with their own count, so `checkZones` checks `loose` and `puddle` separately. Phones show a compact "Drying N 0:42" beside the slosh meter, since the full chip would grow the top bar; wide screens show the `TimerChip` in the rail. The walk view draws the rack on your back.
- The HUD shows one `TimerChip` for the latest finish time. `?fast` shrinks the minute to 3s through `startTimer`.

### Drains and the Coat Hanger

- In Pickup, a loose bean moving slower than 40 u/s over the grate falls in. Tap the grate to open the Drain scene.
- The Drain scene is side-on: grate at y 80, shaft walls at x 180 and 420, gunk at y 640 to 720. Drain beans are Matter circles with gravity 1. A rubber duck, a sock and a key sit in the gunk.
- The hook tip follows the pointer with `damp` rate 12, clamped to the shaft. Releasing the pointer leaves the hook where it is.
- A bean is hooked when the hook's cup is within 10 u of it while the hook moves up. A hooked bean leaves physics and rides the hook.
- The hook can snag the duck, sock or key instead: "A sock. Not a bean." It drops them back on release.
- `JoltMeter({ pointerRef: 5000 })` reads hook velocity. Going over the limit, or scraping a wall faster than 300 u/s, drops the bean back.
- Reaching y < 110 pops the bean onto the pavement next to the grate as a loose bean.
- At most 30 drain beans are simulated. A bean wedged out of reach for 2s respawns on top of the gunk.
- The kitchen's fridge gap reuses this scene with dust bunnies, a fridge magnet and a crayon.

### Pigeons, Dogs and the Cat

- **Pigeons** only appear in Pickup and Grounded. They walk in from an edge at 45 u/s toward the pot, at most 3 at once.
  - A loose bean within 60 u of the path diverts the pigeon. It pecks for 1.0s and the bean is lost: `move('loose', 'packets', 1)`.
  - At the pot without an untangled net, it eats 1 bean every 0.9s from the pot.
  - Tap or click within 50 u of any pigeon to scatter the whole flock in a burst of feathers. They return after 6 to 10s.
- **Park dogs in Pickup:** every 35s a bark comes 1.5s before a dash. Beans within 70 u get a 150 u/s push, and the dog eats up to 2. Tapping it during the bark sends it away.
- **Street pigeons and market gulls (audit round):** the guard step starts on the street. One pigeon comes every 30s there, and at the market a gull does (`bird: 'gull'`): bigger, white, with a yellow beak, a croak and a cackle on arrival. Same shoo rule, same eating, and its beans fill "Gull Tax" packets. Captions and prompts name the stretch's bird.
- **How M13 built pigeons** (`pigeons.ts`): the stretch sets the rhythm (`pigeonEveryMs`: park 15s, hill 40s, bridge 25s; street and market 30s since the audit round) and the first pigeon of a set-down comes after half of it. In Pickup they walk in from either side at a seeded height; in the walk view with the pot down (Grounded) they start 380 u either side of the pot and hop onto its rim. A walking pigeon picks the nearest free bean within 60 u (letters and held beans are out of reach), pecks it for 1s and the bean is lost. On the rim it eats a bean every 0.9s with a "-1" and a running "Pigeon tax: 10." every fifth bean. A click or tap within 50 u of any pigeon, on press for a mouse and on release for a finger, scatters the flock with feathers; they come back 6 to 10s later. Picking the pot up, a new stretch or the kiosk clears the flock. The Drain scene and the window box pause it.
- **Lost beans** (`packets.ts`): every loss goes through `loseBeans` (or `recordLost` after the Pickup world's own ledger move), which tops up the newest open packet of the same cause and stretch. `checkPackets` joins the dev ledger check.
- **The cat in kitchen Pickup:** it walks in for 1.5s, wiggles its bum for 1s with a "!", then bats a loose bean within 150 u under the fridge. A tap during the walk-in or the wiggle always stops it and sends it off for 12s. The first visit comes 5s after a kitchen Pickup opens (never on the opening bean), later ones every 20s. M6 kept every visit stoppable: a player who already taps the cat skips the coat hanger in the kitchen and meets it at the street drains. The first bat's caption teaches the tap. The kitchen's top-down floor starts at y 112, under the fridge, so no bean can hide behind it.

### Seed Packets and the Window Box

- Lost beans fill the newest open packet of the same cause and stretch, up to **8** beans. Labels read like "Pigeon Tax, Park: 7" or "River Tax, Bridge: 8".
- The box has **3** slots, or 6 with the Bigger Window Box. Each slot takes up to **3** packets.
- Steps per slot:
  1. Dig: `RubGesture({ minAmplitude: 30 })`, 6 strokes. Holes stay dug after harvest unless the slot floods.
  2. Plant: tap a packet to select it, then hold on a dug hole for 600 ms. Its beans move to `growing`.
  3. Water: `HoldCharge({ fillMs: 1200 })`. Holding past 1.8s floods the slot: "Drowned it." You dig it again.
  4. Grow: the first watering starts one shared `startTimer('Beans growing', 60_000)`. Planting locks until harvest.
  5. Harvest: tap each pod. Pods have faces, and one is a pea in disguise. Beans go to the pot when it is on the ground, otherwise to `regrown` in the jar, which tips in at the next set-down.
- A "Plant your packets" nudge shows whenever 3 or more packets wait and the box is idle.
- **Grandma's windowsill (audit round):** in the count view, packets waiting while the box's batch grows go onto her windowsill (`sillPackets`). They share the running timer, draw as a planter of sprouts under her window, and go straight into the stew when the batch is due: "Grandma's windowsill grew." So a door with more packets than the box holds never adds a second idle minute.
- **How M14 built it** (`windowBox.ts`, `boxScene.ts`): the box opens over a copy of the last frame drawn at an eighth of its size, which smears into a blur and costs a sixty-fourth of the memory. Up to 6 packet cards show, three to a row; tapping one lifts it, and planting empties your hand, so the next hold on a planted slot waters it. One hold of the can waters every planted slot in the 3-slot box, which is the cost the Bigger Window Box's "every slot needs its own watering" adds back. Flooding fills the watered holes back in and floats their seeds back into their packets. Pods grow one per packet; one pod per batch is a pea in glasses and a moustache. Picked beans go into the pot when it sits on the ground (Pickup, Grounded, the kiosk) and into a jar on your back while you carry it, which tips in at the next set-down or kiosk. The world pauses while the box is open: game time, characters, physics, slosh and pigeons stop, while the drying and grow timers keep running on the wall clock. The phone action bar holds Tilt Left, Set Down, Box and Tilt Right in 375 px; the Box button wobbles every 1.6s while pods wait or 3 or more packets do.

### Gossip

- Twelve lines sit in a queue. Slots per stretch: kitchen 1, street 2, market 2, park 3, hill 2, bridge 2. Unused slots carry forward and end at the bridge.
- **Trigger:** entering Pickup on a zone while a slot is open assigns the first unfound line whose bean need fits the zone's loose beans. "THE CAT KNOWS" is reserved for the kitchen, which spells nothing else. A run that missed it in the kitchen gets it on a later stretch after every other line, so a careful player can still find all twelve (second audit round). Only one line is out at a time. Scripted big hits always spill enough for the next line: the cat's swat throws at least the next line's need plus 8 (64 for "THE CAT KNOWS").
- **Stroke font:** `gossipFont.ts` defines each letter as polylines on a 4 by 6 grid. Beans sit along the strokes 26 u apart (M7 widened this from 18 u to 22 u; M27 widened it to 26 u so smaller spills spell gossip, about 5 beans a letter), turned along the stroke, with letters 44 u tall and 13 u gaps between letters so edge beans of neighbours don't touch. A line's need is the exact number of stroke beans. Every line fits in 2 rows inside 520 u, so the block sits at y 340, or y 560 when a pile takes the middle, clear of the captions and the pot.
- The beans slide into letters over 0.8s with a critically damped spring: "The beans spell something…". Other beans scatter off the block to open floor. Settled letters become still obstacles, so loose beans can't lie on top of them, and they draw a shade darker over a pale chalk glow (M27) so the words stand out at phone size.
- **Jot It Down:** hold J or the button, `HoldCharge({ fillMs: 2000 })`. On the first gossip of the run, bean pickup stays locked until you jot it. Later, the first touch on a spelling bean wiggles the letters as a warning, and a grab scrambles them: "You forgot the gossip already." The line returns to the queue.
- A jotted line is collected. Selling it at the kiosk pays coins. The Notebook stamps sold pages "SOLD" and shares each page as a Weekly Whisper front page.
- **Secret:** "GRANDMA TRAINED THE DOG" reveals letters by a fixed order that makes it readable early. Pages found `p` reveal `round(20 * (p / 12) ^ 0.6)` letters, so the first pages reveal the most and every page adds at least one (M26 front-loaded it from `round(20 * p / 12)`, since an average run finds about 3 pages). The consonants of GRANDMA, THE and DOG come first, so 3 pages read "GR_NDM_ _______ TH_ D_G" and 6 read "GR_NDM_ TR__N_D TH_ D_G". The Notebook (N, the rail button, or Menu then Notebook on phones) shows the pages and the secret so far.

| Queue | Line                   | Letters | Funny rank | Price |
| ----- | ---------------------- | ------- | ---------- | ----- |
| 1     | THE CAT KNOWS          | 11      | 10         | 42    |
| 2     | MAYOR WEARS A WIG      | 14      | 9          | 46    |
| 3     | CHOIR MIMES            | 10      | 1          | 78    |
| 4     | VICAR CHEATS AT BINGO  | 18      | 4          | 66    |
| 5     | LIFEGUARD CAN'T SWIM   | 17      | 2          | 74    |
| 6     | MILKMAN HATES MILK     | 16      | 11         | 38    |
| 7     | BAKER BUYS BREAD       | 14      | 7          | 54    |
| 8     | BUTCHER IS VEGAN       | 14      | 3          | 70    |
| 9     | POSTMAN FEARS SNAILS   | 18      | 8          | 50    |
| 10    | DR LUND SINGS TO LEEKS | 17      | 6          | 58    |
| 11    | WEATHERMAN GUESSES     | 17      | 5          | 62    |
| 12    | JUDGE LOVES CATS       | 14      | 12         | 34    |

Price is `30 + 4 * (13 - rank)` since M26 (it was `15 + 2 * (13 - rank)`), so pages pay 34 to 78 and all 12 pay 672 coins. Exact needs from the font, in queue order: 56, 67, 47, 89, 81, 73, 72, 72, 88, 90, 91 and 73 beans (57 to 106 before M27).

### Rain

- Rain falls only on the hill: **0.12 u/s** of water, which fills the 10 u margin in about 80s. Water lowers the margin directly.
- When water exceeds the resting margin, beans float out at 2 per second: "They're swimming for it!"
- **Pour Off:** set the pot down anywhere and hold P or the button, `HoldCharge({ fillMs: 2400 })`. Releasing between 0.55 and 0.80 pours all water. Below 0.55 pours part of it. Above 0.80 pours beans too: `20 + 400 * (level - 0.8)` beans, at most 100.
- The Pot Lid blocks rain. Setting the pot down stops the rain: "Of course it stops now."

### Hill and Bridge

- **Hill:** 4,000 u with an 1,800 u slope at 12°. Uphill speed is 70%. Every slope spill lands at the hill start, so you walk back down and climb again. Gusts every 8 to 12s (9 to 14s until M26).
- **How M18 built the hill** (`weather.ts`, `route.ts`): a stretch can now have a `slope`, `rain` and `gusts`. The hill's ground ramps 383 u up from 1,000 to 2,800, and forward speed there is 70% (56 u/s at a stroll). A bean landing on the slope flies there, then rolls straight down at 250 u/s to a spot 10 to 70 u before the foot, where the ledger already put it; the first rolling bean of each spill event scores "Gravity: 1. You: 0.". Rain adds 0.12 u of water a second while you carry the pot (the Pot Lid keeps it out), glazes the heap blue, and stops the moment you set the pot down ("Of course it stops now."), resuming when you pick it up. Past the resting margin a flooded pot spills on its own, beans float out 2 a second ("They're swimming for it!"), and the rain gets the blame. Pour Off works with the pot on the ground in the walk view (Grounded), from P or a `HoldButton`: the pot tips over its front corner as the hold fills over 2.4s, a meter shows blue, green and red, and letting go pours some water (under 0.55), all of it (0.55 to 0.80), or all of it plus `20 + 400 * (level - 0.8)` beans into "Pour Tax" packets. Gusts warn for 1.2s with leaves streaming in from the windward edge, a rising wind loop, a warning arrow and "A gust! Lean into it with A.", then blow for 1s: the surface push swells and fades as a half sine peaking at 14° (a flat step rang the slosh spring so hard that even a perfect lean spilled, so this is a plan correction; M26 raised the peak from 8°), and the pot drifts 15°/s downwind (20°/s until M26), fading at 2.5/s afterwards. Riding one out cleanly says "Rode it out." the first three times; gusts pay no coins, since standing still and waiting for them would farm them. In hill Pickup beans never sleep and creep left (downhill) at 6 u/s on a hillside ground with contour lines and arrows ("It's a hill."). Bots pour off at a set water level away from spilled beans (the average bot sometimes over-pours) and a bot that reads a gust leans into its drift as it hits instead of a reaction later. Bots over 8 seeds on the hill: careful 0 beans, keyboard about 80, average about 85 (about 74 of it gusts), against the plan's 160, which stays an M26 target.
- **Bridge:** 2,500 u. The deck roll adds to the pot angle, so you counter it continuously. Gusts every 6 to 10s (7 to 12s until M26).
- **Bridge Pickup:** the deck spans y 200 to 560 with river above and below. Plank gaps are 6 u wide every 60 u. A bean past a deck edge, or slow over a gap, is lost with a `splash`: "Bye, bean." A bean you flung in yourself comes back on a duck's head after 2s: "Grandma saw that."
- **How M19 built the bridge** (`weather.ts`, `emit.ts`, `bridge.ts`, `pickupWorld.ts`): plan correction: the Pickup pot always sits at (300, 700), below a deck that ends at y 560, so the deck runs up the screen instead, from x 50 to 550, with the river either side and planks across it every 60 u with 6 u gaps; the roll slides beans left and right toward the edges. Walking, the pot's drift is the deck roll (`7° sin(2π 0.32t) + 3° sin(2π 0.71t + 1.3)`) plus a steady 4° crosswind lean plus any gust, so standing still and doing nothing pours beans out ("It sways."); spills while the deck leans past 6° blame "The bridge swayed.". The walk view shows the roll with a far handrail and a near knee-high rail that rise and fall opposite each other, and a duck paddles in the river. 30% of the beans of a spill, at most 30 per spill event, splash into the river below the deck as "River Tax" packets ("Bye, bean."), tip-overs included. In Pickup beans start on the planks clear of the gaps; the slide reaches 60 to 90 u/s at the roll's big peaks (`SLIDE_ROLL` 8.5°; its smaller peaks slide 25 to 50 u/s); a bean past an edge, or slower than 40 u/s over a gap, sinks for good; a bean you let go of in the last 1.5s that goes past an edge rides a duck for 2s and comes back to the edge ("Grandma saw that."); a top arrow shows which way the deck tips. Bots over 8 seeds on the bridge: careful 0 beans, average about 56 (about 18 lost to the river), keyboard about 95, mostly to gusts, against the plan's 150, which stays an M26 target.

### Tip-Over

- If `|psiEff|` stays above **50°** for 300 ms, the pot teeters on one edge for 0.5s with a creak. Turning the target 3° or more back toward level in that window saves it: "Saved it!" (0.1s of a key at 30°/s).
- Set Down is refused while the pot teeters ("Not now! It's on one edge. Tilt back!") and while beans pour over the rim ("Not mid-spill!"), unless rain has flooded the pot, so putting it down never cancels a fail under way (second audit round).
- A tip spills at most **600** beans: 200 loose bodies and a 400-bean pile. It always opens the replay. On the bridge the pot tips onto the deck, and only the per-event river cap applies.
- The Taller Pot tips at 42°. Its psi kicks are not multiplied, and gusts and deck roll alone peak below 35°, so only your own tilt can tip it. Its shop text says "Tips over at a smaller angle".
- M21 made every tip-over knock the Pot Lid off too, with its clang and the "Fetch the lid" chore, closing M16's open question. Since the audit round the lid holds half the loose beans in first: 100 loose and the 400-bean pile, or 20 loose on Grandma's steps.
- M17 made that rule exact instead of trusting the peaks: with the Taller Pot, the tip timer only runs while your own pot angle leans at least 10° (`TALL_OWN_TILT`) the same way as the total angle. A level or counter-tilted pot never tips from bumps, pulls or gusts, however they stack. Leaning 40° with a park dog's 10° jump tips it; the plain pot survives the same lean and jump.

### Coins and Upgrades

- Clean bonus per stretch: kitchen 20, street 30, market 40, park 40, hill 50, bridge 60, Grandma's Door 30. Full pay at 5 spilled beans or fewer, half at 25 or fewer. The door has no kiosk, so Grandma pays its bonus when she starts counting ("Not a bean on her steps."), and the ending lists Clean Stretches and the coins you finished with.
- The shop disables Grippy Shoes once no wet grass lies ahead and the Pigeon Net once no birds do, with the reason under the row ("No wet grass ahead. The park's behind you.").
- Each dodged telegraphed event pays 5 coins (2 until M26): the door cat, each neighbour, cyclist, shopper, stall spoon and the ladder so far. Characters you can pass more than once (the cat, the spoons, the ladder) pay once, for the first forward pass, so walking back and forth can't farm coins.
- Walking off a cleared stretch opens the kiosk (M10), which pays the clean bonus at once. Beans that left the pot on the stretch count, except the cat's opening bean. Pages sell there for their table price, one Sell button each, and the shop lists only the upgrades whose milestone has made them work.
- Gossip sales pay 34 to 78 coins a page (17 to 39 until M26).
- The first plan had an average player earn about 340: 230 from 9 pages, 55 from dodges and 55 from bonuses. M26's bots showed that can't happen (section 5), so dodges and pages pay more. Measured over 20 seeded runs from the kitchen to the bridge: the average bot earns about 248 (about 3 pages, 12 dodges and a few half bonuses), the keyboard bot about 272, the careful bot about 281 (no pages, 19 dodges, most bonuses) and the sloppy bot about 279 (about 4 pages, 7 dodges). The four cheapest upgrades cost 235 and all six cost 415, so each kind of player buys four, and the luckier ones five. Unlucky runs fall short: the poorest average run of the 20 earned 136.

| Upgrade           | Cost | Helps                                           | New chore or downside                                                                                                  |
| ----------------- | ---- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Wider Tweezers    | 50   | Grab radius 1.6 times; clumps up to 5 beans     | Strain limit 0.65 and a 12% slippery-bean roll                                                                         |
| Grippy Shoes      | 55   | The "whoa" save window grows from 0.35s to 0.7s | Mud after the park: "Clean the mud off your shoes", 24 rub strokes, blocks `leave-stretch`                             |
| Pigeon Net        | 60   | Pigeons can't eat from the pot once untangled   | It tangles when the first pigeon of a set-down arrives: 3 knots of 2 circles each                                      |
| Bigger Window Box | 70   | 6 slots instead of 3                            | Every slot needs its own watering hold                                                                                 |
| Pot Lid           | 80   | Spill rate capped at 6 beans/s; character hits throw a quarter; tip-overs scatter half; blocks rain | Rattles: a kick over 1.2 rad/s pops `floor((J - 1) * 3)` beans. The ladder and the ambushes launch it with a full spill unless you lean against them, and you fetch it |
| Taller Pot        | 100  | Margin 20 u instead of 10; damping 0.26         | Tips over at a smaller angle (42°)                                                                                     |

- Untangling uses `CircleGesture` centred on each knot. Circling the wrong way tightens the knot and adds one circle.
- **How M17 built the other three** (`net.ts`, `upgrades.ts`): the shop now sells all six. The Taller Pot sets `options.tall` (margin 20 u, damping 0.26, the 42° own-tilt tip rule in section 3's Tip-Over) and draws 1.4 times deeper in the walk view and at the kiosk; on flat ground a 10s hurry spills nothing, against 45 beans with the plain pot. The Pigeon Net goes over the pot at every set-down (Grounded or Pickup) and the first pigeon that walks in ties it into 3 knots of 2 circles, with neighbouring knots turning opposite ways ("The net's in knots."). Each knot shows a curved arrow and the circles it still needs; a press within 34 u starts circling it, a green or red arc shows the turn so far, a wrong-way circle adds one (up to 5, "Wrong way. Tighter now."), and the last knot pulls the net tight ("Net's on."), flinging perched pigeons off. While tangled it protects nothing. Untangled, a pigeon on the rim pecks the net twice with a boing and a "?" and flies off ("The net says no."); pigeons still eat loose beans in Pickup. In Pickup a knot press beats taps and tweezers, and a second finger turns it into a pinch. The side-on knots draw 1.2 times larger and sit over your dangling arm, since that pot is smaller on screen. The Bigger Window Box adds a second row of three bare slots the step after you buy it, and every slot then needs its own watering hold.
- **How M16 built three of them** (`upgrades.ts`): the shop now sells the Wider Tweezers, Grippy Shoes and Pot Lid; the other three stay `built: false` until M17. Wider Tweezers multiply every grab radius by 1.6 (mouse, Assist and the pinch's), lift clumps of up to 5, read strain against a limit of 0.65 (so the tremble and the drop come sooner) and roll a 12% slippery bean; they also draw wider open. The Pot Lid caps the slosh spill at 6 beans a second; any kick harder than 1.2 rad/s, from the ground or a character, rattles it and pops floor((J - 1) * 3) beans out on the kick's side ("The lid rattles." the first time). A hit that throws a splash (the cat's swat, an elbow, the ladder, the football) knocks it off instead: it spins 240 u the way the hit throws, a "Fetch the lid" chore holds the gate, a bobbing arrow marks it, and walking the pot over it puts it back. A new stretch puts it back too. M18 made it block rain. Grippy Shoes double the "whoa" window to 0.7s and draw zigzag soles; leaving the park in them adds "Clean the mud off your shoes" at the kiosk, where a muddy boot card above the panel takes 24 rub strokes ("Squeaky clean. Off you go."), and Next Stretch waits for it. The editor comments on each purchase. Since M21 a tip-over knocks the lid off too.

### Ending Sequence

- **Doorstep dog:** on the last stair the dog barks with an arrow from the right, then jumps 1.2s later. Stopping or a counter-tilt of 10° toward it saves you: "Made it!" One bean then moves `pot -> hidden` and rolls under the doormat.
- **A missed dodge** tips the whole pot: 40 loose beans and the rest in a pile, with 0.3 time scale for 0.6s and the replay. One bean still goes to `hidden`. Grandma hands you the dustpan.
- **Count gate:** the chore board blocks `count` until every place except `pot`, `hidden`, `packets`, `growing` and `regrown` is 0. Since the audit round unplanted packets don't hold it: you plant them while she counts, and the prompt says so.
- **Count:** `n = round(9,999 * p^3)`, capped at the pot count, where `p` runs from 0 to 1 at a steady pace over 14s, or until the window box's running batch is due if that is later (`countAt`, audit round). So she reaches the shortfall just as the beans grow. `tick` plays with pitch rising from 0.8 to 2.0. If beans are still growing, the count holds at the shortfall ("Still 16 short, dear.") and resumes after the harvest. Captions appear at 1, 2, 3, 50 "This'll take a while.", 1,000 "Tea break? No.", 4,321 "Ooh, my knee.", 6,000 "This one's been in a puddle.", 7,777 "Lucky bean!", 9,999 "One is missing."
- **Doormat:** drag the mat up 80 u. The bean appears; drag it into the stew: `move('hidden', 'pot', 1)`.
- **Taste:** a `squish` at pitch 0.6, "Hmm.", salt with `rattle`, the dog's `sneeze`, then the stew spells the secret with the letters you earned, then `EndingScreen`.
- **How M21 built the door** (`door.ts`, `art/grandma.ts`, `walkScene.ts`): Grandma Doris stands in her doorway past the top step at route x 900, her small white dog with a pink bow sits at x 864, and the WELCOME mat lies at x 885; the backdrop's purple door moved there. The dog barks once your feet pass x 600 on the steps ("WOOF!", "Oh! He gets so excited.", a warning arrow and "The dog! Let go of W, or lean on D."), leaps in the last 300 ms, and lands 1.2s after the bark. Standing still (under 20 u/s) or leaning 5° toward it saves you: "Made it! He only got one bean." and the bean hops onto the mat ("One rolled under the doormat. Grandma didn't see."), leaving a lump. Plan correction: the plan's 10° counter-tilt poured beans out of a full pot, which spills from 10.1°, so the lean uses the same 5° as every other character; a lean while climbing still costs a bean or two to the stair kicks, so stopping is the safe answer. Walking on tips the whole pot: one bean still hides, the lid flies, 40 beans scatter and the rest land in one pile, with slow motion, a shake, "Oh dear. Again." and an auto replay. In door Pickup pile scoops use Grandma's dustpan (`dustpanScoop`, 1,195 beans from a 9,959 pile, 17 to 18 scoops) and draw as a heaped red-handled pan. Pile mounds stop growing at 120 u in Pickup and 80 u in the walk view so a whole pot stays workable. The top step at x 720 stops you; with the dog done, reaching it starts the count, unless beans lie on the ground, sit down a drain, are drying, or wait in seed packets, when Grandma says what is missing, buzzes, and the prompt says how to fix it. "Plant N seed packets" and "Let N beans dry" chores block the `count` action, and the pick-up and fish chores now block it too. Bots heed the barking dog. Since the audit round seed packets no longer hold the count, and the plant chore is gone.
- **How M22 built the count** (`door.ts`, `doorScene.ts`, `ui/Ending.tsx`): the count view is Grandma's doorstep close up: her purple door, Grandma counting with a raised finger, her dog, a black stew pot and the doormat. The pot goes into the stew (the jar tips in too) and she counts 9,999 (t / 14s)^3 out loud in big marker numbers, with a tick every 75 ms rising from pitch 0.8 to 2.0 and her lines in a bubble at 1, 2, 3, 50, 1,000, 4,321, 6,000, 7,777 and 9,999. Beans still growing hold her at the shortfall ("Still 16 short, dear.", and a prompt to open the box); picked pods go straight into the stew and she counts them at 12 a second. At 9,999 a sad trombone plays and she says "One is missing."; dragging the mat up 80 u rolls it back (a short lift drops it), the bean glints, and dragging it within 120 u of the stew makes 10,000 with a pop, a coin and a ding. The taste is scripted: "Hmm." with the spoon at 1.4s, "Needs salt." with the shaker at 2.8s, the dog's "Atchoo!" at 4s, then the stew's beans fly into the secret over a paper panel (letters 56 u tall, unearned letters as a short line of beans), "Every year, dear. It builds character." with a laugh at 3s, and the ending at 7s. `EndingScreen` shows "Ten Thousand.", the secret as revealed, how many letters your pages earned, and Picked Up, Lost for Good, Time, Gossip and Biggest Spill.

### Share Cards

- **How M23 built them** (`ui/Ending.tsx`, `art/whisper.ts`, `ui/Notebook.tsx`): the ending's Share card reads "Grandma Got Her 10,000" with Picked Up, Lost for Good, Time and Gossip, the biggest spill's still as the picture (none before any spill of 3 or more), and the funniest page you found as the footer ("Town gossip: CHOIR MIMES"), or the secret so far with no pages. Each Notebook page has **Share This Page**: a Weekly Whisper front page drawn on tap (960 x 720, freed when the dialog closes) with the masthead, an EXCLUSIVE stamp, the line spelled out in beans and the editor's verdict, on a card with its page number, the beans it took and its price. The shared `ShareModal` offers Share where the browser can share files, and Download otherwise.

## 4. Coverage Table

Every line of the Game 2 section of `DESIGN.md`:

| DESIGN.md line                                                      | Mechanic                                                                | Milestone     |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------- |
| Pitch: carry 10,000 beans, pick up every one you spill              | Start screen copy; ledger starts at 10,000 in the pot; exit gate        | M1, M2, M4    |
| Working title 10,000 Beans, avoiding the Hasbro and Steam names     | Title everywhere; copy never says "Spill the Beans"                     | M4            |
| Story: Grandma needs exactly 10,000 and counts at the door          | Start screen story; the count scene                                     | M4, M22       |
| Goal: brimming pot of exactly 10,000 from kitchen to door           | Ledger; margin of 10 u at a full pot; 7-stretch route                   | M1, M5        |
| Goal: can't leave a stretch until every spilled bean is picked up   | Exit gate and "Pick up N beans" chore blocking `leave-stretch`          | M2            |
| Goal: lost beans must be regrown before the final count             | Planting blocks `count`; the count waits on the last batch              | M14, M22      |
| Route 1: kitchen, the cat by the door                               | Cat at the kitchen door; counter gag; fridge bats with a wiggle         | M6            |
| Route 2: street, neighbours bump you and ask what's in the pot      | Neighbour peek and lean; elbow if you walk on                           | M9            |
| Route 3: market, crowds, stalls and a man with a ladder             | Crowd bumps, tasting spoons, ladder swing                               | M12           |
| Route 4: park, kid with a football, off-lead dogs, pigeons          | Football arc, dog jumps and dashes, pigeons                             | M13, M15      |
| Route 5: hill, beans roll down to the start of the hill             | Slope landings move to the hill start with a roll animation             | M18           |
| Route 6: rope bridge sways; river beans are lost for good           | Two-sine deck roll, gusts, capped river share, sliding deck in Pickup   | M19           |
| Route 7: Grandma's door, small dog jumps on the last step           | Telegraphed doorstep dog                                                | M21           |
| Core loop 1: walk and keep the pot level                            | Walking, rate-controlled tilt with lag, slosh spring                    | M1            |
| Core loop 2: spill                                                  | Weir spill rate, particles and spill juice                              | M1            |
| Core loop 3: set the pot down, pick up every bean with tweezers     | Pickup scene with kinematic tweezers                                    | M1, M2        |
| Core loop 4: guard the pot on the ground from pigeons               | Pigeon AI and flock shooing; pigeons from the street on, gulls at the market | M13, audit    |
| Core loop 5: walk on                                                | Gate opens; next stretch through the kiosk                              | M2, M10       |
| Picking up: pinch or drag each bean, one at a time                  | Mouse drag, two-finger pinch, Assist one-finger drag; small clumps      | M1, M3        |
| Puddle beans swell and dry in the sun for 1 minute                  | Swollen state, drying rack in the sun on your back, 60s per-bean timers | M11           |
| Drain beans are fished out with a bent coat hanger                  | Drain scene and hook rules; fridge gap variant                          | M8            |
| Every lost bean comes back as a seed packet                         | Packets of up to 8 per cause and stretch                                | M13           |
| Plant it in a window box: dig, plant, water                         | Rub to dig, hold to plant, hold to water                                | M14           |
| It grows in 1 minute, in real time                                  | Shared 60s `startTimer`                                                 | M14           |
| A bigger window box grows more beans at once                        | 6 slots                                                                 | M17           |
| Gossip: spills spell gossip, sold to the paper, all reveal a secret | Stroke font, Jot It Down, kiosk sales, hangman secret                   | M7, M10, M22  |
| Potholes, cobblestones, kerbs and stairs                            | Terrain kicks scaled by speed squared                                   | M5            |
| Wind on the hill and the bridge                                     | Telegraphed gusts with drift and push                                   | M18, M19      |
| Rain slowly overfills the pot                                       | Water level lowers the margin; Pour Off                                 | M18           |
| A cyclist rings their bell right behind you                         | Bell telegraph, startle when walking                                    | M9            |
| Coins: bonus for each stretch with no spills                        | Tiered clean bonus 20 to 60                                             | M10           |
| Coins: gossip pages sold to the newspaper                           | Kiosk sale prices 34 to 78                                              | M10           |
| Upgrade: Pot lid stops big spills; rattles and beans hop out        | Rate cap 6/s; hits throw a quarter, tips scatter half; rattle pops on kicks; launched by the ladder and ambushes | M16, audit    |
| Upgrade: Grippy shoes, less slipping; clean mud after the park      | Longer save window; mud chore for owners                                | M16           |
| Upgrade: Wider tweezers pick faster but drop more beans             | Bigger grab and clumps; lower strain limit                              | M16           |
| Upgrade: Taller pot sloshes less; tips over more                    | Margin 20 u; tip angle 42°                                              | M17           |
| Upgrade: Pigeon net protects the pot; untangle before each use      | Net blocks pot pecks once untangled; knot circles race the first pigeon | M17           |
| Upgrade: Bigger window box regrows more; more watering              | 6 slots, each watered                                                   | M17           |
| Length: each of the 7 stretches takes 10 to 15 minutes              | Pacing model in section 5                                               | M26, M27      |
| Length: regrowing adds 1-minute waits shared across the box         | One grow timer per batch                                                | M14           |
| Length: 1 to 2 hours average, longer when unskilled                 | Bots estimate 45 to 50 min average and 81 unskilled; M27 decides        | M26, M27      |
| Ending: count, 9,999, doormat bean, stew, taste, salt               | Count, Doormat and Taste scenes                                         | M22           |
| Shareable: the whole pot tipping over on Grandma's doorstep         | Doorstep tip with slow-motion replay and Share                          | M20, M21, M23 |
| Shareable: a "beans picked up" count on the share card              | Picked-up stat                                                          | M23           |
| Shareable: the funniest gossip spelled out in beans                 | Weekly Whisper page cards from the Notebook; footer on the ending card  | M7, M23       |
| Controls: walk by holding a thumb or W; faster means more slosh     | `isHeld` walking, slide or Shift to hurry, sway resonance               | M1, M3        |
| Controls: tilt the phone or A and D to keep level                   | Motion through `TiltAxis`; rate-controlled keys and buttons             | M1, M3        |
| Controls: pinch with two fingers or click and drag to pick up       | Pinch grab and mouse drag                                               | M1, M3        |
| Controls: tap and hold or click and hold to plant and water         | Window box holds                                                        | M14           |
| Build note: beans in the pot are a number                           | Ledger `pot` count                                                      | M1            |
| Build note: only spilled beans are bodies, about 200; piles scooped | Zone cap of 200 and scoops                                              | M2            |
| Build note: small bodies run well on mid-range phones               | Sleeping circles, cached stamps, frame budget checks                    | M2, M5, M25   |

Cross-cutting decisions from "Decisions So Far" and "Shared Foundation":

| Decision                                                                 | How this game meets it                                                                 | Milestone     |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------- |
| Waits run in real time, about 1 minute, unskippable, overlapping a chore | Drying rides on your back; growing overlaps walking; the count waits on the last batch | M11, M14, M22 |
| No paid skips, free, no server, no saving                                | No purchases, no network, no storage APIs                                              | M4            |
| Hand-drawn scrappy art, no external images                               | Sketch helpers and cached layers only                                                  | M1 to M24     |
| Matter.js physics                                                        | Pickup and Drain scenes                                                                | M1, M8        |
| Keep the screen awake and warn before leaving                            | `StartScreen` session, `useLeaveWarning`                                               | M4            |
| Fail replays and share cards                                             | Replay recorder and `renderShareCard`                                                  | M20, M23      |
| One controls layer; settings for sound, sensitivity, Assist Mode         | Shared input and `SettingsPanel` with a Level Here button                              | M3, M4        |

## 5. Pacing Model

Per stretch, time is walking plus pickup plus drains plus chores plus the kiosk:

`T = W + n * (1 - f) * tb / 60 + nd * td / 60 + C + K` minutes, where:

- `W` is walking and events in minutes, including walking back to zones.
- `n` is beans spilled and `f` is the share lost for good, which needs no pickup.
- `tb` is seconds per bean picked: 1.5 average on desktop, 2.3 unskilled, and 1.3 times those on phones. It mixes singles at about 2.5s, clumps of 2 or 3 at about 3s a grab, and cluster scoops of about 20 at 4s. **M3 measured a scripted floor: a pinch bot at the iphone-se preset potted 51 beans in 30s of game time, 0.6s a bean, with clumps averaging about 1.7 beans a grab. Real players add finding, aiming and drops, so the 1.5s guess stands until Ekansh times real 50-bean pickups on a desktop and a phone (Owner Follow-Ups).**
- `nd` is drain beans and `td` is seconds each: 15 average, 25 unskilled.
- `C` is chores, gossip jotting, window box tending and tutorial reading. Grow and dry waits overlap other work, so they add no time.
- `K` is the kiosk visit after the stretch.

The two tables below are the first plan's targets. "What M26's Bots Measured" after them replaces their walking column with measurements.

Average player:

| Segment      | W   | n                                                    | f    | Pickup desktop | Pickup phone | Drain | C   | K   | Total desktop | Total phone |
| ------------ | --- | ---------------------------------------------------- | ---- | -------------- | ------------ | ----- | --- | --- | ------------- | ----------- |
| Start        |     |                                                      |      |                |              |       | 0.5 |     | 0.5           | 0.5         |
| Kitchen      | 1.5 | 55                                                   | 0    | 1.38           | 1.79         | 0.25  | 1.0 | 1.0 | 5.1           | 5.5         |
| Street       | 4.5 | 110                                                  | 0    | 2.75           | 3.58         | 1.25  | 1.0 | 1.0 | 10.5          | 11.3        |
| Market       | 4.5 | 140                                                  | 0    | 3.50           | 4.55         | 0.75  | 1.0 | 1.0 | 10.8          | 11.8        |
| Park         | 5.0 | 150                                                  | 0.15 | 3.19           | 4.14         | 0.50  | 2.5 | 1.0 | 12.2          | 13.1        |
| Hill         | 5.5 | 160                                                  | 0.05 | 3.80           | 4.94         | 0     | 2.0 | 1.0 | 12.3          | 13.4        |
| Bridge       | 4.0 | 150                                                  | 0.30 | 2.63           | 3.41         | 0     | 2.0 | 1.0 | 9.6           | 10.4        |
| Door         | 2.0 | half the players tip: 40 loose and 17 dustpan scoops |      | 1.0            | 1.3          |       | 2.0 |     | 5.0           | 5.3         |
| One tip-over |     | 600                                                  | 0    | 3.75           | 4.88         |       |     |     | 3.8           | 4.9         |
| Total        |     |                                                      |      |                |              |       |     |     | **69.8**      | **76.2**    |

Pickup, drains and tip cleanup take about 24.7 of 69.8 minutes on desktop, 35%.

Unskilled player: `f` as above, spills times 1.8, `tb` 2.3s, drain beans times 1.5 at 25s, `W` and `C` times 1.3, two tip-overs, and 80% of them tip at the door. The bridge `C` rises to 3.5 for two window box batches.

| Segment       | W    | n                               | Pickup = n(1-f)2.3/60 | Drain | C    | K   | Total     |
| ------------- | ---- | ------------------------------- | --------------------- | ----- | ---- | --- | --------- |
| Start         |      |                                 |                       |       | 0.75 |     | 0.8       |
| Kitchen       | 1.95 | 99                              | 3.80                  | 0.63  | 1.30 | 1.0 | 8.7       |
| Street        | 5.85 | 198                             | 7.59                  | 3.13  | 1.30 | 1.0 | 18.9      |
| Market        | 5.85 | 252                             | 9.66                  | 1.88  | 1.30 | 1.0 | 19.7      |
| Park          | 6.50 | 270                             | 8.80                  | 1.25  | 3.25 | 1.0 | 20.8      |
| Hill          | 7.15 | 288                             | 10.49                 | 0     | 2.60 | 1.0 | 21.2      |
| Bridge        | 5.20 | 270                             | 7.25                  | 0     | 3.50 | 1.0 | 17.0      |
| Door          | 2.60 | 80% tip: 40 loose and 17 scoops | 2.40                  |       | 2.60 |     | 7.6       |
| Two tip-overs |      | 1,200                           | 11.50                 |       |      |     | 11.5      |
| Total         |      |                                 |                       |       |      |     | **126.2** |

- The first plan's average total was **70 min on desktop and 76 on phones**, and **2 h 6 min** unskilled. M26 found its walking column far too long (below).
- Window box tending totals about 3.5 min for an average player: about 80 lost beans fill about 10 packets, which take 2 or 3 batches of 3 slots at about 40s of tending each.

### What M26's Bots Measured

`runRoute` walks one game from the kitchen to Grandma's top step, 20 seeds per bot. After each spill the bot does what a player would: it sets the pot down by beans within 400 u, spells and jots any gossip line the zone fits, and puts the beans back; beans further away (the hill's foot) wait for one trip back from the gate. It sells every page at each kiosk and buys nothing. Picking up takes no simulated time, so pickup minutes come from the formula above.

| Stretch | Bot walking (min) | Walk back | Average n | Keyboard n | Sloppy n | Careful n | Lost (average) | Pages (average) |
| ------- | ----------------- | --------- | --------- | ---------- | -------- | --------- | -------------- | --------------- |
| Kitchen | 0.25              | 0         | 44        | 35         | 61       | 0         | 0              | 0.45            |
| Street  | 1.36              | 0         | 131       | 99         | 240      | 0         | 0              | 1.15            |
| Market  | 1.30              | 0         | 114       | 75         | 206      | 0         | 0              | 0.25            |
| Park    | 1.28              | 0         | 126       | 95         | 241      | 0         | 0              | 0.75            |
| Hill    | 1.06              | 1.34      | 127       | 250        | 262      | 20        | 3              | 0.35            |
| Bridge  | 0.63              | 0         | 119       | 177        | 191      | 20        | 34             | 0               |
| Door    | 0.15              | 0         | 45% tip   | 35% tip    | 65% tip  | 0% tip    | 0              | 0               |

- Every average-bot stretch is within 25% of its budget, and the sloppy bot spills 1.8 times as much from the kitchen to the bridge, as the unskilled table assumes. `balance.test.ts` checks both.
- Keyboard players lose about twice what tilting players do on the hill: keys turn the pot at 30°/s, short of what a gust asks. The bridge and the characters cost them less.
- Bots never tipped the pot outside the door in 80 runs, so the estimate below has no tip-over row. Each one adds about 4 min.
- Drains caught under one bean per run, not the 11 the first plan assumed, so drains add almost nothing.
- The average bot finds about 3 pages, not 9. A page needs one spill of 57 to 106 beans, and only character hits throw that many, so pages track the big hits you take while a slot is open.
- Round 9 measured the keyboard gap over the same 20 seeds. With keys at 30°/s the keyboard bot spills 250 on the hill and 177 on the bridge, against the tilting average bot's 127 and 119. At 45°/s it spills 175 and 138; at 60°/s, 146 and 117. Every other stretch moves by 4 beans or fewer. The phone tilt buttons share the rate. This is a feel change, so it waits for Ekansh's M27 desktop run.
- Round 10 measured keys that speed up while held. A key that starts at 30°/s and only speeds up after 0.3s barely helps (234 and 178): the bot loses its beans in a gust's first 0.3s. A key that starts at 30°/s and rises to 75°/s over the first 0.2s spills 153 and 127, close to 60°/s, while a 0.1s tap still turns about 4° (3° at 30°/s, 6° at 60°/s). M26c lets Ekansh try all four speeds in dev builds.
- Round 10 also measured the second length lever. With `REPOSE` at 9 instead of 10, the average bot spills 798 beans from the kitchen to the bridge instead of 662 (+21%), mostly on the hill and the bridge, and the sloppy bot 1,359 instead of 1,201. At `tb` 1.5s that adds about 3.4 min on desktop and 4.4 min on phones, so it can't close a gap of 10 min or more alone.
- Round 11 measured the other two levers on scratch copies of the route, over the same 20 seeds. Minutes use the estimate's method below:
  - Doubling the characters on the street, market and park adds 3 neighbours, 2 cyclists, 4 stalls, 2 kicks and 2 dogs. The average bot then spills 897 beans instead of 662 and walks 0.4 min longer. That adds about 6.4 min on desktop and 8 min on phones. Pages rise from 3.0 to 4.2 a run, and the poorest run's coins from 136 to 200.
  - One encounter at a time, the average bot spills about 74 more beans per extra football kick, 67 per neighbour, 40 per cyclist, 21 per stall and 7 per dog. Each one reshuffles later random events, so these carry about 25 beans of noise.
  - Walking the street twice adds 191 beans and 1.4 min of bot walking. With a stretch's chores and kiosk visit, that is about 9 min on desktop and 10 on phones, plus 1.3 pages and 92 coins. A second park adds about the same. A real extra stretch needs its own name, backdrop and characters.
  - If real runs match the bots' 45 min, no single lever closes the 15 min gap. Doubling the middle characters and adding one stretch come to about 15 min together.

The estimate takes the bots' walking times 1.5 times over for reading captions, hesitating and setting down (1.95 times for unskilled players), the walk-backs as measured, `tb` and `td` as above, the door's dustpan at 17 scoops of 4s, and `C` and `K` from the first plan:

| Player                         | Walking | Pickup and drains | Chores and kiosk | Total  | Pickup share |
| ------------------------------ | ------- | ----------------- | ---------------- | ------ | ------------ |
| Average, desktop (`tb` 1.5s)   | 10.4    | 16.7              | 18.0             | **45** | 37%          |
| Average, phone (`tb` 1.95s)    | 10.4    | 21.6              | 18.0             | **50** | 43%          |
| Keyboard bot, desktop          | 11.4    | 17.8              | 18.0             | **47** | 38%          |
| Sloppy, phone (`tb` 2.3s)      | 12.6    | 47.0              | 21.6             | **81** | 58%          |

- The first plan's walking column was 5 to 7 times what bots take. Stops for characters cost seconds, not minutes, so the run lands near 45 to 50 min for an average player, under the 1 to 2 hour goal, with pickup at 37% to 43%.
- `tb` and the walking factor are guesses. Ekansh's real numbers replace them when he has them (Owner Follow-Ups): `__game.beans.stats()` reports minutes per stretch by activity, seconds in Pickup per bean potted, and the pickup share.
- If real runs land under 60 min, the levers are, in order: more character encounters on the middle stretches (more stops, dodges, coins and big hits, so more pages; about 6.4 min for doubling them), then `REPOSE` 1 u lower (more slosh spills, which raises the pickup share; about 3.4 min), then longer stretches or an extra stretch (about 9 min each). If a run passes 110 min, raise `REPOSE` or lower `WEIR_K`.

### What M27's Bots Measured

M27 built the Lead Decisions: the rising key speed, `REPOSE` 9, gossip letters that need fewer beans, doubled characters on the street, market and park, an ambush on each, longer stretches, and a pour-off prompt from 1.5 u of leftover rain water. The estimate above is now code: `runMinutes` in `pacing.ts` turns a `runRoute` run into minutes with the same factors, and `balance.test.ts` checks that an average run lasts 65 to 120 min on a desktop and on a phone. Over 20 seeds per bot:

| Stretch | Length  | Average walking (s) | Average n | Keyboard n | Sloppy n | Careful n | Lost (average) | Pages (average) |
| ------- | ------- | ------------------- | --------- | ---------- | -------- | --------- | -------------- | --------------- |
| Kitchen | 1,500 u | 19                  | 46        | 36         | 71       | 0         | 0              | 0.4             |
| Street  | 7,800 u | 116                 | 330       | 283        | 469      | 88        | 0              | 2.45            |
| Market  | 7,800 u | 107                 | 314       | 268        | 500      | 83        | 0              | 1.4             |
| Park    | 8,400 u | 106                 | 340       | 339        | 575      | 109       | 0              | 2.2             |
| Hill    | 6,000 u | 95, plus 143 back   | 254       | 271        | 388      | 50        | 6              | 0.85            |
| Bridge  | 4,000 u | 61                  | 173       | 251        | 323      | 38        | 51             | 0               |
| Door    | 800 u   | 9                   | 45% tip   | 35% tip    | 65% tip  | 0% tip    | 0              | 0               |

| Player                                    | Walking | Pickup and drains | Chores and kiosk | Total   | Pickup share |
| ----------------------------------------- | ------- | ----------------- | ---------------- | ------- | ------------ |
| Average, desktop (`tb` 1.5s)              | 15.2    | 36.3              | 18.0             | **70**  | 51%          |
| Average, phone (`tb` 1.95s)               | 15.2    | 47.0              | 18.0             | **80**  | 58%          |
| Keyboard bot, desktop                     | 16.7    | 35.2              | 18.0             | **70**  | 49%          |
| Careful, desktop                          | 17.4    | 8.9               | 18.0             | **44**  | 20%          |
| Sloppy, desktop                           | 14.6    | 57.9              | 18.0             | **91**  | 64%          |
| Sloppy at the unskilled pace, phone       | 18.3    | 88.5              | 21.6             | **128** | 69%          |

- The average run went from 45 to 70 min on a desktop and from 50 to 80 on a phone. On a desktop, `REPOSE` 9 added 2.8 min, and the doubled characters, the ambushes and the longer stretches added about 22. The sparser gossip letters took 0.6 off, since big hits now throw fewer beans.
- Pages: the average bot finds 7.3 a run (4 at least), the sloppy one 8.35 and the keyboard one 6.65. The careful bot finds exactly 3, one from each ambush. Average bots still find none on the bridge, where gusts spill in small handfuls and the river takes 30%.
- Coins: the average run earns 537 (414 at least). Dodges paid twice as often with twice the characters. The lead then raised the six upgrades from 415 to 720 coins in all (see Lead Decisions), so most players buy four or five.
- Keys: with the rising key speed the keyboard bot spills 271 on the hill against the tilting bot's 254, so the hill gap is closed. On the bridge it still spills 251 against 173. Before the leftover-water prompt it was 321, because the longer hill sent more rain water onto the bridge and the old prompt only asked from 3 u.
- Careful players spill about 90 beans at each ambush and little else, so their run is 44 min, mostly walking and chores.
- A bot that never pours the rain off floods the pot on the 6,000 u hill: beans float out faster than it picks them up, and it is still short of the kiosk after 15 min. The prompt asks from 3 u of water, and the average bot pours at 5.5 u.
- Real players who learn to hurry past the ambushes will find fewer pages than the bots, and a real `tb` and walking factor will move every number here. Both are Owner Follow-Ups.
- If real runs land under 60 min, lower `REPOSE` to 8 or lengthen the stretches again. If they pass 110 min, raise `REPOSE` or lower `WEIR_K`.

### Round 13: One Real-Time Stretch

Round 13 played the market without `?fast`, so drying took its real minute. A scripted player walked with W and a levelling controller, stopped for characters, hurried from the sale, and put every bean back with eased mouse drags plus a 0.3s aim pause between beans:

| Measure                 | Round 13 market | Model's average desktop market |
| ----------------------- | --------------- | ------------------------------ |
| Walking and events      | 2.3 min         | 2.7 min (107s x 1.5)           |
| Beans spilled           | 305             | 314                            |
| Seconds in Pickup a bean | 1.13 (scripted) | 1.5 (`tb`)                     |
| Pickup                  | 5.5 min         | 7.9 min                        |
| Drying waits            | 2 beans dried while walking and picking up; the gate never waited | No time added |

- At the model's 1.5s a bean, the same stretch takes about 10 min plus the kiosk, against the model's 12.5 min. That is within 20%, so the 70 min desktop average stands and no tuning changed.
- A window box batch grew in 59,999 ms of wall clock.
- The scripted 1.13s a bean is a floor: it never misses a bean or hesitates. Real players' numbers still belong to the Owner Follow-Ups.

### How to Time Real Runs (Owner Follow-Ups)

Phones have no console, so every number the follow-ups need also shows on screen in dev builds (M26b):

1. Run `bun run dev:beans` from the repo root. The server listens on the local network, so a phone on the same Wi-Fi opens `http://your_computer_lan_ip:5174/`. Leave `?fast` off: drying and growing take their real minute.
2. Browsers send motion only to HTTPS pages, so over plain http the phone shows the Tilt Left and Tilt Right buttons. On Android Chrome, adding the address under "Insecure origins treated as secure" (`chrome://flags/#unsafely-treat-insecure-origin-as-secure`) turns tilt on. An iPhone needs an HTTPS dev server, which means installing a tool; ask before adding one.
3. Timed pickups: carry the pot on the street or later with nothing behind you, then choose **Time 50 Beans** (the dev panel on desktop, **Menu** then **Run Report (Dev)** on a phone). It spills 50 beans 60 to 150 u ahead, spread like a hurried spill. Set the pot down, put them all back, and a toast reads "Timed: 50 beans in 72.0s, 1.44s a bean." Only seconds in Pickup count. Do two or three, on desktop and on a phone.
4. Full runs: reload first, since timed pickups add to the run's numbers. Play from the start screen to the ending, then open **Run Report (Dev)** at the bottom of the ending screen and take a screenshot. Mid-run, the same report opens from the dev panel, the phone Menu, or `__game.beans.statsText()`.
5. The report lists, per stretch, minutes split into walking, Pickup, window box, kiosk and the count, beans spilled, potted and lost, and seconds per bean; then the run's played and wall-clock minutes, pickup share, coins by source, upgrades and pages, and the timed pickups.
6. Key speed: A, D and the tilt buttons now turn the pot from 30°/s, rising to 75°/s over the first 0.2s of a hold. Try it on the hill and the bridge (`Jump` and **Trigger Gust** in the dev panel help).

## 6. Controls

All input comes from `@slop/shared`: `PointerTracker` on the canvas, `Keyboard`, `createMotion` with `prefersMotion`, `TiltAxis` (motion only), `isHeld`, `RubGesture`, `CircleGesture`, `HoldCharge` and `JoltMeter`.

| Action                    | Desktop                                       | Phone                                                                        | Shared piece                                                  |
| ------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Pick up or set down pot   | Space, or the **Set Down** button             | **Set Down** / **Pick Up Pot** button                                        | `Keyboard.onPress`                                            |
| Walk                      | Hold W or Up, or hold the mouse on the canvas | Hold a thumb anywhere on the canvas                                          | `isHeld(pointer, keys, codes)`                                |
| Hurry                     | Hold Shift with W                             | Slide the held thumb right: 30 u is stroll, 110 u is hurry                   | `PointerTracker.x - startX`                                   |
| Walk back                 | Hold S or Down                                | Slide the held thumb left past 40 u                                          | Same                                                          |
| Keep the pot level        | A and D, or Left and Right, turn it from 30°/s, rising to 75°/s while held | Tilt the phone; **Tilt Left** and **Tilt Right** hold buttons without motion | `TiltAxis` for motion; game rate control for keys and buttons |
| Recalibrate level         | Not needed                                    | Automatic at each pick-up; **Level Here** in Settings                        | `motion.calibrate()`                                          |
| Pick up beans             | Click and drag to the pot                     | Pinch with two fingers, carry, lift; Assist: one-finger drag                 | `onPress`/`onDrag`, `pinch`                                   |
| Scoop a pile or cluster   | Press and hold still, then drag               | Drag with one finger                                                         | `onDrag`                                                      |
| Shoo a pigeon, dog or cat | Click it                                      | Tap it (resolved on release)                                                 | `onUp`                                                        |
| Jot down gossip           | Hold J or the **Jot It Down** button          | Hold **Jot It Down**                                                         | `HoldCharge`                                                  |
| Fish with the coat hanger | Hold the mouse button and move the hook       | Drag the hook                                                                | `onDrag`, `JoltMeter`                                         |
| Dry a swollen bean        | Drag it to the drying rack                    | Pinch or Assist drag                                                         | Same as beans                                                 |
| Pour off rain             | Hold P or **Pour Off**                        | Hold **Pour Off**                                                            | `HoldCharge`                                                  |
| Open the window box       | E or **Window Box**                           | **Box** button                                                               | `Keyboard.onPress`                                            |
| Dig                       | Drag back and forth                           | Rub back and forth                                                           | `RubGesture`                                                  |
| Plant                     | Click a packet, then click and hold a hole    | Tap a packet, then tap and hold a hole                                       | `HoldCharge`                                                  |
| Water                     | Click and hold                                | Tap and hold                                                                 | `HoldCharge`                                                  |
| Harvest                   | Click a pod                                   | Tap a pod                                                                    | `onRelease`                                                   |
| Untangle the net          | Drag circles round each knot                  | Draw circles                                                                 | `CircleGesture` with `center`                                 |
| Clean the mud             | Drag back and forth on the shoe               | Rub                                                                          | `RubGesture`                                                  |
| Lift the doormat          | Drag up                                       | Drag up                                                                      | `onDrag`                                                      |
| Notebook                  | N or **Notebook**                             | **Menu** then **Notebook**                                                   | React                                                         |
| Settings and pause        | Esc or **Settings**                           | **Menu**                                                                     | `Modal` blocks game input                                     |

Input details:

- Keys and tilt buttons drive the same rate control. The buttons are `HoldButton`s: no click sound, pointer capture, and release on cancel, lost capture, window blur or blocked input.
- `TiltAxis` gets the motion source and the `PointerTracker` but no keys and no `pointerRange`. Pointer steering stays off, and `prefersMotion` still sees the real input.
- The phone walk thumb is the primary pointer. The tilt buttons are DOM buttons in the bottom bar, so two thumbs work together.
- The simulation pauses while any modal is open (`isGameInputBlocked()`). Real-time timers keep running.
- Copy adapts to the input in use: keys copy when the last input was a mouse or key, touch copy otherwise.

## 7. Art Direction

Everything is drawn with the shared sketch helpers in the felt-tip default style. Static art goes into `CachedLayer` once. Characters redraw each frame and boil their lines at 6 fps with `boilSeed`, except under Reduced Motion.

### Palette

The shared `palette` covers ink, paper and markers. Game colours live in `scenes/art/colors.ts`:

| Name          | Value     | Use                                 |
| ------------- | --------- | ----------------------------------- |
| `bean`        | `#8d5524` | Beans (`palette.brown`)             |
| `beanSwollen` | `#c49a6c` | Puddle beans                        |
| `beanShine`   | `#f3d9b1` | Bean highlight stroke               |
| `sky`         | `#d8ecff` | Sky fill behind tiles               |
| `grass`       | `#9fcf7f` | Park and hill                       |
| `road`        | `#cfc8b8` | Street and paving                   |
| `brick`       | `#c9744f` | Terraced houses                     |
| `mud`         | `#7a5230` | Mud and drain gunk                  |
| `river`       | `#74c0fc` | River and puddles (`palette.water`) |
| `potRed`      | `#c92a2a` | Enamel pot (`palette.red`)          |

### Characters

- **You:** a round head (`sketchCircle` r 22, paper fill) with dot eyes. Eyebrows rise with the slosh level. The mouth goes flat, wavy, then an "O" on a spill. A blue hatched jumper, arms as lines to the pot handles, and legs from the step phase. Shoes turn into brown blobs when muddy; Grippy Shoes get zigzag soles. Squash to 0.96 on each footstep and 0.88 then 1.06 on a kick. Arms flail during a "whoa" wobble.
- **The pot:** a red enamel `sketchRoundRect` with a white rim ellipse and two handles, labelled "STEW". The bean surface is a heap polygon following `phi`, topped with bean stamps. The low rim glows red near the spill line. The Taller Pot is 1.4 times taller. The Lid rattles with a jitter offset.
- **Beans:** a kidney `sketchEllipse` with a highlight line: 11 by 6.5 u in the walk view, 20 by 12 u in Pickup. Three cached variants by seed, a swollen variant at 1.5 times, and a red-tinted strained variant.
- **The cat:** an orange `blobPoints` body, triangle ears, and a smooth tail path that swishes when awake. Slit eyes while grooming, round judging eyes while watching. A bum wiggle before a bat.
- **Neighbours:** a lady in a pink dressing gown with curlers, a man in a cardigan with a mug of tea, and a teen in headphones. Each has a speech bubble.
- **Market:** shoppers as seeded silhouettes with bags; stallholders in aprons with a spoon and a blob of chutney; the ladder man in blue overalls with a cap.
- **Park:** a kid with a backwards cap and a doodled football; scruffy spotted dogs with long tongues; pigeons as grey ellipses with bobbing heads, orange legs and one wild eye.
- **Cyclist:** two wheel circles, a rider and a "DING" in marker.
- **Grandma Doris:** a purple cardigan with a bean brooch, a hair bun, round glasses and slippers, holding a wooden spoon. Her dog is a white high-irregularity blob with a bow.
- **The editor:** a green visor and a pencil behind his ear, leaning out of the kiosk.

### Props and Rooms

- **Kitchen:** hatched floor tiles, brown counters, a white fridge with magnets, the cat bowl, a hall rug and a door scrawled "OUT".
- **Street:** terraced brick houses with coloured doors and curtains, lamp posts, a kerb line, pothole blobs and hatched drain grates.
- **Market:** striped awnings, crates of round veg, zigzag bunting, cobbles of small circles, puddle blobs.
- **Park:** hatched grass, blob trees, a bench, a pond, and a "Dogs on leads please" sign.
- **Hill:** a sloped ground polygon, a "Steep. Sorry." sign, rain as short lines per frame, streaming leaves on gusts.
- **Bridge:** a catenary deck with plank rectangles and rope lines. The river below uses wavy lines boiled with `boilSeed`, a fish jumps now and then, and a duck paddles.
- **Grandma's door:** a garden path, a gnome, four steps, a "WELCOME" doormat and the door.
- **Top-down grounds:** kitchen tiles, paving slabs, cobbles, grass, the hill path, bridge planks with gaps, and the doorstep.
- **Drain shaft:** gunk with a rubber duck, a sock and a key. The hanger is a bent wire with a sad hook.
- **Window box:** a wooden box of soil with slot holes. Seed packets are small rectangles with a bean doodle and their label.
- **Kiosk:** a newsstand under a "The Weekly Whisper" banner. Its headlines show the gossip you sold.

Backgrounds are tiles 800 u wide, each a `CachedLayer` with a `rect` at its route position covering the stretch's whole ground range. M5 widened them from 600 u, because a desktop view is 800 u wide and spans three 600 u tiles. A tile strip keeps the visible tiles plus one ahead in the walking direction, painted before it scrolls into view, and disposes the rest, so at most 3 exist. Static ground hazards paint into the tiles. A far layer (sky, rooftops) that scrolls at 0.3 times is not built; add it only if a stretch looks flat without it.

**Camera and stamps:** `CachedLayer.stamp` sets its own transform from the viewport, which drops any camera translate. The camera passes its scroll and shake into stamp coordinates (`x - camX + shakeX`) and re-applies its transform after each stamp batch.

### Sound and Juice

Each milestone adds its own rows; M24 audited the whole table and filled the gaps marked below.

| Moment                | Sound                                  | Juice                                                        | Milestone    |
| --------------------- | -------------------------------------- | ------------------------------------------------------------ | ------------ |
| Footstep              | `thud` at volume 0.15, pitch 1.4       | Body squash                                                  | M1           |
| Slosh peak over 6°    | `slosh`, volume by angle               | Surface heap wobble                                          | M1           |
| Near the spill line   | none                                   | Low rim glows and pulses                                     | M1           |
| Bean leaves the pot   | `splat` per 10 beans, pitch 0.9 to 1.1 | Particles with spin                                          | M1           |
| Spill of 30 or more   | `fail`                                 | Shake `min(12, n / 10)` u, 0.3 time scale for 0.4s           | M1           |
| Spill event ends      | none                                   | Caption naming the cause and count, plus a Grandma line      | M1           |
| Bean into the pot     | `pop`, pitch up 4% per streak bean     | Pot squash; streak captions at 10, 25 and 50                 | M1           |
| Strain past 70%       | `rattle` quiet                         | Tweezers tremble, held bean tints red                        | M1           |
| Bean dropped          | `squish`                               | Bean spins away (M24: spin from the release speed), caption naming the cause | M1           |
| Tip-over teeter       | `creak` and `rattle` (M24 added `creak`) | Pot balances on an edge                                    | M2           |
| Gate blocked          | `buzz`                                 | Gate wobble, arrow                                           | M2           |
| Kicks                 | `thud`; `whoosh` for ladder and ball   | Shake by kick size, side arrow in the warning; every ground kick buzzes (8 ms per cobble, 15 ms small, 30 ms big), character hits 30 ms | M5 onward, M24 |
| Dodged event          | `coin`                                 | Caption and +2 float                                         | M9           |
| Cat, dog, pigeon      | `meow`, `bark`, `coo`                  | Character pop-in; "WOOF!", "SWAT!", "DING!" and "Atchoo!" bounce (M24) | M6, M13, M15 |
| Cyclist               | `bell`, then `whoosh`                  | Speed lines                                                  | M9           |
| Rain and wind         | `rain` and `wind` loops by intensity   | Rain lines, leaves                                           | M18          |
| River, puddle, drain  | `splash`, `drip`                       | Ripples where walk-view beans drop in (M24)                  | M8, M11, M19 |
| Lid rattle and launch | `rattle`, `slam`                       | Lid jitter; the lid spins away                               | M16          |
| Dig, clean mud, jot   | `scrub`, pitch 0.8, 1.0 and 1.6        | Dirt and mud flecks (M24 added the mud's), pencil scribble   | M7, M14, M16 |
| Watering              | `pour` loop (M24: a real loop, was repeated one-shots) | Darkening soil                               | M14          |
| Harvest, coins        | `pop`, `coin`                          | Pod burst, `CoinBadge` float                                 | M10, M14     |
| Timer done            | `ding` (M24 added it to drying)        | `TimerChip` done state                                       | M11          |
| Grandma's door, count | `slam`, rising `tick`                  | Big marker numbers                                           | M22          |
| Replays               | none                                   | Corner chip; auto replay pauses the game in slow motion      | M20          |
| Doorstep dog          | `bark`, then `pop` or `thud` and `fail` | Leap at the pot, "WOOF!", slow motion and shake on a tip     | M21          |
| One is missing        | `fail` quietly                         | Grandma's bubble, the lumpy doormat                          | M22          |
| Taste and secret      | `squish` 0.6, `rattle`, `sneeze`, `whoosh`, `laugh` | Spoon, salt shaker, "Atchoo!", beans flying into letters | M22  |

Shake reads `settings.get().reducedMotion` first. So do the body and pot squash, the "whoa" wobble, the shouts' bounce and slow motion: under Reduced Motion big spills play at full speed (M24).

**How M24 built it:** every row above was checked against the code and in the browser through a dev sound log (`__game.beans.sounds()`). The gaps it filled: the teeter's `creak`, the drying `ding`, the watering `pour` loop, walk-view ripples, bouncing shouts, mud flecks, spinning drops, a buzz on every ground kick, and Reduced Motion for squash and slow motion. Captions still stack at most 3.

### Comedic Copy

Captions are sentence case, under 8 words, drawn near the cause. Each has 4 to 6 versions that rotate without repeats:

- "Hurried. 14 beans." / "Tilted too far. 23 beans." / "Cat swat. 60 beans."
- "Grandma felt that." / "Grandma sat down." / "Grandma is updating her will." / "Grandma heard that from across town."
- "Ladder: 2. You: 0."
- "Too jerky." / "Too fast." / "Butterfingers."
- "10 in a row!" / "25 in a row. Show-off." / "50 in a row. Grandma is proud."
- "Saved it!" / "Made it!" / "Not today, ladder man." / "The cat is furious."
- "Gravity: 1. You: 0."
- "Pigeon tax."
- "That bean is swimming now."
- "Bye, bean." / "Grandma saw that."
- "Too swollen. Put it on the rack."
- "Of course it stops now."
- "A sock. Not a bean."
- "Is it soup? It looks like soup."
- "Beans? For Doris? She counts them, you know."
- "Ooh, the vicar. I'll take it."

Replay labels: "47 beans in 0.4s", "Pigeon tax: 6", "Carried for 1:02:41. So close."

**How M24 built it:** `game/lines.ts` holds every recurring caption's versions in one place, each with 4 to 6 versions of under 8 words (a test checks this). The plain version always shows first, so a first-time caption still teaches; after that each kind deals its versions from a shuffled bag, so all of them show before any repeats. Spill lead-ins rotate per cause ("Hurried.", "Too fast.", "Speed kills beans." …), and so do Grandma's tiers, dodge lines per character, drops, saves, river, drain and puddle lines, shoos, the duck, the cat's bats, the gate and gust praise. One-off tutorial captions keep one version.

Every spill caption carries a third line with its cause's running score, such as "Ladder: 2. You: 0.", "Potholes: 3. You: 0." or "Your legs: 1. You: 0." for hurrying. Causes group into families (a hurried pothole is still a pothole), and a dodge, a teeter you saved or a gust you rode out scores for you: "Bikes: 0. You: 2.". The old one-off ladder and football scoreboards became this; "Gravity: N. You: 0." on the hill stays its own caption.

## 8. Modules and State

### File Layout

`src/game/` holds pure logic with no React and no DOM, all unit tested:

| File             | Purpose                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `tuning.ts`      | Every number in section 3, each with a one-line comment                                                      |
| `units.ts`       | Degree and u/s conversions, including Matter per-step velocity                                               |
| `random.ts`      | Per-system seeded streams                                                                                    |
| `ledger.ts`      | Places, `move`, `total`                                                                                      |
| `slosh.ts`       | Pot angle, rate control, slosh spring, margin, weir spill, teeter and tip-over                               |
| `spill.ts`       | Spill events, causes and caption text                                                                        |
| `walk.ts`        | Speed, step phase, sway, terrain kicks, camera target                                                        |
| `route.ts`       | Seven stretch definitions: length, features, events, gossip slots, pigeon rates                              |
| `events.ts`      | Event state machines and kick output                                                                         |
| `zones.ts`       | Landing classification and caps, merging, cap and pile, top-down mapping, "Behind", the one-owner bean moves |
| `pickupWorld.ts` | The Matter world for one zone: bodies, walls, clamp, respawn, held beans                                     |
| `pickup.ts`      | Grab selection, clumps, strain and drops, pot acceptance, scoop size and dribble                             |
| `pigeons.ts`     | Pigeons in Pickup and Grounded (M13 named it for what it holds; the kitchen cat lives in `kitchen.ts`)       |
| `packets.ts`     | Seed packets of lost beans: causes, labels, filling, the ledger check                                        |
| `hanger.ts`      | Hook follow, catch and drop rules                                                                            |
| `windowBox.ts`   | Slots, dig, plant, water, flood, grow batch, harvest, the jar, the box's layout and prompts                  |
| `gossipFont.ts`  | Stroke letters and bean placement                                                                            |
| `gossip.ts`      | Lines, queue, slots, carry-over, trigger, scramble, secret reveal                                            |
| `economy.ts`     | Upgrade definitions, bonuses, prices, chore ids                                                              |
| `door.ts`        | Doorstep dog, count gate, count curve and caption timeline, doormat, taste and secret (M21 named it)         |
| `replays.ts`     | Which spills get a replay, its caption, and when its clip is cut (M20)                                       |
| `bot.ts`         | Seeded scripted players, including a keyboard bot, for tests and the dev panel                               |
| `ambush.ts`      | The street's, market's and park's ambushes: tell, shout, lunge, hit or dodge (M27)                          |
| `pacing.ts`      | `runMinutes`: section 5's estimate of a bot run's real minutes per kind of player (M27)                     |
| `game.ts`        | `createGame(seed)`, the `Game` state, `update(game, dt, input)` by scene                                     |
| `hud.ts`         | The `hud` store and `publish(game)`                                                                          |
| `state.ts`       | The `Game` type, its parts and `createGame`                                                                  |
| `effects.ts`     | `sound` and `caption`: queued side effects the runtime plays                                                 |
| `pickupFlow.ts`  | Pickup actions: tweezers, hold-to-cup hands, dribbles, drops, streaks                                        |
| `gate.ts`        | The stretch-end gate and the chores that block it                                                            |
| `fx.ts`          | Walk-view geometry, bean particles and captions as data                                                      |
| `testing.ts`     | `simulate` and `testGame` for unit tests                                                                     |

`src/dev.ts` holds `window.__game.beans` and the dev panel actions. It needs the viewport, so it sits beside `App.tsx`.

`src/scenes/` draws and reads input:

| File                | Purpose                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `runtime.ts`        | Owns the loop, input objects, recorder and scene switch                                              |
| `input.ts`          | Builds `PointerTracker`, `Keyboard`, motion, `TiltAxis`, the tilt buttons' state                     |
| `walkScene.ts`      | Side-on render, particles, zone markers, walk input                                                  |
| `pickupScene.ts`    | Pickup render, drag, pinch, scoop, shoo, gossip steering                                             |
| `drainScene.ts`     | Coat hanger mini-game                                                                                |
| `windowBoxScene.ts` | Box render and gestures                                                                              |
| `kioskScene.ts`     | Kiosk drawing                                                                                        |
| `doorScene.ts`      | Doorstep, count and doormat render                                                                   |
| `particles.ts`      | Pooled bean particles, feathers, splashes                                                            |
| `captions.ts`       | Canvas captions, at most 3 stacked                                                                   |
| `camera.ts`         | Follow, shake, slow motion, camera-safe stamps                                                       |
| `tiles.ts`          | Tile strip over `CachedLayer`                                                                        |
| `art/*.ts`          | `colors`, `player`, `pot`, `bean`, `critters`, `people`, `props`, one background painter per stretch |

`src/ui/` holds React overlays: `Hud.tsx` (bars and rails), `HoldButton.tsx`, `WalkButtons.tsx`, `PickupButtons.tsx`, `Kiosk.tsx` (sell list, `ShopPanel`, `ChoreList`), `Notebook.tsx`, `WindowBoxChrome.tsx`, `ReplayChip.tsx`, `Ending.tsx`, and `Settings.tsx` (`SettingsPanel` with a **Level Here** extra). `App.tsx` holds `StartScreen`, the layout grid and modals.

### Simulation State

One mutable `Game` object lives in `scenes/runtime.ts` and is passed to pure update functions. Nothing in it is React state.

```ts
export interface Game {
  seed: number
  scene: SceneId // 'walk' | 'grounded' | 'pickup' | 'drain' | 'box' | 'kiosk' | 'doorstep' | 'count'
  stretch: number // 0 kitchen … 6 door
  counts: Counts
  walker: WalkerState // x, v, ax, stepPhase, carrying
  pot: PotState // psiTarget, psi, kick, sigma, sigmaVel, water, spillAcc, overMs, teeterMs
  zones: Zone[]
  activeZone: number // -1 outside Pickup
  spill: SpillEventState
  fx: FxState // shake, slow motion, captions
  stats: Stats // pickedUp, lostTotal, startedAt, spilledByStretch, pickupMs[]
  timeMs: number
}
```

```ts
export interface Zone {
  id: number
  stretch: number
  anchorX: number
  beans: Float32Array // x, y, angle, kind per bean, 200 max (kind: loose, puddle)
  count: number
  pile: number
  drain: number
  shown: number // beans whose particle has landed, for the walk view
  gossipLine: number // -1 when none
}
```

Shared objects created next to `Game`: `wallet` (`createWallet`), `shop` (`createShop(UPGRADES, wallet)`), `chores` (`createChoreBoard()`), the Pickup world (rebuilt on entry from the zone record), and the `ReplayRecorder`.

### React Snapshot

```ts
export interface HudSnapshot {
  scene: SceneId
  stretch: number
  carrying: boolean
  canSetDown: boolean
  prompt: string
  lost: number // packets + growing
  gossipFound: number
  timers: readonly RealTimer[] // reference changes only when a timer starts or ends
  replay: ReplayRequest | null
}
```

- `publish(game)` runs on discrete events and from a 10 Hz tick. `createStore` only notifies on change.
- Fast values never go through the store: `Meter read` shows slosh, and `LiveText` shows the pot and Behind counts.
- Coins come from `useCoins(wallet)`, chores from `useChores(chores)`, settings from `useSettings`.

## 9. Dev Hooks

All of this sits behind `import.meta.env.DEV`. `App.tsx` loads `src/dev.ts` with a dynamic import inside that check, so production builds drop it.

`window.__game.beans`, published with `exposeDev('beans', api)`:

```ts
interface BeansDevApi {
  state(): DevState // scene, stretch, counts, walker, pot, zone summaries, timers, coins, owned, gossip
  ledger(): Counts & { total: number }
  jump(
    stretch: number,
    scene?: 'walk' | 'pickup' | 'kiosk' | 'doorstep' | 'count'
  ): void
  addCoins(n: number): void
  spill(n: number, into?: 'loose' | 'puddle' | 'drain' | 'river' | 'pile'): void
  pickUpAll(): void // returns every zone bean in this stretch to the pot
  trigger(event: EventId): void // 'cat' | 'neighbour' | 'cyclist' | 'crowd' | 'spoon' | 'ladder' | 'football' | 'dog' | 'gust' | 'rain' | 'pigeon' | 'tip' | 'ambush'
  setInput(
    input: {
      walk?: number
      hurry?: boolean
      tilt?: number
      tiltRate?: number
    } | null
  ): void
  setMotion(motion: { tiltX: number } | null): void // feeds the real TiltAxis path
  step(n: number): void // calls window.__game.loop.step(n)
  finishWaits(): void
  giveGossip(count?: number): void
  givePackets(beans: number): void
  own(upgradeId: string): void
  beanPoints(): { client: [number, number][]; pot: [number, number] } // client coordinates for PointerEvent scripts
  stats(): RunReport
  statsText(): string // the same report as the Run Report dialog's text
  timeBeans(): string | null // starts a 50-bean timed pickup, or says why it can't
  timings(): TrialResult[] // finished timed pickups, oldest first
}
```

- `stats()` returns the run so far: per stretch, minutes played (dialogs that pause the game left out) split into walking, Pickup, window box, kiosk and the count, beans spilled, potted and lost, and seconds in Pickup per bean potted; for the run, played and wall-clock minutes, the pickup share, seconds per bean, coins from dodges, bonuses and pages, coins spent and left, upgrades and pages. M27's manual runs read their numbers here or in the Run Report.
- The **Run Report** dialog shows `statsText()` and offers **Time 50 Beans**. M27 removed M26c's **Key Speed** trial once the rising speed shipped. The dev panel opens it on desktop, **Menu** then **Run Report (Dev)** on phones, and the ending screen folds it under the secret. Phones have no backquote key, so this is their only dev entry.
- `setInput` overrides walking and tilt until cleared, so automation can walk without key events. `tilt` sets an absolute target fraction; `tiltRate` acts like held keys.
- `beanPoints` converts logical positions with the viewport, so a script can dispatch real `PointerEvent` drags and pinches.

Dev panel actions (backquote key): **Run Report**, **Time 50 Beans**, **+100 Coins**, one **Jump** per stretch plus **Kiosk** and **Count**, **Spill 30**, **Spill 300**, **Drain 3**, **Puddle 3**, **Lose 10**, **Pick Up All**, **Finish Waits**, **All Gossip**, **Own All Upgrades**, one **Trigger** per event id, **Bot Walk**, and **Check Ledger**.

`?debug` draws Matter bodies with `drawPhysicsDebug`, plus a walk overlay with `sigma`, `phi`, margin, `d`, `Q` and zone anchors.

## 10. Unit Test Plan

Tests sit next to their files and cover game logic only:

| File                  | Cases                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ledger.test.ts`      | Starts at 10,000 in the pot; `move` rejects fractions, negatives and overdraws; 10,000 seeded random moves keep the total                                                                                                                                                                                                                                                                                                                                        |
| `slosh.test.ts`       | A level pot at rest never spills; a stroll start never spills; spill starts at 9.1° relative; weir rates within 1%; amplitude decays by `exp(-zeta omega t)`; emission is whole beans; the Lid caps at 6/s; keys turn from 30°/s, rise to 75°/s over 0.2s and hold, and a turn back starts slow; teeter then tip, and a counter-tilt saves it; a correct counter-tilt lowers the total spilled across the whole rocking                                                                                                 |
| `spill.test.ts`       | Events start and end on the 0.6s gap; the cause picks the latest kick, then tilt, hurry or start; caption size tiers; Set Down refused mid-spill (unless flooded) and mid-teeter                                                                                                                                                                                                                                                                                                                                             |
| `walk.test.ts`        | Speed reaches 90% in about 1s; sway frequency is `v / 150`; terrain kicks scale with `(v / 80)²`; stairs cap speed; back runs at stroll                                                                                                                                                                                                                                                                                                                          |
| `zones.test.ts`       | Landing order and per-event caps; merging within 150 u; the 201st loose bean goes to the pile; "Behind" counts only this stretch; zone sums match the ledger; the round trip Pickup to Drain to Window Box to Pickup keeps positions                                                                                                                                                                                                                             |
| `pickupWorld.test.ts` | Headless Matter: 1,000 seeded flings never leave the play rect; a release at 65 u from the pot centre goes in; a bean out of reach respawns; on the bridge a resting bean at peak roll moves at least 40 u in 1s                                                                                                                                                                                                                                                 |
| `pickup.test.ts`      | Grab radius and clumps; strain from jolt, speed and clump size; drop causes; the pinch grab rule at 70 to 130 CSS px gaps; scoop sizes; dribble only above 700 u/s                                                                                                                                                                                                                                                                                               |
| `input.test.ts`       | Rate control and auto-level; the walk thumb's hurry and back mapping; Pour Off thresholds 0.55 and 0.80 and its bean-loss formula                                                                                                                                                                                                                                                                                                                                |
| `drying.test.ts`      | Drying timers use the clock with an injected `now`; a dry bean drops into the pot; the gate ignores drying beans                                                                                                                                                                                                                                                                                                                                                 |
| `critters.test.ts`    | Pigeons eat from the pot only without an untangled net; diversion radius; a shoo scatters the flock; at most 3; eaten beans fill packets of 8                                                                                                                                                                                                                                                                                                                    |
| `hanger.test.ts`      | Catch radius 10 u; a slow lift keeps the bean; a jolt or wall scrape drops it; reaching the top makes a loose bean; snags                                                                                                                                                                                                                                                                                                                                        |
| `windowBox.test.ts`   | Packet capacity 8; 3 packets per slot; dig needs 6 strokes and stays dug; over-watering floods; one timer per batch; harvest goes to the pot when it is on the ground; 6 slots with the bigger box                                                                                                                                                                                                                                                               |
| `gossip.test.ts`      | Stroke counts per line (45 to 95); trigger picks the first line that fits; a missed kitchen line spells last on later stretches; queue order and carry-over; first-line lock, wiggle then scramble; the dev Pick Up All forgets an unjotted line; secret reveal counts                                                                                                                                                                                                                                                                                                          |
| `economy.test.ts`     | Bonus tiers; dodge pay; prices total 672; buying each upgrade adds its chore or flag; chores block `leave-stretch` and `count`                                                                                                                                                                                                                                                                                                                                   |
| `events.test.ts`      | Each event's telegraph comes before its active window; stopping avoids neighbour, cyclist, crowd and dog kicks; the ladder hit window is 1.4s of 4s                                                                                                                                                                                                                                                                                                              |
| `ending.test.ts`      | A dodge hides exactly one bean; a missed dodge tips and still hides one; the count curve is monotonic, holds at the shortfall and stops at 9,999; a harvest during the dustpan pickup still opens the count; the doormat move makes 10,000; the windowsill caption names the packets, even when harvested beans arrive at once; a clean walk pays the door's bonus                                                                                                                                                                                                                       |
| `balance.test.ts`     | Every bot reaches Grandma; the average bot spills each stretch's section 5 budget within 25%; the sloppy bot spills 1.5 to 2.2 times as much; a careful bot spills only its three ambushes to the park and under 60 in the wind; every kind of player earns the four cheapest upgrades; the average run finds 7 to 9 pages, the sloppy one more and the careful one at least 3; an average run lasts 65 to 120 min on a desktop and a phone (`runMinutes`); about half the average bots tip at the door; hurry spills more than stroll on an empty street; the river keeps about 30% on the bridge; pouring off helps on the hill; walking blind costs each character stretch its big hits; the same seed replays the same run |
| `ambush.test.ts`      | Ambushes burst out with the pot already inside their reach; a strolling or stopped pot gets hit with at least the next line's need plus 8; a hurry from the shout dodges for coins and a score; a 0.4s late hurry still makes it and a 0.8s one doesn't; Set Down is refused from the shout until the lunge lands |

No tests only check that a component renders.

## 11. Milestones

Each milestone ends with `bun run typecheck`, `bun run test` and `bun run build` passing in this package, and a check in the T3 preview at desktop size and the iphone-12-pro and iphone-se presets for its new actions.

- [x] M1: Walk, Spill and Pick Up Slice - At 1280x800 a flat placeholder street shows you holding a brimming pot at 10,000; W walks, Shift+W hurries; A and D turn the pot at 30°/s and the angle holds; the bean surface sloshes and beans arc over the low rim, which glows near the spill line; spills play `splat`, and 30 or more play `fail` with shake and slow motion; each spill ends with a caption naming its cause; Space sets the pot down, and near a zone opens a top-down view where spilled beans are Matter bodies; dragging beans onto the pot adds them back with rising pops, clumps of up to 3 come together, strain trembles before a drop, and drops name their cause; beans and background move together during shake; HUD rails show the pot count and a slosh meter without per-frame React renders; `__game.beans.ledger().total` stays 10,000 after every action; ledger, slosh, spill, pickup and headless Matter tests pass.
- [x] M2: Spill Zones, Piles, Scoops and the Exit Gate - Spills join zones within 150 u; `spill(300)` gives 200 bodies and a 100-bean pile; hold-to-cup hands scoop the pile and clusters of 15 or more, with dribbles above 700 u/s; S walks back at stroll speed; setting the pot down away from zones grounds it; the gate buzzes with "N beans are still back there." until "Behind" is 0; a hit that pushes the pot past the tip angle (dev `trigger('tip')`) teeters, and a counter-tilt saves it or it tips 600 beans; the bridge slide spike test passes; a 200-body Pickup holds its frame budget at iphone-se size; zone and pickup tests pass.
- [x] M3: Phone Controls and Layout - At iphone-12-pro and iphone-se presets the top and bottom bars never overlap the canvas cell, and after two orientation changes the canvas rect equals its cell rect (checked with bounding rects); holding a thumb walks and sliding it right hurries; scripted pinches that start 150 CSS px apart and close to 90 CSS px grab a bean at both presets, and one finger does not until Assist Mode is on; the tweezer tip draws above the fingers; `HoldButton` tilt buttons appear without motion and steer the pot; `setMotion` drives the real tilt path; a scripted 50-bean pinch run sets a timing floor in section 5; one-finger drags from the pile scoop with hands; safe-area insets apply. Manual check for Ekansh: pinch and tilt on a real phone.
- [x] M4: Start Screen, Settings and Session - `StartScreen` shows the title, pitch and story and asks for motion on iPhones; Settings opens `SettingsPanel` with **Level Here** in a `Modal` and pauses the simulation; the leave warning and wake lock follow the session; no storage or network calls appear in the browser.
- [x] M5: Route Framework and Ground Hazards - Seven stretch definitions drive placeholder tile backgrounds, the camera and stretch transitions; `jump(n)` reaches each stretch; potholes, rhythmic cobbles, kerbs and stairs kick by speed squared with their side shown, so strolling over a pothole spills nothing and hurrying spills; the average, careful and keyboard bots and the balance test exist; each system has its own random stream; tile strips keep at most 3 tiles alive and paint ahead; frame budget holds at iphone-se size.
- [x] M6: Your Kitchen and the Cat - Kitchen art; the counter cat paws one bean off within 15s and that bean is the first pickup; tutorial captions for both input types; the door cat swats on its awake and grooming cycle (3.5s first window) with a tail-swish telegraph and a 60-bean splash; the hall rug bumps; in Pickup the cat wiggles before each bat and a tap during the wiggle stops it; the scripted fridge knock sends one bean to `drain`.
- [x] M8: Coat Hanger Chore - Tapping a drain grate or the fridge gap opens the Drain scene; the hook follows the pointer; a slow lift brings a bean up and a jolt or wall scrape drops it; the hook can snag the duck, sock or key with a caption; fished beans pop out as loose; wedged beans respawn; the "Fish N beans out" chore clears at 0; hanger tests pass. (Built before M7: the kitchen cat's fridge knock in M6 leaves a bean only the coat hanger can reach.)
- [x] M7: Gossip and the Notebook - The stroke font spells each line with an exact bean count, readable at the iphone-se preset; entering Pickup on a zone that fits slides beans into letters; the first line locks pickup until **Jot It Down**; later lines wiggle on the first touch and scramble on a grab; the Notebook lists pages and the secret's revealed letters; "THE CAT KNOWS" triggers from the cat swat; slots and carry-over follow section 3; gossip tests pass.
- [x] M9: The Street - Street art; three neighbours peek from the left and lean, and walking on gets an elbow; two cyclists ring 1.5s ahead and startle you only when walking; drains placed on the route with per-event caps; each dodge pays 2 coins with a caption; each hazard has its sound and caption.
- [x] M10: Kiosk, Coins and Shop - Clearing a stretch opens the kiosk; selling pages pays the table prices with `coin` sounds; the clean bonus pays its tiers; `ShopPanel` lists the upgrades built so far; `ChoreList` shows blockers; **Next Stretch** loads the next route; economy tests pass.
- [x] M11: Puddles and the Drying Rack - Puddle landings swell beans, capped at 10 per event; the pot refuses them with a caption; the drying rack starts a 60s timer per bean (3s with `?fast`) shown in a `TimerChip`; dry beans drop into the pot wherever you are; the gate ignores drying beans; drying tests pass.
- [x] M12: The Market - Market art with cobbles and puddles; crowds bump unless you stop; stall spoons poke from the right on a 3s cycle; the ladder swings on a 4s cycle with a 1.4s danger window and a hit splashes 100 beans; shoppers' feet scuff beans in Pickup; each event has a dev trigger.
- [x] M13: Pigeons and Lost Beans - Pigeons waddle in during Pickup and Grounded, at most 3, divert to loose beans and eat from the pot; one click or tap scatters the flock; eaten beans fill labelled packets of 8; the HUD shows lost beans; critter tests pass.
- [x] M14: Window Box and the Grow Wait - E or **Window Box** opens the box anywhere and pauses the world; dig by rubbing, select a packet and hold a hole to plant up to 3 packets, hold to water, over-water to flood; holes stay dug; one 60s batch timer (3s with `?fast`) grows every watered slot; harvest pods have faces and go to the pot when it is on the ground, otherwise to the jar; the "Plant your packets" nudge shows; window box tests pass.
- [x] M15: The Park - Park art; the kid's football shows a dashed arc and hits if you are in its window; dogs jump in Walk and dash through Pickup; hurrying onto wet patches starts the "whoa" wobble, which a counter-tilt or stop saves; pigeons spawn every 15s.
- [x] M16: Upgrades: Wider Tweezers, Pot Lid, Grippy Shoes - Each appears in the shop with its cost; Wider Tweezers grab clumps of up to 5 and drop more; the Lid caps spills at 6/s, blocks rain, rattles beans out on kicks and launches on big hits for you to fetch; Grippy Shoes lengthen the save window and add the mud chore after the park, cleared with 24 rub strokes; effects verified with `own(id)`.
- [x] M17: Upgrades: Taller Pot, Pigeon Net, Bigger Window Box - The Taller Pot sloshes less and tips at 42° only from your own tilt; the Net tangles when the first pigeon of a set-down arrives and protects once untangled with knot circles, where the wrong direction tightens a knot; the Bigger Window Box has 6 slots, each watered; upgrade tests pass.
- [x] M18: The Hill - Slope art at 12°; uphill speed 70%; slope spills roll to the hill start; gusts arrive every 9 to 14s with leaves and rising wind 1.2s ahead; heavy rain at 0.12 u/s teaches **Pour Off** with a `HoldButton`; beans creep downhill in Pickup.
- [x] M19: The Rope Bridge - The deck rolls on two sine waves and gusts push the pot; river losses are capped at 30 per spill event; in Pickup the deck slide moves beans 60 to 90 u/s toward the edges and plank gaps swallow slow beans; a flung bean returns on a duck; captions and splashes play.
- [x] M20: Fail Replays - The recorder captures the design area at 24 fps and cuts clips 1s after the last bean lands; small spills show a Replay chip that fades after 4s; a new biggest spill or a tip-over opens the replay by itself and pauses the simulation; spills of 100 or more and tip-overs offer Share; memory stays at two frame sets.
- [x] M21: Grandma's Door and the Dog - Door art, steps and Grandma with her dog; the dog barks with an arrow 1.2s ahead; a dodge shows "Made it!" and hides exactly one bean; a miss tips the pot in slow motion with a replay, and the dustpan scoops the pile in about 17 scoops; planting blocks the count.
- [x] M22: The Count and the Ending - Grandma counts toward 9,999 over 14s with captions and rising ticks, holding at the shortfall while a batch grows; dragging the doormat up reveals the last bean; dropping it in makes 10,000; taste, salt and sneeze play; the stew spells the secret with the earned letters; `EndingScreen` shows the stats and the secret; ending tests pass.
- [x] M23: Share Cards - The ending card shows Picked Up, Lost for Good, Time and Gossip with the biggest spill's still as the picture and the funniest line as the footer; the Notebook shares Weekly Whisper page cards; `ShareModal` shares on phones and downloads on desktop.
- [x] M24: Sound and Juice Audit - Every row of the sound and juice table plays; captions have 4 to 6 rotating versions and per-cause running scores; shake, squash and slow motion respect Reduced Motion; captions never stack beyond 3; Android vibrates on kicks.
- [x] M25: Phone Polish and Performance - At both phone presets every button is at least 48 px and inside the safe area; a 200-body Pickup and a rainy hill hold 60 fps in a performance trace; walk particles cap at 160; the landscape phone note shows; no console errors.
- [x] M26: Bot Balance Pass - Bots pick up as they go, spell and sell gossip, and walk the whole route in `runRoute`; the average bot's spills per stretch match section 5 within 25% and a sloppy bot spills about 1.8 times as much; each player type earns four upgrades on average; about half the average bots tip at the door; `stats()` reports minutes per stretch by activity, seconds per bean and the pickup share; section 5 records the measured walking times and the run estimate they give; tuning comments updated. (Plan fix: M26 used to include Ekansh's real-device timing, which no agent can do, so that part moved to M27.)
- [x] M26b: Timing Tools on Any Device - The dev **Run Report** shows `stats()` as short text lines in a dialog, from the dev panel on desktop and from **Menu** on phones, and folded under the ending's secret; **Time 50 Beans** spills 50 beans ahead and toasts the seconds in Pickup and per bean once none lie behind, and the report lists each timing; `statsText()`, `timeBeans()` and `timings()` script the same; trial and report tests pass. (Plan fix: M27 asked Ekansh to read `__game.beans.stats()` on a phone, which has no console. Section 5's "How to Run M27" lists the steps.)
- [x] M26c: Key Speed Trial (Dev) - The Run Report dialog (and the dev panel) has **Key Speed**, which cycles how fast A, D and the tilt buttons turn the pot through 30°/s, 45°/s, 60°/s and 30 to 75°/s; the report's first line names the one in use, and `__game.beans.keySpeed(id)` sets it; the game itself keeps a steady 30°/s and the production build has no trial strings; the rising speed's bot numbers sit in section 5; a slosh test checks that a rising speed starts slow for taps, speeds up on a hold and restarts on a turn back. (Plan fix: M27 asks Ekansh to decide the keyboard gap, a feel change he had no way to try.)
- [x] M27: Lead Decisions Built - Build every item in Lead Decisions at the end of this file, re-run the bot balance pass with 16 or more seeds, and record the new average and unskilled run lengths in section 5. Done when the bot average is at least 65 min on desktop and phones, careful bots find at least 3 gossip pages, average bots find 7 to 9, and the Key Speed trial is removed with the chosen speed shipped. Built as: keys and tilt buttons turn the pot from 30°/s, rising to 75°/s over 0.2s (`keyRate`), and the trial's button, list and `keySpeed` are gone; `REPOSE` 9; gossip beans 26 u apart (needs 47 to 91) over a chalk glow; the street, market and park with doubled characters; Mrs Pryce, the sale and Bruno (`ambush.ts`, section 3); stretches of 1,500, 7,800, 7,800, 8,400, 6,000, 4,000 and 800 u; and the leftover-water prompt from 1.5 u. Over 20 seeds the average bot takes 70 min on a desktop and 80 on a phone, finds 7.3 pages, and the careful bot finds 3 (section 5, "What M27's Bots Measured"). `balance.test.ts` checks the minutes with `runMinutes` and the pages. Checked at 1280x800, iphone-12-pro and iphone-se (verification notes, round 12).

## 12. Code Map

<!-- Builders: one line per file, "path: what it does". Keep it current as files change. -->

- `index.html`: page shell with the viewport and theme colour.
- `src/main.tsx`: loads fonts and CSS, renders `App`. In dev, any hot update reloads the page fully, without the leave warning.
- `src/index.css`: shared styles plus the `wide` variant (landscape and 900 px or more) that switches bars to rails, `short` (portrait under 700 px tall) for the smaller phone prompt, and `sideways` (landscape under 500 px tall) for the turn-your-phone note.
- `src/App.tsx`: the layout grid (status, canvas cell with the kiosk panel, the Replay chip and the "Turn Your Phone Upright" note for sideways phones), the start screen, the replay dialog, the ending, and the dev-hook loader, which in dev builds also mounts the Run Report and hands it to the phone Menu and the ending.
- `src/dev.ts`: dev only. `window.__game.beans` (reload, start, stats (the run report from `runLog.ts`), statsText (the same as text), timeBeans (a 50-bean timed pickup, checked every 250 ms until none lie behind) and timings, state with street, market, park, grate, puddle, drying, flock, the net with each knot's direction, circles left and client position, packets, box, owned upgrades, tall, lid, mud, kiosk and coin detail, ledger, checkLedger (the total, zones, packets and the window box; the same check runs after every update step through `devHooks.afterUpdate` and logs the first mismatch to the console), jump, route, bot, giveGossip, spill(n, 'loose' | 'drain' | 'puddle'), finishWaits (drying and growing), box, givePackets(n), pickUpAll, toggleCarry, trigger('tip' | 'cat' | 'fridge' | 'neighbour' | 'cyclist' | 'shopper' | 'spoon' | 'ladder' | 'feet' | 'pigeon' | 'football' | 'dog' | 'whoa' | 'gust' | 'rain' | 'doordog' | 'ambush'), door(x) (Grandma's door with the pot in your hands at route x), count() (straight to her count with one bean under the doormat), with state() also showing the weather (gust, water, drift, roll, ducks, pouring), the door (dog, dustpan, Grandma's words, count phase and number, the mat, the bean's client position, the secret) and the replay (pending, the latest shot, open, whether a best still exists), own(id), addCoins, kiosk, sell, setInput, setMotion, assist, step, sounds (the latest sounds, loops and buzzes played, optionally clearing the log), captions (on screen now, with their extra line and score), beanPoints, toClient), with state() also showing the ambush and the tile count read off the walk scene, dev panel actions, including Run Report, Time 50 Beans, a Jump per stretch, Kiosk, +100 Coins, Own Built Upgrades, Bot Walk, Drain 3, Lose 10, All Gossip and a Trigger per event.
- `src/game/tuning.ts`: every gameplay number with a comment.
- `src/game/units.ts`: degrees, u/s to Matter speed, bean count formatting.
- `src/game/random.ts`: one seeded random stream per system (including `lines` for caption rotation).
- `src/game/ledger.ts`: bean places, `move`, `total`.
- `src/game/state.ts`: the `Game` state type, its parts (the run's stats with the played clock and each stretch's log, wallet, shop, street, market and park characters, the stretch's ambush, kiosk, the stretch's spill count, seed packets, the pigeon flock, the window box, the waiting replay, Grandma's door, the run's start time, the caption rotation and each cause's running score), the scenes (including `count`), events (including `replay`), input shape, `createGame(seed, route)`, `currentStretch`.
- `src/game/effects.ts`: `sound` and `caption` queue side effects for the runtime; a caption can carry a running score line and a key naming its kind, and `showing` tells whether a kind is on screen.
- `src/game/game.ts`: `updateGame` (logging each step's time first, slow motion skipped under Reduced Motion, the replay's settle clock, the door's timers and the count view's script too; the wall-clock waits first, then everything else unless the window box has paused the world), walking with slosh and spills, bean emission onto the ground profile, landing clamps, the teeter's creak, tip-over (which knocks the lid off and names the whole spill "Tipped it."), each spill's rotating caption with Grandma's line and the cause's running score, and its queued replay, the door stretch's walk step, `enterStretch`, the walk off a cleared stretch into the kiosk and `leaveKiosk`, set down (tipping the jar in; `setDownRefusal` refuses it with a buzz and a caption while the pot teeters, while beans pour over the rim unless rain has flooded it, and from an ambush's shout until its lunge lands) and pick up, taps that shoo pigeons (`pickupTap`, `groundTap`), dev helpers (`devJump`, `devKiosk` and others). Re-exports state and pickup actions.
- `src/game/emit.ts`: beans leaving the pot: `emitBeans` (spill events and juice), `throwBean` (one bean onto the ground with a particle, rolling down the slope to its foot with "Gravity: N. You: 0.", into the river off the bridge (30%, at most 30 per spill event), down a route drain at most 5 per spill event, or swollen into a puddle at most 10 per spill event), rim positions, landing clamps, and the plop, splash, ripple or doormat tick when a particle lands, with each kind of caption shown once per burst.
- `src/game/drainWorld.ts`: the Drain scene's shaft as a Matter world: drain beans under gravity, junk, and the hook that follows a pressed pointer, catches rising, drops on a jerk or a wall scrape, snags junk, and respawns wedged beans.
- `src/game/drainFlow.ts`: the coat hanger flow: where a zone's grate sits in Pickup (`grateSpot`), slow beans falling through it (`updateGrate`), taps on the fridge gap or a grate, opening and closing the Drain scene, captions, and fished beans landing as loose beans through `PickupWorld.fishOut`.
- `src/game/gossip.ts`: the twelve lines with prices (from `PAGE_PRICE_BASE` and `PAGE_PRICE_STEP`), bean needs and the editor's quip, slots that carry forward, line choice (a kitchen line you missed spells on later stretches after every other line), the hangman-style secret with its front-loaded reveal (`lettersRevealed`), and the funniest page found (`funniestLine`) for the ending card.
- `src/game/gossipFont.ts`: the stroke font: letter polylines (plus `_` for a secret letter not earned yet), row wrapping, and bean placement along strokes with exact counts.
- `src/game/gossipFlow.ts`: gossip in Pickup: spelling a line when Pickup opens, the first-line lock, warn then scramble, Jot It Down, and the splash size big hits need for the next line. Dev: `devGiveGossip`, and `devForgetSpelling`, which **Pick Up All** and **Jump** call so an unjotted line doesn't keep its slot after its beans go back.
- `src/game/hits.ts`: `characterHit` for telegraphed hits from characters (leaning against a hit halves its kick and splash; with the Pot Lid on a hit throws a quarter of its splash, and only a `hard` hit you didn't lean against knocks the lid off), `leaningAgainst` with an optional angle, and `dodged(cause)`, which pays `DODGE_COINS` (5) with the cause's rotating dodge line and its running score.
- `src/game/street.ts`: the street's characters: nosy neighbours (step out, walk over, peek and pull the front rim, or elbow you) and cyclists (seeded pause, bell, pass, startle), their pull on the pot, `streetWait` advice for bots, prompts, and dev triggers.
- `src/game/economy.ts`: the six upgrade definitions (`built` marks the ones that work: all six since M17), the shop's list, and the clean bonus tiers (Grandma's Door's paid when she starts counting).
- `src/game/upgrades.ts`: what owning an upgrade changes: `syncOptions` (the lid and Taller Pot switches, and the Bigger Window Box's extra row of slots, every step), the Wider Tweezers' grab, clump, strain and slippery numbers, the Pot Lid (`lidOn`, `lidRattle`, `lidHeld` when it keeps a hit in, `lidLaunch`, `lidLanding`, which lands it within the pot's reach even at a shut gate, `stepLid`, the "Fetch the lid" chore), Grippy Shoes (`whoaWindow`, mud after the park and rubbing it off at the kiosk), `pastItsUse` (why the shop disables Grippy Shoes once no wet grass lies ahead and the Pigeon Net once no birds do), the editor's word on each purchase (`bought`), and `devOwn`.
- `src/game/net.ts`: the Pigeon Net: laid at each set-down (`layNet`), tangled by the set-down's first pigeon (`tangleNet`), knot positions in either view (`knotSpot`), circling knots with `CircleGesture` (`netPress`, `netDrag`, `netRelease`), wrong-way tightening, pulling tight (`netGuards`), and the prompt.
- `src/game/drying.ts`: puddles in a zone's top-down view, beans landing swollen in them, the drying rack's spot, and one real-time drying timer per bean that drops it into the pot when done (`updateDrying`, with an injectable clock).
- `src/game/kiosk.ts`: the Weekly Whisper kiosk: opening it with the clean bonus (logged per stretch) and the editor's greeting (and tipping the jar into the pot), selling pages, the editor's bubble, and the chore check before Next Stretch.
- `src/game/packets.ts`: seed packets of up to 8 lost beans per cause and stretch, their labels ("Pigeon Tax, Park: 7", "Gull Tax, Market: 3"), `loseBeans` and `recordLost`, and `checkPackets`.
- `src/game/pigeons.ts`: the flock in Pickup and Grounded, pigeons or the market's gulls (named in captions, prompts and packets, with a gull's croak and cackle): arrivals on the stretch's rhythm (the first one tangles the Pigeon Net), walking in, diverting to a loose bean and pecking it, eating from the rim or pecking the untangled net and giving up, the running tax caption, the shoo that scatters them all with feathers (`flyOff` per bird), the prompt, and `devPigeon`.
- `src/game/windowBox.ts`: the window box: slots and their states, the layout of cards, slots and pods, press, drag and release (dig, choose, plant, water, pick), the plant and water holds with the flood, the shared grow timer (`updateGrowth`), Grandma's windowsill at the door (`sillPackets`, harvested into the stew with the batch), the jar (`tipJar`), the nudge, prompts and `checkBox`.
- `src/game/park.ts`: the park's characters: the kid's football (wind-up, flight, hit or dodge, the scoreboard), off-lead dogs that bark and jump at a walking pot or sit by a still one, wet grass and its "whoa" (`stepWet`), the dog in park Pickup (bark, dash, push, eat, shoo), `parkWait` advice for bots, prompts, the warning arrow's side, and dev triggers.
- `src/game/market.ts`: the market's characters: shoppers walking against you, stall spoons and the ladder man on their rhythms (`spoonOut`, `ladderSwinging`), no shoppers near the sale, shoppers' feet scuffing beans in Pickup, `clearCrossing` and `marketWait` advice for bots, prompts, and dev triggers.
- `src/game/kitchen.ts`: your kitchen: the counter cat's opening gag, the door cat's watch, groom and swat cycle (getting past pays a dodge) with `catAdvice` for bots, and the cat in kitchen Pickup that bats beans under the fridge and runs off when tapped.
- `src/game/route.ts`: the seven stretch definitions (length, gate, bumps, cobbles, stairs, drains, puddles, neighbour doors, cyclist triggers, gossip slots, pigeon rhythm (from the street on) and bird (gulls at the market), the kid's kicks, dogs, wet grass, the hill's slope, rain and gust rhythm, and each middle stretch's ambush, with M27's doubled characters and longer stretches), the ground profile with the slope's ramp (`groundDrop`, `groundY`), drain, puddle, wet grass and slope lookups (`drainAt`, `drainNear`, `puddleAt`, `wetAt`, `onSlope`), `dropSpan` (the ground's range over a stretch of route, for tiles), and the flat `TEST_ROUTE` for unit tests.
- `src/game/weather.ts`: rain filling the carried pot (and the prompt to pour off leftover rain water on later stretches) (not under the lid), beans floating out of a flooded pot (`flooded`), gusts (warn, blow with a swelling surface push and the pot's drift, calm, "Rode it out."), the rope bridge's roll (`deckRoll`) and crosswind lean with the sway's blame, the rain stopping at a set-down, Pour Off (`startPour`, which refuses in Pickup with "Not by the beans.", `updatePour`, `endPour`, `pourResult`), the prompt (from 3 u in the rain and 1.5 u of leftover water elsewhere, and saying to pour away from the spilled beans when a set-down would open Pickup), the warning side, and `devGust` and `devRain`.
- `src/game/replays.ts`: fail replays as game logic: a finished spill queues a replay request (caption such as "47 beans in 0.4s" or "Carried for 1:02:41. So close." by played time, without menus, blame with the caption's own lead-in, whether it opens by itself or offers Share, whether it is the biggest), merges with one still waiting, and asks the runtime to cut the clip 1s after the last bean lands or at once when you leave the walk view; `formatRunTime`.
- `src/game/door.ts`: Grandma's door: the doorstep dog (bark, leap, "Made it!" or the whole-pot tip with the dustpan), the bean that rolls under the doormat, the top-step stop and what holds the count (`countBlocker`, the dry chore; seed packets don't), the count along its cubic curve (`countAt`), paced to end no sooner than the window box's batch, with Grandma's lines, handing waiting packets to her windowsill while a batch grows (her bubble says so, after "There we are." when both happen at once, and a caption names how many packets and beans she took), the door's clean bonus when she starts counting ("Not a bean on her steps."), the shortfall hold ("Still N short" waits for her current line) and counting on at 12 a second once she has waited, lifting the doormat and dropping the bean in the stew (`doorPress`, `doorDrag`, `doorRelease`), the taste script, the secret laid out in beans, prompts, bot advice and dev helpers.
- `src/game/bridge.ts`: rope bridge Pickup: the deck's slide from its roll, beans lost off the edges or through the gaps as River Tax, ducks bringing flung beans back ("Grandma saw that."), and the prompt.
- `src/game/terrain.ts`: ground hazard kicks scaled by speed squared, the cobble rhythm, and the kick juice (sound, shake by size, a buzz on every kick from `kickBuzzMs`, side arrow, hurried causes).
- `src/game/bot.ts`: seeded scripted players (careful, average, keyboard, sloppy) that roll their heed per telegraphed event (cat, street, market, park, gusts, Grandma's dog), lean against characters' pulls and the wind's drift (bracing as a gust they read hits), look ahead for bumps, cobbles and wet grass, and set the pot down to pour off rain (out of the rain, as soon as the prompt asks from 1.5 u); they know nothing of the ambushes, like a first-time player; `runStretch` walks one stretch to its kiosk or Grandma's top step, picking up after each spill like a player (gossip spelled and jotted, far beans left for one trip back from the gate) and selling pages, and reports spills, walking and walk-back seconds, beans picked, fished and lost, pages, coins and a doorstep tip; `runRoute` walks one game through the whole route. Balance tests and the dev Bot Walk use them.
- `src/game/ambush.ts`: the street's, market's and park's ambushes (Mrs Pryce, the sale, Bruno): the early tell, the shout with its caption and prompt, coming out just ahead of the pot, the lunge, then a hit sized for the next gossip line or a dodge with coins and a score; `ambushComing` (from the shout until the lunge lands, while Set Down is refused), the warning side, and `devAmbush`.
- `src/game/pacing.ts`: `runMinutes` turns a `runRoute` run into section 5's minutes for a desktop, phone or unskilled player (walking factor, seconds per bean, the door's dustpan, chores and kiosks).
- `src/game/slosh.ts`: pot angle with rate control (keys turn it at `keyRate`, from 30°/s rising to 75°/s over the first 0.2s held one way), characters' pull (`lean`), the weather's `drift`, the slosh spring, margin, weir spill, teeter and tip (`pastTipAngle`, with the Taller Pot's own-tilt rule).
- `src/game/spill.ts`: spill events with their durations, causes (including the football, dogs, wet grass and Grandma's dog), `causeText` (the plain lead-in), `spillHeadline`, and Grandma's lines in six tiers of 4 or 5 (a doorstep tier where she watched it happen) through `grandmaLine`.
- `src/game/lines.ts`: every recurring caption's 4 to 6 versions (`LINES`, spill lead-ins per cause, dodge lines per character, Mrs Pryce, the sale and Bruno included), `LineBook` (the plain version first, then a shuffled bag per kind with no repeats), and the running scores per cause family (`scoreFamily`, `scoreHit`, `scoreDodge`, "Ladder: 2. You: 0.").
- `src/game/walk.ts`: speed with an optional cap (stairs, which still lets you stop) and uphill scale (the slope), footsteps, sway, the walking thumb's slide mapping.
- `src/game/zones.ts`: spill zones, landing and merging, the 200 cap and pile, swollen beans among a zone's positioned beans (`puddleFromPot`), "Behind", ledger checks.
- `src/game/pickupWorld.ts`: the Matter world for one zone: bodies, walls (with a lower top edge in the kitchen), clamp, kinematic tweezers and hands, pile scoops, dribbles, deck slide, a drain grate that swallows slow beans (`swallowSlow`, with sinking beans to draw), puddles that swell resting beans (`swellSlow`), swollen bodies the pot bounces out and the drying rack takes, the bridge deck (beans start on the planks; `river` loses beans past the edges or slow over gaps and hands flung ones to ducks, which bring them back), `sendToDrain`, `loseBean` (a pigeon eats it) and `fishOut`, and gossip letters (out of the simulation while they slide, still obstacles once settled, written back as gossip beans).
- `src/game/runLog.ts`: where the time went: `logStep` adds each update step's real ms to the played clock and the stretch's scene, `stretchLog` holds each stretch's spills, potted and lost beans and clean bonus, `runReport` sums it all for the dev `stats()`, `reportText` writes it as short lines for a phone, and `startTrial` and `trialResult` time a dev pickup of 50 beans in Pickup seconds.
- `src/game/pickup.ts`: pure pickup rules: strain, drop captions, pop pitch, streaks, scoop sizes.
- `src/game/pickupFlow.ts`: Pickup actions: open and close (with the zone's grate, puddles and rack, the park dog's clock, the hill's creep downhill, and Grandma's dustpan on the door stretch after the dog tipped you), the pile mound's capped radius, press, drag, release (the pot refusing swollen beans, the rack starting their timers), hold-to-cup, dribble, drops, swelling, the opening bean's caption, and the clear caption ("This patch is clear." while beans wait elsewhere in the stretch, "All clear." otherwise).
- `src/game/gate.ts`: the stretch-end gate, its buzz and arrow, what the buzz says (`gateRefusal`: the beans behind, the lid, or the first blocking chore), the far-end exit to the next stretch, and the "Pick up N beans" and "Fish N beans out" chores, which block leaving and Grandma's `count`.
- `src/game/pinch.ts`: the phone pinch rule in CSS px (closing share or gap), the lifted tweezer tip.
- `src/game/fx.ts`: walk-view geometry constants, the `Ripples` ring buffer where beans drop into water or drains, (including where the pot sits once set down, and `potDepth` for the Taller Pot), pooled bean particles (at most 160) that know where they land (ground, drain, puddle, river or under the doormat), report the spot, and can roll down a slope after landing, and caption data with at most 3 on screen. The kick arrow and title card state live in `FxState`.
- `src/game/hud.ts`: the HUD store (whether the ending is open, stretch name, Jot It Down, notebook pages with their line ids, the secret so far, the kiosk's summary while at the kiosk, beans drying, beans lost, the grow timer, whether the box wants you, whether Pour Off can start) and the next-step prompt, including the count view and the door, an ambush's escape, the street's characters, swollen beans, "This patch is clear." while beans wait elsewhere, the Pigeon Net's knots, pigeons, the window box and its nudges, and the kiosk.
- `src/game/testing.ts`: `simulate` and `testGame` for unit tests.
- `src/game/*.test.ts`: ledger, slosh (including a key speed that rises while held), spill, walk, zones, pickup, pickupWorld (headless Matter), gate, pinch, terrain (route, ground hazards, transitions through the kiosk), street (neighbour step-out, elbow, peek and dodge, cyclist bell timing, startle and dodge, drain caps, the Pickup grate), economy (bonus tiers, prices, the kiosk's bonus, sales and Next Stretch), drying (puddle caps, swelling in Pickup, the pot's refusal, the rack's timers on an injected clock, the gate ignoring drying beans), market (rhythm maths, spoon pokes and dodges, the ladder's splash and scoreboard, shoppers' timing, bumps and dodges, the feet's scuff), kitchen (the gag, the door cat, leaning, the Pickup cat, and a whole kitchen from the gag to the street), drain (the hanger's catch, lift, jerk, scrape, snag, wedge and the fishing flow), gossip (font counts and wrapping, slots, line choice, the secret, lock and jot, warn and scramble, letters kept clear, the cat's line), pigeons (packets of 8 and their labels, eating from the pot, at most 3, leaving on pick-up, the flock's scatter and return, diverting within 60 u and not beyond, a click shooing instead of grabbing, a pigeon every 30s on the street and a gull at the market), windowBox (the paused world, 6 dig strokes, planting holds and 3 packets a slot, the flood, one timer per batch with holes staying dug, the jar and its tip, the nudge), park (the football's hit and its dodge, dogs jumping or sitting, wet grass at a stroll, a slip, saves by letting go and by leaning, the Pickup dog's dash and eating cap, shooing it, pigeons every 15s), upgrades (all six in the shop, wider grabs, clumps of 5, the lower strain limit, the lid's 6 a second cap, its rattle and quiet stroll, a lidded elbow throwing a quarter of a plain one, a leaned-against hard hit leaving it on, its launch on a hard hit, chore and fetch, a tip at the shut gate landing it where the pot can fetch it and the gate opening, the gate naming it once every bean is in, the shoes' longer whoa, the mud and its 24 rubs, no mud without them, the Taller Pot's margin and calmer hurry, its own-tilt tip rule, the bigger box's extra row), net (tangling on the first pigeon, eating while tangled, circles loosening and wrong ways tightening up to 5, pigeons giving up on an untangled net, flinging perched ones, re-tangling every set-down, Pickup, nothing without the upgrade), windowBox (also each slot watered on its own with the bigger box), weather (the 12° slope and 70% uphill speed, slope spills rolling to the foot, rain filling the carried pot and stopping on the ground, the lid keeping it out, a flooded pot floating beans out, Pour Off's three outcomes and its packets, a gust's 1.2s warning and its spill, leaning into one, hill Pickup's creep), bridge (the roll and crosswind, at most 30 river beans per spill as River Tax, a tip losing only that cap, the slide's 60 to 90 u/s at big peaks, beans lost off the deck), pickupWorld (also the deck: starting on the planks, edges and gaps, ducks), fx (particle landing times), replays (no replay under 3 beans, the cut 1s after the last bean lands, auto at a new biggest of 30 or more, Share from 100, a tip mid-spill, the cut on setting down, run-time format), lines (rotation without repeats, 4 to 6 short versions per kind, score families, the score under a spill caption), juice (slow motion off under Reduced Motion, a buzz on every ground kick, at most 3 captions, ripples on river landings, the 160-particle cap), ending (the dog barking on the steps, stopping or leaning to save the pot and hide one bean, walking on to tip the whole pot with a "Carried for" replay and a dustpan pile of about 17 scoops, counting with packets unplanted, Grandma's windowsill growing what the busy box can't take, the count curve, a count stretched to the batch, the shortfall hold and the harvest resuming it, the doormat, the bean, the taste, the secret and the end) runLog (time per stretch and scene, the pickup share and seconds per bean, coins by source, "Carried for" by played time, a timed pickup from its spill until none lie behind, the report's text fitting a phone) and balance (whole-route runs for four bots against section 5's budgets, coins for four upgrades, pages, the door's tip rate, and single stretches for hurrying, the river, pouring off and walking blind) tests. Walk also checks stopping on stairs after a hurry. Upgrades also checks a tip-over knocking the lid off and scattering half the loose beans; gossip the funniest page and the `_` glyph.
- `src/scenes/runtime.ts`: owns the game, input, scenes (walk, Pickup, Drain, kiosk, window box, the count view) and loop; plays the rain, wind and pour loops (the pour also while you water the window box); logs sounds and buzzes for dev through `devHooks.ts`; films the walk view for replays and cuts clips when the game asks; starts the run's clock (`begin`); routes presses on the doormat and its bean in the count view; plays the rain, wind and pour loops; routes P for Pour Off, E and pointer input in the window box, knot circles and taps on Grounded pigeons; plays queued sounds; publishes the HUD; sells pages for the kiosk's buttons; in dev builds runs `devHooks`' input driver (such as a bot) and after-update check, and with `?debug` draws `debugOverlay.ts`.
- `src/scenes/devHooks.ts`: dev only: the slots `dev.ts` fills (the input driver such as a bot, the after-update check such as the bean ledger) and the sound log. The runtime reads them behind `import.meta.env.DEV`, so production builds drop it.
- `src/scenes/debugOverlay.ts`: dev only, with `?debug`: Matter bodies in Pickup and the Drain scene through `drawPhysicsDebug`, and in the walk view the slosh numbers (sigma, phi, psi, margin, the spill line, overflow d, spill rate Q, danger, water, teeter) and each zone's anchor with its bean counts and the bar Set Down reaches it from.
- `src/scenes/input.ts`: pointer, keyboard, motion source (real or dev stub), `TiltAxis`, tilt buttons, dev overrides into one `GameInput`.
- `src/scenes/pickupControls.ts`: Pickup pointer handling: circling the Pigeon Net's knots (a second finger turns that into a pinch), mouse and Assist drags, two-finger pinch with the lifted tip, one-finger touch scoops, taps (a click, or a finger lifted where it landed) for shooing, and a let-go safety net when no finger is down.
- `src/scenes/camera.ts`: follow in x and y, shake, and camera-safe stamps.
- `src/scenes/tiles.ts`: cached 800 u background tiles for one stretch, each only as tall as its own ground needs, one painted ahead in the walking direction, at most 3 alive.
- `src/scenes/captions.ts`: draws captions with pop-in, rise and fade: the headline, an optional smaller line and an optional running score.
- `src/scenes/film.ts`: the fail replay recorder over the shared `ReplayRecorder` (the design area at 24 fps, 240 x 320, two frame sets), the `film` store React reads (the latest shot, open, seen), `openReplay` and `closeReplay`, and the biggest spill's still kept for the ending card.
- `src/scenes/doorScene.ts`: the count view at Grandma's door: the cached doorstep, Grandma counting, tasting, salting or shrugging, her dog sneezing, the stew pot, Grandma's windowsill planter sprouting your leftover packets with the batch, the doormat with its lump and the glinting bean, the big count, her bubble, and the secret's beans flying out of the stew into letters.
- `src/scenes/walkScene.ts`: the side view: sky, per-stretch tiles sized to their ground (reaching over what a tall phone cell shows below the design, rebuilt when that changes) with the fill beneath starting under the highest ground in view, ripples, Grandma in her doorway with her dog sitting, barking or leaping at the pot and the WELCOME mat (lumpy once a bean hides), her speech bubble, the bridge's duck and rolling handrails, open front doors, zones and gate on the ground profile, neighbours, stallholders with their spoons, the ladder man and shoppers behind you, the ambush (Mrs Pryce's twitching curtain and rush from her door, the sale's sign and stampede, Bruno asleep by his bench on a red lead and charging) and its speech bubble, the park kid with the football's dashed path and dogs in the grass behind you, the ball and running, jumping or sitting dogs in front, cyclists in front, you and the pot (deeper for the Taller Pot, tipping over its front corner during Pour Off with its stream and meter) with the window box, the jar and the drying rack on your back, the Pigeon Net over the grounded pot, pigeons and feathers while the pot sits on the ground, rain and gust leaves, particles, the kick arrow and the warning arrow for a coming hit, speech bubbles, the bell's warning, captions and the stretch title card. The camera follows the ground up and down and snaps on a new stretch. Its `tiles` field is public so dev can count them.
- `src/scenes/boxScene.ts`: the window box over a blurred copy of the last frame: the title, one caption at a time, packet cards (the chosen one lifted), the cached planter, each slot's soil, hole, flags, sprouts or pods with faces (and the pea in disguise), the batch clock, flashes, the planting ring, digging dirt, and the watering can with its fill and flood bar.
- `src/scenes/kioskScene.ts`: the kiosk between stretches: the cached booth and street, the editor, you with the pot (and its lid) at your feet, the muddy boot card while your shoes need cleaning, the sandwich board with your latest headline, and the editor's bubble, all above the kiosk panel.
- `src/scenes/pickupScene.ts`: the top-down view (Grandma's dustpan instead of cupped hands when it scoops the doorstep pile): a ground per stretch (kitchen tiles and fridge, market cobbles, park grass, the hillside with contour lines and downhill arrows, the bridge deck over the river with the tip arrow and ducks, paving elsewhere), shoppers' feet crossing in the market, the park dog, the zone's drain grate with its count and beans sinking through it, puddles, the drying rack with its beans, swollen beans, beans, gossip letters over a pale glow with their warning shiver and the jot bar, pile, the pot (its heap shrinking into the enamel bottom with its fill, empty once it holds none), the kitchen cat and batted beans, pigeons and feathers, tweezers, cupped hands, cup timer.
- `src/scenes/drainScene.ts`: the Drain scene: the shaft (a street drain or under the fridge), gunk, junk, beans, the held bean reddening near a jerk, and the bent coat hanger.
- `src/scenes/art/colors.ts`: game colours.
- `src/scenes/art/bean.ts`: bean painting and cached bean stamps (walk, pickup, strained, the darker gossip letter, and swollen beans for both views).
- `src/scenes/art/pot.ts`: the side pot with its sloshing heap and the beans on it (glazed blue by rain water, none once the pot is empty) and rim glow (or the Pot Lid rattling on it), deeper for the Taller Pot, and the top-down pot drawn by its fill.
- `src/scenes/art/grandma.ts`: Grandma Doris from the front (slippers, grey skirt, purple cardigan with a bean brooch, bun, round glasses, wooden spoon; waiting, counting, tasting, salting or shrugging), her small white dog with a pink bow (sitting, barking "WOOF!", jumping, sneezing "Atchoo!"), the steaming stew pot, and the WELCOME doormat close up (lifting, with a lump) and side-on.
- `src/scenes/art/whisper.ts`: the Weekly Whisper front page for a page's share card: masthead, EXCLUSIVE stamp, the line spelled out in beans, and the editor's verdict.
- `src/scenes/art/bridge.ts`: the duck (paddling, or carrying a flung bean), rope handrails that sag between posts and lift with the roll, the bridge deck from above for Pickup, and the arrow showing which way it tips.
- `src/scenes/art/weather.ts`: rain streaks over the view, leaves streaming in a gust, the Pour Off stream (with beans past the green), and the Pour Off meter.
- `src/scenes/art/net.ts`: the Pigeon Net side-on and from above: neat mesh, bunched mesh with knots (hatched balls with their circles left, curved arrows, red flashes when they tighten, a burst when undone), and the arc of the circle in progress.
- `src/scenes/art/player.ts`: you: legs, shoes (plain, Grippy with zigzag soles, or muddy blobs), jumper, face that reacts to the slosh, arms.
- `src/scenes/art/backdrops.ts`: one backdrop per stretch (kitchen, street with curtains, lamps and numbered doors, market, park with benches and a pond, hill with a climbing ridge, rain clouds, a fence, signs and a bench at the top, bridge with posts over the river, door, with Grandma's purple door where she stands past the top step): scenery, the walking band on the ground profile (its grass hatching on a grid fixed to route coordinates, so it runs on unbroken from tile to tile), sky and below colours, and a street door standing open while its neighbour is out; `houseWindow` gives Mrs Pryce's window for her curtain.
- `src/scenes/art/hazards.ts`: potholes, cobbles, kerb crossings, stair nosings, drain grates, puddles, wet grass and the hall rug, painted into tiles.
- `src/scenes/art/gate.ts`: the stretch-end gate with its arrow, or your front door scrawled "OUT".
- `src/scenes/art/people.ts`: the three neighbours (gown and curlers, cardigan and tea, hoodie and headphones) and Mrs Pryce (leopard coat, headscarf, big glasses and opera glasses) stepping out, walking, peeking with a hand on the rim and elbowing; the cyclist with speed lines and "DING!"; the bell warning; wobbly speech bubbles that wrap.
- `src/scenes/art/kiosk.ts`: the kiosk's static art (brick wall, pavement, booth, awning, sign with its name squeezed to fit, papers), the editor in his green visor, and the sandwich board.
- `src/scenes/art/park.ts`: the kid in a backwards cap winding up and kicking, the football and its dashed arc and landing ring (`arcPoint`), the scruffy spotted dog side-on (lying, running, jumping, sitting; `BRUNO` draws the Great Dane 1.7 times bigger in grey) and from above, "WOOF!", the bench, the pond and wet grass.
- `src/scenes/art/ambush.ts`: the ambushes' extra art: Mrs Pryce's twitching curtain with eyes, the flashing SALE! sign, Bruno's red lead and his snore.
- `src/scenes/art/market.ts`: shoppers with seeded coats, hats and bags; stallholders in aprons with a tasting spoon and its blob of chutney; the ladder man in overalls with a ladder that turns broadside.
- `src/scenes/art/mud.ts`: the muddy Grippy Shoe on a card at the kiosk, its mud spots coming off as you rub with flecks flying, and the rub count.
- `src/scenes/art/shout.ts`: `shoutSize`, the bounce of a character's shout ("WOOF!", "SWAT!", "DING!"), still under Reduced Motion.
- `src/scenes/art/pigeon.ts`: pigeons, or bigger white gulls, from above and side-on (waddling, pecking, perched with a "-1" or a puzzled "?" at the net, flapping off) with one wild eye, and drifting feathers.
- `src/scenes/art/cat.ts`: the orange cat side-on (watching, grooming, smug, running, reaching paw, "SWAT!") and from above (with the bum wiggle).
- `src/ui/Hud.tsx`: status bar or rail (95 to 100 px on phones: counts, Lost, coins as a compact count on phones and a `CoinBadge` on wide screens, slosh meter, beans drying and growing as compact countdowns on phones and `TimerChip`s on wide screens, prompt, chores) and the action bar or rail: Set Down, Pick Up, Back or Next Stretch, Window Box (Box on phones, wobbling when it wants you), tilt hold buttons on phones without tilt, Jot It Down while gossip waits, Pour Off while the grounded pot holds rain, the Notebook and Settings rail buttons, and Close Box alone while the box is open; the count view keeps only the box.
- `src/ui/Kiosk.tsx`: the kiosk panel over the lower part of the canvas cell: the stretch report and clean bonus, Sell Gossip with a button per page, the shop of built upgrades (telling the game what you bought, and disabling ones past their use with the reason through `ShopPanel`'s `unavailable`), and the chores holding you on phones.
- `src/ui/HoldButton.tsx`: a hold-to-act button with pointer capture that releases on cancel, lost capture, blur and unmount.
- `src/ui/Notebook.tsx`: the Notebook modal (jotted lines as Weekly Whisper clippings, each with Share This Page, and Grandma's secret so far) and the phone Menu modal that leads to it, to Settings, or in dev builds to the Run Report.
- `src/ui/Replay.tsx`: the corner Replay chip that fades after 4s, and the replay dialog (the caption, the clip in slow motion, the blame, Watch Again, Share for big spills and tip-overs, Carry On).
- `src/ui/Ending.tsx`: the ending screen once the secret is spelled: the story, the secret as revealed, the stats (Time is played time, without menus; Clean Stretches counts the stretches that paid the full clean bonus; Coins is what you finished with), the ending share card (its dialog headed "Brag About It"), and in dev builds the folded Run Report.
- `src/ui/DevReport.tsx`: dev only, imported by `dev.ts` alone: the Run Report dialog (the report as selectable text, Time 50 Beans, Close) and the folded copy for the ending.
- `src/ui/Settings.tsx`: the Settings modal: shared settings plus Level Here and a note on what Assist Mode changes here.

### Verification Notes

- M1 and M2 were checked in the T3 preview at 1280x800, iphone-12-pro and iphone-se by stepping the loop with `__game.loop.step` and scripted key and pointer events.
- M3 was checked at iphone-12-pro and iphone-se with synthetic touch pointers: thumb walking and the hurry slide, tilt hold buttons (hidden once device tilt works), the dev motion stub through the real `TiltAxis` path, 150 to 90 CSS px pinches, Assist one-finger grabs, one-finger pile scoops, and canvas-equals-cell after rotating to landscape and back.
- M4 was checked at 1280x800 and iphone-se: Esc and the Menu button open Settings, game time stops while it is open and resumes after, and the page leaves localStorage, sessionStorage and IndexedDB empty with no requests to other origins.
- The phone top bar is 115 px, not the planned 52 px, because it holds the two-line prompt and the Menu button. The iPhone SE design scale is 0.59 instead of 0.625, so Pickup beans draw about 12 CSS px long. M25 should trim the bar, for example to a one-line prompt.
- Background preview tabs throttle timers after a few minutes, so long scripted runs with real-time gaps between events can stall. Keep scripted runs short or step the loop between events.
- Frame check (M2): a settled 200-body Pickup costs about 1.0 ms of script per frame on the dev machine, 1.5 ms while beans move; walking costs 0.12 ms. The preview has no CPU throttling, so M25 still needs a trace on a real phone.
- M5 was checked at 1280x800, iphone-12-pro and iphone-se: every stretch through `jump(n)`, a stroll from the kitchen through its door into the street, the street's pothole, kerb, cobble rhythm and stairs (speed held at 80 u/s, ground 80 u lower, camera following), the "Hurried into a pothole. 28 beans." caption with its arrow, and at most 3 tiles walking either way at both sizes. Script time per step while walking, a 300-bean zone in view included, is 0.1 to 0.3 ms median and 1 ms at the 95th percentile at iphone-se.
- Measuring raster time with `getImageData` readbacks is unreliable here: after a few readbacks Chrome moves the canvas to software rendering and every frame costs about 33 ms. Stepping without presenting also batches many frames into one flush, which shows as 50 to 200 ms spikes every 160 steps. Neither happens in normal play. M25 needs a trace on a real phone.
- Ground hazards alone (no characters yet): a careful bot spills nothing on any stretch; the average bot spills about 10 beans on the street and 0 to 35 elsewhere; hurrying the whole street spills about 370.
- Dev tooling: once the game has started, the leave warning blocks every reload of a preview tab, and `preview_navigate` to the same URL does nothing. Use `__game.beans.reload()`, or open a fresh tab. Dev builds now reload fully on every hot update, so an old game loop can no longer keep drawing under a new one.
- M6 was checked at 1280x800, iphone-12-pro and iphone-se: the opening gag (Pick Up disabled, paw to the rim, the bean dropping, Pickup opening), potting it with a mouse drag and with a two-finger pinch, the walking tutorial in key and touch copy, stopping until the door cat grooms and passing with "Not today, cat.", strolling in for a 60-bean swat with the paw and "SWAT!" in front of the pot, the Pickup cat's walk-in, wiggle and bat with "1 under the fridge", and shooing it with a click and with a finger tap.
- M8 was checked at 1280x800 and iphone-12-pro: a click and a finger tap on the fridge gap and on a street grate open the Drain scene in its two looks, a real mouse drag hooked a bean and lifted it out ("Back you come. 2 to go."), a finger drag hooked one on the phone, and the Back button returns to Pickup. Drain grates only show in Pickup while a zone has drain beans; M9 places drains on the route and adds the rule that slow beans fall through a grate.
- M7 was checked at 1280x800 and iphone-se: the cat swat's beans spelling "THE CAT KNOWS", the first-line lock ("Jot it down first.") on a click, jotting with a held J and with the phone's Jot It Down button, the Notebook opened with N and through the phone Menu, and "MAYOR WEARS A WIG" in two rows with the other beans scattered clear. At iphone-se the letters are about 26 px tall; they read, but only just, so M25 should judge them on a real phone.
- M7 fixed a bug from M1: the landing time of a spilled bean used the wrong sign for beans thrown upward, so the ledger landed them much closer than their particle flew. Spills now land 30 to 120 u away as section 3 says, and big hits such as the cat's swat throw beans about 270 u.
- M9 was checked at 1280x800, iphone-12-pro and iphone-se: the gown neighbour stepping out with "Ooh, what's in the pot?" and the teaching caption; a stop, a peek held level with real A and D key events (2.6° at most, no spill, "Not today, curlers. +2 coins"); on the phone, a thumb on the street to walk, then the Tilt Left and Tilt Right hold buttons through the pull and the release (4.5° at most, both prompts shown, +2 coins); walking into her for "Oops! Clumsy me." and "Elbowed by a neighbour. 107 beans."; the cyclist's bell, "DING!", the warning arrow and "Startled by a bike. 9 beans."; a big hit beside the drain sending exactly 5 beans down with "Down the drain."; the Pickup grate under "CHOIR MIMES" and a real mouse drag dropping a clump of 3 through it; the careful bot walking the whole street with no spill and 8 coins from four dodges; and the phone bar with Pot, Behind, coins and Menu in one row at iphone-se (110 px tall, down from 115).
- Synthetic pointer events fired in one script call arrive microseconds apart, so the tweezers read them as impossibly fast and drop the bean ("Too jerky."). Space drag events about 16 ms apart in real time with `await`, stepping the loop between them.
- A drag that starts within about 12 u of where it ends counts as a tap, so dragging a bean that sits next to a grate onto it opens the Drain scene instead. That is the tap rule working; pick a bean further away.
- M10 was checked at 1280x800, iphone-12-pro and iphone-se: the careful bot walking out of the kitchen opened the kiosk by itself with the 20-coin clean bonus (plus 2 for dodging the cat); a real click on Sell paid 21 coins with the editor's "Everyone suspected. Now it's news." and the sandwich board chalking the headline; Space walked on to The Street with its title card; on the phone the panel scrolled under the kiosk drawing, a tap sold "CHOIR MIMES" for 39, and the Notebook stamped both sold pages SOLD.
- Balance with the street's characters (12 seeds): the careful bot spills nothing on any stretch; the average bot spills about 178 beans on the street (20 to 348 per seed), the keyboard bot about 124, and a bot that reads nobody about two elbows and a startle. Bots never open Pickup, so no gossip line ever starts and every elbow throws the 87 beans "MAYOR WEARS A WIG" needs; in real play the second and third elbows throw 65 and 50. The plan's 110 for the average street stays the M26 target.
- M15 was checked at 1280x800 and iphone-12-pro: walking up to the first crossing for "Heads up!" with the kid's wind-up, the dashed arc and the landing ring, strolling on into "Football to the pot." and "Kid: 1. You: 0.", and on the phone stopping at the shout for "Not today, kid. +2 coins"; the second kick coming from behind with the arrow pointing forward; the first dog's "WOOF!" run from behind and, stopped too late, "Jumped by a dog. 24 beans."; hurrying onto the second wet patch for "Whoa! Let go of W, or lean on A!", and on the third a real D key press 100 ms in for "Saved it! +2 coins"; park Pickup on grass with the dog barking at the edge ("A dog! Click it before it dashes.") and then dashing through the beans, knocking 24 aside. Bots over 8 seeds: careful 0 beans and 10 coins, keyboard about 63, average about 93 (mostly footballs), and a bot that reads nobody about 223, against the plan's 150 for an average park, which stays an M26 target.
- M16 was checked at 1280x800 and iphone-12-pro: real clicks buying the Wider Tweezers, Pot Lid and Grippy Shoes at the street's kiosk with the editor's remarks; the lid on the pot, a dev ladder hit knocking it 240 u back with "The lid!" and "Fetch the lid" in the chores, then walking back over it for "Lid back on."; hurrying onto the market's cobbles for "The lid rattles." and one bean out; zigzag soles in the walk view; a grab from 40 u away with the wider-open tweezers in market Pickup; and on the phone, the park's kiosk with "Wipe your feet first, love.", the muddy boot card, 24 synthetic finger rubs to "Squeaky clean. Off you go.", and Next Stretch leading on to the hill with the lid on. Clumps of 5 were checked in unit tests only, since the preview's spills left no tight bunches.
- Preview screenshots of a background tab can show a stale canvas, and the page's own loop can advance a few steps of real time while one is taken. Step the loop and take the screenshot again before trusting it, and resolve timed moments (a whoa, a bark) inside one scripted call.
- M12 was checked at 1280x800 and iphone-12-pro: the first stallholder poking the spoon out with "Try the chutney!" and the prompt to pass while it is pulled back; the careful bot crossing the market's first half with no spill and 10 coins from five dodges; the ladder man sweeping broadside with "Mind your backs!", and strolling into a sweep for "Ladder to the pot. 128 beans." and "Ladder: 1. You: 0."; a shopper coming with "Excuse me!" and a warning arrow; market Pickup on cobbles with "MAYOR WEARS A WIG" spelled from the ladder's beans, the shoes crossing ("Feet!") and scuffing 23 beans; and the walk view with the ladder man and a shopper on the phone. Bots over 8 seeds: careful 0 beans, keyboard about 8, average about 77 (mostly two ladder hits in eight runs), against the plan's 140 for an average market, which stays an M26 target.
- M11 was checked at 1280x800 and iphone-12-pro: a big hit beside the market's first puddle swelling exactly 10 beans ("That bean is swimming now."); Pickup showing the puddle with fat, pale swollen beans and the drying rack; a real mouse drag of a swollen bean onto the pot bouncing back with "Too swollen. Put it on the rack."; a drag onto the rack starting the "Drying 1" chip at 0:03 with `?fast` and the bean on the rack; "A dry bean hopped back in." 3s later with the pot one bean fuller; and on the phone the compact countdown beside the slosh meter and the rack on your back in the walk view.
- M13 was checked at 1280x800, iphone-12-pro and iphone-se: in the park, a pigeon walking in while the pot sat on the grass, hopping onto the rim with "-1" floats and "Pigeon tax. Click a pigeon to shoo the lot.", a real mouse click on a second, walking pigeon scattering both with feathers and "Shoo! They'll be back."; in park Pickup two pigeons perched on the pot and a third walking in, then a synthetic finger tap scattering all three on the phone; "Lost 10" in the phone bar's meter row and "Lost" in the rail; packets labelled "Pigeon Tax, Park: 8"; and the ledger check clean throughout.
- M14 was checked at 1280x800 and iphone-se (iphone-12-pro for the box view): E opening the box over a blurred park, real pointer rubs digging two slots, taps choosing packets and holds planting them, one hold watering both planted slots with the fill bar turning red and "Let go!", "Growing 0:03" in the phone bar and on the planter, pods with faces and the pea in disguise, picking them into the pot (+8 each), holding past 1.8s drowning a slot back to bare soil with its packet returned, the Box button opening it on the phone with Tilt Left, Set Down, Box and Tilt Right fitting in 375 px, picking into the jar while carrying ("+8 beans in the jar." and the jar on your back), and "The jar tipped in. +8 beans." at the next set-down.
- M17 was checked at 1280x800 and iphone-12-pro: real clicks buying the Pigeon Net, Bigger Window Box and Taller Pot at the market's kiosk with the editor's "A taller pot. Tips easier, mind." and the deeper pot at your feet; in the park, the net laid over the grounded pot, the first pigeon tangling it ("The net's in knots."), a wrong-way mouse circle tightening a knot to 3 with a red flash, right-way circles undoing all three ("Knot undone. 1 to go.", "Net's on."), and the pigeon arriving, pecking the net with a "?" ("The net says no."), giving up after two pecks and flying off with the pot still at 10,000; on the phone, one-finger circles undoing the knots on the grounded pot and in park Pickup, and a second finger landing during a knot circle turning it into a pinch; the Taller Pot carried 1.4 times deeper, a 4s hurry spilling nothing, a 40° lean into a park dog's jump teetering and tipping it while the plain pot survived the same lean and jump; and the 6-slot box at both sizes with real rubs, taps and holds, where watering one slot left the other planted. On the phone the side-on knots are about 40 px across: readable, but Ekansh should judge them on a real phone (M25).
- M18 was checked at 1280x800 and iphone-12-pro: walking up the slope at 56 u/s with rain streaks, the water rising 0.12 u a second, a gust's leaves and warning arrow, "A gust! Lean into it with D.", the pot tipping in the wind with beans pouring off the back rim and rolling down the slope to its foot under "Gravity: 2. You: 0."; setting down for "Of course it stops now.", holding a real P key for the tipping pot and the meter, letting go in the green for "Poured off. Not a bean lost.", holding to the end for "Poured 99 beans out too." and 13 Pour Tax packets (since fixed to exactly 100 at a full hold); hill Pickup on the hillside with "It's a hill." and free beans creeping left about 5 u/s; on the phone a held thumb walking up with the tilt buttons, a flooded pot's "They're swimming for it!", and the Pour Off button in the action bar beside Pick Up and Box; and the careful bot through the dev hook walking the whole hill to the kiosk with two pours and no spill.
- M19 was checked at 1280x800 and iphone-12-pro: walking onto the bridge for "It sways.", the pot rocking with the deck and both handrails rising and falling, a spill splitting into "Bye, bean." River Tax and beans on the deck, "The bridge swayed. 17 beans."; bridge Pickup with the deck running up the screen between the river strips, "Rope bridge." and the prompt, a bean sliding off during a jot ("Bye, bean."), a real mouse fling of a clump of 2 into the river riding the duck and coming back 2s later with "Grandma saw that.", and the same views on the phone with a held thumb walking. Preview snapshots of this tab often timed out on the first try; calling `preview_status` and retrying worked.
- Edits to files while a preview tab is open reload the page, so define pointer helpers again after every edit. Another agent's edit to a shared file can update the page without the full reload; when the start screen stays up after `start()`, call `__game.beans.reload()`.
- An earlier note said Vite sometimes misses a file edited by a script. In this round every case turned out to be a stale page or a script replacement that silently matched nothing after Prettier reflowed the text. Check that scripted replacements match before trusting the browser.
- M20 was checked at 1280x800, iphone-12-pro and iphone-se: a dev tip-over on the street opening "600 beans at once." by itself 1s after the beans landed, playing in slow motion with "Tipped it. Grandma felt that in her knees." and Watch Again, Share and Carry On; game time stood still while it was open and carried on after Carry On; a 20-bean tilt showing the corner Replay chip instead ("20 beans in 0.5s"), which sits in the sky band above the design on the phone (cell top 113 px, design top 183 px); a 61-bean spill as the run's first big one opening by itself on the phone; and the dialog fitting the iphone-se at 55 to 612 px of 667.
- M21 and M22 were checked at 1280x800 and iphone-12-pro, and the count view at iphone-se: Grandma in her doorway, "Oh! He gets so excited.", the bark prompt and "WOOF!"; on the phone a held thumb walking up the steps and lifting at the bark for "Made it! He only got one bean.", the bean hopping onto the mat with "One rolled under the doormat." and a lump on the mat; walking on for the whole-pot tip with "Oh dear. Again.", the 9,959-bean mound, an auto replay "Carried for 0:00. So close." (the dev start resets the clock) and the dustpan prompt; a real mouse hold on the pile for "Grandma's dustpan." scooping 1,195 beans and dribbling 3 on a fast carry; 12 beans in seed packets turning you away at her door with "Plant your seed packets first, dear." and "Plant 2 seed packets"; the count in big numbers with her finger up, "This'll take a while.", "One is missing." and the sad trombone; mouse and finger drags lifting the mat and dropping the bean in the stew for 10,000; the taste, salt and sneeze; the secret spelled in beans ("GR_NDM_ TR__N__ TH_ D_G" with 7 pages); and `EndingScreen` with its stats at both sizes. The shortfall hold while beans grow was checked in unit tests only.
- M23 was checked at 1280x800 and iphone-12-pro: the ending card with Picked Up, Lost for Good, Time and Gossip, the run's biggest spill as its picture and "Town gossip: CHOIR MIMES" as its footer; and Share This Page on a notebook page drawing the Weekly Whisper front page with "CHOIR MIMES" in beans. The preview browser can't share files, so both offered Download; a real phone's share sheet is a manual check.
- Preview snapshots of this round's tabs timed out about half the time (the client reported 1s timeouts) and once the host dropped for a moment. Retrying after `preview_status` worked every time. The page's own loop keeps running between calls, so freeze a moment by stepping with `setInput` held, not by waiting.
- M24 was checked at 1280x800 and iphone-12-pro with the dev sound log: hurrying on the street for "Hurried. 257 beans.", "Grandma is updating her will." and "Your legs: 1. You: 0." with `splat`, `fail` and a 40 ms buzz; a dev teeter playing `creak` and `rattle`, then a counter-tilt for "Saved it!" and "Floor: 0. You: 1."; two cyclist dodges rotating from "Not today, cyclist." to "Ding ding yourself." with "Bikes: 0. You: 1." then "You: 2."; a bridge spill dropping beans into the river with white ripples and "Bye, bean."; real pointer rubs, a tap and holds in the window box digging, planting and watering a slot with the `pour` loop playing; and on the phone a ladder hit reading "Ladder to the pot. 130 beans.", Grandma's line and "Ladder: 1. You: 0." clearly. Unit tests cover Reduced Motion's slow motion, the kick buzzes, the 3-caption cap and the ripples. The buzz itself needs an Android phone, and iPhones never vibrate from the web.
- M25 was checked at iphone-12-pro, iphone-se, iphone-12-pro landscape and 1280x800. The phone top bar is 100 px (95 px at iphone-se) and the action bar 64 px (70 px when the tilt buttons wrap), so the iphone-se cell is 375 x 502 to 508 px and the design keeps its 0.625 scale. Every button measured 48 px or more and sat inside the viewport, including the Menu, Settings and Notebook dialogs and the kiosk panel. The layout and dialogs pad by the safe-area insets, which the preview reports as 0. The sideways note shows at 844 x 390 and lets touches through. No console errors appeared in any scene visited.
- Script time per step at iphone-se, measured with `loop.step(1)`: walking up the rainy hill 0.1 ms median and 0.3 ms at the 95th percentile; a 200-body Pickup 0.4 ms settled and 0.5 ms while dragging beans to the pot. Spikes of 4 ms every 11 steps (and one of 75 to 120 ms) are batched GPU flushes from stepping without presenting, as noted for M5. That leaves a wide margin under 16.7 ms, but a real 60 fps trace still needs Ekansh's phone.
- Hill tiles now keep only the height their own ground needs: a tile on the slope is 800 x 955 u instead of 800 x 1,063 u (about 12.2 MB instead of 13.6 MB at desktop 2x), and flat tiles 800 x 700 u. The fill under the ground starts under the highest ground in view, so a short tile never leaves a sky-coloured strip at the bottom.
- A hidden preview tab never runs animation frames, so the replay player stays blank and dialogs stop partway through their pop-in (buttons measure 42 px instead of 48 px). Read `offsetWidth` for sizes, and trust replays only in a visible tab or on a phone.
- Round 7 checked the count's shortfall hold in the browser for the first time and found a bug: once her curve had finished, a harvest jumped the count straight to 9,999, and "There we are." overwrote "One is missing." in the same step. Now she holds at 9,991 with "Still 8 short, dear.", says "There we are." when the harvest lands, counts on one bean at a time to 9,999, and says "One is missing.". The ending test checks both lines.
- M26 was checked at 1280x800 and iphone-12-pro: hurrying onto Grandma's steps and letting go at the bark now slows you to 6 u/s for "Made it!" (before the fix the speed stayed at 80 u/s and the pot tipped), driven with `setInput` on desktop and by a held, slid and lifted finger on the phone; `stats()` after a walk, a set-down and three real mouse drags reported 3 beans potted, 9s in Pickup, 3s a bean and the pickup share; the kiosk's Sell buttons at 42, 46 and 78 coins on both sizes (48 px tall on the phone), a real click selling CHOIR MIMES for 78 and `stats()` splitting the coins into the 30 bonus and the 78 page; a cyclist dodge paying "+5 coins"; the Notebook reading "GR_NDM_ _______ TH_ D_G" with 3 pages on both sizes; the bridge prompt "Rain water is still in the pot." with water carried over; and on the phone the count, the doormat lifted and the bean dropped in the stew by finger, and the ending's "Your 3 gossip pages showed 9 of her secret's 20 letters." with Time 0:42 of play while the wall clock said 1:04. No console errors.
- `runRoute` over 20 seeds takes about 1s per bot, and longer while other test files run, so `balance.test.ts` makes all four once in a `beforeAll` with a 60s timeout.
- Rain water stays in the pot from the hill onto the bridge, as designed. A pot that crossed the bridge with 4 u of water spilled about three times as much, so bots now pour off once the prompt asks out of the rain, and the prompt says "Rain water is still in the pot." there instead of "Rain is filling the pot."
- Round 9 added the Run Report and Time 50 Beans (M26b) and checked them at 1280x800, iphone-12-pro and iphone-se: the dev panel's Run Report dialog with the report as text (303 px wide at iphone-se, no sideways scroll, 48 px buttons); Time 50 Beans on the street spilling 50 beans ahead, 50 real mouse drags putting them back, and the toast "Timed: 50 beans in 38.8s, 0.78s a bean." with the timing listed in the report; on the phone, Menu then Run Report (Dev) then Time 50 Beans spilling the beans with "Set the pot down by the beans and pick them all up."; and at the end of a run "Run Report (Dev)" folded under the secret, with the ending's Share dialog headed "Brag About It". The production build has none of the Run Report's strings.
- Round 9 found the "Behind" lag (problem 7 of round 8) is the preview tab, not the game. Both numbers come from the same count every step, but the status bar's numbers redraw on animation frames, which this tab runs at about 12 a second, while scripted `step` calls move the game many steps between them. On a phone or desktop at 60 fps they agree within one frame.
- Round 9 fixed the hill's grass seam. It had two causes: each tile hatched its band from its own box, so the lines broke where tiles met, and on tall phone cells a tile on the slope stopped above the bottom of the view, leaving a plain, unhatched strip. Hatching now sits on a grid fixed to the route, and tiles reach over what the cell shows below the design (about 123 u at iphone-12-pro, which adds about 1.5 MB to each of the 3 tiles there). The park's grass had the same break. A street, park and hill step that paints new tiles still costs 1 to 7 ms on the dev machine.
- Round 10 added the Key Speed trial (M26c) and checked it at 1280x800, iphone-12-pro and iphone-se. Held D key events turned the pot 3° in 0.1s at 30°/s, 4.5° at 45°/s, 6° at 60°/s and 3.9° at 30 to 75°/s, and 15°, 22.5°, 30° and 32.6° in 0.5s. On the phone, held Tilt Right and Tilt Left buttons followed the same speeds. Real clicks on **Key Speed** in the Run Report cycled the label and the report's first line, from the dev panel on desktop and from **Menu** then **Run Report (Dev)** on both phones, with 48 px buttons and no sideways scroll. The production build has none of the trial's strings. No console errors.
- A spill big enough to open its replay pauses the game, so scripted tilt tests that spill first must press **Carry On** before stepping on.
- Round 11 rechecked the M27 tools at 1280x800 and iphone-12-pro: Key Speed cycling from the dev panel and from **Menu** then **Run Report (Dev)**, and Time 50 Beans with 37 mouse drags toasting "Timed: 50 beans in 39.8s, 0.80s a bean." No console errors.
- After a preview tab has been hidden for about 5 minutes, Chrome runs its timers about once a minute. A script that awaits `setTimeout` between pointer events then stalls, and every later call to that tab times out until it ends. Space the events with a busy-wait on `performance.now()` inside one call instead, about 10s of drags per call.
- Round 12 first ran a whole game through the real UI before the Lead Decisions arrived: the start screen, the kitchen's cat and the first gossip line jotted with J, mouse drags in every Pickup, sales and an upgrade bought by click at the kiosks, the mud rubbed off, the Pigeon Net untangled with circles, Pour Off with P, the window box planted, watered and picked by pointer, the count, the doormat and the ending. It found four problems, now fixed. The kiosk's "THE WEEKLY WHISPER" ran past both ends of its sign. The dev **Pick Up All** and **Jump** left an unjotted line holding its slot, so no later spill could spell gossip. Clearing one patch said "All clear." while other beans still lay behind. The rain prompt said "Space sets it down, then hold P" beside spilled beans, where Space opens Pickup and P did nothing; now the prompt says to pour away from the beans, and P in Pickup says "Not by the beans."
- After clicking **Carry On** in a replay, a script must yield (a `MessageChannel` round trip) before more input: the dialog stays mounted until React renders, and the game ignores input while it is open. Busy-wait loops never yield, so input sent in the same call is lost.
- Round 12 checked M27 at 1280x800: Mrs Pryce's curtain twitching with two eyes, her shout, caption and prompt, her coming out ahead of the pot, and a stop getting grabbed (83 beans behind, "Beans! For Doris? I must tell everyone."); the sale's sign and stampede, and a real Shift+W 0.2s after the shout escaping with "Beat the rush. +5 coins" (the hurry over cobbles cost 39 beans); Bruno asleep by his bench on his red lead with a "Zzz" over him, then sitting up barking; a real D key turning the pot 3.9° in a 0.1s tap and 32.6° in a 0.5s hold, and A turning back 3.9° in 0.1s; the kitchen's longer hall. At iphone-12-pro a held thumb slid right dodged Mrs Pryce with "Mrs Pryce! Slide your thumb right to hurry past." and "Oi! Come back!", and the stampede fit the narrow view. At iphone-se "MAYOR WEARS A WIG" read over its glow, the Run Report had only **Time 50 Beans** and **Close** (48 px), and the rain prompt fit in two lines. No console errors.
- Preview snapshots of the hidden tab worked this round, but right after a resize or reload they can show a black canvas. Step the loop once, yield, and take it again. `includeImage: false` with `save: true` returns only a path, which keeps tool output small; crop it with Pillow to look closer.
- The preview tool times out an evaluate after about 15s, while the page's script carries on. Keep each call under 10s.

- Round 13 played the whole game through the real UI at 1280x800 with `?fast`, from Tap to Start to Play Again, and checked the iphone-12-pro and iphone-se presets with finger input: pinches, Assist one-finger drags, the walking thumb and its hurry slide, the tilt, Pour Off and Jot It Down hold buttons, the Menu, a finger-fished fridge bean, the doormat by finger, and the ending. It fixed these:
  - Setting the pot down just out of reach of beans did nothing visible. Now a caption says the beans are too far and which way to go.
  - A pigeon standing on a knot of the tangled Pigeon Net couldn't be shooed in Pickup or the walk view: the press circled the knot. A press on a pigeon now shoos first.
  - Stacked captions overlapped: an older caption's smaller lines ran into the newer headline, and in Pickup the oldest went off the top. The stack now spaces by each caption's own height and moves down when it would leave the view.
  - The gate's repeated buzz stacked two "still back there" captions. A caption with a key now replaces the old one with the same key.
  - "This patch is clear. 3 still out there." showed when the 3 were under this patch's fridge or drain. It now names the drain and the gap or grate to click.
  - The pickup prompt said "Hold still on the pile" with no pile. It now says a heap unless a pile is there.
  - The fishing chore said "Set the pot down by the hole, then tap it." It now names the fridge or the drain, and says click on desktop. The window box said "Tap a packet" on desktop too.
  - Spill captions, replay labels and the walk view's bean counts printed "9999". They now print "9,999".
  - After Grandma's dustpan the grounded pot said only "Space picks up the pot." It now says to carry it up to Grandma.
  - The button that lifts the pot read "Pick Up" beside the chore "Pick up 110 beans". It now reads **Pick Up Pot**.
  - The kiosk panel repeated the editor's "Spill something juicy." It now says big spills spell out gossip.
- Wider Tweezers drop beans on drags that the plain tweezers carry ("Too fast."), as their downside intends. A 450 u drag needs about 1.3s.
- A preview host can drop mid-run. `preview_status` brought it back with the page's state intact.
- The audit round was checked at 1280x800 with `?fast`, driven by `setInput`, `step` and scripted pointers:
  - The bridge with the Pot Lid and Taller Pot, beans behind and the pot pressed against the shut gate, tipped forward: the lid landed 108 u before the gate and went straight back on, then the gate opened once the beans were in. Before the fix it landed 40 u before the gate, out of reach.
  - The same pot tipped backward: with every bean in, the gate buzzed "The lid's still back there. Go and fetch it." with its arrow pointing back at the lid. Before the fix it said "0 beans are still back there."
  - The cat's swat on the street with the lid on threw 21 of 85 beans, "The lid held. Only 21 beans got out.", and the lid stayed on. The ladder knocked it off with a full 102.
  - Grandma started counting with 17 packets unplanted ("Plant your seed packets while she counts."). Planting and watering one in the box sent the other 16 to her windowsill ("Pass those here, dear."), the planter sprouted "+128", and the batch put them in the stew. Picking the pod let her reach 9,999. The ledger stayed at 10,000 throughout.
  - A gull came to the grounded pot at the market for "Gull tax." and a "Gull Tax, Market" packet; a pigeon came to street Pickup at iphone-se; Grandma's windowsill harvest showed at iphone-12-pro.
- The second audit round was checked at 1280x800 and iphone-se with `?fast`, driven by `step`, `setInput` and scripted pointers:
  - Space during Mrs Pryce's and the sale's shout buzzed "No time! Hurry past!" and the pot stayed up; pressed every 10 steps through the lunge, she still got the pot (105 beans). Space during a teeter buzzed "Not now!" and the pot tipped (400-bean pile).
  - After the dog tipped the pot, the walk view's empty pot showed no beans on its rim, and Pickup's pot showed its bare enamel bottom, then a part heap and 4 beans at 5,583 beans after six dustpan scoops.
  - With 4 packets waiting at Grandma's count, planting and watering one in the box and closing it showed "Pass those here, dear." and the caption "Grandma took 3 seed packets. 22 beans grow on her windowsill with your batch."
  - A clean walk up her path paid "Not a bean on her steps. Grandma tips you 30 coins.", and the ending listed Clean Stretches and Coins.
  - The park kiosk's shop showed Grippy Shoes as Unavailable with "No wet grass ahead. The park's behind you.", and the bridge kiosk's the Pigeon Net with "No pigeons between here and Grandma.", also at iphone-se.
  - `?debug` drew the slosh numbers and zone anchors in the walk view, and body outlines in street Pickup and a street drain.
  - The production bundle no longer contains the ledger check, the bot driver, the debug overlay or the runtime's dev helpers.

## Lead Decisions (2026-10-09, 21:45)

Ekansh delegated every design, tuning and balance decision to the lead and is not available to answer questions. Never leave a milestone waiting on him. Make the call yourself, record it in this section with a one-line reason, and move on. Anything only a real phone or a real human session can measure goes under Owner Follow-Ups below and never blocks a milestone.

- **Key speed:** ship the 30 to 75 degrees per second rising key speed for A, D and the tilt buttons (KEY_RAMP_S 0.2). Reason: the bots show it nearly closes the hill and bridge gap with phone tilt while taps stay precise. Remove the Key Speed trial button, list and dev API once it ships.
- **Run length:** the bots' 45 to 50 min is under the 60 to 120 min target. Build all of these: double the characters on the street, market and park as measured (about +6 to 8 min); spill slightly sooner (about +3 to 4 min); and make each of the seven stretches longer to walk until the bot average reaches at least 65 min. Keep exactly seven stretches, as the design says.
- **Gossip:** an average run should find 7 to 9 pages and a careful run at least 3. Guarantee one gossip spill on each of the street, market and park stretches from a scripted character encounter that is hard but possible to dodge, and lower the bean threshold for a spill to spell gossip.
- **Round 8 economy changes** (page prices, dodge pay, the secret reveal): approved as built.
- **Upgrade prices (final check, 2026-10-10):** raised from 415 to 720 coins in all (Wider Tweezers 70, Grippy Shoes 80, Pigeon Net 90, Bigger Window Box 120, Pot Lid 160, Taller Pot 200). Reason: over 20 seeds the bots earn about 420 (careful), 550 (average and keyboard) and 570 (sloppy), so at 415 everyone bought everything and no upgrade was a choice. At 720 nobody average affords all six, and every bot still affords the four cheapest (360).

Calls the round 12 builder made while building these, each with its reason:

- **The ambushes are Mrs Pryce, a sale and Bruno, and only hurrying escapes them.** Every other character teaches "stop", so a careful player stops into these and gets hit, which gives the careful bot its 3 pages. A player who hurries from the shout gets clear, so they are hard but fair.
- **Ambush hits throw the next line's need plus 8.** That is how the cat, the elbow and the ladder already guarantee gossip.
- **Bots don't learn the hurry trick.** They model a first run. Real players who learn it will find fewer pages, which the Owner Follow-Ups cover.
- **Gossip letters sit 26 u apart instead of 22 u, over a pale glow.** That lowers the threshold by about 12% (needs 47 to 91). The glow keeps the sparser letters readable at the iphone-se size.
- **Stretch lengths 1,500, 7,800, 7,800, 8,400, 6,000, 4,000 and 800 u.** These put the average bot at 70 min on a desktop, a 5 min margin over 65. Grandma's Door stays 800 u: its steps, house, dog and count view are built on fixed spots, and 200 u more would add about 5s.
- **The leftover-water prompt asks from 1.5 u, not 3 u, off the rain.** The longer hill sent more rain water onto the bridge, and keyboard spills there rose to 321. Asking from 1.5 u brought them down to 238. The rain prompt on the hill still waits for 3 u, so it doesn't nag every few seconds.

Calls the audit round builder made, each with its reason:

- **Grandma takes the leftover packets herself, only while a batch grows.** Planting stays your chore at the door, but a second batch would add an idle minute after the first.
- **The lid holds a quarter of every character hit, and only the ladder and the ambushes knock it off.** Those two are the hardest hits, and a lean still saves the lid, so a lost lid is your own fault.
- **The lid always lands within the pot's reach.** A lid past the shut gate's stop could never be fetched, which ended the run.
- **Gulls at the market, pigeons on the street.** The same rule in a new look keeps the guard step from feeling repeated, and "Gull tax" is its own joke.

Calls the second audit round builder made, each with its reason:

- **Set Down is refused, not punished, mid-teeter, mid-spill and while an ambush comes.** A buzz and a caption ("Not now!", "Not mid-spill!", "No time!") teach the rule in one press, and the fail stays the one you were already in. A pot set down mid-wobble that tipped would feel like the game's fault. A flooded pot can always go down, since pouring off is its only fix.
- **A missed kitchen line comes last on later stretches.** "MAYOR WEARS A WIG" stays the street's first page, and a careful run can still find all twelve.
- **Spent upgrades are disabled with a reason, not extended.** Grippy Shoes on the hill and bridge, or pigeons at Grandma's door, would add new hazards and move the measured balance. The shop row now says why instead, through a new optional `unavailable` prop on the shared `ShopPanel`.
- **Grandma pays the door's clean bonus as a tip when she starts counting.** The ending lists Clean Stretches and the coins you finished with, so the clean walk up her path counts for something. The bonus tiers (full at 5 spilled beans or fewer, half at 25) stay as built; `DESIGN.md`'s Coins says "no spills" and needs the lead's update.
- **Clumps, scoops, packets of 8 and the short bookends stay.** These are recorded departures (above) waiting on the lead's `DESIGN.md` update, which a game builder can't make. The bots still put the average desktop run at 70 min and a careful one at 44 min after this round; real timed runs stay an Owner Follow-Up.

## Owner Follow-Ups

These need a real phone or a real player. They do not block any milestone. The game ships with the current best-guess numbers.

- Time real 50-bean pickups on a desktop and a phone, and play two full manual runs (one careful, one sloppy) to confirm the bot pacing.
- Try the shipped key speed with real hands. Keyboard players still spill about 45% more than tilting players on the bridge.
- Try the three ambushes on a real phone: whether the shout gives enough time to slide the thumb right, and whether the twitching curtain, the SALE! sign and Bruno's snore read as warnings.
- Judge the gossip letters on a real small phone: they sit further apart since M27, over a pale glow.
- Watch the economy in a real run: the average bot earns about 550 coins against 720 for every upgrade.
- Original milestone text, kept for reference: M27: Real-Player Timing - Ekansh times real 50-bean pickups on a desktop and a phone with **Time 50 Beans**, and plays two full manual runs (one careful, one sloppy), reading the **Run Report** at the end of each (section 5, "How to Run M27"); the pacing table takes the real seconds per bean, walking minutes and pickup share; Ekansh decides how to reach the 1 to 2 hour goal if the average lands under 60 min (section 5 lists the levers), and the chosen lever is built and checked with the bots; Ekansh tries the key speeds with **Key Speed** and picks one, and the next builder makes it the game's own and reruns the balance tests.
