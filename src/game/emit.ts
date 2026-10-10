import { puddleBean } from './drying'
import { caption, showing, sound } from './effects'
import {
  flightTime,
  LAND_DRAIN,
  LAND_GROUND,
  LAND_MAT,
  LAND_PUDDLE,
  LAND_RIVER,
  POT_OFFSET_X,
  POT_RIM_Y,
  RIVER_ZONE
} from './fx'
import { gateOpen, gateX } from './gate'
import { line } from './lines'
import { loseBeans } from './packets'
import { drainAt, groundDrop, groundY, onSlope, puddleAt } from './route'
import { effectiveAngle } from './slosh'
import { causeFor, noteSpill } from './spill'
import { currentStretch, type Game } from './state'
import {
  BIG_SPILL,
  DRAIN_EVENT_CAP,
  MAX_SHAKE,
  PUDDLE_EVENT_CAP,
  RIM_HALF,
  RIVER_DROP,
  RIVER_EVENT_CAP,
  RIVER_SHARE,
  SLOW_MS
} from './tuning'
import { drainFromPot, landFromPot, zoneForLanding, type Zone } from './zones'

/**
 * A walk-view particle landed: its zone shows one more bean. A bean bound for a drain
 * plops through the grate instead, and one landing in a puddle splashes. Given the spot
 * at (`x`, `y`), water and drain landings leave a ripple there.
 */
export function landed(
  game: Game,
  zoneId: number,
  kind = LAND_GROUND,
  x = NaN,
  y = NaN
): void {
  if (kind !== LAND_GROUND && kind !== LAND_MAT && !Number.isNaN(x))
    game.fx.ripples.add(x, y, kind)
  if (kind === LAND_MAT) {
    sound(game, 'tick', 0.6, 0.7)
    caption(
      game,
      'One rolled under the doormat.',
      'info',
      "Grandma didn't see."
    )
    return
  }
  if (kind === LAND_RIVER) {
    sound(game, 'splash', 0.45, 1.1 + game.random.fx() * 0.4)
    if (!showing(game, 'river'))
      caption(
        game,
        line(game, 'river'),
        'bad',
        game.taught.river
          ? ''
          : "River beans are gone. They're seed packets now.",
        game.taught.river ? 1600 : 3200,
        { key: 'river' }
      )
    game.taught.river = true
    return
  }
  if (kind === LAND_PUDDLE) {
    sound(game, 'splash', 0.35, 1.3 + game.random.fx() * 0.3)
    if (!showing(game, 'puddle'))
      caption(
        game,
        line(game, 'puddle'),
        'bad',
        game.taught.puddle ? '' : 'Swollen beans dry on the rack.',
        game.taught.puddle ? 1800 : 3200,
        { key: 'puddle' }
      )
    game.taught.puddle = true
  }
  if (kind === LAND_DRAIN) {
    sound(game, 'drip', 0.6, 0.8 + game.random.fx() * 0.4)
    if (showing(game, 'drain')) return
    const taught = game.taught.drain
    game.taught.drain = true
    caption(
      game,
      line(game, 'drain'),
      'bad',
      taught ? '' : 'The coat hanger can fish it out.',
      taught ? 1800 : 3200,
      { key: 'drain' }
    )
    return
  }
  const zone = game.zones.list.find(z => z.id === zoneId)
  if (zone) zone.shown = Math.min(zone.count + zone.pile, zone.shown + 1)
}

/**
 * Where the rim on `side` sits in the walk view, for the pot at angle `psiEff`, with the
 * ground under your feet `drop` u below GROUND_Y.
 */
export function rimPoint(
  walkerX: number,
  psiEff: number,
  side: number,
  drop: number,
  out = { x: 0, y: 0 }
): { x: number; y: number } {
  out.x = walkerX + POT_OFFSET_X + Math.cos(psiEff) * side * RIM_HALF
  out.y = POT_RIM_Y + drop + Math.sin(psiEff) * side * RIM_HALF
  return out
}

/**
 * Keeps a landing where you can reach it: not before the stretch start, and not past a
 * shut gate, where beans bounce off the bars.
 */
export function clampLanding(game: Game, x: number): number {
  const def = currentStretch(game)
  const max = def.gate && !gateOpen(game) ? gateX(game) - 40 : def.length
  return Math.min(max, Math.max(0, x))
}

const rim = { x: 0, y: 0 }

/**
 * Throws one bean from the pot at (x, y) with velocity (vx, vy) onto the ground: the
 * ledger moves it at once, and a particle shows the flight. A bean landing on a drain
 * grate goes down it, and one landing in a puddle swells, up to DRAIN_EVENT_CAP and
 * PUDDLE_EVENT_CAP per spill event. Returns the zone it joins.
 */
export function throwBean(
  game: Game,
  x: number,
  y: number,
  vx: number,
  vy: number
): Zone {
  const def = currentStretch(game)
  const r = game.random.spill
  const scatter = (r() - 0.5) * 16
  // The ground can step down or up under the arc, so aim once, then land on it.
  let floor = groundY(def, x + Math.sign(vx) * 60) + scatter
  let landX = x + vx * flightTime(y, vy, floor)
  floor = groundY(def, landX) + scatter
  landX = clampLanding(game, x + vx * flightTime(y, vy, floor))
  const spin = (r() - 0.5) * 24
  const spill = game.spill
  if (def.slope && onSlope(def, landX)) {
    // It lands on the slope, then rolls all the way down to the foot of the hill.
    const restX = clampLanding(game, def.slope.from - 10 - r() * 60)
    const restY = groundY(def, restX) + scatter
    const zone = landFromPot(
      game.counts,
      game.zones,
      game.stretch,
      restX,
      1,
      game.random.zones
    )
    if (
      !game.fx.particles.spawn(
        x,
        y,
        vx,
        vy,
        spin,
        floor,
        zone.id,
        LAND_GROUND,
        restX,
        restY
      )
    )
      zone.shown = Math.min(zone.count + zone.pile, zone.shown + 1)
    if (spill.rolled++ === 0) rolledDown(game)
    return zone
  }
  if (drainAt(def, landX) !== null && spill.drained < DRAIN_EVENT_CAP) {
    spill.drained++
    const zone = zoneForLanding(game.zones, game.stretch, landX)
    drainFromPot(game.counts, zone, 1)
    if (
      !game.fx.particles.spawn(x, y, vx, vy, spin, floor, zone.id, LAND_DRAIN)
    )
      landed(game, zone.id, LAND_DRAIN)
    return zone
  }
  const puddle = puddleAt(def, landX)
  if (puddle && spill.puddled < PUDDLE_EVENT_CAP) {
    const zone = zoneForLanding(game.zones, game.stretch, landX)
    if (puddleBean(game, zone, puddle)) {
      spill.puddled++
      if (
        !game.fx.particles.spawn(
          x,
          y,
          vx,
          vy,
          spin,
          floor,
          zone.id,
          LAND_PUDDLE
        )
      )
        landed(game, zone.id, LAND_PUDDLE)
      return zone
    }
  }
  const zone = landFromPot(
    game.counts,
    game.zones,
    game.stretch,
    landX,
    1,
    game.random.zones
  )
  if (!game.fx.particles.spawn(x, y, vx, vy, spin, floor, zone.id))
    zone.shown = Math.min(zone.count + zone.pile, zone.shown + 1)
  return zone
}

/**
 * On the rope bridge some spilled beans miss the deck: RIVER_SHARE of them, at most
 * RIVER_EVENT_CAP per spill event, splash into the river and are lost for good. Returns
 * true when this bean went in.
 */
function intoRiver(
  game: Game,
  x: number,
  y: number,
  vx: number,
  vy: number
): boolean {
  const def = currentStretch(game)
  const spill = game.spill
  if (!def.deck || spill.rivered >= RIVER_EVENT_CAP) return false
  if (game.random.spill() >= RIVER_SHARE) return false
  spill.rivered++
  loseBeans(game, 'pot', 1, 'river')
  const water = groundY(def, x + vx * 0.4) + RIVER_DROP
  const spin = (game.random.spill() - 0.5) * 24
  if (
    !game.fx.particles.spawn(x, y, vx, vy, spin, water, RIVER_ZONE, LAND_RIVER)
  )
    landed(game, RIVER_ZONE, LAND_RIVER)
  return true
}

/** The first bean of a spill event rolled down the slope: the hill scores a point. */
function rolledDown(game: Game): void {
  const n = ++game.weather.gravity
  sound(game, 'whoosh', 0.4, 0.7)
  caption(
    game,
    `Gravity: ${n}. You: 0.`,
    'bad',
    n === 1 ? 'Beans spilled on the slope roll to the bottom.' : '',
    2800
  )
}

/**
 * Sends `n` beans over the rim on `side`: ledger first, then particles for the show.
 * `overflow` (u) sets how hard they fly. The spill event and its juice update too.
 */
export function emitBeans(
  game: Game,
  n: number,
  side: number,
  overflow: number
): void {
  const { walker, pot, fx } = game
  const r = game.random.spill
  const before = game.spill.count
  const note = noteSpill(game.spill, n, side, game.timeMs, () =>
    causeFor({
      now: game.timeMs,
      lastKick: game.lastKick,
      psi: pot.psi,
      side,
      v: walker.v,
      ax: walker.ax
    })
  )
  const def = currentStretch(game)
  rimPoint(walker.x, effectiveAngle(pot), side, groundDrop(def, walker.x), rim)
  const push = Math.min(40, Math.max(0, overflow))
  for (let i = 0; i < n; i++) {
    const vx = side * (50 + 3 * push) * (0.6 + 0.8 * r()) + walker.v
    const vy = -(60 + 5 * push) * (0.6 + 0.8 * r())
    if (!intoRiver(game, rim.x, rim.y, vx, vy))
      throwBean(game, rim.x, rim.y, vx, vy)
  }
  game.stats.spilled += n
  game.stretchSpilled += n
  fx.gaspMs = 900
  const count = game.spill.count
  if (note.started || Math.floor(before / 10) !== Math.floor(count / 10))
    sound(game, 'splat', 0.7, 0.9 + r() * 0.2)
  if (note.turnedBig) {
    sound(game, 'fail', 0.8)
    fx.slowMs = SLOW_MS
    game.out.push({ type: 'vibrate', ms: 40 })
  }
  if (count >= BIG_SPILL)
    fx.shake = Math.max(fx.shake, Math.min(MAX_SHAKE, count / 10))
}
