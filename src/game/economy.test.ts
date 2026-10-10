import { describe, expect, it } from 'vitest'

import { cleanBonus, UPGRADES } from './economy'
import { createGame, enterStretch, leaveKiosk, type Game } from './game'
import { LEAVE_STRETCH } from './gate'
import { LINES } from './gossip'
import { openKiosk, sellPage } from './kiosk'
import { ROUTE } from './route'
import { simulate } from './testing'
import { CLEAN_BONUS } from './tuning'

/** A run standing at the end of stretch `index` with its gate open. */
function atStretchEnd(index: number, spilled = 0): Game {
  const game = createGame(1, ROUTE)
  enterStretch(game, index)
  game.stretchSpilled = spilled
  game.walker.x = ROUTE[index]!.length - 120
  return game
}

describe('coins', () => {
  it('pay the clean bonus in full up to 5 beans, half up to 25, then nothing', () => {
    expect(cleanBonus('street', 0)).toBe(30)
    expect(cleanBonus('street', 5)).toBe(30)
    expect(cleanBonus('street', 6)).toBe(15)
    expect(cleanBonus('street', 25)).toBe(15)
    expect(cleanBonus('street', 26)).toBe(0)
    expect(cleanBonus('kitchen', 3)).toBe(20)
    expect(cleanBonus('bridge', 10)).toBe(30)
    expect(cleanBonus('door', 0)).toBe(30)
    expect(Object.values(CLEAN_BONUS)).toEqual([20, 30, 40, 40, 50, 60, 30])
  })

  it('price the twelve gossip pages at 672 coins and the six upgrades at 720', () => {
    expect(LINES.reduce((sum, line) => sum + line.price, 0)).toBe(672)
    // The funniest page pays the most, from 34 to 78.
    expect(LINES.map(line => line.price).sort((a, b) => a - b)[0]).toBe(34)
    expect(LINES.find(line => line.rank === 1)?.price).toBe(78)
    expect(UPGRADES.reduce((sum, u) => sum + u.cost, 0)).toBe(720)
  })
})

describe('the kiosk', () => {
  it('opens when you walk off a cleared stretch and pays its clean bonus', () => {
    const game = atStretchEnd(1, 4)
    simulate(game, 3, input => void (input.walk.walk = 1))
    expect(game.scene).toBe('kiosk')
    expect(game.wallet.coins()).toBe(30)
    expect(game.kiosk?.summary).toEqual({
      cleared: 'The Street',
      next: 'The Market',
      spilled: 4,
      bonus: 30,
      full: 30
    })
  })

  it('counts every spill on the stretch toward the bonus', () => {
    const game = createGame(1, ROUTE)
    enterStretch(game, 1)
    game.walker.x = 3_000
    game.walker.v = 170
    simulate(game, 4, input => {
      input.walk.walk = 1
      input.walk.hurry = 1
    })
    expect(game.stretchSpilled).toBe(game.stats.spilled)
    expect(game.stretchSpilled).toBeGreaterThan(25)
    openKiosk(game)
    expect(game.kiosk?.summary.bonus).toBe(0)
  })

  it('buys jotted pages at their table price, once each', () => {
    const game = atStretchEnd(0)
    game.gossip.status[0] = 'found'
    game.gossip.status[3] = 'found'
    expect(sellPage(game, 0)).toBe(false)
    openKiosk(game)
    const before = game.wallet.coins()
    expect(sellPage(game, 3)).toBe(true)
    expect(game.wallet.coins() - before).toBe(LINES[3]!.price)
    expect(game.gossip.status[3]).toBe('sold')
    expect(game.kiosk?.says).toBe(LINES[3]!.quip)
    expect(sellPage(game, 3)).toBe(false)
    expect(sellPage(game, 5)).toBe(false)
    expect(game.out.some(e => e.type === 'sound' && e.name === 'coin')).toBe(
      true
    )
  })

  it('holds you while a chore blocks leaving, then leads on to the next stretch', () => {
    const game = atStretchEnd(2)
    openKiosk(game)
    game.chores.add({
      id: 'mud',
      label: 'Clean the mud',
      blocks: [LEAVE_STRETCH]
    })
    expect(leaveKiosk(game)).toBe(false)
    expect(game.scene).toBe('kiosk')
    game.chores.complete('mud')
    expect(leaveKiosk(game)).toBe(true)
    expect(game.stretch).toBe(3)
    expect(game.scene).toBe('walk')
    expect(game.walker.carrying).toBe(true)
    expect(game.kiosk).toBeNull()
    expect(game.stretchSpilled).toBe(0)
  })
})
