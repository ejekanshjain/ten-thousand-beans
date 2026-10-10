import Matter from 'matter-js'
import { describe, expect, it } from 'vitest'

import {
  createGame,
  devSpill,
  enterStretch,
  pickUp,
  pickupTap,
  setDown,
  type Game
} from './game'
import { total } from './ledger'
import {
  checkPackets,
  createPackets,
  fillPackets,
  packetLabel
} from './packets'
import { activePigeons, devPigeon, shooPigeons } from './pigeons'
import { ROUTE } from './route'
import { simulate } from './testing'
import {
  PACKET_SIZE,
  PIGEON_BITE_MS,
  PIGEON_MAX,
  PIGEON_RETURN_MAX_MS,
  PIGEON_RETURN_MIN_MS,
  POT_X,
  POT_Y
} from './tuning'
import { checkZones } from './zones'

/** The park with the pot set down on open ground, so pigeons come in the walk view. */
function grounded(): Game {
  const game = createGame(1, ROUTE)
  enterStretch(game, 3)
  game.walker.x = 1_000
  setDown(game)
  expect(game.scene).toBe('grounded')
  return game
}

/** The park in Pickup on a fresh 30-bean spill, with no pigeon due for a long while. */
function inPickup(): Game {
  const game = createGame(1, ROUTE)
  enterStretch(game, 3)
  game.walker.x = 1_000
  devSpill(game, 30)
  simulate(game, 1)
  setDown(game)
  expect(game.scene).toBe('pickup')
  simulate(game, 0.02)
  game.flock.waitMs = Infinity
  return game
}

/** Lines the free beans up in a row 25 u apart from (x, y), out of each other's way. */
function spreadOut(game: Game, x: number, y: number): void {
  for (const [i, body] of game.pickup.world!.beans.entries()) {
    Matter.Body.setPosition(body, {
      x: x + (i % 7) * 25,
      y: y - Math.floor(i / 7) * 25
    })
    Matter.Body.setVelocity(body, { x: 0, y: 0 })
  }
}

function healthy(game: Game): void {
  expect(total(game.counts)).toBe(10_000)
  expect(checkZones(game.counts, game.zones.list)).toBeNull()
  expect(checkPackets(game.counts, game.packets)).toBeNull()
}

describe('seed packets', () => {
  it('hold up to 8 beans each, topping up the newest of the same cause and stretch', () => {
    const set = createPackets()
    fillPackets(set, 'pigeon', 'park', 20)
    expect(set.list.map(p => p.beans)).toEqual([8, 8, 4])
    fillPackets(set, 'pigeon', 'park', 5)
    expect(set.list.map(p => p.beans)).toEqual([8, 8, 8, 1])
    fillPackets(set, 'river', 'bridge', 3)
    fillPackets(set, 'pigeon', 'bridge', 1)
    expect(set.list.map(packetLabel)).toEqual([
      'Pigeon Tax, Park: 8',
      'Pigeon Tax, Park: 8',
      'Pigeon Tax, Park: 8',
      'Pigeon Tax, Park: 1',
      'River Tax, Bridge: 3',
      'Pigeon Tax, Bridge: 1'
    ])
    expect(Math.max(...set.list.map(p => p.beans))).toBe(PACKET_SIZE)
  })
})

describe('pigeons', () => {
  it('walk in while the pot sits on the ground, and eat from it once on the rim', () => {
    const game = grounded()
    expect(devPigeon(game)).toBe(true)
    game.flock.waitMs = Infinity
    simulate(game, 12)
    const pigeon = game.flock.pigeons[0]!
    expect(pigeon.phase).toBe('eat')
    // One bean every PIGEON_BITE_MS from the moment it perched.
    const eaten = 10_000 - game.counts.pot
    expect(eaten).toBeGreaterThan(0)
    expect(game.counts.packets).toBe(eaten)
    expect(game.packets.list[0]?.cause).toBe('pigeon')
    expect(packetLabel(game.packets.list[0]!)).toMatch(/^Pigeon Tax, Park: /)
    const before = game.counts.pot
    simulate(game, (PIGEON_BITE_MS * 10) / 1000)
    expect(before - game.counts.pot).toBe(10)
    healthy(game)
  })

  it('never stand more than 3 on the ground at once', () => {
    const game = grounded()
    let most = 0
    simulate(game, 120, (_, g) => {
      most = Math.max(most, activePigeons(g.flock))
    })
    expect(most).toBe(PIGEON_MAX)
    healthy(game)
  })

  it('leave when you pick the pot up', () => {
    const game = grounded()
    devPigeon(game)
    simulate(game, 1)
    pickUp(game)
    expect(game.flock.view).toBeNull()
    expect(game.flock.pigeons).toHaveLength(0)
  })

  it('scatter as a flock from one tap near any of them, and come back 6 to 10s later', () => {
    const game = grounded()
    devPigeon(game)
    devPigeon(game)
    devPigeon(game)
    simulate(game, 2)
    const one = game.flock.pigeons[1]!
    expect(shooPigeons(game, one.x + 500, one.y)).toBe(false)
    expect(shooPigeons(game, one.x + 10, one.y - 14)).toBe(true)
    expect(game.flock.pigeons.every(p => p.phase === 'flee')).toBe(true)
    expect(game.flock.waitMs).toBeGreaterThanOrEqual(PIGEON_RETURN_MIN_MS)
    expect(game.flock.waitMs).toBeLessThanOrEqual(PIGEON_RETURN_MAX_MS)
    simulate(game, 2)
    expect(game.flock.pigeons).toHaveLength(0)
    simulate(game, PIGEON_RETURN_MAX_MS / 1000)
    expect(activePigeons(game.flock)).toBe(1)
  })

  it('divert to a loose bean within 60 u of their path, which is lost for good', () => {
    const game = inPickup()
    const world = game.pickup.world!
    // Every bean but one goes far away; that one sits 50 u off the pigeon's line.
    spreadOut(game, 400, 160)
    const bait = world.beans[0]!
    Matter.Body.setPosition(bait, { x: 150, y: POT_Y - 50 })
    devPigeon(game)
    const pigeon = game.flock.pigeons[0]!
    pigeon.x = 40
    pigeon.y = POT_Y
    const loose = game.counts.loose
    simulate(game, 4)
    expect(game.counts.loose).toBe(loose - 1)
    expect(game.counts.packets).toBe(1)
    expect(world.beans.includes(bait)).toBe(false)
    healthy(game)
  })

  it('ignore beans further than 60 u from their path and head for the pot', () => {
    const game = inPickup()
    spreadOut(game, 120, POT_Y - 100)
    devPigeon(game)
    const pigeon = game.flock.pigeons[0]!
    pigeon.x = 40
    pigeon.y = POT_Y
    simulate(game, 9)
    expect(pigeon.phase).toBe('eat')
    expect(Math.hypot(pigeon.x - POT_X, pigeon.y - POT_Y)).toBeLessThan(70)
    expect(game.counts.loose).toBe(30)
    healthy(game)
  })

  it('come for the pot every 30s from the street on, as gulls at the market', () => {
    for (const [stretch, cause] of [
      [1, 'Pigeon Tax, Street'],
      [2, 'Gull Tax, Market']
    ] as const) {
      const game = createGame(1, ROUTE)
      enterStretch(game, stretch)
      game.walker.x = 1_000
      setDown(game)
      expect(game.scene).toBe('grounded')
      simulate(game, 14)
      expect(activePigeons(game.flock)).toBe(0)
      simulate(game, 1.5)
      expect(activePigeons(game.flock)).toBe(1)
      // It waddles over, hops on the rim and eats until shooed.
      simulate(game, 12)
      expect(game.counts.packets).toBeGreaterThan(0)
      expect(packetLabel(game.packets.list[0]!)).toMatch(cause)
      const bird = game.flock.pigeons[0]!
      expect(shooPigeons(game, bird.x, bird.y - 14)).toBe(true)
      healthy(game)
    }
  })

  it('scatter from a click in Pickup instead of a grab', () => {
    const game = inPickup()
    devPigeon(game)
    const pigeon = game.flock.pigeons[0]!
    pigeon.x = 120
    pigeon.y = 600
    expect(pickupTap(game, 130, 590)).toBe(true)
    expect(pigeon.phase).toBe('flee')
  })
})
