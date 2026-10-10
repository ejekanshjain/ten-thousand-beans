import { kickPot } from './slosh'
import { sound } from './effects'
import {
  BUMP_KICKS,
  bumpsCrossed,
  COBBLES,
  inSpans,
  type Bump,
  type BumpKind
} from './route'
import { currentStretch, type Game } from './state'
import { BIG_KICK, HURRY_CAUSE, KICK_REF_SPEED, MAX_SHAKE } from './tuning'
import { lidRattle } from './upgrades'

/** Cause ids for terrain kicks, so spill captions can blame them. */
export type TerrainCause = BumpKind | 'cobbles'

/** How hard a terrain kick hits at speed `v` (u/s): `base` at a stroll, scaled by speed squared. */
export function terrainKick(base: number, v: number): number {
  return base * (v / KICK_REF_SPEED) ** 2
}

/** The way cobbles throw the beans on footstep `stepPhase`: back on even steps, forward on odd. */
export function cobbleSide(stepPhase: number): number {
  return Math.floor(stepPhase) % 2 === 0 ? -1 : 1
}

const crossed: Bump[] = []

/**
 * Applies the ground under your feet after walking from `x0` to the walker's x: a kick
 * for each bump crossed, and a cobble kick on each footstep over cobbles. `stepped` is
 * true when a foot landed this step.
 */
export function stepTerrain(game: Game, x0: number, stepped: boolean): void {
  const def = currentStretch(game)
  const walker = game.walker
  const speed = Math.abs(walker.v)
  const dir = Math.sign(walker.x - x0)
  for (const bump of bumpsCrossed(def, x0, walker.x, crossed)) {
    const rule = BUMP_KICKS[bump.kind]
    // Walking back reverses which way the beans surge.
    groundKick(
      game,
      bump.kind,
      rule.side * (dir || 1),
      terrainKick(rule.kick, speed)
    )
  }
  if (stepped && speed > 0 && inSpans(def.cobbles, walker.x))
    groundKick(
      game,
      'cobbles',
      cobbleSide(walker.stepPhase),
      terrainKick(COBBLES.kick, speed)
    )
}

/** How long a ground kick buzzes the phone, in ms. */
export function kickBuzzMs(cause: TerrainCause, strength: number): number {
  if (cause === 'cobbles') return 8
  return strength >= BIG_KICK ? 30 : 15
}

/**
 * Kicks the bean surface so beans surge toward `side` (1 forward, -1 back), with the
 * sound, shake and side arrow for its size. Hurried kicks get their own caption cause.
 */
export function groundKick(
  game: Game,
  cause: TerrainCause,
  side: number,
  strength: number
): void {
  if (strength <= 0) return
  const hurried = Math.abs(game.walker.v) > HURRY_CAUSE
  // A negative surface velocity heaps beans toward the front rim.
  kickPot(game.pot, -side * strength, 0)
  game.lastKick = { cause: hurried ? `${cause}-hurry` : cause, at: game.timeMs }
  const fx = game.fx
  fx.kick.side = side
  fx.kick.strength = strength
  fx.kick.ms = cause === 'cobbles' ? 450 : 800
  if (cause === 'cobbles') {
    sound(game, 'tick', Math.min(0.6, 0.2 + strength * 0.3), 0.6)
  } else {
    sound(game, 'thud', Math.min(1, 0.35 + strength / 3), 0.75)
  }
  // Phones that can buzz feel every bump: a tick per cobble, longer for bigger kicks.
  game.out.push({ type: 'vibrate', ms: kickBuzzMs(cause, strength) })
  if (cause !== 'cobbles')
    fx.shake = Math.max(fx.shake, Math.min(MAX_SHAKE / 2, strength * 2))
  if (strength >= BIG_KICK) fx.squash = 0.88
  else fx.squash = Math.min(fx.squash, 0.95)
  lidRattle(game, strength, side)
}
