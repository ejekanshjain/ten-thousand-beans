import { clamp } from '../shared'
import { caption, showing, sound } from './effects'
import { DrainWorld, type DrainVariant } from './drainWorld'
import type { Point } from './pickupWorld'
import { drainNear, type StretchDef } from './route'
import { line } from './lines'
import type { Game, GameInput } from './state'
import {
  DRAIN_SLOW_SPEED,
  DRAIN_ZONE_REACH,
  FRIDGE_GAP_X,
  FRIDGE_GAP_Y,
  GRATE_HALF_W,
  GRATE_TAP,
  GRATE_TOP_Y,
  GRATE_X,
  SCATTER_LEFT,
  SCATTER_RIGHT,
  ZONE_SPREAD
} from './tuning'
import type { Zone } from './zones'

/** The Drain scene: the shaft's world, which hole it is, and a short pause after the last bean. */
export interface DrainState {
  world: DrainWorld
  variant: DrainVariant
  /** Real ms left before the scene closes by itself once every bean is out. 0 while fishing. */
  doneMs: number
}

/**
 * Where a zone's drain grate sits in its top-down view: under the route drain near its
 * anchor, mapped like the beans, or at a fixed spot when drain beans sit here without
 * a route drain (dev spills). Null when the zone has no drain at all.
 */
export function grateSpot(def: StretchDef, zone: Zone): Point | null {
  if (def.id === 'kitchen') return null
  const drain = drainNear(def, zone.anchorX, DRAIN_ZONE_REACH)
  if (drain !== null)
    return {
      x: clamp(
        300 + (drain - zone.anchorX) * ZONE_SPREAD,
        SCATTER_LEFT + GRATE_HALF_W,
        SCATTER_RIGHT - GRATE_HALF_W
      ),
      y: GRATE_TOP_Y
    }
  return zone.drain > 0 ? { x: GRATE_X, y: GRATE_TOP_Y } : null
}

/** Where a hole is in the zone's top-down view: the fridge gap in the kitchen, a grate elsewhere. */
export function holeAt(game: Game): Point {
  return isKitchenPickup(game)
    ? { x: FRIDGE_GAP_X, y: FRIDGE_GAP_Y }
    : (game.pickup.world?.grate ?? { x: GRATE_X, y: GRATE_TOP_Y })
}

function isKitchenPickup(game: Game): boolean {
  return game.route[game.stretch]?.id === 'kitchen'
}

/** True when a tap at (x, y) in Pickup lands on the fridge gap or the drain grate. */
export function onHole(game: Game, x: number, y: number): boolean {
  if (isKitchenPickup(game))
    return Math.abs(x - FRIDGE_GAP_X) <= 110 && Math.abs(y - FRIDGE_GAP_Y) <= 30
  const grate = game.pickup.world?.grate
  if (!grate) return false
  return Math.hypot(x - grate.x, y - grate.y) <= GRATE_TAP
}

/**
 * A tap on the hole: opens the Drain scene when beans are down there. Returns true when
 * the tap hit the hole, even if it was empty.
 */
export function tapHole(game: Game, x: number, y: number): boolean {
  const world = game.pickup.world
  if (!world || game.scene !== 'pickup' || !onHole(game, x, y)) return false
  if (game.pickup.carry.count > 0) return false
  if (world.zone.drain === 0) {
    if (isKitchenPickup(game))
      caption(
        game,
        'Nothing under there.',
        'info',
        'Just dust and regret.',
        1600
      )
    else caption(game, 'Nothing down there.', 'info', 'Yet.', 1600)
    return true
  }
  openDrain(game, isKitchenPickup(game) ? 'fridge' : 'drain')
  return true
}

/** Opens the Drain scene on the current Pickup zone's drain beans. */
export function openDrain(game: Game, variant: DrainVariant): boolean {
  const world = game.pickup.world
  if (!world || world.zone.drain === 0) return false
  game.drain = {
    world: new DrainWorld(variant, world.zone.drain, game.random.critters),
    variant,
    doneMs: 0
  }
  game.scene = 'drain'
  game.pickup.cup.armed = false
  game.fx.captions.length = 0
  sound(game, 'drip', 0.7, 0.8)
  if (!game.taught.hanger) {
    game.taught.hanger = true
    caption(
      game,
      'Hook a bean, then lift it slowly.',
      'info',
      game.touch
        ? 'Drag to steer the coat hanger.'
        : 'Hold the mouse button to steer the coat hanger.',
      4200
    )
  }
  game.out.push({ type: 'scene' })
  return true
}

/** Back to Pickup. Whatever the hook holds falls back into the shaft. */
export function closeDrain(game: Game): void {
  const drain = game.drain
  if (!drain) return
  drain.world.letGo()
  drain.world.dispose()
  game.drain = null
  game.scene = 'pickup'
  game.fx.captions.length = 0
  sound(game, 'whoosh', 0.4, 1.3)
  game.out.push({ type: 'scene' })
}

/** One step of fishing: the hook moves, and caught, dropped and rescued beans get their juice. */
export function updateDrain(game: Game, simMs: number, input: GameInput): void {
  const drain = game.drain
  if (!drain) return
  if (drain.doneMs > 0) {
    drain.doneMs -= simMs
    if (drain.doneMs <= 0) closeDrain(game)
    return
  }
  const world = drain.world
  const event = world.step(simMs, input.pointer)
  switch (event) {
    case 'caught':
      sound(game, 'pop', 0.5, 1.7)
      break
    case 'jerked':
      sound(game, 'squish', 0.8, 0.9)
      caption(game, 'Too jerky.', 'bad', 'Lift it slowly.', 1600)
      break
    case 'scraped':
      sound(game, 'scrub', 0.7, 1.2)
      caption(game, 'Scraped it off on the wall.', 'bad', '', 1600)
      break
    case 'snagged': {
      const junk = world.heldJunk
      sound(game, 'rattle', 0.5, 1.4)
      if (junk) caption(game, `${junk.name}. Not a bean.`, 'info', '', 1800)
      break
    }
    case 'junkTop':
      sound(game, 'splash', 0.5, 1.2)
      caption(game, 'Still not a bean.', 'info', 'Back it goes.', 1600)
      break
    case 'out':
      fished(game)
      break
    case 'none':
      break
  }
}

/** A bean on the hook rose out of the hole: it lands next to the hole as a loose bean. */
function fished(game: Game): void {
  const drain = game.drain
  const pickup = game.pickup.world
  if (!drain || !pickup) return
  const hole = holeAt(game)
  const r = game.random.critters
  pickup.fishOut(hole.x + (r() - 0.5) * 120, hole.y + 46 + r() * 40)
  game.stats.fished++
  sound(game, 'pop', 0.8, 1.3)
  if (pickup.zone.drain === 0) {
    caption(game, 'All fished out.', 'good', 'Now get them in the pot.', 2600)
    sound(game, 'ding', 0.6)
    drain.doneMs = 1200
    return
  }
  caption(
    game,
    line(game, 'fished'),
    'good',
    `${pickup.zone.drain} to go.`,
    1600
  )
}

/**
 * One Pickup step at a street grate: beans resting or crawling over it fall through,
 * with a drip, a sink, and a caption that names the rule the first time.
 */
export function updateGrate(game: Game): void {
  const world = game.pickup.world
  if (!world?.grate) return
  const fell = world.swallowSlow(DRAIN_SLOW_SPEED)
  if (fell === 0) return
  game.pickup.streak = 0
  sound(game, 'drip', 0.8, 0.7 + game.random.fx() * 0.3)
  if (!game.taught.grate) {
    game.taught.grate = true
    caption(
      game,
      'Slow beans fall through the grate.',
      'bad',
      'Keep them moving over it.',
      3600
    )
    return
  }
  if (!showing(game, 'drain'))
    caption(game, line(game, 'drain'), 'bad', '', 1400, { key: 'drain' })
}
