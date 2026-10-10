// Every gameplay number lives here, with what it controls. Units: logical units (u),
// seconds (s) and degrees unless the name says otherwise. PLAN.md section 3 explains them.

// ---------------------------------------------------------------- Ledger

/** Beans Grandma's stew needs, and the beans in the pot at the start. */
export const TOTAL_BEANS = 10_000

// ---------------------------------------------------------------- Walking

/** Strolling speed in u/s. Holding W without Shift. */
export const STROLL_SPEED = 80
/** Hurrying speed in u/s. Shift+W, or a thumb slid 110 u right. */
export const HURRY_SPEED = 170
/** Walking-back speed in u/s. Same as a stroll, so going back for beans isn't a toll. */
export const BACK_SPEED = 80
/** How fast speed follows its target (per second). 2.2 reaches 90% in about 1s. */
export const SPEED_RATE = 2.2
/** Stride length in u. Body sway runs at half the step rate, v / 150 Hz. */
export const STRIDE = 75
/** Peak sideways sway acceleration at hurry speed, in u/s². */
export const SWAY_ACCEL = 160
/** Share of forward acceleration that tips the bean surface, so a stroll start rocks without spilling. */
export const ACCEL_SLOSH = 0.5
/** Thumb slide right (u) where hurrying starts, and where it reaches full hurry. */
export const THUMB_HURRY_FROM = 30
export const THUMB_HURRY_FULL = 110
/** Thumb slide left (u) that switches to walking back. */
export const THUMB_BACK = 40

// ---------------------------------------------------------------- Pot tilt

/**
 * Keys and tilt buttons turn the target angle at KEY_TILT_RATE degrees per second as they
 * go down, rising to KEY_TOP_RATE over the first KEY_RAMP_S of holding one way. Taps stay
 * fine, and a held key keeps up with a gust (PLAN.md Lead Decisions).
 */
export const KEY_TILT_RATE = 30
export const KEY_TOP_RATE = 75
export const KEY_RAMP_S = 0.2
/** With no tilt input, the target eases back to level at this rate, in degrees per second. */
export const AUTO_LEVEL_RATE = 4
/** Largest target tilt from any input, in degrees. Input alone can't reach the tip angle. */
export const MAX_TILT = 40
/** How fast the pot follows its target angle (per second). 10 is a 100 ms lag. */
export const POT_LAG_RATE = 10
/** How fast a pot kick from a bump fades (per second). */
export const KICK_DECAY_RATE = 4

// ---------------------------------------------------------------- Slosh

/** Natural rocking frequency of the bean surface, in Hz. One swing takes 0.9s. */
export const SLOSH_HZ = 1.1
/** Damping ratio of the bean surface. The Taller Pot uses SLOSH_ZETA_TALL. */
export const SLOSH_ZETA = 0.2
export const SLOSH_ZETA_TALL = 0.26
/** Effective gravity that sets how far acceleration tips the surface, in u/s². */
export const G_EFF = 1600

// ---------------------------------------------------------------- Spilling

/** Half the rim width in u. */
export const RIM_HALF = 56
/** Beans that fill 1 u of pot depth. */
export const BEANS_PER_UNIT = 125
/**
 * Margin in u between a full pot's surface and the rim. The Taller Pot uses REPOSE_TALL.
 * Lead Decisions lowered it from 10, so beans spill a little sooner and the run is longer.
 */
export const REPOSE = 9
export const REPOSE_TALL = 20
/** Extra margin in u in Assist Mode. */
export const ASSIST_MARGIN = 4
/** The overflow formula stops growing past this relative angle, in degrees. */
export const MAX_PHI = 60
/** Weir constant: spill rate is WEIR_K * d^1.5 beans per second. */
export const WEIR_K = 4
/** Highest spill rate in beans per second, so a held tilt can't empty the pot in a blink. */
export const MAX_SPILL_RATE = 90
/** Spill rate cap in beans per second with the Pot Lid on. */
export const LID_SPILL_RATE = 6
/** The low rim starts glowing at this share of the spill angle. */
export const RIM_GLOW_FROM = 0.7

// ---------------------------------------------------------------- Tip-over

/** The pot teeters once |psiEff| stays above this many degrees for TIP_HOLD_MS. */
export const TIP_ANGLE = 50
/** Tip angle with the Taller Pot. */
export const TIP_ANGLE_TALL = 42
/** The Taller Pot only tips while your own tilt leans at least this many degrees the same way, so outside forces alone never tip it. */
export const TALL_OWN_TILT = 10
/** How long the pot must stay past the tip angle before it teeters, in ms. */
export const TIP_HOLD_MS = 300
/** How long the pot balances on one edge before it falls, in ms. */
export const TEETER_MS = 500
/** Turning the target this many degrees back toward level during a teeter saves the pot. At 30°/s keys that takes 0.1s. */
export const TEETER_SAVE = 3
/** A tip-over spills this many loose beans, plus TIP_PILE into a pile. */
export const TIP_LOOSE = 200
export const TIP_PILE = 400

// ---------------------------------------------------------------- Spill events and juice

/** A spill event ends this long after its last bean, in ms. */
export const SPILL_EVENT_GAP_MS = 600
/** A kick counts as the cause of a spill for this long, in ms. */
export const KICK_CAUSE_MS = 1500
/** A spill this big plays the fail sound, shakes and slows time. */
export const BIG_SPILL = 30
/** Slow-motion time scale and how long it lasts in real ms. */
export const SLOW_SCALE = 0.3
export const SLOW_MS = 400
/** Largest screen shake in u. */
export const MAX_SHAKE = 12
/** Pot tilt in degrees that makes "Tilted too far." the cause, when it leans the spill's way. */
export const TILT_CAUSE = 8
/** Speed in u/s that makes "Hurried." the cause. */
export const HURRY_CAUSE = 120
/** Slosh peaks above this many degrees play the slosh sound. */
export const SLOSH_SOUND_FROM = 6

// ---------------------------------------------------------------- Landing and zones

/** Particle gravity in the walk view, in u/s². */
export const PARTICLE_GRAVITY = 900
/** Most bean particles in flight at once. Extra beans land at once. */
export const MAX_PARTICLES = 160
/** A spill landing within this distance of a zone anchor joins that zone, in u. */
export const ZONE_MERGE = 150
/** Setting the pot down within this distance of a zone opens Pickup, in u. */
export const PICKUP_REACH = 150
/** Setting the pot down out of PICKUP_REACH but this close to a zone points at it, in u. */
export const FAR_BEANS_HINT = 450
/** Most loose bean bodies per zone. Extra beans go to the zone's pile. */
export const ZONE_MAX_LOOSE = 200
/** Top-down mapping: px = 300 + (x - anchor) * ZONE_SPREAD, clamped. */
export const ZONE_SPREAD = 1.6

// ---------------------------------------------------------------- Pickup

/** The playable rect of the top-down view, in u. */
export const PLAY_LEFT = 20
export const PLAY_RIGHT = 580
export const PLAY_TOP = 20
export const PLAY_BOTTOM = 780
/** Bean placement band in the top-down view, away from the pot. */
export const SCATTER_TOP = 140
export const SCATTER_BOTTOM = 560
export const SCATTER_LEFT = 50
export const SCATTER_RIGHT = 550
/** Static wall thickness in u, so fast beans can't tunnel through. */
export const WALL_THICKNESS = 100
/** Bean body radius in Pickup, in u. Beans draw 20 by 12 u. */
export const BEAN_RADIUS = 9
/** Matter body settings for beans. */
export const BEAN_FRICTION_AIR = 0.12
export const BEAN_RESTITUTION = 0.25
export const BEAN_DENSITY = 0.0015
/** The pot in Pickup: centre and radius, in u. */
export const POT_X = 300
export const POT_Y = 700
export const POT_RADIUS = 62
/** A held bean whose centre is this close to the pot centre goes in: pot radius plus bean radius. */
export const POT_ACCEPT = POT_RADIUS + BEAN_RADIUS
/** Pressing within this distance of a bean grabs it, in u. */
export const GRAB_RADIUS = 28
/** Touching beans within this distance of the grabbed one come along, in u. */
export const CLUMP_RADIUS = 22
/** Most beans one grab lifts with the base tweezers. */
export const CLUMP_MAX = 3
/** Released beans fly at most this fast, in u/s, under one radius per step. */
export const RELEASE_SPEED_MAX = 400
/** A let-go bean spins this many radians a step per u a step of sideways speed, so drops spin away. */
export const RELEASE_SPIN = 0.05
/** Carry speed in u/s that counts as full strain. */
export const CARRY_SPEED_LIMIT = 1400
/** Pointer acceleration in u/s² that reads as full strain. */
export const STRAIN_JOLT_REF = 9000
/** Each extra bean in a clump multiplies strain by this. */
export const CLUMP_STRAIN = 1.25
/** Strain where the tweezers start trembling. */
export const STRAIN_WARN = 0.7
/** Chance a carry gets a slippery bean, and how long it wiggles first, in ms. */
export const SLIPPERY_CHANCE = 0.05
export const SLIPPERY_MS = 400
/** Keeping the pointer under this speed (u/s) during the wiggle saves a slippery bean. */
export const SLIPPERY_SAFE_SPEED = 120
/** Pop pitch rises this much per bean in a streak, up to POP_PITCH_MAX. */
export const POP_PITCH_STEP = 0.04
export const POP_PITCH_MAX = 1.6
/** Streak lengths that earn a caption. */
export const STREAK_MARKS = [10, 25, 50] as const

// ---------------------------------------------------------------- Scoops

/** Pile mound centre in the top-down view. */
export const PILE_X = 300
export const PILE_Y = 330
/** Pile mound radius: PILE_BASE_R + sqrt(pile) * PILE_R_GROWTH, in u. */
export const PILE_BASE_R = 26
export const PILE_R_GROWTH = 2.2
/** The mound stops growing at this radius, so a whole tipped pot still leaves room to work. */
export const PILE_MAX_R = 120
/** Hands can scoop a cluster: at least CLUSTER_MIN beans within CLUSTER_RADIUS u. */
export const CLUSTER_RADIUS = 50
export const CLUSTER_MIN = 15
/** Most beans hands lift from a cluster. */
export const CLUSTER_SCOOP = 25
/** Hands from the pile carry HAND_BASE + floor(pile / HAND_DIVISOR) beans. */
export const HAND_BASE = 25
export const HAND_DIVISOR = 40
/** Grandma's dustpan carries DUSTPAN_BASE + floor(pile / DUSTPAN_DIVISOR) beans. */
export const DUSTPAN_BASE = 200
export const DUSTPAN_DIVISOR = 10
/** Holding still this long on a pile or cluster cups your hands, in ms. */
export const CUP_MS = 350
/** Moving further than this (u) before CUP_MS keeps the tweezers. */
export const CUP_STILL = 6
/** Hands faster than this (u/s) dribble one bean every DRIBBLE_MS. */
export const DRIBBLE_SPEED = 700
export const DRIBBLE_MS = 120

// ---------------------------------------------------------------- Ground hazards

/** Terrain kicks scale with (v / KICK_REF_SPEED)², so a hurry hits 4.5 times harder than a stroll. */
export const KICK_REF_SPEED = 80
/** Pothole kick to the bean surface at a stroll, in rad/s. Beans surge forward. A stroll peaks near 6°. */
export const POTHOLE_KICK = 0.9
/** Kerb kick at a stroll, in rad/s. Stepping back up a kerb throws beans back. */
export const KERB_KICK = 0.7
/**
 * Hall rug edge kick at a stroll, in rad/s. Beans surge forward. Softer than the plan's
 * 0.6, since it is the tutorial bump: a full hurry over it adds 0 to 40 beans by sway phase.
 */
export const RUG_KICK = 0.4
/** Stair kick at a stroll, in rad/s, once per stair. */
export const STAIR_KICK = 0.6
/** Cobble kick at a stroll, in rad/s, on every footstep, alternating back and forward. */
export const COBBLE_KICK = 0.3
/** Kicks above this (rad/s, after speed scaling) shake the screen and buzz the phone. */
export const BIG_KICK = 0.8
/** A kerb crossing dips the ground this far (u) for this long (u). The kick comes at the far kerb. */
export const KERB_DROP = 14
export const KERB_WIDTH = 140
/** Each stair drops (or rises) this far in u, every STAIR_TREAD u. */
export const STAIR_RISE = 16
export const STAIR_TREAD = 50
/** Speed is capped at a stroll from this far before the first stair, in u. */
export const STAIR_APPROACH = 70
/** How fast speed falls to the stroll cap on the stairs (per second). */
export const CAP_RATE = 6

// ---------------------------------------------------------------- Character hits

/** Leaning the pot this many degrees against a hit, as it lands, halves its splash and kick. */
export const LEAN_SAVE = 5
/** Coins for each telegraphed hit you dodge. Tripled from 5 so upgrades come sooner. */
export const DODGE_COINS = 15
/** Walking slower than this (u/s) counts as stopped for characters: neighbours peek, bikes don't startle. */
export const STILL_SPEED = 20

// ---------------------------------------------------------------- The street

/** A neighbour steps out once your pot comes this close to their door, in u. */
export const NEIGHBOUR_NOTICE = 350
/** Stepping out of the door takes this long, in ms, before they walk over. */
export const NEIGHBOUR_STEP_MS = 700
/** Neighbours walk toward you at this speed, in u/s. */
export const NEIGHBOUR_WALK = 60
/** A neighbour stops this far ahead of the pot's centre, then reaches for the front rim. */
export const NEIGHBOUR_MEET = RIM_HALF + 64
/** A peek lasts this long, in ms, while the neighbour pulls the front rim down. */
export const PEEK_MS = 2500
/** The peek pulls the pot toward the neighbour at this rate, in degrees per second. */
export const PEEK_LEAN_RATE = 14
/** Once they let go, the pull fades at this rate, in degrees per second. */
export const LEAN_RELEASE_RATE = 20
/**
 * Walking on into a neighbour: surface kick in rad/s, pot kick in degrees, beans thrown
 * out. An open gossip slot raises the splash to the next line's need. M26 lowered them
 * from 2.8 and 50, which put the average street at 140 beans against a budget of 110.
 */
export const ELBOW_KICK = 2.4
export const ELBOW_TILT = 10
export const ELBOW_SPLASH = 35
/** A cyclist rings this long after you pass their trigger point, between these bounds, in ms. */
export const CYCLIST_DELAY_MIN_MS = 400
export const CYCLIST_DELAY_MAX_MS = 2600
/** The bell rings this long before the bike passes the pot, in ms. */
export const BELL_LEAD_MS = 1500
/** Bike speed in u/s. */
export const CYCLIST_SPEED = 320
/** Surface kick in rad/s when a bike passes while you walk, and while you stand still. */
export const CYCLIST_KICK = 2.0
export const CYCLIST_KICK_STILL = 0.3
/** A startle shakes the pot this many degrees either way, for STARTLE_MS, at STARTLE_HZ. */
export const STARTLE_JITTER = 8
export const STARTLE_MS = 400
export const STARTLE_HZ = 9

// ---------------------------------------------------------------- The market

/**
 * A shopper comes every this many u of forward progress through the crowd's span, between
 * these bounds: 6 to 10s at a stroll. Progress, not time, so standing still or pacing
 * back and forth can't farm their dodge coins.
 */
export const SHOPPER_EVERY_MIN = 480
export const SHOPPER_EVERY_MAX = 800
/** "Excuse me!" comes this long before the shopper reaches the pot, in ms. */
export const SHOPPER_LEAD_MS = 2_000
/** Shoppers close in on you at this speed, in u/s, and stop this far ahead of the pot's centre. */
export const SHOPPER_SPEED = 140
export const SHOPPER_MEET = RIM_HALF + 30
/**
 * Walking into a shopper: surface kick in rad/s and pot kick in degrees. Standing still: a
 * nudge. M26 raised them from 1.8 and 8, so a bump costs about 22 beans, not 6, and the
 * market reaches its budget. They throw no splash, so the Pot Lid stays on.
 */
export const SHOPPER_KICK = 3.0
export const SHOPPER_TILT = 12
export const SHOPPER_KICK_STILL = 0.4
/** No shopper comes while your pot is this close before a stall or the ladder, in u. */
export const SHOPPER_CLEAR = 350
/** A stall's tasting spoon is out for SPOON_OUT_MS of every SPOON_CYCLE_MS. */
export const SPOON_CYCLE_MS = 3_000
export const SPOON_OUT_MS = 1_200
/** The spoon pokes the pot when its centre is this close to the stall, in u. */
export const SPOON_REACH = 50
/** A poke: surface kick in rad/s and pot kick in degrees. M26 raised them from 1.5 and 6, about 26 beans a poke. */
export const SPOON_KICK = 2.6
export const SPOON_TILT = 10
/** The ladder man turns every LADDER_CYCLE_MS; the ladder sweeps the path for LADDER_SWING_MS of it. */
export const LADDER_CYCLE_MS = 4_000
export const LADDER_SWING_MS = 1_400
/** The ladder hits the pot when its centre is this close to the ladder man, in u. */
export const LADDER_REACH = 70
/** "Mind your backs!" shows once your pot comes this close, in u. */
export const LADDER_NOTICE = 450
/** A ladder hit: surface kick in rad/s, pot kick in degrees, and beans thrown out. */
export const LADDER_KICK = 3.5
export const LADDER_TILT = 18
export const LADDER_SPLASH = 100
/** In market Pickup, shoppers' feet cross every this many ms, at this speed (u/s). */
export const FEET_EVERY_MS = 8_000
export const FEET_SPEED = 220
/** Feet scuff beans within this many u of them, sending each 40 to 80 u. */
export const FEET_REACH = 30
export const SCUFF_MIN = 40
export const SCUFF_MAX = 80

// ---------------------------------------------------------------- The park

/** The kid shouts "Heads up!" and winds up for this long, then the ball flies for BALL_FLIGHT_MS. */
export const KID_WINDUP_MS = 1_200
export const BALL_FLIGHT_MS = 500
/**
 * The kid kicks once your pot is this far short of the crossing: where a stroll would
 * carry it during the wind-up and the flight. Stopping leaves you about 100 u short.
 */
export const KICK_LEAD = 136
/** The ball hits the pot when the pot's centre is this close to the crossing as it lands, in u. */
export const BALL_REACH = 55
/** A football to the pot: surface kick in rad/s, pot kick in degrees, and beans thrown out. */
export const FOOTBALL_KICK = 3.0
export const FOOTBALL_TILT = 15
export const FOOTBALL_SPLASH = 90
/** An off-lead dog barks once your pot passes it, then reaches you this long later, in ms. */
export const DOG_BARK_MS = 1_000
/** A dog jumping up at a walking pot: surface kick in rad/s and pot kick in degrees. M26 raised the kick from 2.4. */
export const DOG_KICK = 2.8
export const DOG_TILT = 10
/** A dog that found you standing still sits this long, then trots off, in ms. */
export const DOG_SIT_MS = 1_800
/** Hurrying onto wet grass faster than this (u/s) starts a "whoa" wobble. */
export const WET_SPEED = 90
/** The wobble lasts this long; slow under WET_SPEED or lean against it before it ends, in ms. */
export const WHOA_MS = 350
/** A slip on wet grass: surface kick in rad/s and pot kick in degrees. */
export const WET_KICK = 2.4
export const WET_TILT = 12
/** In park Pickup a dog comes every PARK_DOG_EVERY_MS, the first PARK_DOG_FIRST_MS after it opens. */
export const PARK_DOG_EVERY_MS = 35_000
export const PARK_DOG_FIRST_MS = 20_000
/** It barks this long before it dashes, and a tap within PARK_DOG_SHOO u during the bark sends it off. */
export const PARK_DOG_BARK_MS = 1_500
export const PARK_DOG_SHOO = 60
/** The dash: speed in u/s, the reach that pushes beans aside at PARK_DOG_PUSH u/s, and beans it eats. */
export const PARK_DOG_SPEED = 520
export const PARK_DOG_REACH = 70
export const PARK_DOG_PUSH = 150
export const PARK_DOG_EATS = 2

// ---------------------------------------------------------------- Ambushes

/**
 * One hard encounter on each of the street, market and park (PLAN.md Lead Decisions):
 * someone comes for the pot from a door, a shop or a bench, and reaches the walking line
 * within AMBUSH_REACH u of it. They burst out once your pot is AMBUSH_TRIGGER u inside
 * that reach, so stopping or strolling leaves you in it when AMBUSH_WARN_MS ends. Hurrying
 * from the shout covers about 230 u and gets you out.
 */
export const AMBUSH_REACH = 120
export const AMBUSH_TRIGGER = 60
export const AMBUSH_WARN_MS = 1_600
/** An early tell (a twitching curtain, a sign, a snore) starts this far before the trigger, in u. */
export const AMBUSH_TELL = 400
/** The lunge takes this long, and they wait this long before going back, in ms. */
export const AMBUSH_LUNGE_MS = 250
export const AMBUSH_BACK_MS = 1_800
/** The hit: surface kick in rad/s, pot kick in degrees, and beans thrown out at least. */
export const AMBUSH_KICK = 3.2
export const AMBUSH_TILT = 16
export const AMBUSH_SPLASH = 70

// ---------------------------------------------------------------- Drains on the route

/** Half the width of a drain grate in the walk view, in u. Beans landing on it go down. */
export const DRAIN_HALF = 28
/** Most beans one spill event sends down drains. */
export const DRAIN_EVENT_CAP = 5
/** A zone this close to a route drain shows its grate in Pickup, in u. */
export const DRAIN_ZONE_REACH = 180
/** In Pickup, a loose bean over the grate slower than this (u/s) falls through. */
export const DRAIN_SLOW_SPEED = 40
/** Half the grate's size in Pickup, in u. */
export const GRATE_HALF_W = 44
export const GRATE_HALF_H = 30

// ---------------------------------------------------------------- Your kitchen

/** After the start, the counter cat waits this long, then reaches for the rim, in ms. */
export const INTRO_WAIT_MS = 2600
/** How long the slow paw takes to reach the rim, in ms. */
export const INTRO_PAW_MS = 1600
/** How long after the pawed bean lands before the view drops to the floor, in ms. */
export const INTRO_DROP_MS = 1800
/** Route x where the pawed bean lands, in front of the counter. */
export const INTRO_BEAN_X = 210
/** The counter cat sits here on the counter. */
export const COUNTER_CAT_X = 250
/** Height of the kitchen counter top in the walk view. */
export const COUNTER_TOP = 456
/** The door cat sits here in the kitchen doorway. */
export const DOOR_CAT_X = 480
/** How long the counter cat takes to jump down and trot to the doorway, in ms. */
export const CAT_RUN_MS = 1200
/** The door cat starts its cycle once your pot comes this close, in u. */
export const CAT_NOTICE = 320
/** The door cat's awake timer only runs while you walk slower than this, in u/s. */
export const CAT_STILL_SPEED = 15
/**
 * Once you stand still, the door cat watches for this long, then grooms. Its first
 * grooming window is longer. After that the cycle runs whenever you stand still.
 */
export const CAT_AWAKE_MS = 3000
export const CAT_GROOM_FIRST_MS = 3500
export const CAT_GROOM_MS = 2400
/** The paw reaches the pot when the pot's centre is this close to the cat, in u. */
export const CAT_REACH = 70
/** The paw winds up this long before the swat lands, in ms. */
export const CAT_WINDUP_MS = 250
/** The swat: surface kick in rad/s, pot kick in degrees, and beans thrown straight out. M26 raised the splash from 60. */
export const CAT_SWAT_KICK = 2.6
export const CAT_SWAT_TILT = 10
export const CAT_SWAT_SPLASH = 85
/** After a swat the cat grooms smugly for this long, so you can pass, in ms. */
export const CAT_SMUG_MS = 4000
/** Kitchen Pickup: the cat bats a free bean within this many u of where it sits. */
export const CAT_BAT_REACH = 150
/** The cat sits this far from its target bean, on the side away from the fridge, in u. */
export const CAT_SIT_OFF = 55
/** The cat walks in for this long, then wiggles its bum for CAT_WIGGLE_MS before it bats. */
export const CAT_ENTER_MS = 1500
export const CAT_WIGGLE_MS = 1000
/** The first bat comes this long after a kitchen Pickup opens; later ones this long apart. */
export const CAT_FIRST_BAT_MS = 5000
export const CAT_BAT_EVERY_MS = 20_000
/** A tap within this many u of a wiggling cat sends it off for CAT_SHOO_MS. */
export const SHOO_RADIUS = 50
export const CAT_SHOO_MS = 12_000
/** A batted bean slides under the fridge for this long, in ms. */
export const BAT_SLIDE_MS = 450
/** The gap under the fridge in the kitchen's top-down view. */
export const FRIDGE_GAP_X = 120
export const FRIDGE_GAP_Y = 100
/** Kitchen Pickup's play rect starts below the fridge, in u. */
export const KITCHEN_PLAY_TOP = 112

// ---------------------------------------------------------------- Drains and the coat hanger

/** The Drain scene's shaft, side-on: walls at these x, the grate at the top, gunk at the bottom. */
export const SHAFT_LEFT = 180
export const SHAFT_RIGHT = 420
export const GRATE_Y = 80
export const GUNK_TOP = 640
/** A bean on the hook pops out onto the ground once the hook rises above this y. */
export const HOOK_OUT_Y = 110
/** How fast the hook tip follows the pointer (per second). */
export const HOOK_RATE = 12
/** The hook's cup catches a bean this close to it, in u, but only while rising. */
export const HOOK_CATCH = 10
/** Rising faster than this (u/s) counts as lifting, for catches and snags. */
export const HOOK_LIFT_SPEED = 20
/** The cup snags junk this close to it, in u. */
export const SNAG_RADIUS = 18
/** Hook acceleration in u/s² that reads as a full jolt and drops the bean. */
export const HOOK_JOLT_REF = 5000
/** Moving faster than this (u/s) within HOOK_SCRAPE_GAP of a wall scrapes the bean off. */
export const HOOK_SCRAPE_SPEED = 300
export const HOOK_SCRAPE_GAP = 10
/** Most drain beans simulated at once. The rest wait in the gunk. */
export const DRAIN_MAX_BODIES = 30
/** A bean out of the hook's reach this long (ms) respawns on top of the gunk. */
export const WEDGE_MS = 2000
/**
 * Where a drain grate sits in a zone's top-down view when no route drain is near (dev
 * drain spills), its height everywhere, and the tap radius for it and the fridge gap.
 */
export const GRATE_X = 470
export const GRATE_TOP_Y = 250
export const GRATE_TAP = 60

// ---------------------------------------------------------------- Puddles and the drying rack

/** Most beans one spill event sends into puddles. */
export const PUDDLE_EVENT_CAP = 10
/** A puddle in Pickup sits at this y, this tall (half height), and at least this wide (half width), in u. */
export const PUDDLE_TOP_Y = 225
export const PUDDLE_RY = 40
export const PUDDLE_MIN_RX = 50
/** A loose bean resting in a puddle slower than this (u/s) swells. */
export const SWELL_SPEED = 40
/** Body radius of a swollen bean in Pickup, in u. It draws 1.5 times a bean's size. */
export const SWOLLEN_RADIUS = 12
/** A swollen bean released over the pot bounces off the rim at this speed, in u/s. */
export const SWOLLEN_BOUNCE = 220
/** The drying rack at the bottom left of Pickup: left, top, width and height, in u. */
export const RACK_X = 34
export const RACK_Y = 640
export const RACK_W = 150
export const RACK_H = 110
/** A swollen bean dries on the rack for this long, in real ms (3s with ?fast). */
export const DRY_MS = 60_000

// ---------------------------------------------------------------- Pigeons and lost beans

/** Beans lost for good fill seed packets of up to this many. */
export const PACKET_SIZE = 8
/** Pigeons waddle at this speed, in u/s. */
export const PIGEON_SPEED = 45
/** Most pigeons on the ground at once. */
export const PIGEON_MAX = 3
/** The first pigeon of a set-down comes after this share of the stretch's pigeon interval. */
export const PIGEON_FIRST_SHARE = 0.5
/** A loose bean this close to a walking pigeon diverts it, in u. */
export const PIGEON_DIVERT = 60
/** A pigeon pecks at a bean this long before it's gone, in ms. */
export const PIGEON_PECK_MS = 1000
/** On the pot's rim, a pigeon eats one bean every this many ms. */
export const PIGEON_BITE_MS = 900
/** A tap or click this close to any pigeon scatters the whole flock, in u. */
export const PIGEON_SHOO_RADIUS = 50
/** A scattered flock comes back after this long, between these bounds, in ms. */
export const PIGEON_RETURN_MIN_MS = 6_000
export const PIGEON_RETURN_MAX_MS = 10_000
/** Scattered pigeons fly off at this speed, in u/s. */
export const PIGEON_FLEE_SPEED = 420
/** With the pot on the ground in the walk view, pigeons start this far either side of it, in u. */
export const PIGEON_GROUND_START = 380

// ---------------------------------------------------------------- Upgrades

/** Wider Tweezers: grab radius times WIDE_GRAB, clumps of up to WIDE_CLUMP_MAX. */
export const WIDE_GRAB = 1.6
export const WIDE_CLUMP_MAX = 5
/** Wider Tweezers drop beans at this share of the usual strain, and more beans are slippery. */
export const WIDE_STRAIN_LIMIT = 0.65
export const WIDE_SLIPPERY_CHANCE = 0.12
/** Pot Lid: a kick harder than LID_RATTLE_FROM rad/s pops floor((J - 1) * LID_RATTLE_PER) beans. */
export const LID_RATTLE_FROM = 1.2
export const LID_RATTLE_PER = 3
/** A big hit throws the lid this far along the route, in u. Walking the pot within LID_FETCH u of it puts it back. */
export const LID_THROW = 240
export const LID_FETCH = 40
/** The lid's flight after a big hit, in ms. */
export const LID_FLIGHT_MS = 700
/** With the Pot Lid on, a character hit throws this share of its splash, at least 1 bean. */
export const LID_HIT_SHARE = 0.25
/** With the Pot Lid on, a tip-over scatters this share of its loose beans. The pile stays the same. */
export const LID_TIP_SHARE = 0.5
/** Grippy Shoes: how long a "whoa" on wet grass gives you to save it, in ms. */
export const WHOA_MS_GRIPPY = 700
/** Rub strokes that clean the mud off Grippy Shoes after the park. One stroke is one way. */
export const MUD_STROKES = 24
export const MUD_STROKE_MIN = 30
/** Pigeon Net: the first pigeon of a set-down ties it into NET_KNOTS knots of NET_KNOT_CIRCLES circles each. */
export const NET_KNOTS = 3
export const NET_KNOT_CIRCLES = 2
/** Circling a knot the wrong way adds a circle, up to this many. */
export const NET_KNOT_MAX = 5
/** A press this close to a knot starts circling it, in u. */
export const NET_KNOT_REACH = 34
/** A pigeon pecks at an untangled net this many times, then gives up and flies off. */
export const NET_GIVE_UP = 2

// ---------------------------------------------------------------- The window box

/** Slots in the window box on your back. The Bigger Window Box has BOX_SLOTS_BIG. */
export const BOX_SLOTS = 3
export const BOX_SLOTS_BIG = 6
/** Seed packets one slot takes. */
export const SLOT_PACKETS = 3
/** One-way rub strokes that dig a slot, each at least DIG_STROKE_MIN u long. */
export const DIG_STROKES = 6
export const DIG_STROKE_MIN = 30
/** Holding a dug hole this long plants the chosen packet, in ms. */
export const PLANT_HOLD_MS = 600
/** The watering can empties over this long while held, in ms. Past BOX_FLOOD_MS it floods. */
export const WATER_FILL_MS = 1_200
export const BOX_FLOOD_MS = 1_800
/** One batch grows for this long, in real ms (3s with ?fast). */
export const GROW_MS = 60_000
/** "Plant your packets" shows once this many packets wait and the box is idle. */
export const PLANT_NUDGE = 3
/** A press in the box that moves less than this before it lifts is a tap, in u. */
export const BOX_TAP_MOVE = 12

// ---------------------------------------------------------------- Gossip

/** Gossip letters are this tall, in u. */
export const GOSSIP_LETTER_HEIGHT = 44
/**
 * Beans sit this far apart along a letter's strokes, in u: about 5 beans a letter. Lead
 * Decisions raised it from 22, so a line needs 47 to 91 beans instead of 57 to 106 and
 * smaller spills spell gossip.
 */
export const GOSSIP_BEAN_SPACING = 26
/** Gossip rows wrap inside this width, in u. */
export const GOSSIP_MAX_WIDTH = 520
/** Beans slide into their letters over this long, on a critically damped spring, in ms. */
export const LETTER_SLIDE_MS = 800
/** Jot It Down fills over this long while held, in ms. */
export const JOT_MS = 2000
/** A press this close to a letter bean touches the gossip, in u. */
export const LETTER_TOUCH = 26
/** The letters wiggle this long after a warning touch, in ms. */
export const LETTER_WIGGLE_MS = 700
/** A scramble flings letter beans this fast, in u/s. */
export const SCRAMBLE_SPEED = 160
/** A big scripted hit throws at least this many more beans than the next line needs. */
export const GOSSIP_MARGIN = 8

// ---------------------------------------------------------------- Kiosk and coins

/**
 * Clean stretch bonus in coins, paid in full at CLEAN_FULL beans spilled or fewer. The
 * kiosk pays it after each stretch, and Grandma pays the door's when she starts counting.
 */
export const CLEAN_BONUS = {
  kitchen: 60,
  street: 90,
  market: 120,
  park: 120,
  hill: 150,
  bridge: 180,
  door: 90
} as const
/** Spill this many beans or fewer on a stretch for the full clean bonus. */
export const CLEAN_FULL = 5
/** Spill this many or fewer for half of it, rounded down. */
export const CLEAN_HALF = 25
/**
 * The Weekly Whisper pays PAGE_PRICE_BASE + PAGE_PRICE_STEP * (13 - rank) for a page, so
 * the funniest (rank 1) pays 234 and the dullest 102. Tripled from 30 and 4 so an
 * average run of about 3 pages buys upgrades sooner.
 */
export const PAGE_PRICE_BASE = 90
export const PAGE_PRICE_STEP = 12
/** Pages p reveal round(20 * (p / 12) ^ SECRET_CURVE) of the secret's letters. Under 1, the first pages reveal the most. */
export const SECRET_CURVE = 0.6
/** How long the editor's speech bubble stays up, in ms. */
export const EDITOR_SAYS_MS = 3200

// ---------------------------------------------------------------- Exit gate

/** The gate stands this far before the stretch end, in u. */
export const GATE_FROM_END = 160
/** You stop this far before a shut gate's centre, in u, so the pot's front rim stays clear of it. */
export const GATE_STOP = 190
/** Past the gate, walking to this far (u) before the stretch end leads on to the next stretch. */
export const STRETCH_EXIT = 40
/** How long a stretch's title card shows when you arrive, in ms. */
export const TITLE_MS = 2600
/** How often a closed gate buzzes while you push on it, in ms. */
export const GATE_BUZZ_MS = 2000

// ---------------------------------------------------------------- The hill and the weather

/** The hill's slope, in degrees. */
export const SLOPE_DEGREES = 12
/** Walking uphill runs at this share of your usual speed. */
export const UPHILL_SCALE = 0.7
/** A bean landing on the slope rolls down to the hill start at this speed, in u/s. */
export const SLOPE_ROLL_SPEED = 250
/** Rain fills the pot at this rate while you carry it on the hill, in u of water per second. */
export const RAIN_RATE = 0.12
/** Once the water passes the pot's resting margin, beans float out at this many a second. */
export const FLOAT_RATE = 2
/** Pour Off: the hold fills over POUR_FILL_MS. Letting go between POUR_GOOD_FROM and POUR_GOOD_TO pours all the water; past POUR_GOOD_TO beans go too. */
export const POUR_FILL_MS = 2400
export const POUR_GOOD_FROM = 0.55
export const POUR_GOOD_TO = 0.8
/** Beans poured out past the green: POUR_BEANS_BASE + POUR_BEANS_PER * (level - POUR_GOOD_TO), at most POUR_BEANS_MAX. */
export const POUR_BEANS_BASE = 20
export const POUR_BEANS_PER = 400
export const POUR_BEANS_MAX = 100
/** The prompt asks you to pour off once this much water is in the pot, in u. */
export const POUR_PROMPT_WATER = 3
/**
 * Out of the rain it asks from this much leftover water, in u, and bots obey it. The
 * longer hill sends more water onto the bridge, where it cost key players the most.
 */
export const POUR_PROMPT_LEFTOVER = 1.5
/** Wind gusts: leaves stream and the wind rises GUST_WARN_MS ahead, then it blows for GUST_MS. */
export const GUST_WARN_MS = 1200
export const GUST_MS = 1000
/**
 * A gust pushes the bean surface this many degrees downwind, and drifts the pot at
 * GUST_DRIFT_RATE degrees per second. M26 moved them from 8 and 20 so the hill and the
 * bridge reach their budgets. Keys turn the pot at 30°/s, short of what a gust asks, so
 * keyboard players lose about twice what tilting players do on the hill.
 */
export const GUST_PUSH = 14
export const GUST_DRIFT_RATE = 15
/** After a gust, its drift on the pot fades at this rate (per second), as your arms settle it. */
export const GUST_DRIFT_DECAY = 2.5
/** Pickup on the hill: resting beans creep downhill at this speed, in u/s. */
export const HILL_CREEP = 6

// ---------------------------------------------------------------- Bridge

/** Bridge deck slide speed at peak roll, in u/s. Sleeping is off on the bridge so it applies. */
export const BRIDGE_SLIDE_SPEED = 75
/** The deck's roll at which beans slide at BRIDGE_SLIDE_SPEED, in degrees. Peaks of 7 to 10 degrees slide them 60 to 90 u/s. */
export const SLIDE_ROLL = 8.5
/** The deck rolls the pot by ROLL_A sin(2 PI ROLL_HZ t) + ROLL_B sin(2 PI ROLL_HZ_B t + ROLL_PHASE), in degrees. */
export const ROLL_A = 7
export const ROLL_HZ = 0.32
export const ROLL_B = 3
export const ROLL_HZ_B = 0.71
export const ROLL_PHASE = 1.3
/** A steady crosswind leans the pot this many degrees on the bridge. */
export const CROSSWIND = 4
/** Spills while the deck rolls past this many degrees blame the bridge's sway. */
export const SWAY_BLAME = 6
/** Share of the beans spilled on the bridge that fall in the river, at most RIVER_EVENT_CAP per spill event. */
export const RIVER_SHARE = 0.3
export const RIVER_EVENT_CAP = 30
/** River beans splash down this far below the deck in the walk view, in u. */
export const RIVER_DROP = 110
/** In bridge Pickup the deck runs from DECK_LEFT to DECK_RIGHT, with the river beyond its edges, in u. */
export const DECK_LEFT = 50
export const DECK_RIGHT = 550
/** Planks are DECK_PLANK u apart with DECK_GAP u gaps, and a bean slower than GAP_SLOW_SPEED u/s over a gap falls through. */
export const DECK_PLANK = 60
export const DECK_GAP = 6
export const GAP_SLOW_SPEED = 40
/** A bean you let go of counts as flung for FLING_MS; flung into the river, a duck brings it back after DUCK_MS. */
export const FLING_MS = 1_500
export const DUCK_MS = 2_000

// ---------------------------------------------------------------- Phone pinch

/** A pinch grabs once it closes under this share of its start distance... */
export const PINCH_CLOSE_SHARE = 0.75
/** ...or under this gap in CSS px, whichever comes first. */
export const PINCH_CLOSE_PX = 100
/** The tweezer tip draws this many CSS px above the pinch centre, so fingers never cover the bean. */
export const PINCH_TIP_LIFT_PX = 50
/** A pinch grabs the bean nearest the tip within this many u. */
export const PINCH_GRAB_RADIUS = 40
/** A one-finger drag that starts on a pile or cluster scoops after moving this far, in u. */
export const TOUCH_SCOOP_MOVE = 12

// ---------------------------------------------------------------- Fail replays

/** The recorder keeps REPLAY_SECONDS of the design area at REPLAY_FPS, in REPLAY_W x REPLAY_H frames. Two sets of 72 frames hold about 44 MB. */
export const REPLAY_SECONDS = 3
export const REPLAY_FPS = 24
export const REPLAY_W = 240
export const REPLAY_H = 320
/** A spill's clip is cut this long after its last bean lands, in real ms. */
export const REPLAY_SETTLE_MS = 1_000
/** Spills smaller than this get no replay, since there is barely anything to see. */
export const REPLAY_MIN = 3
/** A new biggest spill opens its replay by itself once it reaches this many beans. Tip-overs always do. */
export const REPLAY_AUTO_MIN = 30
/** Spills this big offer Share, as do tip-overs. */
export const REPLAY_SHARE_MIN = 100
/** The corner Replay chip shows for this long, in ms. */
export const REPLAY_CHIP_MS = 4_000
/** Replays play at this speed. */
export const REPLAY_SPEED = 0.35

// ---------------------------------------------------------------- Grandma's door

/** Grandma's dog barks once your feet pass this route x on the steps up to her door. */
export const DOOR_BARK_X = 600
/** It jumps this long after the bark, in simulated ms. */
export const DOOR_DOG_WARN_MS = 1_200
/** Leaning toward the dog by this many degrees when it jumps also saves you, as with every other character. The plan's 10 poured beans out of a full pot, which spills from 10.1°. */
export const DOOR_LEAN = 5
/** You stop on the top step, at this route x, until Grandma starts counting. */
export const DOOR_STOP_X = 720
/** A missed dodge tips the whole pot: this many loose beans, and the rest in a pile. */
export const DOOR_TIP_LOOSE = 40
/** Slow motion after the doorstep tip, in real ms at SLOW_SCALE. */
export const DOOR_SLOW_MS = 600
/** Route x of Grandma in her doorway, her dog at her feet, and the doormat. */
export const GRANDMA_X = 900
export const DOOR_DOG_X = 864
export const DOORMAT_X = 885
/** Grandma counts to 9,999 over COUNT_MS along 9,999 (t / COUNT_MS)^3. Beans picked while she waits count at COUNT_RESUME_RATE a second. */
export const COUNT_MS = 14_000
export const COUNT_RESUME_RATE = 12
/** Count view: the stew pot's rim centre, and how close a dropped bean must land to go in, in u. */
export const STEW_X = 300
export const STEW_Y = 520
export const STEW_REACH = 120
/** Count view: the doormat's centre and size, and how far you drag it up to find the bean, in u. */
export const MAT_X = 300
export const MAT_Y = 706
export const MAT_W = 320
export const MAT_H = 96
export const MAT_LIFT = 80
/** A press this close to the doormat bean picks it up, in u. */
export const MAT_BEAN_GRAB = 46
/** The taste, in simulated ms: "Hmm.", the salt, the dog's sneeze, then the secret. */
export const TASTE_HMM_MS = 1_400
export const TASTE_SALT_MS = 2_800
export const TASTE_SNEEZE_MS = 4_000
export const TASTE_MS = 5_200
/** The secret: beans fly from the stew into letters, each SECRET_FLY_MS, SECRET_STAGGER_MS apart. Grandma speaks at SECRET_SAY_MS, and the ending opens at SECRET_MS. */
export const SECRET_FLY_MS = 900
export const SECRET_STAGGER_MS = 14
export const SECRET_SAY_MS = 3_000
export const SECRET_MS = 7_000
