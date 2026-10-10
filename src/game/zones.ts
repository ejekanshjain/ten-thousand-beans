import { clamp, type Rng } from '../shared'
import { move, type Counts } from './ledger'
import {
  SCATTER_BOTTOM,
  SCATTER_LEFT,
  SCATTER_RIGHT,
  SCATTER_TOP,
  ZONE_MAX_LOOSE,
  ZONE_MERGE,
  ZONE_SPREAD
} from './tuning'

/** Floats stored per bean in a zone record: x, y, angle, kind. */
export const BEAN_FIELDS = 4
export const KIND_LOOSE = 0
/** A swollen bean that landed in a puddle or soaked in one. It must dry before the pot takes it. */
export const KIND_PUDDLE = 1
/** A bean spelling gossip that hasn't been jotted down yet. */
export const KIND_GOSSIP = 2

/**
 * A patch of ground holding spilled beans. Positions are top-down Pickup coordinates.
 * Every change goes through the functions below, which keep the ledger in step.
 */
export interface Zone {
  id: number
  stretch: number
  /** Route x of the zone's centre in the walk view. */
  anchorX: number
  /** x, y, angle, kind per bean, up to ZONE_MAX_LOOSE beans. */
  beans: Float32Array
  /** Beans with positions, swollen ones included. Includes beans held in the tweezers during Pickup. */
  count: number
  /** Swollen beans among `count`, which the ledger keeps in `puddle`. */
  puddle: number
  /** Overflow beans in a heap, cleared with scoops. */
  pile: number
  /** Beans down a drain here. */
  drain: number
  /** Beans whose walk-view particle has landed, so the walk view shows them. */
  shown: number
}

export function createZone(id: number, stretch: number, anchorX: number): Zone {
  return {
    id,
    stretch,
    anchorX,
    beans: new Float32Array(ZONE_MAX_LOOSE * BEAN_FIELDS),
    count: 0,
    puddle: 0,
    pile: 0,
    drain: 0,
    shown: 0
  }
}

/** The zone in `stretch` whose anchor is nearest `x` and within `reach`, or null. */
export function nearestZone(
  zones: readonly Zone[],
  stretch: number,
  x: number,
  reach: number
): Zone | null {
  let best: Zone | null = null
  let bestDistance = reach
  for (const zone of zones) {
    if (zone.stretch !== stretch) continue
    const distance = Math.abs(zone.anchorX - x)
    if (distance <= bestDistance) {
      best = zone
      bestDistance = distance
    }
  }
  return best
}

/** Holds the zone list and hands out ids. */
export interface ZoneSet {
  list: Zone[]
  nextId: number
}

export function createZoneSet(): ZoneSet {
  return { list: [], nextId: 1 }
}

/** The zone a bean landing at `x` joins: an existing one within ZONE_MERGE, or a new one. */
export function zoneForLanding(set: ZoneSet, stretch: number, x: number): Zone {
  const near = nearestZone(set.list, stretch, x, ZONE_MERGE)
  if (near) return near
  const zone = createZone(set.nextId++, stretch, x)
  set.list.push(zone)
  return zone
}

/**
 * Where a bean landing at route x sits in the top-down view of its zone. Beans bunch
 * around the middle of the band, so big spills leave clusters worth scooping.
 */
export function scatterPoint(
  zone: Zone,
  landX: number,
  random: Rng,
  out: { x: number; y: number; angle: number }
): void {
  const spread = (landX - zone.anchorX) * ZONE_SPREAD
  out.x = clamp(
    300 + spread + (random() + random() - 1) * 50,
    SCATTER_LEFT,
    SCATTER_RIGHT
  )
  const middle = (SCATTER_TOP + SCATTER_BOTTOM) / 2
  const half = (SCATTER_BOTTOM - SCATTER_TOP) / 2
  out.y = middle + (random() + random() - 1) * half
  out.angle = random() * Math.PI * 2
}

const scratch = { x: 0, y: 0, angle: 0 }

/**
 * Moves `n` beans from the pot onto the ground at route x `landX`. Beans fill the zone's
 * positions up to ZONE_MAX_LOOSE and the rest go to its pile. Returns the zone.
 */
export function landFromPot(
  counts: Counts,
  set: ZoneSet,
  stretch: number,
  landX: number,
  n: number,
  random: Rng
): Zone {
  const zone = zoneForLanding(set, stretch, landX)
  const room = Math.min(n, ZONE_MAX_LOOSE - zone.count)
  for (let i = 0; i < room; i++) {
    scatterPoint(zone, landX, random, scratch)
    writeBean(zone, zone.count, scratch.x, scratch.y, scratch.angle, KIND_LOOSE)
    zone.count++
  }
  if (room > 0) move(counts, 'pot', 'loose', room)
  if (n > room) {
    move(counts, 'pot', 'pile', n - room)
    zone.pile += n - room
  }
  return zone
}

/**
 * Moves one bean from the pot into a puddle in `zone`, swollen, at top-down (x, y).
 * Returns false when the zone already holds ZONE_MAX_LOOSE positioned beans.
 */
export function puddleFromPot(
  counts: Counts,
  zone: Zone,
  x: number,
  y: number,
  angle: number
): boolean {
  if (zone.count >= ZONE_MAX_LOOSE) return false
  writeBean(zone, zone.count, x, y, angle, KIND_PUDDLE)
  zone.count++
  zone.puddle++
  move(counts, 'pot', 'puddle', 1)
  return true
}

/** Moves `n` pile beans straight into a zone's pile from the pot, for tip-overs. */
export function pileFromPot(counts: Counts, zone: Zone, n: number): void {
  move(counts, 'pot', 'pile', n)
  zone.pile += n
}

/** Moves `n` beans from the pot straight down a drain in `zone`, for dev spills and drain landings. */
export function drainFromPot(counts: Counts, zone: Zone, n: number): void {
  move(counts, 'pot', 'drain', n)
  zone.drain += n
}

/** Writes one bean's record at `index`. */
export function writeBean(
  zone: Zone,
  index: number,
  x: number,
  y: number,
  angle: number,
  kind: number
): void {
  const o = index * BEAN_FIELDS
  zone.beans[o] = x
  zone.beans[o + 1] = y
  zone.beans[o + 2] = angle
  zone.beans[o + 3] = kind
}

/** Beans still on the ground in this stretch: loose, pile and drain. */
export function behind(zones: readonly Zone[], stretch: number): number {
  let sum = 0
  for (const zone of zones)
    if (zone.stretch === stretch) sum += zone.count + zone.pile + zone.drain
  return sum
}

/** True once a zone holds nothing at all. */
export function isEmpty(zone: Zone): boolean {
  return zone.count === 0 && zone.pile === 0 && zone.drain === 0
}

/** Drops empty zones from the set. */
export function pruneZones(set: ZoneSet): void {
  set.list = set.list.filter(zone => !isEmpty(zone))
}

/** Returns a problem description when zone totals disagree with the ledger, or null. */
export function checkZones(
  counts: Counts,
  zones: readonly Zone[]
): string | null {
  let loose = 0
  let puddle = 0
  let pile = 0
  let drain = 0
  for (const zone of zones) {
    loose += zone.count - zone.puddle
    puddle += zone.puddle
    pile += zone.pile
    drain += zone.drain
    if (zone.shown > zone.count + zone.pile)
      return `zone ${zone.id} shows ${zone.shown} beans but holds ${zone.count + zone.pile}`
  }
  if (loose !== counts.loose)
    return `zones hold ${loose} loose beans but the ledger says ${counts.loose}`
  if (puddle !== counts.puddle)
    return `zones hold ${puddle} swollen beans but the ledger says ${counts.puddle}`
  if (pile !== counts.pile)
    return `zones hold ${pile} pile beans but the ledger says ${counts.pile}`
  if (drain !== counts.drain)
    return `zones hold ${drain} drain beans but the ledger says ${counts.drain}`
  return null
}
