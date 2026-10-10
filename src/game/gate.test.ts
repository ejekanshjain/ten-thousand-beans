import { describe, expect, it } from 'vitest'

import { devPickUpAll, devSpill } from './game'
import { gateX, LEAVE_STRETCH, PICK_UP_CHORE } from './gate'
import { simulate, testGame } from './testing'
import { GATE_STOP } from './tuning'

describe('the exit gate', () => {
  it('holds you back with a chore and a caption while beans lie behind', () => {
    const game = testGame()
    devSpill(game, 12)
    simulate(game, 0.1)
    expect(game.chores.has(PICK_UP_CHORE)).toBe(true)
    expect(game.chores.canDo(LEAVE_STRETCH)).toBe(false)
    game.walker.x = gateX(game) - 200
    simulate(game, 6, input => void (input.walk.walk = 1))
    expect(game.walker.x).toBe(gateX(game) - GATE_STOP)
    const texts = game.fx.captions.map(c => c.text)
    expect(texts).toContain('12 beans are still back there.')
  })

  it('opens once every bean is back and lets you through', () => {
    const game = testGame()
    devSpill(game, 12)
    simulate(game, 0.1)
    devPickUpAll(game)
    game.scene = 'walk'
    simulate(game, 0.1)
    expect(game.chores.list()).toHaveLength(0)
    game.walker.x = gateX(game) - 200
    simulate(game, 6, input => void (input.walk.walk = 1))
    expect(game.walker.x).toBeGreaterThan(gateX(game))
    expect(game.gate.passed).toBe(true)
  })
})
