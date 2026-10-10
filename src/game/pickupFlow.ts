import { updateBridgePickup } from './bridge'
import { grateSpot, updateGrate } from './drainFlow'
import { puddleSpots, startDrying } from './drying'
import { resetFeet, updateFeet } from './market'
import { resetPickupDog, updatePickupDog } from './park'
import { caption, showing, sound } from './effects'
import { gossipPress, maybeSpell, updateGossip } from './gossipFlow'
import {
  dustpanScoop,
  handScoop,
  popPitch,
  slipsAt,
  strainFor,
  streakCaption,
  type DropCause
} from './pickup'
import { line } from './lines'
import { PickupWorld, type ReleaseResult } from './pickupWorld'
import { stretchLog } from './runLog'
import {
  currentStretch,
  type Game,
  type GameInput,
  type PointerInput
} from './state'
import {
  CLUSTER_MIN,
  CLUSTER_RADIUS,
  CLUSTER_SCOOP,
  CUP_MS,
  CUP_STILL,
  DRIBBLE_MS,
  DRIBBLE_SPEED,
  GRAB_RADIUS,
  HILL_CREEP,
  KITCHEN_PLAY_TOP,
  PILE_BASE_R,
  PILE_MAX_R,
  PILE_R_GROWTH,
  PILE_X,
  PILE_Y,
  PLAY_TOP,
  SLIPPERY_MS,
  STRAIN_WARN,
  SWELL_SPEED
} from './tuning'
import { clumpMax, grabRadius, slipperyChance, strainLimit } from './upgrades'
import { formatBeans } from './units'
import { behind, type Zone } from './zones'

/** Grab radius with Assist Mode's one-finger drag. */
const ASSIST_GRAB_RADIUS = 36

/** Radius of the pile mound in the top-down view. A whole pot's pile stops growing at PILE_MAX_R. */
export function pileRadius(pile: number): number {
  return Math.min(PILE_MAX_R, PILE_BASE_R + Math.sqrt(pile) * PILE_R_GROWTH)
}

/** True while pile scoops use Grandma's dustpan instead of your hands. */
export function usingDustpan(game: Game): boolean {
  return game.door.dustpan && currentStretch(game).id === 'door'
}

/** True when (x, y) is on the pile mound of `zone`. */
export function onPile(zone: Zone, x: number, y: number): boolean {
  return (
    zone.pile > 0 && Math.hypot(x - PILE_X, y - PILE_Y) <= pileRadius(zone.pile)
  )
}

/** Opens Pickup on a zone: its beans become Matter bodies. */
export function openPickup(game: Game, zone: Zone): void {
  const pickup = game.pickup
  game.scene = 'pickup'
  // The kitchen's top-down floor starts below the fridge.
  const def = currentStretch(game)
  const kitchen = def.id === 'kitchen'
  const puddles = puddleSpots(def, zone)
  // On the hill the ground tilts, so resting beans creep downhill (left), and on the
  // bridge the deck rolls them about. Neither lets beans sleep.
  const hill = def.slope !== null
  const bridge = def.deck
  pickup.world = new PickupWorld(zone, game.counts, {
    top: kitchen ? KITCHEN_PLAY_TOP : PLAY_TOP,
    grate: grateSpot(def, zone),
    puddles,
    rack: puddles.length > 0 || zone.puddle > 0,
    sleeping: !hill && !bridge,
    deck: bridge
  })
  if (hill) pickup.world.slide.x = -HILL_CREEP
  pickup.streak = 0
  pickup.carry.count = 0
  pickup.cup.armed = false
  resetFeet(game)
  resetPickupDog(game)
  if (zone.pile > 0 && usingDustpan(game))
    caption(
      game,
      "Grandma's dustpan.",
      'info',
      game.touch
        ? 'Drag the pile to scoop it.'
        : 'Hold still on the pile to scoop.',
      4000
    )
  else if (!pickup.taught.tweezers) {
    pickup.taught.tweezers = true
    caption(
      game,
      'Every bean goes back in the pot.',
      'info',
      'Jerk them and they fly.',
      4000
    )
  } else if (!pickup.taught.hands && zone.pile > 0) {
    pickup.taught.hands = true
    caption(
      game,
      'Too many to tweeze.',
      'info',
      'Scoop the pile with your hands.',
      4000
    )
  }
  if (bridge && !game.taught.bridge) {
    game.taught.bridge = true
    caption(
      game,
      'Rope bridge.',
      'bad',
      'Beans slide off the edges as it sways. Be quick.',
      3600
    )
  }
  if (hill && !game.taught.creep) {
    game.taught.creep = true
    caption(
      game,
      "It's a hill.",
      'bad',
      'Beans creep downhill, so be quick.',
      3600
    )
  }
  maybeSpell(game)
}

/** Writes positions back and frees the Matter world. */
export function closePickup(game: Game): void {
  const world = game.pickup.world
  if (!world) return
  world.writeBack()
  world.dispose()
  game.pickup.world = null
  game.pickup.carry.count = 0
  game.pickup.cup.armed = false
}

/** One Pickup step: physics, hold-to-cup, and the strain or dribble of whatever you carry. */
export function updatePickup(
  game: Game,
  simMs: number,
  input: GameInput
): void {
  const pickup = game.pickup
  const world = pickup.world
  if (!world) return
  world.step(simMs)
  updateBridgePickup(game, simMs)
  updateGrate(game)
  if (world.swellSlow(SWELL_SPEED) > 0) swelled(game)
  updateFeet(game, simMs)
  updatePickupDog(game, simMs)
  updateGossip(game, simMs)
  updateCup(game, simMs, input.pointer)
  const carry = pickup.carry
  if (carry.count === 0) return
  const { vx, vy } = input.pointer
  const speed = Math.hypot(vx, vy)
  if (carry.mode === 'hands') {
    carry.dribbleMs += simMs
    if (speed > DRIBBLE_SPEED && carry.dribbleMs >= DRIBBLE_MS) {
      carry.dribbleMs = 0
      if (world.dribble()) {
        carry.count = world.holding
        sound(game, 'tick', 0.35, 0.8 + game.random.fx() * 0.3)
      }
    }
    return
  }
  pickup.jolt.feedPointer(vx, vy, simMs)
  const reading = strainFor(
    pickup.jolt.level,
    speed,
    carry.count,
    strainLimit(game)
  )
  carry.strain = reading.strain
  carry.creakMs += simMs
  if (carry.strain >= 1) {
    drop(game, reading.cause, input.pointer)
    return
  }
  if (carry.strain > STRAIN_WARN && carry.creakMs > 220) {
    carry.creakMs = 0
    sound(game, 'rattle', 0.25, 1.8)
  }
  if (carry.slipperyIn > 0) {
    carry.slipperyIn -= simMs
    if (carry.slipperyIn <= 0) carry.slipperyMs = SLIPPERY_MS
  } else if (carry.slipperyMs > 0) {
    carry.slipperyMs -= simMs
    if (carry.slipperyMs <= 0) {
      carry.slipperyMs = 0
      if (slipsAt(speed)) drop(game, 'slippery', input.pointer)
    }
  }
}

/** Turns a still press on the pile or a cluster into cupped hands after CUP_MS. */
function updateCup(game: Game, simMs: number, pointer: PointerInput): void {
  const pickup = game.pickup
  const cup = pickup.cup
  const world = pickup.world
  if (!cup.armed || !world) return
  if (Math.hypot(pointer.x - cup.x, pointer.y - cup.y) > CUP_STILL) {
    cup.armed = false
    return
  }
  cup.ms += simMs
  if (cup.ms < CUP_MS) return
  cup.armed = false
  // Beans the tweezers already lifted go back down into the scoop.
  if (pickup.carry.count > 0) world.release(0, 0)
  beginScoop(game, cup.source, cup.x, cup.y)
}

/** Fills cupped hands from the pile or a cluster at (x, y). Returns the beans lifted. */
function beginScoop(
  game: Game,
  source: 'pile' | 'cluster',
  x: number,
  y: number
): number {
  const pickup = game.pickup
  const world = pickup.world
  if (!world) return 0
  const pile = world.zone.pile
  const n =
    source === 'pile'
      ? world.scoopPile(
          usingDustpan(game) ? dustpanScoop(pile) : handScoop(pile),
          x,
          y
        )
      : world.scoopCluster(x, y, CLUSTER_RADIUS, CLUSTER_SCOOP)
  const carry = pickup.carry
  carry.mode = 'hands'
  carry.count = n
  carry.strain = 0
  carry.dribbleMs = 0
  if (n === 0) return 0
  sound(game, 'squish', 0.6, 0.7)
  if (!pickup.taught.hands) {
    pickup.taught.hands = true
    caption(game, `Scooped ${n}.`, 'good', 'Fast hands drop beans.', 2400)
  }
  return n
}

/** Where hands could scoop at (x, y): the pile, a dense cluster, or nowhere. */
export function scoopSourceAt(
  game: Game,
  x: number,
  y: number
): 'pile' | 'cluster' | null {
  const world = game.pickup.world
  if (!world) return null
  if (onPile(world.zone, x, y)) return 'pile'
  return world.countNear(x, y, CLUSTER_RADIUS) >= CLUSTER_MIN ? 'cluster' : null
}

/** Phones: a one-finger drag that starts on the pile or a cluster scoops at once. */
export function pickupScoop(game: Game, x: number, y: number): number {
  const pickup = game.pickup
  if (game.scene !== 'pickup' || pickup.carry.count > 0) return 0
  if (gossipPress(game, x, y)) return 0
  const source = scoopSourceAt(game, x, y)
  return source ? beginScoop(game, source, x, y) : 0
}

/** How a press grabs. Pinches use a wider radius and never cup hands. */
export interface PressOptions {
  radius?: number
  cup?: boolean
}

/**
 * The pointer goes down at (x, y). Tweezers grab at once; on the pile or a dense cluster
 * the press also arms cupped hands, which take over if you hold still. Returns the beans
 * lifted by the tweezers.
 */
export function pickupPress(
  game: Game,
  x: number,
  y: number,
  options: PressOptions = {}
): number {
  const pickup = game.pickup
  const world = pickup.world
  if (game.scene !== 'pickup' || !world || pickup.carry.count > 0) return 0
  if (gossipPress(game, x, y)) return 0
  const source = options.cup === false ? null : scoopSourceAt(game, x, y)
  const cup = pickup.cup
  cup.armed = source !== null
  cup.ms = 0
  cup.x = x
  cup.y = y
  cup.source = source ?? 'cluster'
  if (source === 'pile') return 0
  const radius = grabRadius(
    game,
    options.radius ?? (game.options.assist ? ASSIST_GRAB_RADIUS : GRAB_RADIUS)
  )
  const n = world.grab(x, y, radius, clumpMax(game))
  if (n === 0) return 0
  const carry = pickup.carry
  carry.mode = 'tweezers'
  carry.count = n
  carry.strain = 0
  carry.creakMs = 0
  carry.slipperyMs = 0
  carry.slipperyIn =
    game.random.pickup() < slipperyChance(game)
      ? 150 + game.random.pickup() * 350
      : 0
  pickup.jolt.reset()
  sound(game, 'click', 0.35, 1.7 - n * 0.1)
  return n
}

/** The pointer moves to (x, y). */
export function pickupDrag(game: Game, x: number, y: number): void {
  const world = game.pickup.world
  if (world && game.pickup.carry.count > 0) world.moveHeld(x, y)
}

/** The pointer lifts. Whatever is held over the pot goes in. */
export function pickupRelease(
  game: Game,
  pointer: Omit<PointerInput, 'down'>
): void {
  const pickup = game.pickup
  const world = pickup.world
  pickup.cup.armed = false
  if (!world || pickup.carry.count === 0) return
  const hands = pickup.carry.mode === 'hands'
  const result = world.release(pointer.vx, pointer.vy)
  pickup.carry.count = 0
  pickup.carry.strain = 0
  swollenOutcome(game, result)
  if (result.potted > 0) potted(game, result.potted)
  else if (hands && result.returned > 0) {
    sound(game, 'splat', 0.6, 0.8)
    caption(game, line(game, 'missed'), 'bad', '', 1400)
  }
}

/** A dry bean soaked in a puddle and swelled. */
function swelled(game: Game): void {
  sound(game, 'splash', 0.4, 1.4)
  if (!showing(game, 'puddle'))
    caption(
      game,
      line(game, 'puddle'),
      'bad',
      'Keep dry beans out of puddles.',
      2400,
      { key: 'puddle' }
    )
}

/** The pot refused swollen beans, or they went onto the drying rack. */
function swollenOutcome(game: Game, result: ReleaseResult): void {
  if (result.refused > 0) {
    game.pickup.streak = 0
    sound(game, 'boing', 0.7, 1)
    caption(game, 'Too swollen. Put it on the rack.', 'bad', '', 2200)
  }
  if (result.racked > 0) {
    startDrying(game, result.racked)
    sound(game, 'squish', 0.6, 1.3)
    if (game.taught.rack)
      caption(game, 'On the rack.', 'good', 'Dry in a minute.', 1600)
    else {
      game.taught.rack = true
      caption(
        game,
        'On the rack to dry.',
        'good',
        'It hops into the pot by itself.',
        3200
      )
    }
  }
}

function potted(game: Game, n: number): void {
  const pickup = game.pickup
  const before = pickup.streak
  pickup.streak += n
  game.stats.pickedUp += n
  stretchLog(game).pickedUp += n
  game.out.push({ type: 'potted', n })
  sound(game, 'pop', 0.8, popPitch(pickup.streak))
  const line = streakCaption(before, pickup.streak)
  if (line) {
    caption(game, line, 'good')
    sound(game, 'coin', 0.5, 1.2)
  }
  const world = pickup.world
  if (world?.clear) {
    if (world.zone.id === game.kitchen.introZone)
      caption(
        game,
        '9,999 became 10,000 again.',
        'good',
        game.touch ? 'Tap Pick Up Pot to carry on.' : 'Space picks up the pot.',
        5000
      )
    else {
      const left = behind(game.zones.list, game.stretch)
      const down = world.zone.drain
      if (down > 0) {
        const kitchen = currentStretch(game).id === 'kitchen'
        caption(
          game,
          'This patch is clear.',
          'good',
          `${formatBeans(down)} still ${kitchen ? 'under the fridge' : 'down the drain'}. ${game.touch ? 'Tap' : 'Click'} ${kitchen ? 'the gap' : 'the grate'}.`,
          4000
        )
      } else if (left > 0)
        caption(
          game,
          'This patch is clear.',
          'good',
          `${formatBeans(left)} still out there.`,
          4000
        )
      else
        caption(
          game,
          'All clear.',
          'good',
          'Pick up the pot and carry on.',
          4000
        )
    }
    sound(game, 'ding', 0.6)
  }
}

function drop(game: Game, cause: DropCause, pointer: PointerInput): void {
  const pickup = game.pickup
  const world = pickup.world
  if (!world) return
  const result = world.release(pointer.vx, pointer.vy)
  pickup.carry.count = 0
  pickup.carry.strain = 0
  pickup.carry.slipperyMs = 0
  pickup.streak = 0
  sound(game, 'squish', 0.8, 0.9 + game.random.fx() * 0.2)
  caption(game, line(game, cause), 'bad', '', 1600)
  swollenOutcome(game, result)
  if (result.potted > 0) potted(game, result.potted)
}
