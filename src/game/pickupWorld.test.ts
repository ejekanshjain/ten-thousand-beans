import Matter from 'matter-js'
import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import { createCounts, move } from './ledger'
import { PickupWorld } from './pickupWorld'
import {
  DECK_LEFT,
  DECK_PLANK,
  DECK_RIGHT,
  DUCK_MS,
  GAP_SLOW_SPEED,
  PLAY_BOTTOM,
  PLAY_LEFT,
  PLAY_RIGHT,
  PLAY_TOP,
  POT_X,
  POT_Y
} from './tuning'
import { createZone, KIND_LOOSE, writeBean } from './zones'

/** A zone with `n` loose beans scattered by a seeded source, and a ledger to match. */
function scatteredWorld(n: number, seed = 1) {
  const counts = createCounts()
  const zone = createZone(1, 0, 500)
  const random = rng(seed)
  for (let i = 0; i < n; i++)
    writeBean(zone, i, 60 + random() * 480, 150 + random() * 400, 0, KIND_LOOSE)
  zone.count = n
  move(counts, 'pot', 'loose', n)
  return { counts, zone, world: new PickupWorld(zone, counts) }
}

describe('PickupWorld', () => {
  it('keeps every bean inside the play rect through 1,000 seeded flings', () => {
    const { world } = scatteredWorld(40)
    const random = rng(9)
    for (let fling = 0; fling < 1_000; fling++) {
      const body = world.beans[Math.floor(random() * world.beans.length)]!
      const { x, y } = body.position
      expect(world.grab(x, y, 30, 3)).toBeGreaterThan(0)
      world.moveHeld(x + (random() - 0.5) * 80, y + (random() - 0.5) * 80)
      const angle = random() * Math.PI * 2
      world.release(Math.cos(angle) * 5_000, Math.sin(angle) * 5_000)
      for (let s = 0; s < 6; s++) world.step(1000 / 60)
    }
    for (const body of world.beans) {
      expect(body.position.x).toBeGreaterThanOrEqual(PLAY_LEFT)
      expect(body.position.x).toBeLessThanOrEqual(PLAY_RIGHT)
      expect(body.position.y).toBeGreaterThanOrEqual(PLAY_TOP)
      expect(body.position.y).toBeLessThanOrEqual(PLAY_BOTTOM)
    }
    world.dispose()
  })

  it('puts a bean released 65 u from the pot centre into the pot', () => {
    const { counts, zone, world } = scatteredWorld(1)
    const body = world.beans[0]!
    expect(world.grab(body.position.x, body.position.y, 30, 1)).toBe(1)
    world.moveHeld(POT_X + 65, POT_Y)
    expect(world.release(0, 0)).toEqual({
      potted: 1,
      returned: 0,
      refused: 0,
      racked: 0
    })
    expect(counts.pot).toBe(10_000)
    expect(counts.loose).toBe(0)
    expect(zone.count).toBe(0)
  })

  it('returns a bean released beside the pot to the ground, slowed to the release cap', () => {
    const { world } = scatteredWorld(1)
    const body = world.beans[0]!
    world.grab(body.position.x, body.position.y, 30, 1)
    world.moveHeld(300, 300)
    expect(world.release(3_000, 0)).toEqual({
      potted: 0,
      returned: 1,
      refused: 0,
      racked: 0
    })
    expect(world.speedOf(world.beans[0]!)).toBeCloseTo(400, 0)
  })

  it('lifts a touching clump up to the limit, nearest first', () => {
    const counts = createCounts()
    const zone = createZone(1, 0, 0)
    const spots = [300, 316, 284, 332, 400]
    spots.forEach((x, i) => writeBean(zone, i, x, 300, 0, KIND_LOOSE))
    zone.count = spots.length
    move(counts, 'pot', 'loose', spots.length)
    const world = new PickupWorld(zone, counts)
    expect(world.grab(300, 300, 28, 3)).toBe(3)
    expect(world.beans.map(b => b.position.x).sort()).toEqual([332, 400])
    expect(world.count).toBe(5)
  })

  it('writes positions back so the zone record matches the bodies', () => {
    const { zone, world } = scatteredWorld(10)
    world.grab(world.beans[0]!.position.x, world.beans[0]!.position.y, 30, 1)
    world.moveHeld(123, 456)
    world.writeBack()
    expect(zone.count).toBe(10)
    const xs = Array.from({ length: 10 }, (_, i) => zone.beans[i * 4]!)
    expect(xs).toContain(123)
  })

  it('lets resting beans sleep, so a still floor costs little', () => {
    const { world } = scatteredWorld(60)
    for (let s = 0; s < 240; s++) world.step(1000 / 60)
    const sleeping = world.beans.filter(b => b.isSleeping).length
    expect(sleeping).toBeGreaterThan(world.beans.length / 2)
    expect(Matter.Composite.allBodies(world.engine.world).length).toBe(65)
  })
})

describe('scoops', () => {
  it('lifts a cluster with hands and pots it all over the pot', () => {
    const { counts, zone, world } = scatteredWorld(0)
    for (let i = 0; i < 30; i++)
      writeBean(
        zone,
        i,
        280 + (i % 6) * 8,
        300 + Math.floor(i / 6) * 8,
        0,
        KIND_LOOSE
      )
    zone.count = 30
    move(counts, 'pot', 'loose', 30)
    const clustered = new PickupWorld(zone, counts)
    expect(clustered.scoopCluster(300, 316, 50, 25)).toBe(25)
    clustered.moveHeld(POT_X, POT_Y)
    expect(clustered.release(0, 0).potted).toBe(25)
    expect(zone.count).toBe(5)
    expect(counts.loose).toBe(5)
    world.dispose()
  })

  it('keeps pile beans in the pile until they land in the pot', () => {
    const counts = createCounts()
    const zone = createZone(1, 0, 0)
    move(counts, 'pot', 'pile', 100)
    zone.pile = 100
    const world = new PickupWorld(zone, counts)
    expect(world.scoopPile(35, 300, 330)).toBe(35)
    world.moveHeld(500, 300)
    expect(world.release(0, 0)).toEqual({
      potted: 0,
      returned: 35,
      refused: 0,
      racked: 0
    })
    expect(zone.pile).toBe(100)
    world.scoopPile(35, 300, 330)
    world.moveHeld(POT_X, POT_Y - 20)
    expect(world.release(0, 0).potted).toBe(35)
    expect(zone.pile).toBe(65)
    expect(counts.pile).toBe(65)
    expect(counts.pot).toBe(10_000 - 65)
  })

  it('dribbles a pile bean onto the ground as a new body', () => {
    const counts = createCounts()
    const zone = createZone(1, 0, 0)
    move(counts, 'pot', 'pile', 10)
    zone.pile = 10
    const world = new PickupWorld(zone, counts)
    world.scoopPile(10, 300, 330)
    expect(world.dribble()).toBe(true)
    expect(world.holding).toBe(9)
    expect(world.beans).toHaveLength(1)
    expect(zone.pile).toBe(9)
    expect(zone.count).toBe(1)
    expect(counts.loose).toBe(1)
    expect(counts.pile).toBe(9)
  })
})

describe('the bridge slide', () => {
  it('moves a resting bean at least 40 u in a second at peak roll, with sleeping off', () => {
    const counts = createCounts()
    const zone = createZone(1, 0, 0)
    writeBean(zone, 0, 300, 300, 0, KIND_LOOSE)
    zone.count = 1
    move(counts, 'pot', 'loose', 1)
    const world = new PickupWorld(zone, counts, { sleeping: false })
    for (let s = 0; s < 120; s++) world.step(1000 / 60)
    world.slide.y = 75
    const start = world.beans[0]!.position.y
    for (let s = 0; s < 60; s++) world.step(1000 / 60)
    expect(world.beans[0]!.position.y - start).toBeGreaterThan(40)
  })
})

describe('the bridge deck', () => {
  /** A bridge world with beans at the given spots, at rest. */
  function deck(spots: [number, number][]) {
    const counts = createCounts()
    const zone = createZone(1, 0, 0)
    for (const [i, [x, y]] of spots.entries())
      writeBean(zone, i, x, y, 0, KIND_LOOSE)
    zone.count = spots.length
    move(counts, 'pot', 'loose', spots.length)
    const world = new PickupWorld(zone, counts, { sleeping: false, deck: true })
    return { counts, zone, world }
  }

  it('starts every bean on the planks, off the river and the gaps', () => {
    const { world } = deck([
      [30, 300],
      [570, 400],
      [300, DECK_PLANK * 5]
    ])
    for (const body of world.beans) {
      expect(world.offDeck(body.position.x)).toBe(false)
      expect(world.overGap(body.position.y)).toBe(false)
    }
  })

  it('loses a bean past an edge or resting on a gap, but not one rolling over it', () => {
    const { world, counts, zone } = deck([
      [300, 300],
      [300, 420],
      [200, 200]
    ])
    const [edge, gap, rolling] = world.beans as [
      Matter.Body,
      Matter.Body,
      Matter.Body
    ]
    Matter.Body.setPosition(edge, { x: DECK_LEFT - 5, y: 300 })
    Matter.Body.setPosition(gap, { x: 300, y: DECK_PLANK * 7 })
    Matter.Body.setPosition(rolling, { x: 200, y: DECK_PLANK * 3 })
    Matter.Body.setVelocity(rolling, { x: 2, y: 0 })
    expect(world.speedOf(rolling)).toBeGreaterThan(GAP_SLOW_SPEED)
    const result = world.river(GAP_SLOW_SPEED, 16)
    expect(result.lost).toBe(2)
    expect(world.beans).toEqual([rolling])
    expect(counts.packets).toBe(2)
    expect(zone.count).toBe(1)
  })

  it('lets a duck bring back a bean you flung in, after DUCK_MS', () => {
    const { world, counts, zone } = deck([[100, 300]])
    expect(world.grab(100, 300, 30, 1)).toBe(1)
    world.moveHeld(DECK_RIGHT - 30, 300)
    world.release(600, 0)
    for (let t = 0; t < 400; t += 1000 / 60) world.step(1000 / 60)
    expect(world.river(GAP_SLOW_SPEED, 400).ducked).toBe(1)
    expect(world.beans).toHaveLength(0)
    expect(world.count).toBe(1)
    expect(counts.loose).toBe(1)
    expect(world.river(GAP_SLOW_SPEED, DUCK_MS).returned).toBe(1)
    const body = world.beans[0]!
    expect(world.offDeck(body.position.x)).toBe(false)
    expect(counts.packets).toBe(0)
    expect(zone.count).toBe(1)
  })
})
