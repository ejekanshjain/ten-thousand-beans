import { describe, expect, it } from 'vitest'

import { updateDrying } from './drying'
import { throwBean } from './emit'
import {
  createGame,
  enterStretch,
  pickUp,
  pickupDrag,
  pickupPress,
  pickupRelease,
  setDown,
  type Game
} from './game'
import { gateOpen } from './gate'
import { total } from './ledger'
import { ROUTE } from './route'
import { noteSpill } from './spill'
import { simulate } from './testing'
import {
  DRY_MS,
  POT_X,
  POT_Y,
  PUDDLE_EVENT_CAP,
  RACK_H,
  RACK_W,
  RACK_X,
  RACK_Y
} from './tuning'
import { checkZones } from './zones'

const PUDDLE = ROUTE[2]!.puddles[0]!
const MIDDLE = (PUDDLE.from + PUDDLE.to) / 2

/** The market with you just before its first puddle, and `n` beans thrown into it in one spill. */
function splashed(n = 16): Game {
  const game = createGame(1, ROUTE)
  enterStretch(game, 2)
  game.walker.x = PUDDLE.from - 100
  noteSpill(game.spill, n, 1, game.timeMs, () => 'test')
  for (let i = 0; i < n; i++) throwBean(game, MIDDLE, 500, 0, -100)
  game.stats.spilled += n
  simulate(game, 1)
  return game
}

/** Opens Pickup on the splash, with its puddle and the drying rack. */
function inPickup(): Game {
  const game = splashed()
  setDown(game)
  expect(game.scene).toBe('pickup')
  return game
}

/** Lifts the bean `body` and lets go of it at (x, y), standing still. */
function carry(
  game: Game,
  from: { x: number; y: number },
  x: number,
  y: number
) {
  pickupPress(game, from.x, from.y)
  pickupDrag(game, x, y)
  pickupRelease(game, { x, y, vx: 0, vy: 0 })
}

describe('puddles', () => {
  it('swell up to 10 beans from each spill event, and the rest land dry', () => {
    const game = splashed()
    expect(game.counts.puddle).toBe(PUDDLE_EVENT_CAP)
    expect(game.counts.loose).toBe(16 - PUDDLE_EVENT_CAP)
    expect(checkZones(game.counts, game.zones.list)).toBeNull()
  })

  it('show in Pickup, keep swollen beans swollen, and swell a dry bean left in one', () => {
    const game = inPickup()
    const world = game.pickup.world!
    expect(world.puddles).toHaveLength(1)
    expect(world.rack).toBe(true)
    expect(world.swollen.size).toBe(PUDDLE_EVENT_CAP)
    const puddle = world.puddles[0]!
    const dry = world.beans.find(b => !world.swollen.has(b))!
    expect(world.inPuddle(dry.position.x, dry.position.y)).toBe(false)
    carry(game, dry.position, puddle.x, puddle.y)
    simulate(game, 0.5)
    expect(game.counts.puddle).toBeGreaterThan(PUDDLE_EVENT_CAP)
    expect(checkZones(game.counts, game.zones.list)).toBeNull()

    // Closing and reopening keeps every swollen bean swollen.
    const swollen = game.counts.puddle
    expect(pickUp(game)).toBe(true)
    setDown(game)
    expect(game.pickup.world!.swollen.size).toBe(swollen)
  })

  it('make the pot bounce a swollen bean back out', () => {
    const game = inPickup()
    const world = game.pickup.world!
    const bean = [...world.swollen][0]!
    carry(game, bean.position, POT_X, POT_Y)
    expect(game.counts.puddle).toBe(PUDDLE_EVENT_CAP)
    expect(world.swollen.has(bean)).toBe(true)
    expect(game.fx.captions.map(c => c.text)).toContain(
      'Too swollen. Put it on the rack.'
    )
  })
})

describe('the drying rack', () => {
  it('dries each swollen bean for a minute on the wall clock, then drops it in the pot', () => {
    const game = inPickup()
    const world = game.pickup.world!
    const bean = [...world.swollen][0]!
    carry(game, bean.position, RACK_X + RACK_W / 2, RACK_Y + RACK_H / 2)
    const drying = game.counts.drying
    expect(drying).toBeGreaterThan(0)
    expect(game.drying).toHaveLength(drying)
    const timer = game.drying[0]!
    expect(timer.durationMs).toBe(DRY_MS)
    expect(updateDrying(game, timer.startedAt + DRY_MS - 1)).toBe(0)
    const pot = game.counts.pot
    expect(updateDrying(game, timer.startedAt + DRY_MS)).toBe(drying)
    expect(game.counts.pot).toBe(pot + drying)
    expect(game.counts.drying).toBe(0)
    expect(total(game.counts)).toBe(10_000)
  })

  it('lets the gate open while beans still dry on your back', () => {
    const game = inPickup()
    const world = game.pickup.world!
    for (let guard = 0; guard < 60 && world.beans.length > 0; guard++) {
      const body = world.beans[0]!
      const swollen = world.swollen.has(body)
      carry(
        game,
        body.position,
        swollen ? RACK_X + RACK_W / 2 : POT_X,
        swollen ? RACK_Y + RACK_H / 2 : POT_Y
      )
    }
    expect(world.clear).toBe(true)
    expect(game.counts.drying).toBeGreaterThan(0)
    simulate(game, 0.1)
    expect(gateOpen(game)).toBe(true)
  })
})
