import { CAUSE_LINES } from './lines'
import type { Game } from './state'
import {
  BIG_SPILL,
  HURRY_CAUSE,
  KICK_CAUSE_MS,
  SPILL_EVENT_GAP_MS,
  TILT_CAUSE
} from './tuning'
import { DEG, formatBeans } from './units'

/** The latest bump, so a spill can blame it. */
export interface KickRecord {
  /** Short cause id, such as 'pothole' or 'cat'. */
  cause: string
  /** Simulated ms when it happened. */
  at: number
}

/** One spill event: beans leaving the pot with no gap longer than SPILL_EVENT_GAP_MS. */
export interface SpillEvent {
  active: boolean
  count: number
  /** -1 left rim, 1 right rim, from the first bean. */
  side: number
  cause: string
  startedAt: number
  lastAt: number
  /** True once the big-spill juice has played for this event. */
  big: boolean
  /** Beans this event sent down drains, capped at DRAIN_EVENT_CAP. */
  drained: number
  /** Beans this event sent into puddles, capped at PUDDLE_EVENT_CAP. */
  puddled: number
  /** Beans this event sent rolling down a slope. */
  rolled: number
  /** Beans this event lost in the river, capped at RIVER_EVENT_CAP. */
  rivered: number
}

export function createSpillEvent(): SpillEvent {
  return {
    active: false,
    count: 0,
    side: 0,
    cause: '',
    startedAt: 0,
    lastAt: 0,
    big: false,
    drained: 0,
    puddled: 0,
    rolled: 0,
    rivered: 0
  }
}

/** What the player was doing when a spill started. */
export interface CauseContext {
  now: number
  lastKick: KickRecord | null
  /** Pot angle in radians, clockwise positive. */
  psi: number
  /** Rim the beans leave over: -1 left, 1 right. */
  side: number
  /** Walking speed in u/s. */
  v: number
  /** Forward acceleration in u/s². */
  ax: number
}

/** Hard starts above this acceleration (u/s²) get the blame when nothing else fits. */
const HARD_START = 90

/**
 * Picks the cause a spill caption names: the latest bump within KICK_CAUSE_MS, then a
 * pot tilted toward the spilling rim, then hurrying, then a hard start.
 */
export function causeFor(ctx: CauseContext): string {
  if (ctx.lastKick && ctx.now - ctx.lastKick.at <= KICK_CAUSE_MS)
    return ctx.lastKick.cause
  // A positive pot angle lowers the right rim, so it pours over the right (side 1).
  if (Math.abs(ctx.psi) > TILT_CAUSE * DEG && Math.sign(ctx.psi) === ctx.side)
    return 'tilt'
  if (Math.abs(ctx.v) > HURRY_CAUSE) return 'hurry'
  if (Math.abs(ctx.ax) > HARD_START) return 'start'
  return 'slosh'
}

/** What changed when beans were added to the current event. */
export interface SpillNote {
  started: boolean
  /** True on the step the event first reaches BIG_SPILL beans. */
  turnedBig: boolean
}

/** Adds `n` beans to the current spill event, starting one if needed. */
export function noteSpill(
  event: SpillEvent,
  n: number,
  side: number,
  now: number,
  cause: () => string
): SpillNote {
  const started = !event.active
  if (started) {
    event.active = true
    event.count = 0
    event.side = side
    event.cause = cause()
    event.startedAt = now
    event.big = false
    event.drained = 0
    event.puddled = 0
    event.rolled = 0
    event.rivered = 0
  }
  event.count += n
  event.lastAt = now
  const turnedBig = !event.big && event.count >= BIG_SPILL
  if (turnedBig) event.big = true
  return { started, turnedBig }
}

/** A spill event that just ended. */
export interface FinishedSpill {
  count: number
  cause: string
  /** Simulated ms from its first bean to its last. */
  durationMs: number
}

/** Ends the event once no bean has left for SPILL_EVENT_GAP_MS. Returns the finished event. */
export function closeSpillIfQuiet(
  event: SpillEvent,
  now: number
): FinishedSpill | null {
  if (!event.active || now - event.lastAt < SPILL_EVENT_GAP_MS) return null
  event.active = false
  return {
    count: event.count,
    cause: event.cause,
    durationMs: event.lastAt - event.startedAt
  }
}

/** The plain lead-in naming a cause, such as "Hurried.". Captions rotate through `causeLine`. */
export function causeText(cause: string): string {
  return CAUSE_LINES[cause]?.[0] ?? `${cause}.`
}

/** "Hurried. 14 beans." for a lead-in and a count. */
export function spillHeadline(lead: string, count: number): string {
  return `${lead} ${formatBeans(count)} ${count === 1 ? 'bean' : 'beans'}.`
}

/** Grandma's reaction lines, by spill size. Each tier rotates without repeating. */
export const GRANDMA_LINES = {
  tiny: [
    'Grandma felt that.',
    'Somewhere, Grandma tutted.',
    'Grandma looked up from her knitting.',
    'Grandma sensed a disturbance.',
    'Grandma sniffed.'
  ],
  small: [
    'Grandma winced.',
    'Grandma put her tea down.',
    "Grandma's eye twitched.",
    'Grandma sighed at the telly.',
    'Grandma counted to ten.'
  ],
  big: [
    'Grandma sat down.',
    'Grandma needs a moment.',
    'Grandma dropped a stitch.',
    'Grandma reached for the sherry.',
    'Grandma took her glasses off.'
  ],
  huge: [
    'Grandma is updating her will.',
    'Grandma is calling your mother.',
    'Grandma has stopped knitting.',
    'Grandma is writing a strong letter.',
    'Grandma has gone very quiet.'
  ],
  tip: [
    'Grandma heard that from across town.',
    'Grandma felt that in her knees.',
    'Grandma fainted a bit.',
    'Grandma saw it in her tea leaves.'
  ],
  door: [
    'Grandma saw the whole thing.',
    'Grandma is right there, watching.',
    'Grandma blinked twice.',
    'Grandma is not surprised.'
  ]
} as const

export type GrandmaTier = keyof typeof GRANDMA_LINES

export function grandmaTier(cause: string, count: number): GrandmaTier {
  if (cause === 'doorstep') return 'door'
  if (cause === 'tip') return 'tip'
  if (count >= 100) return 'huge'
  if (count >= BIG_SPILL) return 'big'
  if (count >= 10) return 'small'
  return 'tiny'
}

/** Grandma's next line for a tier, rotating without repeats. */
export function grandmaLine(game: Game, tier: GrandmaTier): string {
  return game.lines.pick(
    `grandma:${tier}`,
    GRANDMA_LINES[tier],
    game.random.lines
  )
}
