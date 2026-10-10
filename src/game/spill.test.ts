import { describe, expect, it } from 'vitest'

import { devTeeter, setDown } from './game'
import {
  causeFor,
  closeSpillIfQuiet,
  createSpillEvent,
  grandmaLine,
  grandmaTier,
  noteSpill,
  spillHeadline,
  type CauseContext
} from './spill'
import { simulate, testGame } from './testing'
import { TIP_PILE } from './tuning'
import { DEG } from './units'

const calm: CauseContext = {
  now: 10_000,
  lastKick: null,
  psi: 0,
  side: 1,
  v: 80,
  ax: 0
}

describe('spill causes', () => {
  it('blames a recent kick first, then a tilt toward the spilling rim, then hurrying, then a hard start', () => {
    expect(causeFor({ ...calm, lastKick: { cause: 'cat', at: 9_000 } })).toBe(
      'cat'
    )
    expect(causeFor({ ...calm, lastKick: { cause: 'cat', at: 8_000 } })).toBe(
      'slosh'
    )
    expect(causeFor({ ...calm, psi: 12 * DEG, side: 1 })).toBe('tilt')
    expect(causeFor({ ...calm, psi: 12 * DEG, side: -1 })).toBe('slosh')
    expect(causeFor({ ...calm, v: 150 })).toBe('hurry')
    expect(causeFor({ ...calm, ax: 200 })).toBe('start')
  })

  it('names the cause and the count in the headline', () => {
    expect(spillHeadline('Hurried.', 14)).toBe('Hurried. 14 beans.')
    expect(spillHeadline('Tilted too far.', 1)).toBe('Tilted too far. 1 bean.')
  })

  it('tiers Grandma by spill size and never repeats a line twice in a row', () => {
    expect(grandmaTier('hurry', 3)).toBe('tiny')
    expect(grandmaTier('hurry', 12)).toBe('small')
    expect(grandmaTier('hurry', 30)).toBe('big')
    expect(grandmaTier('hurry', 140)).toBe('huge')
    expect(grandmaTier('tip', 3)).toBe('tip')
    const game = testGame(3)
    let last = ''
    for (let i = 0; i < 50; i++) {
      const line = grandmaLine(game, 'big')
      expect(line).not.toBe(last)
      last = line
    }
  })
})

describe('spill events', () => {
  it('groups beans until a 0.6s gap and turns big once at 30', () => {
    const event = createSpillEvent()
    const first = noteSpill(event, 20, 1, 0, () => 'hurry')
    expect(first).toEqual({ started: true, turnedBig: false })
    expect(noteSpill(event, 15, 1, 500, () => 'other').turnedBig).toBe(true)
    expect(noteSpill(event, 15, 1, 900, () => 'other').turnedBig).toBe(false)
    expect(closeSpillIfQuiet(event, 1_400)).toBeNull()
    expect(closeSpillIfQuiet(event, 1_500)).toEqual({
      count: 50,
      cause: 'hurry',
      durationMs: 900
    })
    expect(event.active).toBe(false)
  })

  it('captions a finished spill with its cause', () => {
    const game = testGame()
    simulate(game, 1, input => void (input.tilt.rate = 1))
    // Held keys speed up to 75°/s, so about half a second brings 40° back near level.
    simulate(game, 0.55, input => void (input.tilt.rate = -1))
    simulate(game, 2)
    const texts = game.fx.captions.map(c => c.text)
    expect(texts.some(text => text.startsWith('Tilted too far.'))).toBe(true)
  })
})

describe('setting the pot down', () => {
  it('is refused while beans pour over the rim, and works once they stop', () => {
    const game = testGame()
    simulate(game, 1, input => void (input.tilt.rate = 1))
    expect(game.spill.active).toBe(true)
    expect(setDown(game)).toBe(false)
    expect(game.scene).toBe('walk')
    expect(game.fx.captions.map(c => c.text)).toContain('Not mid-spill!')
    simulate(game, 1, input => void (input.tilt.absolute = 0))
    expect(setDown(game)).toBe(true)
    expect(game.scene).toBe('pickup')
  })

  it('is refused while the pot teeters, so only a counter-tilt saves it', () => {
    const game = testGame()
    devTeeter(game)
    expect(setDown(game)).toBe(false)
    simulate(game, 1, (_input, g) => void setDown(g))
    expect(game.counts.pile).toBe(TIP_PILE)
  })

  it('lets a flooded pot down, since pouring off is the only fix', () => {
    const game = testGame()
    game.pot.water = 30
    simulate(game, 1)
    expect(game.spill.active).toBe(true)
    expect(setDown(game)).toBe(true)
  })
})
