import Matter from 'matter-js'
import { describe, expect, it } from 'vitest'

import { POT_OFFSET_X } from './fx'
import { createGame, devSpill, enterStretch, setDown, type Game } from './game'
import { clearCrossing, devShopper, spoonOut } from './market'
import { ROUTE } from './route'
import { simulate } from './testing'
import {
  DODGE_COINS,
  LADDER_SPLASH,
  SCUFF_MAX,
  SCUFF_MIN,
  SHOPPER_LEAD_MS,
  SPOON_CYCLE_MS,
  SPOON_OUT_MS
} from './tuning'

const MARKET = ROUTE[2]!

/** The market with your pot `gap` u short of route x `x`, and no shopper coming unless asked. */
function before(x: number, gap: number): Game {
  const game = createGame(1, ROUTE)
  enterStretch(game, 2)
  game.walker.x = x - gap - POT_OFFSET_X
  game.market.nextShopperAt = Infinity
  return game
}

/** Every caption seen while a drive runs. */
function seen(game: Game, into: Set<string>) {
  for (const c of game.fx.captions) {
    into.add(`${c.text} ${c.sub}`.trim())
    if (c.score) into.add(c.score)
  }
}

describe('market rhythms', () => {
  it('only call a crossing clear when it fits inside one gap', () => {
    expect(clearCrossing(1_500, 3_000, 1_200, 0, 1_000)).toBe(true)
    expect(clearCrossing(2_500, 3_000, 1_200, 0, 1_000)).toBe(false)
    expect(clearCrossing(0, 3_000, 1_200, 1_300, 2_900)).toBe(true)
    expect(clearCrossing(0, 3_000, 1_200, 500, 1_500)).toBe(false)
  })
})

describe('tasting spoons', () => {
  const stall = MARKET.stalls[0]!

  it('poke out 1.2s of every 3s', () => {
    const s = {
      x: 0,
      offset: 0,
      inReach: false,
      poked: false,
      enteredFrom: -1,
      paid: false
    }
    expect(spoonOut(s, 0)).toBe(true)
    expect(spoonOut(s, SPOON_OUT_MS - 1)).toBe(true)
    expect(spoonOut(s, SPOON_OUT_MS)).toBe(false)
    expect(spoonOut(s, SPOON_CYCLE_MS)).toBe(true)
  })

  it('poke a pot that walks into the reach while the spoon is out', () => {
    const game = before(stall, 120)
    const captions = new Set<string>()
    simulate(game, 5, (input, g) => {
      input.walk.walk = 1
      // Hold the spoon out the whole way.
      g.market.stalls[0]!.offset =
        SPOON_CYCLE_MS - (g.market.ms % SPOON_CYCLE_MS)
      seen(g, captions)
    })
    expect(game.market.stalls[0]!.poked).toBe(true)
    expect(game.wallet.coins()).toBe(0)
  })

  it('pay a dodge for passing while the spoon is pulled back', () => {
    const game = before(stall, 120)
    const captions = new Set<string>()
    simulate(game, 5, (input, g) => {
      input.walk.walk = 1
      for (const s of g.market.stalls)
        s.offset =
          SPOON_CYCLE_MS + SPOON_OUT_MS + 300 - (g.market.ms % SPOON_CYCLE_MS)
      seen(g, captions)
    })
    expect(game.counts.pot).toBe(10_000)
    expect(captions).toContain(`No chutney, thanks. +${DODGE_COINS} coins`)

    // Walking back and forth through the gap pays nothing more.
    const coins = game.wallet.coins()
    const between = (g: Game) => {
      for (const s of g.market.stalls)
        s.offset =
          SPOON_CYCLE_MS + SPOON_OUT_MS + 300 - (g.market.ms % SPOON_CYCLE_MS)
    }
    simulate(game, 4, (input, g) => {
      input.walk.walk = -1
      between(g)
    })
    simulate(game, 4, (input, g) => {
      input.walk.walk = 1
      between(g)
    })
    expect(game.wallet.coins()).toBe(coins)
  })
})

describe('the ladder', () => {
  const ladder = MARKET.ladder!

  it('throws at least 100 beans back when you cross during a swing', () => {
    const game = before(ladder, 120)
    const captions = new Set<string>()
    simulate(game, 5, (input, g) => {
      input.walk.walk = 1
      g.market.ms = 0
      seen(g, captions)
    })
    expect(game.scores.get('ladder')).toEqual({ them: 1, you: 0 })
    expect(10_000 - game.counts.pot).toBeGreaterThanOrEqual(LADDER_SPLASH)
    expect(captions).toContain('Ladder: 1. You: 0.')
    expect([...captions].some(c => c.startsWith('Ladder to the pot.'))).toBe(
      true
    )
  })

  it('lets you past for 2 coins while it points away', () => {
    const game = before(ladder, 120)
    const captions = new Set<string>()
    simulate(game, 5, (input, g) => {
      input.walk.walk = 1
      g.market.ms = 2_000
      seen(g, captions)
    })
    expect(game.counts.pot).toBe(10_000)
    expect(game.scores.get('ladder')).toEqual({ them: 0, you: 1 })
    expect(captions).toContain(`Not today, ladder man. +${DODGE_COINS} coins`)
  })
})

describe('shoppers', () => {
  it('say "Excuse me!" 2s ahead and bump a pot that keeps walking', () => {
    const game = before(1_200, 0)
    simulate(game, 1, input => void (input.walk.walk = 1))
    expect(devShopper(game)).toBe(true)
    expect(game.market.shopper?.says).toBe('Excuse me!')
    let metAt = -1
    const start = game.timeMs
    simulate(game, 3, (input, g) => {
      input.walk.walk = 1
      if (metAt < 0 && g.market.shopper?.phase === 'past') metAt = g.timeMs
    })
    expect(metAt - start).toBeCloseTo(SHOPPER_LEAD_MS, -2)
    expect(game.market.shopper!.bumped).toBe(true)
    expect(game.wallet.coins()).toBe(0)
  })

  it('come with forward progress, so standing still brings none', () => {
    const game = before(1_200, 0)
    game.market.nextShopperAt = game.walker.x + POT_OFFSET_X + 100
    simulate(game, 20)
    expect(game.market.shoppers).toBe(0)
    simulate(game, 3, input => void (input.walk.walk = 1))
    expect(game.market.shoppers).toBe(1)
  })

  it('squeeze past a pot that stops, for 2 coins', () => {
    const game = before(1_700, 0)
    devShopper(game)
    simulate(game, 3)
    expect(game.counts.pot).toBe(10_000)
    expect(game.wallet.coins()).toBe(DODGE_COINS)
  })
})

describe("shoppers' feet in Pickup", () => {
  it('scuff each bean in their path 40 to 80 u along their way', () => {
    const game = before(1_200, 0)
    devSpill(game, 40)
    setDown(game)
    const world = game.pickup.world!
    simulate(game, 1)
    const feet = game.market.feet
    feet.waitMs = 0
    simulate(game, 1 / 60)
    expect(feet.active).toBe(true)
    // Put one bean right on the path, ahead of the feet.
    const bean = world.beans[0]!
    const startX = feet.x + feet.dir * 120
    world.push(bean, 0, 0)
    Matter.Body.setPosition(bean, { x: startX, y: feet.y })
    const positions = new Map<number, number>()
    simulate(game, 4, () => {
      if (feet.scuffed.has(bean.id) && !positions.has(bean.id))
        positions.set(bean.id, bean.position.x)
    })
    expect(feet.scuffed.has(bean.id)).toBe(true)
    const moved = (bean.position.x - positions.get(bean.id)!) * feet.dir
    expect(moved).toBeGreaterThan(SCUFF_MIN * 0.7)
    expect(moved).toBeLessThan(SCUFF_MAX * 1.3)
  })
})
