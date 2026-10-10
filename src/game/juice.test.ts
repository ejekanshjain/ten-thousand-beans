import { afterEach, describe, expect, it } from 'vitest'

import { settings } from '../shared'
import { emitBeans, landed } from './emit'
import {
  addCaption,
  LAND_GROUND,
  LAND_RIVER,
  MAX_CAPTIONS,
  RIPPLE_MS,
  type Caption
} from './fx'
import { updateGame } from './game'
import { total } from './ledger'
import { groundKick } from './terrain'
import { idleInput, STEP_MS, testGame } from './testing'
import { MAX_PARTICLES, SLOW_SCALE } from './tuning'

afterEach(() => settings.set({ reducedMotion: false }))

function note(text: string): Omit<Caption, 'ageMs'> {
  return {
    text,
    sub: '',
    score: '',
    key: '',
    tone: 'info',
    lifeMs: 2000,
    world: false,
    x: 0,
    y: 0
  }
}

describe('juice', () => {
  it('slows a big spill down, unless Reduced Motion is on', () => {
    for (const reduced of [false, true]) {
      settings.set({ reducedMotion: reduced })
      const game = testGame()
      emitBeans(game, 40, 1, 10)
      const before = game.timeMs
      updateGame(game, STEP_MS, idleInput())
      expect(game.timeMs - before).toBeCloseTo(
        reduced ? STEP_MS : STEP_MS * SLOW_SCALE
      )
    }
  })

  it('buzzes the phone on every ground kick, longer for bigger ones', () => {
    const game = testGame()
    const buzzes = () =>
      game.out.flatMap(e => (e.type === 'vibrate' ? [e.ms] : []))
    groundKick(game, 'cobbles', 1, 0.3)
    groundKick(game, 'pothole', 1, 0.3)
    groundKick(game, 'pothole', 1, 1.5)
    expect(buzzes()).toEqual([8, 15, 30])
  })

  it('keeps at most 3 captions, dropping the oldest', () => {
    const list: Caption[] = []
    for (const text of ['a', 'b', 'c', 'd', 'e']) addCaption(list, note(text))
    expect(list.map(c => c.text)).toEqual(['c', 'd', 'e'])
    expect(MAX_CAPTIONS).toBe(3)
  })

  it('ripples where a bean drops into the river, not on the ground', () => {
    const game = testGame()
    landed(game, 1, LAND_GROUND, 100, 640)
    expect(game.fx.ripples.ms.filter(ms => ms < RIPPLE_MS).length).toBe(0)
    landed(game, -1, LAND_RIVER, 120, 700)
    expect(game.fx.ripples.ms.filter(ms => ms < RIPPLE_MS).length).toBe(1)
    game.fx.ripples.step(RIPPLE_MS)
    expect(game.fx.ripples.ms.filter(ms => ms < RIPPLE_MS).length).toBe(0)
  })

  it('caps walk-view particles at 160, landing the rest at once', () => {
    const game = testGame()
    emitBeans(game, 300, 1, 30)
    expect(MAX_PARTICLES).toBe(160)
    expect(game.fx.particles.alive).toBe(MAX_PARTICLES)
    expect(game.counts.pot).toBe(9_700)
    expect(total(game.counts)).toBe(10_000)
  })
})
