import {
  CARRY_SPEED_LIMIT,
  CLUMP_STRAIN,
  DUSTPAN_BASE,
  DUSTPAN_DIVISOR,
  HAND_BASE,
  HAND_DIVISOR,
  POP_PITCH_MAX,
  POP_PITCH_STEP,
  SLIPPERY_SAFE_SPEED,
  STREAK_MARKS
} from './tuning'

export type DropCause = 'jerky' | 'fast' | 'slippery'

/** Strain readings for one carry step. */
export interface StrainReading {
  /** Combined strain; 1 drops the beans, 0.7 starts the tremble. */
  strain: number
  /** Which part pushed it highest. */
  cause: Exclude<DropCause, 'slippery'>
}

/**
 * Combines the jolt level and the carry speed into one strain value. Clumps strain more:
 * each extra bean multiplies it by CLUMP_STRAIN. `limit` below 1 makes drops easier.
 */
export function strainFor(
  joltLevel: number,
  speed: number,
  clump: number,
  limit = 1
): StrainReading {
  const speedPart = speed / CARRY_SPEED_LIMIT
  const scale = CLUMP_STRAIN ** Math.max(0, clump - 1) / limit
  return speedPart > joltLevel
    ? { strain: speedPart * scale, cause: 'fast' }
    : { strain: joltLevel * scale, cause: 'jerky' }
}

/** True when a wiggling slippery bean slips at this pointer speed. */
export function slipsAt(speed: number): boolean {
  return speed > SLIPPERY_SAFE_SPEED
}

/** Pitch for the pop of the nth bean in a streak (n from 1). */
export function popPitch(streak: number): number {
  return Math.min(POP_PITCH_MAX, 1 + Math.max(0, streak - 1) * POP_PITCH_STEP)
}

const STREAK_LINES: Record<(typeof STREAK_MARKS)[number], string> = {
  10: '10 in a row!',
  25: '25 in a row. Show-off.',
  50: '50 in a row. Grandma is proud.'
}

/** The caption for a streak mark crossed between `before` and `after`, or null. */
export function streakCaption(before: number, after: number): string | null {
  for (const mark of STREAK_MARKS)
    if (before < mark && after >= mark) return STREAK_LINES[mark]
  return null
}

/** Beans one pair of cupped hands lifts off a pile of `pile`. */
export function handScoop(pile: number): number {
  return Math.min(pile, HAND_BASE + Math.floor(pile / HAND_DIVISOR))
}

/** Beans Grandma's dustpan lifts off a pile of `pile`. */
export function dustpanScoop(pile: number): number {
  return Math.min(pile, DUSTPAN_BASE + Math.floor(pile / DUSTPAN_DIVISOR))
}

/** How many scoops of `size(pile)` clear a pile of `pile` beans. */
export function scoopsToClear(
  pile: number,
  size: (pile: number) => number
): number {
  let scoops = 0
  for (let left = pile; left > 0; left -= size(left)) scoops++
  return scoops
}
