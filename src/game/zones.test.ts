import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import { createCounts, move, total } from './ledger'
import { ZONE_MAX_LOOSE } from './tuning'
import {
  behind,
  checkZones,
  createZoneSet,
  landFromPot,
  pruneZones
} from './zones'

describe('spill zones', () => {
  it('merges landings within 150 u of an anchor and starts a new zone beyond', () => {
    const counts = createCounts()
    const set = createZoneSet()
    const random = rng(1)
    const first = landFromPot(counts, set, 0, 500, 3, random)
    expect(landFromPot(counts, set, 0, 640, 2, random)).toBe(first)
    expect(landFromPot(counts, set, 0, 660, 2, random)).not.toBe(first)
    expect(set.list).toHaveLength(2)
    expect(first.count).toBe(5)
  })

  it('sends the 201st loose bean to the pile', () => {
    const counts = createCounts()
    const set = createZoneSet()
    const zone = landFromPot(counts, set, 0, 500, ZONE_MAX_LOOSE + 1, rng(2))
    expect(zone.count).toBe(ZONE_MAX_LOOSE)
    expect(zone.pile).toBe(1)
    expect(counts.loose).toBe(ZONE_MAX_LOOSE)
    expect(counts.pile).toBe(1)
  })

  it('counts beans behind only in the current stretch', () => {
    const counts = createCounts()
    const set = createZoneSet()
    landFromPot(counts, set, 0, 500, 10, rng(3))
    landFromPot(counts, set, 1, 500, 7, rng(3))
    expect(behind(set.list, 0)).toBe(10)
    expect(behind(set.list, 1)).toBe(7)
  })

  it('keeps zone totals equal to the ledger through random landings and returns', () => {
    const counts = createCounts()
    const set = createZoneSet()
    const random = rng(4)
    for (let i = 0; i < 300; i++) {
      landFromPot(
        counts,
        set,
        0,
        random() * 4_000,
        1 + Math.floor(random() * 40),
        random
      )
      const zone = set.list[Math.floor(random() * set.list.length)]!
      const back = Math.floor(random() * zone.count)
      move(counts, 'loose', 'pot', back)
      zone.count -= back
      zone.shown = Math.min(zone.shown, zone.count + zone.pile)
      pruneZones(set)
      expect(checkZones(counts, set.list)).toBeNull()
    }
    expect(total(counts)).toBe(10_000)
  })
})
