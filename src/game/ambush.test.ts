import { describe, expect, it } from 'vitest'

import {
  ambushTrigger,
  devAmbush,
  inAmbushReach,
  type AmbushKind
} from './ambush'
import { POT_OFFSET_X } from './fx'
import { createGame, enterStretch, setDown, type Game } from './game'
import { LINES } from './gossip'
import { defineStretch } from './route'
import { simulate } from './testing'
import { DODGE_COINS, GOSSIP_MARGIN } from './tuning'

/** A plain stretch with one ambush at x 1,000, carrying the pot from x 500 with one line found. */
function ambushGame(kind: AmbushKind = 'pryce'): Game {
  const def = defineStretch({
    id: 'street',
    name: 'Ambush Street',
    length: 4_000,
    gossipSlots: 2,
    ambush: [kind, 1_000]
  })
  const game = createGame(1, [def])
  enterStretch(game, 0)
  game.walker.x = 500
  game.gossip.started = 1
  game.gossip.status[0] = 'found'
  return game
}

/** Strolls until the shout, then `lateS` seconds later does `then` until the ambush settles. */
function meet(game: Game, then: 'stroll' | 'stop' | 'hurry', lateS = 0): void {
  let since = -1
  simulate(game, 12, (input, g) => {
    if (since < 0 && g.ambush!.phase === 'warn') since = 0
    if (since >= 0) since += 1 / 60
    const act = since > lateS
    input.walk.walk = act && then === 'stop' ? 0 : 1
    input.walk.hurry = act && then === 'hurry' ? 1 : 0
  })
}

describe('ambushes', () => {
  it('burst out once the pot is already inside their reach', () => {
    const game = ambushGame()
    const a = game.ambush!
    let potAtShout = 0
    simulate(game, 10, (input, g) => {
      input.walk.walk = a.phase === 'warn' ? 0 : 1
      if (a.phase === 'warn' && potAtShout === 0)
        potAtShout = g.walker.x + POT_OFFSET_X
    })
    expect(potAtShout).toBeGreaterThanOrEqual(ambushTrigger(a))
    expect(inAmbushReach(a, potAtShout)).toBe(true)
  })

  it('grab a strolling pot and throw enough beans for the next gossip line', () => {
    const game = ambushGame()
    meet(game, 'stroll')
    expect(game.ambush!.hit).toBe(true)
    expect(game.lastKick?.cause).toBe('pryce')
    expect(game.stats.spilled).toBeGreaterThanOrEqual(
      LINES[1]!.need + GOSSIP_MARGIN
    )
  })

  it('still grab you when you stop, the way you stop for everyone else', () => {
    const game = ambushGame('sale')
    meet(game, 'stop')
    expect(game.ambush!.hit).toBe(true)
    expect(game.lastKick?.cause).toBe('sale')
  })

  it('miss you when you hurry from the shout, and pay the dodge', () => {
    const game = ambushGame('bruno')
    meet(game, 'hurry')
    expect(game.ambush!.hit).toBe(false)
    expect(game.wallet.coins()).toBe(DODGE_COINS)
    expect(game.scores.get('bruno')).toEqual({ them: 0, you: 1 })
  })

  it('give a player who reacts in 0.4s time to hurry clear, but not one who takes 0.8s', () => {
    const quick = ambushGame()
    meet(quick, 'hurry', 0.4)
    expect(quick.ambush!.hit).toBe(false)
    const slow = ambushGame()
    meet(slow, 'hurry', 0.8)
    expect(slow.ambush!.hit).toBe(true)
  })

  it('refuse Set Down from the shout until the lunge lands, so only hurrying escapes', () => {
    const game = ambushGame()
    expect(devAmbush(game)).toBe(true)
    expect(setDown(game)).toBe(false)
    expect(game.scene).toBe('walk')
    expect(game.fx.captions.map(c => c.text)).toContain('No time!')
    simulate(game, 3, (_input, g) => void setDown(g))
    expect(game.ambush!.hit).toBe(true)
    expect(game.stats.spilled).toBeGreaterThan(0)
  })
})
