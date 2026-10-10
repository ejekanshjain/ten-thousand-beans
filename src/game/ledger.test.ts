import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import { createCounts, move, PLACES, total } from './ledger'
import { TOTAL_BEANS } from './tuning'

describe('ledger', () => {
  it('starts with every bean in the pot', () => {
    const counts = createCounts()
    expect(counts.pot).toBe(TOTAL_BEANS)
    expect(total(counts)).toBe(TOTAL_BEANS)
  })

  it('rejects fractions, negatives and overdraws without changing anything', () => {
    const counts = createCounts()
    expect(() => move(counts, 'pot', 'loose', 1.5)).toThrow(RangeError)
    expect(() => move(counts, 'pot', 'loose', -1)).toThrow(RangeError)
    expect(() => move(counts, 'loose', 'pot', 1)).toThrow(/holds only 0/)
    expect(counts).toEqual(createCounts())
  })

  it('keeps the total through 10,000 random moves', () => {
    const counts = createCounts()
    const random = rng(7)
    for (let i = 0; i < 10_000; i++) {
      const from = PLACES[Math.floor(random() * PLACES.length)]!
      const to = PLACES[Math.floor(random() * PLACES.length)]!
      move(counts, from, to, Math.floor(random() * (counts[from] + 1)))
    }
    expect(total(counts)).toBe(TOTAL_BEANS)
  })
})
