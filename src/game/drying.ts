import { clamp, isDone, now, startTimer } from '../shared'
import { caption, sound } from './effects'
import { move } from './ledger'
import type { Span, StretchDef } from './route'
import type { Game } from './state'
import {
  DRAIN_ZONE_REACH,
  DRY_MS,
  PUDDLE_MIN_RX,
  PUDDLE_RY,
  PUDDLE_TOP_Y,
  RACK_H,
  RACK_W,
  RACK_X,
  RACK_Y,
  SCATTER_LEFT,
  SCATTER_RIGHT,
  ZONE_SPREAD
} from './tuning'
import { puddleFromPot, type Zone } from './zones'

/** An axis-aligned ellipse in the top-down view, in u. */
export interface Ellipse {
  x: number
  y: number
  rx: number
  ry: number
}

/** Where puddle `span` sits in the top-down view of a zone anchored at route x `anchorX`. */
export function puddleSpot(anchorX: number, span: Span): Ellipse {
  const rx = Math.max(PUDDLE_MIN_RX, ((span.to - span.from) / 2) * ZONE_SPREAD)
  return {
    x: clamp(
      300 + ((span.from + span.to) / 2 - anchorX) * ZONE_SPREAD,
      SCATTER_LEFT + rx,
      SCATTER_RIGHT - rx
    ),
    y: PUDDLE_TOP_Y,
    rx,
    ry: PUDDLE_RY
  }
}

/** The puddles a zone's top-down view shows: route puddles near its anchor. */
export function puddleSpots(def: StretchDef, zone: Zone): Ellipse[] {
  const out: Ellipse[] = []
  for (const span of def.puddles) {
    const half = (span.to - span.from) / 2
    if (Math.abs(span.from + half - zone.anchorX) <= DRAIN_ZONE_REACH + half)
      out.push(puddleSpot(zone.anchorX, span))
  }
  return out
}

/**
 * One bean from the pot lands swollen in puddle `span` of `zone`, at a seeded spot inside
 * the puddle's top-down shape. Returns false when the zone has no room for it.
 */
export function puddleBean(game: Game, zone: Zone, span: Span): boolean {
  const spot = puddleSpot(zone.anchorX, span)
  const r = game.random.zones
  const a = r() * Math.PI * 2
  const d = Math.sqrt(r()) * 0.75
  return puddleFromPot(
    game.counts,
    zone,
    spot.x + Math.cos(a) * spot.rx * d,
    spot.y + Math.sin(a) * spot.ry * d,
    r() * Math.PI * 2
  )
}

/** True when (x, y) lies inside the ellipse, grown by `pad` u. */
export function inEllipse(e: Ellipse, x: number, y: number, pad = 0): boolean {
  const dx = (x - e.x) / (e.rx + pad)
  const dy = (y - e.y) / (e.ry + pad)
  return dx * dx + dy * dy <= 1
}

/** True when (x, y) is over the drying rack at the bottom left of Pickup. */
export function onRack(x: number, y: number): boolean {
  return (
    x >= RACK_X && x <= RACK_X + RACK_W && y >= RACK_Y && y <= RACK_Y + RACK_H
  )
}

/** `n` swollen beans went onto the rack on your back: each starts its own drying timer. */
export function startDrying(game: Game, n: number, at = now()): void {
  for (let i = 0; i < n; i++)
    game.drying.push(startTimer('Bean drying', DRY_MS, at))
  game.out.push({ type: 'scene' })
}

/**
 * Beans whose drying timer has run out drop into the pot with a pop, wherever you are.
 * Every timer runs the same length, so they finish in the order they started. Call every
 * step with the real clock. Returns how many dropped in.
 */
export function updateDrying(game: Game, at = now()): number {
  const timers = game.drying
  let n = 0
  while (n < timers.length && isDone(timers[n]!, at)) n++
  if (n === 0) return 0
  timers.splice(0, n)
  move(game.counts, 'drying', 'pot', n)
  sound(game, 'pop', 0.8, 1.2)
  sound(game, 'ding', 0.5, 1.4)
  caption(
    game,
    n === 1 ? 'A dry bean hopped back in.' : `${n} dry beans hopped back in.`,
    'good',
    '',
    2200
  )
  game.out.push({ type: 'potted', n }, { type: 'scene' })
  return n
}
