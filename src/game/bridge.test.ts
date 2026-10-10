import Matter from 'matter-js'
import { describe, expect, it } from 'vitest'

import { emitBeans } from './emit'
import {
  createGame,
  devSpill,
  enterStretch,
  setDown,
  tipOver,
  type Game
} from './game'
import { total } from './ledger'
import { checkPackets, packetLabel } from './packets'
import { ROUTE } from './route'
import { simulate } from './testing'
import { CROSSWIND, DECK_LEFT, RIVER_EVENT_CAP } from './tuning'
import { DEG } from './units'
import { deckRoll } from './weather'
import { checkZones } from './zones'

/** The bridge, carrying the pot at 800, with no gust due. */
function bridge(): Game {
  const game = createGame(1, ROUTE)
  enterStretch(game, 5)
  game.walker.x = 800
  game.weather.gust.waitMs = Infinity
  return game
}

function healthy(game: Game): void {
  expect(total(game.counts)).toBe(10_000)
  expect(checkZones(game.counts, game.zones.list)).toBeNull()
  expect(checkPackets(game.counts, game.packets)).toBeNull()
}

describe('the rope bridge', () => {
  it('rolls the pot on two sines plus a steady 4 degree crosswind', () => {
    expect(deckRoll(0)).toBeCloseTo(3 * Math.sin(1.3) * DEG, 6)
    const game = bridge()
    simulate(game, 1)
    expect(game.pot.drift).toBeCloseTo(
      deckRoll(game.timeMs) + CROSSWIND * DEG,
      6
    )
    // Standing still and doing nothing, the roll alone pours beans out.
    simulate(game, 10)
    expect(game.counts.pot).toBeLessThan(10_000)
  })

  it('loses at most 30 beans of a spill to the river, as River Tax packets', () => {
    const game = bridge()
    emitBeans(game, 300, 1, 20)
    expect(game.counts.packets).toBe(RIVER_EVENT_CAP)
    expect(packetLabel(game.packets.list[0]!)).toBe('River Tax, Bridge: 8')
    simulate(game, 2)
    expect(game.fx.captions.some(c => c.text === 'Bye, bean.')).toBe(true)
    healthy(game)
  })

  it('tips onto the deck, with only the river cap lost', () => {
    const game = bridge()
    tipOver(game)
    expect(game.counts.packets).toBeLessThanOrEqual(RIVER_EVENT_CAP)
    expect(game.counts.pile).toBe(400)
    healthy(game)
  })
})

describe('bridge Pickup', () => {
  /** Bridge Pickup on a fresh 20-bean spill. */
  function pickup(): Game {
    const game = bridge()
    devSpill(game, 20)
    simulate(game, 1)
    game.walker.x = 860
    setDown(game)
    expect(game.scene).toBe('pickup')
    expect(game.pickup.world!.deck).toBe(true)
    game.flock.waitMs = Infinity
    return game
  }

  it('slides resting beans toward the edges at 60 to 90 u/s at the big peaks of the roll', () => {
    const game = pickup()
    // The two sines line up into the deck's biggest rolls at about 2.2s and 4.2s.
    for (const [at, from, to] of [
      [2_228, -90, -60],
      [4_163, 60, 90]
    ] as const) {
      game.timeMs = at
      simulate(game, 0.02)
      const slide = game.pickup.world!.slide.x
      expect(slide).toBeGreaterThan(from)
      expect(slide).toBeLessThan(to)
    }
  })

  it('loses beans that slide off the deck, with a splash and River Tax', () => {
    const game = pickup()
    const body = game.pickup.world!.beans[0]!
    Matter.Body.setPosition(body, { x: DECK_LEFT - 6, y: 330 })
    simulate(game, 0.05)
    expect(game.counts.packets).toBe(1)
    expect(game.fx.captions.some(c => c.text === 'Bye, bean.')).toBe(true)
    healthy(game)
  })
})
