import Matter from 'matter-js'
import { describe, expect, it } from 'vitest'

import { emitBeans } from './emit'
import {
  createGame,
  devSpill,
  enterStretch,
  pickUp,
  setDown,
  type Game
} from './game'
import { total } from './ledger'
import { checkPackets } from './packets'
import { groundDrop, ROUTE } from './route'
import { simulate, STEP_MS } from './testing'
import { GUST_WARN_MS, POUR_BEANS_MAX, POUR_FILL_MS, RAIN_RATE } from './tuning'
import { DEG } from './units'
import { devOwn } from './upgrades'
import {
  devGust,
  devRain,
  endPour,
  pourResult,
  startPour,
  updatePour,
  weatherPrompt
} from './weather'
import { checkZones } from './zones'

/** The hill, carrying the pot at route x `x`, with no gust due for a long while. */
function hill(x = 600): Game {
  const game = createGame(1, ROUTE)
  enterStretch(game, 4)
  game.walker.x = x
  game.weather.gust.waitMs = Infinity
  return game
}

function healthy(game: Game): void {
  expect(total(game.counts)).toBe(10_000)
  expect(checkZones(game.counts, game.zones.list)).toBeNull()
  expect(checkPackets(game.counts, game.packets)).toBeNull()
}

describe('the hill', () => {
  it('climbs 12 degrees from 1,000 to 2,800 and slows you to 70%', () => {
    const def = ROUTE[4]!
    expect(groundDrop(def, 1_000)).toBe(0)
    expect(groundDrop(def, 2_800)).toBeCloseTo(-1_800 * Math.tan(12 * DEG), 1)
    const flat = hill(200)
    simulate(flat, 4, input => void (input.walk.walk = 1))
    expect(flat.walker.v).toBeCloseTo(80, 0)
    const slope = hill(1_100)
    simulate(slope, 4, input => void (input.walk.walk = 1))
    expect(slope.walker.v).toBeCloseTo(56, 0)
  })

  it('rolls every bean spilled on the slope down to its foot', () => {
    const game = hill(2_000)
    emitBeans(game, 20, -1, 10)
    emitBeans(game, 20, 1, 10)
    const zones = game.zones.list.filter(z => z.stretch === 4)
    expect(zones.length).toBeGreaterThan(0)
    for (const zone of zones) expect(zone.anchorX).toBeLessThan(1_000)
    expect(game.fx.captions.some(c => c.text === 'Gravity: 1. You: 0.')).toBe(
      true
    )
    // The particles fly, land on the slope and roll over 1,000 u down before they show.
    simulate(game, 8)
    for (const zone of zones) expect(zone.shown).toBe(zone.count + zone.pile)
    healthy(game)
  })
})

describe('rain', () => {
  it('fills the pot while you carry it, stops when you set it down, and the lid keeps it out', () => {
    const game = hill()
    simulate(game, 10)
    expect(game.pot.water).toBeCloseTo(10 * RAIN_RATE, 1)
    setDown(game)
    expect(
      game.fx.captions.some(c => c.text === 'Of course it stops now.')
    ).toBe(true)
    simulate(game, 10)
    expect(game.pot.water).toBeCloseTo(10 * RAIN_RATE, 1)
    const lid = hill()
    devOwn(lid, 'lid')
    simulate(lid, 10)
    expect(lid.pot.water).toBe(0)
  })

  it('floats beans out once the water passes the brim, blaming the rain', () => {
    const game = hill()
    devRain(game, 11)
    simulate(game, 3)
    expect(game.counts.pot).toBeLessThan(10_000 - 6)
    expect(game.spill.cause).toBe('rain')
    healthy(game)
  })
})

describe('Pour Off', () => {
  it('pours part of the water early, all of it in the green, and beans too past it', () => {
    expect(pourResult(0.275)).toEqual({ share: 0.5, beans: 0 })
    expect(pourResult(0.55)).toEqual({ share: 1, beans: 0 })
    expect(pourResult(0.8)).toEqual({ share: 1, beans: 0 })
    expect(pourResult(0.9).beans).toBe(60)
    expect(pourResult(1).beans).toBe(POUR_BEANS_MAX)
  })

  /** Sets the pot down with `water` u of rain in it and holds Pour Off for `ms`. */
  function pour(water: number, ms: number): Game {
    const game = hill()
    devRain(game, water)
    setDown(game)
    expect(game.scene).toBe('grounded')
    expect(startPour(game)).toBe(true)
    for (let t = 0; t < ms; t += STEP_MS) updatePour(game, STEP_MS)
    endPour(game)
    return game
  }

  it('empties the pot when you let go in the green, and only on the ground', () => {
    const game = pour(5, POUR_FILL_MS * 0.65)
    expect(game.pot.water).toBe(0)
    expect(game.counts.pot).toBe(10_000)
    expect(game.weather.pouring).toBe(false)
    const early = pour(4, POUR_FILL_MS * 0.275)
    expect(early.pot.water).toBeCloseTo(2, 1)
    // Carrying it, there is nothing to pour from.
    pickUp(early)
    expect(startPour(early)).toBe(false)
  })

  it('tells you to pour away from spilled beans, since Pickup cannot pour', () => {
    const game = hill()
    devRain(game, 4)
    devSpill(game, 10)
    expect(weatherPrompt(game, false, true)).toBe(
      'Rain is filling the pot. Pour it off away from the spilled beans.'
    )
    setDown(game)
    expect(game.scene).toBe('pickup')
    expect(startPour(game)).toBe(false)
    expect(game.fx.captions.at(-1)?.text).toBe('Not by the beans.')
    expect(game.pot.water).toBe(4)
  })

  it('pours beans into seed packets when you hold too long', () => {
    const game = pour(5, POUR_FILL_MS * 1.2)
    expect(game.pot.water).toBe(0)
    expect(game.counts.packets).toBe(POUR_BEANS_MAX)
    expect(game.packets.list[0]!.cause).toBe('pour')
    healthy(game)
  })
})

describe('gusts', () => {
  it('warn 1.2s ahead, then push the pot and spill beans you do not lean against', () => {
    const game = hill(3_000)
    expect(devGust(game)).toBe(true)
    simulate(game, (GUST_WARN_MS - 100) / 1000)
    expect(game.weather.gust.phase).toBe('warn')
    expect(game.counts.pot).toBe(10_000)
    simulate(game, 0.2)
    expect(game.weather.gust.phase).toBe('blow')
    simulate(game, 2.5)
    const lost = 10_000 - game.counts.pot
    expect(lost).toBeGreaterThan(20)
    expect(game.lastKick?.cause).toBe('gust')
  })

  it('spill far less when you lean into them as they hit', () => {
    const game = hill(3_000)
    devGust(game)
    simulate(game, 4, (input, g) => {
      // Holds the pot against the wind's drift and with the beans' tilt.
      const want = g.pot.sigma * 0.8 - g.pot.drift
      input.tilt.absolute = want / (40 * DEG)
    })
    expect(10_000 - game.counts.pot).toBeLessThan(5)
  })
})

describe('hill Pickup', () => {
  it('lets resting beans creep downhill at about 6 u/s', () => {
    const game = hill(1_400)
    devRain(game, -1)
    emitBeans(game, 12, 1, 0)
    simulate(game, 3)
    game.walker.x = game.zones.list[0]!.anchorX - 60
    setDown(game)
    expect(game.scene).toBe('pickup')
    const world = game.pickup.world!
    for (const [i, body] of world.beans.entries()) {
      Matter.Body.setPosition(body, { x: 300 + (i % 4) * 30, y: 300 + i * 18 })
      Matter.Body.setVelocity(body, { x: 0, y: 0 })
    }
    const before = world.beans.map(b => b.position.x)
    simulate(game, 4)
    const moved = world.beans.map((b, i) => before[i]! - b.position.x)
    for (const d of moved) {
      expect(d).toBeGreaterThan(15)
      expect(d).toBeLessThan(30)
    }
  })
})
