import type { AmbushKind } from './ambush'
import { GROUND_Y } from './fx'
import {
  COBBLE_KICK,
  DRAIN_HALF,
  KERB_DROP,
  KERB_KICK,
  KERB_WIDTH,
  POTHOLE_KICK,
  RUG_KICK,
  SLOPE_DEGREES,
  STAIR_APPROACH,
  STAIR_KICK,
  STAIR_RISE,
  STAIR_TREAD
} from './tuning'

export type StretchId =
  'kitchen' | 'street' | 'market' | 'park' | 'hill' | 'bridge' | 'door' | 'test'

/** What comes for the pot on the ground: pigeons, or the market's gulls. Same rules. */
export type BirdKind = 'pigeon' | 'gull'

/** One-off ground hazards you cross at a point. Cobbles are spans, not bumps. */
export type BumpKind = 'pothole' | 'kerb' | 'rug' | 'stair'

/** A ground hazard at route x. */
export interface Bump {
  kind: BumpKind
  x: number
}

/** A stretch of route from `from` to `to`, in u. */
export interface Span {
  from: number
  to: number
}

/** A range of times, from `min` to `max` ms. */
export interface Range {
  min: number
  max: number
}

/** A flight of stairs: `count` stairs from `from`, each `rise` u lower (negative climbs). */
export interface Stairs {
  from: number
  count: number
  rise: number
}

/** One stretch of the route. Positions are u from the stretch start. */
export interface StretchDef {
  id: StretchId
  /** Title Case name for headings and the title card. */
  name: string
  length: number
  /** False on the last stretch, which ends at Grandma's door instead of a gate. */
  gate: boolean
  /** Point hazards, sorted by x. */
  bumps: readonly Bump[]
  cobbles: readonly Span[]
  /** Where speed is capped at a stroll. */
  slow: readonly Span[]
  /** The ground's drop below GROUND_Y, as flat [x, drop] pairs sorted by x. Negative is higher. */
  profile: readonly number[]
  /** The lowest and highest drop anywhere on the stretch, for sizing backdrops. */
  minDrop: number
  maxDrop: number
  /** Gossip lines this stretch can start. Unused slots carry forward. */
  gossipSlots: number
  /** Route x of each drain grate's centre, sorted. */
  drains: readonly number[]
  /** Route x of each nosy neighbour's front door. The look follows the order. */
  neighbours: readonly number[]
  /** Route x where each cyclist starts coming up behind you. */
  cyclists: readonly number[]
  /** Puddles on the walking line, sorted. Beans landing in one swell. */
  puddles: readonly Span[]
  /** Route x of each market stall whose stallholder pokes a tasting spoon. */
  stalls: readonly number[]
  /** Route x of the man turning round with a ladder, or null. */
  ladder: number | null
  /** Where shoppers come at you through the crowd, or null. */
  crowd: Span | null
  /** While the pot sits on the ground, a pigeon walks in every this many ms, or null for none. */
  pigeonEveryMs: number | null
  /** What walks in on that rhythm: pigeons, or gulls at the market. */
  bird: BirdKind
  /** The park kid's kicks: where the kid stands, and where the ball crosses the path. */
  kicks: readonly Kick[]
  /** Route x where each off-lead dog lies on the grass until you pass it. */
  dogs: readonly number[]
  /** Wet grass on the walking line, sorted. Hurrying onto it starts a "whoa" wobble. */
  wet: readonly Span[]
  /** The uphill slope, where you walk slower and spilled beans roll to its foot, or null. */
  slope: Span | null
  /** True when rain fills the pot while you carry it. */
  rain: boolean
  /** Time between wind gusts while you carry the pot, or null for no wind. */
  gusts: Range | null
  /** True on the rope bridge: the deck rolls, and spills can fall in the river. */
  deck: boolean
  /** The stretch's hard encounter and the route x it comes from, or null. */
  ambush: { kind: AmbushKind; at: number } | null
}

/** One kick of the park kid's football across the path. */
export interface Kick {
  /** Route x where the kid stands. */
  kid: number
  /** Route x where the ball crosses the walking line. */
  cross: number
}

/** How each bump kicks: rad/s at a stroll, and the way beans surge when walking forward. */
export const BUMP_KICKS: Record<BumpKind, { kick: number; side: number }> = {
  pothole: { kick: POTHOLE_KICK, side: 1 },
  kerb: { kick: KERB_KICK, side: -1 },
  rug: { kick: RUG_KICK, side: 1 },
  stair: { kick: STAIR_KICK, side: 1 }
}

/** Cobbles kick on every footstep at this rate, alternating sides. */
export const COBBLES = { kick: COBBLE_KICK }

/** Width of a riser or kerb edge in the ground profile, in u. */
const EDGE = 6

interface StretchSpec {
  id: StretchId
  name: string
  length: number
  gate?: boolean
  potholes?: number[]
  /** Side-road crossings: the ground dips at x and the far kerb at x + KERB_WIDTH kicks. */
  kerbs?: number[]
  rug?: number
  cobbles?: [number, number][]
  stairs?: Stairs
  gossipSlots: number
  drains?: number[]
  neighbours?: number[]
  cyclists?: number[]
  puddles?: [number, number][]
  stalls?: number[]
  ladder?: number
  crowd?: [number, number]
  /** Ms between pigeons while the pot sits on the ground. */
  pigeonsEvery?: number
  /** Gulls instead of pigeons. */
  bird?: BirdKind
  /** [kid x, crossing x] per kick of the football. */
  kicks?: [number, number][]
  dogs?: number[]
  wet?: [number, number][]
  /** An uphill slope at SLOPE_DEGREES from the first x to the second. */
  slope?: [number, number]
  rain?: boolean
  /** [min, max] ms between gusts. */
  gusts?: [number, number]
  deck?: boolean
  ambush?: [AmbushKind, number]
}

/** Builds a stretch's bumps and ground profile from its hazard list. */
export function defineStretch(spec: StretchSpec): StretchDef {
  const bumps: Bump[] = []
  const slow: Span[] = []
  // Height changes: from x - width / 2 to x + width / 2 the ground drops by dy.
  const changes: { x: number; dy: number; width: number }[] = []
  for (const x of spec.potholes ?? []) bumps.push({ kind: 'pothole', x })
  for (const x of spec.kerbs ?? []) {
    changes.push(
      { x, dy: KERB_DROP, width: EDGE },
      { x: x + KERB_WIDTH, dy: -KERB_DROP, width: EDGE }
    )
    bumps.push({ kind: 'kerb', x: x + KERB_WIDTH })
  }
  if (spec.rug !== undefined) bumps.push({ kind: 'rug', x: spec.rug })
  const stairs = spec.stairs
  if (stairs) {
    for (let i = 0; i < stairs.count; i++) {
      const x = stairs.from + (i + 0.5) * STAIR_TREAD
      changes.push({ x, dy: stairs.rise, width: EDGE })
      bumps.push({ kind: 'stair', x })
    }
    slow.push({
      from: stairs.from - STAIR_APPROACH,
      to: stairs.from + stairs.count * STAIR_TREAD
    })
  }
  const slope = spec.slope
  if (slope) {
    const [from, to] = slope
    changes.push({
      x: (from + to) / 2,
      dy: -(to - from) * Math.tan((SLOPE_DEGREES * Math.PI) / 180),
      width: to - from
    })
  }
  bumps.sort((a, b) => a.x - b.x)
  changes.sort((a, b) => a.x - b.x)
  const profile: number[] = [0, 0]
  let drop = 0
  let minDrop = 0
  let maxDrop = 0
  for (const change of changes) {
    profile.push(change.x - change.width / 2, drop)
    drop += change.dy
    profile.push(change.x + change.width / 2, drop)
    minDrop = Math.min(minDrop, drop)
    maxDrop = Math.max(maxDrop, drop)
  }
  profile.push(spec.length, drop)
  return {
    id: spec.id,
    name: spec.name,
    length: spec.length,
    gate: spec.gate ?? true,
    bumps,
    cobbles: (spec.cobbles ?? []).map(([from, to]) => ({ from, to })),
    slow,
    profile,
    minDrop,
    maxDrop,
    gossipSlots: spec.gossipSlots,
    drains: [...(spec.drains ?? [])].sort((a, b) => a - b),
    neighbours: spec.neighbours ?? [],
    cyclists: spec.cyclists ?? [],
    puddles: (spec.puddles ?? [])
      .map(([from, to]) => ({ from, to }))
      .sort((a, b) => a.from - b.from),
    stalls: spec.stalls ?? [],
    ladder: spec.ladder ?? null,
    crowd: spec.crowd ? { from: spec.crowd[0], to: spec.crowd[1] } : null,
    pigeonEveryMs: spec.pigeonsEvery ?? null,
    bird: spec.bird ?? 'pigeon',
    kicks: (spec.kicks ?? []).map(([kid, cross]) => ({ kid, cross })),
    dogs: spec.dogs ?? [],
    wet: (spec.wet ?? [])
      .map(([from, to]) => ({ from, to }))
      .sort((a, b) => a.from - b.from),
    slope: slope ? { from: slope[0], to: slope[1] } : null,
    rain: spec.rain ?? false,
    gusts: spec.gusts ? { min: spec.gusts[0], max: spec.gusts[1] } : null,
    deck: spec.deck ?? false,
    ambush: spec.ambush ? { kind: spec.ambush[0], at: spec.ambush[1] } : null
  }
}

/**
 * The seven stretches from your kitchen to Grandma's door. Every hazard sits before the
 * point where a shut gate stops you (length - 350 u), so you always cross it before the
 * gate checks for beans behind you. Neighbour doors sit at x = 200 k + 149, where the
 * street's terraced houses paint their front doors, and stalls at 260 k + 110, where the
 * market paints them. Lead Decisions doubled the street's, market's and park's
 * characters, gave each one an ambush, and made the stretches longer (PLAN.md section 5).
 */
export const ROUTE: readonly StretchDef[] = [
  defineStretch({
    id: 'kitchen',
    name: 'Your Kitchen',
    length: 1_500,
    rug: 750,
    gossipSlots: 1
  }),
  defineStretch({
    id: 'street',
    name: 'The Street',
    length: 7_800,
    potholes: [900, 1_900, 4_300, 6_000],
    kerbs: [1_350, 3_700, 5_450],
    cobbles: [[2_400, 3_200]],
    stairs: { from: 6_950, count: 5, rise: STAIR_RISE },
    drains: [2_700, 4_500, 6_200],
    neighbours: [749, 1_549, 2_349, 3_549, 4_949, 5_749],
    cyclists: [1_950, 3_950, 5_200, 6_700],
    ambush: ['pryce', 6_549],
    // One pigeon now and then, so the pot on the ground needs guarding from the start.
    pigeonsEvery: 30_000,
    gossipSlots: 2
  }),
  defineStretch({
    id: 'market',
    name: 'The Market',
    length: 7_800,
    cobbles: [[300, 7_100]],
    kerbs: [4_600, 7_000],
    drains: [2_200, 5_700],
    puddles: [
      [1_300, 1_390],
      [2_850, 2_950],
      [4_050, 4_130],
      [6_200, 6_280]
    ],
    stalls: [890, 1_150, 1_930, 2_450, 3_230, 4_270, 5_050, 5_830],
    ladder: 3_600,
    crowd: [500, 7_000],
    ambush: ['sale', 6_610],
    pigeonsEvery: 30_000,
    bird: 'gull',
    gossipSlots: 2
  }),
  defineStretch({
    id: 'park',
    name: 'The Park',
    length: 8_400,
    potholes: [2_600, 5_300, 7_350],
    puddles: [
      [3_350, 3_440],
      [6_200, 6_280]
    ],
    // The kid kicks toward you from ahead on odd kicks and from behind on even ones.
    kicks: [
      [1_800, 1_600],
      [4_000, 4_200],
      [6_100, 5_900],
      [7_450, 7_650]
    ],
    dogs: [2_150, 4_950, 6_400, 7_850],
    wet: [
      [1_150, 1_230],
      [2_950, 3_050],
      [4_650, 4_750],
      [6_700, 6_780]
    ],
    cyclists: [5_500],
    ambush: ['bruno', 7_000],
    pigeonsEvery: 15_000,
    gossipSlots: 3
  }),
  defineStretch({
    id: 'hill',
    name: 'The Hill',
    length: 6_000,
    slope: [1_000, 2_800],
    potholes: [3_300, 4_300, 5_200],
    rain: true,
    // M26 shortened the gaps from 9 to 14s to reach the hill's spill budget.
    gusts: [8_000, 12_000],
    pigeonsEvery: 40_000,
    gossipSlots: 2
  }),
  defineStretch({
    id: 'bridge',
    name: 'The Rope Bridge',
    length: 4_000,
    deck: true,
    // M26 shortened the gaps from 7 to 12s to reach the bridge's spill budget.
    gusts: [6_000, 10_000],
    pigeonsEvery: 25_000,
    gossipSlots: 2
  }),
  defineStretch({
    id: 'door',
    name: "Grandma's Door",
    length: 800,
    gate: false,
    stairs: { from: 520, count: 4, rise: -STAIR_RISE },
    gossipSlots: 0
  })
]

/** A flat 4,000 u street with no hazards, for unit tests of walking and spilling. */
export const TEST_ROUTE: readonly StretchDef[] = [
  defineStretch({
    id: 'test',
    name: 'Test Street',
    length: 4_000,
    gossipSlots: 0
  })
]

/** The ground's drop below GROUND_Y at route x, in u. */
export function groundDrop(def: StretchDef, x: number): number {
  const p = def.profile
  if (x <= (p[0] as number)) return p[1] as number
  for (let i = 2; i < p.length; i += 2) {
    const x1 = p[i] as number
    if (x > x1) continue
    const x0 = p[i - 2] as number
    const d0 = p[i - 1] as number
    const d1 = p[i + 1] as number
    return x1 === x0 ? d1 : d0 + ((d1 - d0) * (x - x0)) / (x1 - x0)
  }
  return p[p.length - 1] as number
}

/**
 * The lowest and highest ground drop between route x `from` and `to`, written into `out`
 * as [min, max]. The profile is straight between its points, so only the ends and the
 * points inside count.
 */
export function dropSpan(
  def: StretchDef,
  from: number,
  to: number,
  out: [number, number] = [0, 0]
): [number, number] {
  let min = Math.min(groundDrop(def, from), groundDrop(def, to))
  let max = Math.max(groundDrop(def, from), groundDrop(def, to))
  const p = def.profile
  for (let i = 0; i < p.length; i += 2) {
    const x = p[i] as number
    if (x <= from || x >= to) continue
    min = Math.min(min, p[i + 1] as number)
    max = Math.max(max, p[i + 1] as number)
  }
  out[0] = min
  out[1] = max
  return out
}

/** The ground's height in the walk view at route x. */
export function groundY(def: StretchDef, x: number): number {
  return GROUND_Y + groundDrop(def, x)
}

/** True when x is inside any of the spans. */
export function inSpans(spans: readonly Span[], x: number): boolean {
  for (const span of spans) if (x >= span.from && x <= span.to) return true
  return false
}

/** The bumps your feet crossed moving from `x0` to `x1`, in either direction. */
export function bumpsCrossed(
  def: StretchDef,
  x0: number,
  x1: number,
  out: Bump[] = []
): Bump[] {
  out.length = 0
  if (x0 === x1) return out
  const lo = Math.min(x0, x1)
  const hi = Math.max(x0, x1)
  for (const bump of def.bumps) {
    if (bump.x > hi) break
    // Half-open, so a bump exactly under your feet counts once.
    if (x1 > x0 ? bump.x > lo && bump.x <= hi : bump.x >= lo && bump.x < hi)
      out.push(bump)
  }
  return out
}

/** The route drain whose grate covers route x, or null. */
export function drainAt(def: StretchDef, x: number): number | null {
  for (const drain of def.drains)
    if (Math.abs(x - drain) <= DRAIN_HALF) return drain
  return null
}

/** The route drain nearest x within `reach`, or null. */
export function drainNear(
  def: StretchDef,
  x: number,
  reach: number
): number | null {
  let best: number | null = null
  for (const drain of def.drains)
    if (
      Math.abs(drain - x) <= reach &&
      (best === null || Math.abs(drain - x) < Math.abs(best - x))
    )
      best = drain
  return best
}

/** The wet patch covering route x, as an index into `def.wet`, or -1. */
export function wetAt(def: StretchDef, x: number): number {
  for (let i = 0; i < def.wet.length; i++) {
    const span = def.wet[i]!
    if (x >= span.from && x <= span.to) return i
  }
  return -1
}

/** True when route x is on the stretch's uphill slope. */
export function onSlope(def: StretchDef, x: number): boolean {
  return def.slope !== null && x > def.slope.from && x <= def.slope.to
}

/** The puddle covering route x, or null. */
export function puddleAt(def: StretchDef, x: number): Span | null {
  for (const puddle of def.puddles)
    if (x >= puddle.from && x <= puddle.to) return puddle
  return null
}
