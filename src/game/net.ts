import { CircleGesture } from '../shared'
import { caption, sound } from './effects'
import { GROUND_POT_SHIFT, POT_OFFSET_X, potDepth } from './fx'
import { groundY } from './route'
import { currentStretch, type Game } from './state'
import {
  NET_KNOT_CIRCLES,
  NET_KNOT_MAX,
  NET_KNOT_REACH,
  NET_KNOTS,
  POT_X,
  POT_Y
} from './tuning'
import { owns } from './upgrades'

/**
 * The Pigeon Net on a pot that sits on the ground: packed away (or not owned), laid
 * neatly over it, tied in knots by the first pigeon, or untangled and keeping pigeons
 * out of the pot.
 */
export type NetPhase = 'off' | 'laid' | 'tangled' | 'ready'

export interface Knot {
  /** The way to circle it: 1 clockwise on screen, -1 anticlockwise. */
  dir: 1 | -1
  /** Circles left before it comes undone. 0 once undone. */
  left: number
  /** What happened to it last, for a flash, and ms since. */
  flash: 'none' | 'turn' | 'tight' | 'undone'
  flashMs: number
}

export interface NetState {
  phase: NetPhase
  knots: Knot[]
  /** The knot under the press in progress, or -1. */
  active: number
  /** Counts circles around the active knot while pressed. */
  circle: CircleGesture | null
  /** Set when the net pulls tight, so the flock flings perched pigeons off. */
  snapped: boolean
  /** True once a pigeon pecked the untangled net and the caption explained it. */
  told: boolean
}

/** Where each knot sits: from above, offsets from the pot's centre in u. */
const TOP_KNOTS = [
  [-30, -18],
  [30, -18],
  [0, 28]
] as const
/** Side-on, x offsets from the rim's centre in u and depths as a share of the pot's depth. */
const SIDE_KNOTS = [
  [-42, 0.3],
  [42, 0.3],
  [0, 0.78]
] as const

export function createNet(): NetState {
  return {
    phase: 'off',
    knots: [],
    active: -1,
    circle: null,
    snapped: false,
    told: false
  }
}

/** The pot went down: the net is laid over it neatly, if you own one. */
export function layNet(game: Game): void {
  const net = game.net
  net.phase = owns(game, 'net') ? 'laid' : 'off'
  net.knots = []
  net.active = -1
  net.circle = null
  net.snapped = false
}

/**
 * The first pigeon of a set-down arrives and ties the laid net into NET_KNOTS knots,
 * each with its own direction. Returns true when it tangled.
 */
export function tangleNet(game: Game): boolean {
  const net = game.net
  if (net.phase !== 'laid') return false
  const r = game.random.net
  const first: 1 | -1 = r() < 0.5 ? 1 : -1
  net.phase = 'tangled'
  net.knots = Array.from({ length: NET_KNOTS }, (_, i) => ({
    // Neighbours turn opposite ways, so you have to read every arrow.
    dir: i === 1 ? (-first as 1 | -1) : i === 0 ? first : r() < 0.5 ? 1 : -1,
    left: NET_KNOT_CIRCLES,
    flash: 'none' as const,
    flashMs: 0
  }))
  sound(game, 'creak', 0.6, 1.2)
  caption(
    game,
    "The net's in knots.",
    'bad',
    'Circle each knot the way its arrow points.',
    3400
  )
  return true
}

/** True while the untangled net keeps pigeons out of the pot. */
export function netGuards(game: Game): boolean {
  return game.net.phase === 'ready' && game.flock.view !== null
}

/** Knots still tied. */
export function knotsLeft(net: NetState): number {
  let n = 0
  for (const knot of net.knots) if (knot.left > 0) n++
  return n
}

/**
 * Where knot `i` sits: in Pickup's top-down coordinates, or in world coordinates of the
 * walk view with the pot on the ground. Writes into `out` and returns it.
 */
export function knotSpot(
  game: Game,
  i: number,
  out: { x: number; y: number }
): { x: number; y: number } {
  if (game.flock.view === 'pickup') {
    const [dx, dy] = TOP_KNOTS[i % TOP_KNOTS.length]!
    out.x = POT_X + dx
    out.y = POT_Y + dy
    return out
  }
  const [dx, share] = SIDE_KNOTS[i % SIDE_KNOTS.length]!
  const pot = game.walker.x + POT_OFFSET_X + GROUND_POT_SHIFT
  const depth = potDepth(game.options.tall)
  const rim = groundY(currentStretch(game), pot) - depth - 2
  out.x = pot + dx
  out.y = rim + share * depth
  return out
}

const spot = { x: 0, y: 0 }

/**
 * A press at (x, y) in the current view's coordinates, with the event's time stamp. On a
 * tied knot it starts circling it. Returns true when it did, so the press does nothing else.
 */
export function netPress(game: Game, x: number, y: number, t: number): boolean {
  const net = game.net
  if (net.phase !== 'tangled' || !game.flock.view) return false
  let best = -1
  let bestD = NET_KNOT_REACH
  for (let i = 0; i < net.knots.length; i++) {
    if (net.knots[i]!.left === 0) continue
    knotSpot(game, i, spot)
    const d = Math.hypot(x - spot.x, y - spot.y)
    if (d <= bestD) {
      best = i
      bestD = d
    }
  }
  if (best < 0) return false
  knotSpot(game, best, spot)
  net.active = best
  net.circle = new CircleGesture({
    center: { x: spot.x, y: spot.y },
    onCircle: c => circled(game, c.direction)
  })
  net.circle.add(x, y, t)
  return true
}

/** The pointer moves while circling a knot. */
export function netDrag(game: Game, x: number, y: number, t: number): void {
  game.net.circle?.add(x, y, t)
}

/** The pointer lifts, or a second finger turns the press into a pinch. */
export function netRelease(game: Game): void {
  const net = game.net
  net.circle?.end()
  net.circle = null
  net.active = -1
}

/** A full circle round the active knot: the right way loosens it, the wrong way tightens it. */
function circled(game: Game, direction: 1 | -1): void {
  const net = game.net
  const knot = net.knots[net.active]
  if (!knot || knot.left === 0 || net.phase !== 'tangled') return
  knot.flashMs = 0
  if (direction !== knot.dir) {
    knot.left = Math.min(NET_KNOT_MAX, knot.left + 1)
    knot.flash = 'tight'
    sound(game, 'creak', 0.7, 0.9)
    caption(game, 'Wrong way. Tighter now.', 'bad', 'Follow the arrow.', 1600)
    return
  }
  knot.left--
  if (knot.left > 0) {
    knot.flash = 'turn'
    sound(game, 'scrub', 0.4, 1.3)
    return
  }
  knot.flash = 'undone'
  net.active = -1
  net.circle = null
  sound(game, 'pop', 0.7, 1.2)
  const left = knotsLeft(net)
  if (left > 0) {
    caption(game, 'Knot undone.', 'good', `${left} to go.`, 1400)
    return
  }
  net.phase = 'ready'
  net.snapped = true
  sound(game, 'boing', 0.6, 0.8)
  sound(game, 'ding', 0.5, 1.3)
  caption(game, "Net's on.", 'good', 'No more pot beans for the birds.', 2400)
}

/** One step: knot flashes fade. */
export function updateNet(game: Game, simMs: number): void {
  for (const knot of game.net.knots) knot.flashMs += simMs
}

/** The next-step hint while the net is tied in knots, or null. */
export function netPrompt(game: Game): string | null {
  if (game.net.phase !== 'tangled' || !game.flock.view) return null
  return 'Untangle the net: circle each knot the way its arrow points.'
}
