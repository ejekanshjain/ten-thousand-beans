import { TOTAL_BEANS } from './tuning'

/** Every place a bean can be. Each bean is in exactly one. */
export const PLACES = [
  'pot',
  'loose',
  'pile',
  'puddle',
  'drying',
  'drain',
  'packets',
  'growing',
  'regrown',
  'hidden'
] as const

export type Place = (typeof PLACES)[number]
export type Counts = Record<Place, number>

/** A fresh ledger with every bean in the pot. */
export function createCounts(): Counts {
  const counts = {} as Counts
  for (const place of PLACES) counts[place] = 0
  counts.pot = TOTAL_BEANS
  return counts
}

/** Moves `n` whole beans between places. Throws on a fractional or negative `n`, or an overdraw. */
export function move(counts: Counts, from: Place, to: Place, n: number): void {
  if (!Number.isInteger(n) || n < 0)
    throw new RangeError(
      `Ledger: moving ${n} beans from ${from} to ${to} failed, because only whole positive counts can move`
    )
  if (counts[from] < n)
    throw new RangeError(
      `Ledger: moving ${n} beans from ${from} to ${to} failed, because ${from} holds only ${counts[from]}`
    )
  counts[from] -= n
  counts[to] += n
}

/** Sum of every place. Always TOTAL_BEANS when the ledger is healthy. */
export function total(counts: Counts): number {
  let sum = 0
  for (const place of PLACES) sum += counts[place]
  return sum
}
