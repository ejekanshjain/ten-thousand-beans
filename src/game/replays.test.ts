import { describe, expect, it } from 'vitest'

import { emitBeans } from './emit'
import { setDown, tipOver, updateGame, type Game } from './game'
import { formatRunTime, type ReplayRequest } from './replays'
import { idleInput, STEP_MS, testGame } from './testing'
import { REPLAY_SETTLE_MS } from './tuning'

/** Steps the game for `seconds`, collecting replay cuts and when each happened. */
function run(game: Game, seconds: number) {
  const input = idleInput()
  const cuts: { replay: ReplayRequest; ms: number; flying: number }[] = []
  for (let ms = 0; ms < seconds * 1000; ms += STEP_MS) {
    updateGame(game, STEP_MS, input)
    for (const event of game.out)
      if (event.type === 'replay')
        cuts.push({
          replay: event.replay,
          ms,
          flying: game.fx.particles.alive
        })
    game.out.length = 0
  }
  return cuts
}

/** Spills `n` beans over the front rim and lets the spill play out. */
function spill(game: Game, n: number) {
  emitBeans(game, n, 1, 10)
  return run(game, 4)
}

describe('fail replays', () => {
  it('skips spills too small to see', () => {
    expect(spill(testGame(), 2)).toEqual([])
  })

  it('cuts the clip a second after the last bean lands', () => {
    const game = testGame()
    emitBeans(game, 12, 1, 10)
    let landedAt = -1
    const input = idleInput()
    let cutAt = -1
    for (let ms = 0; ms < 4000 && cutAt < 0; ms += STEP_MS) {
      updateGame(game, STEP_MS, input)
      if (landedAt < 0 && game.fx.particles.alive === 0) landedAt = ms
      if (game.out.some(e => e.type === 'replay')) cutAt = ms
      game.out.length = 0
    }
    expect(landedAt).toBeGreaterThan(0)
    expect(cutAt - landedAt).toBeGreaterThanOrEqual(REPLAY_SETTLE_MS - 20)
    expect(cutAt - landedAt).toBeLessThan(REPLAY_SETTLE_MS + 700)
  })

  it('opens a new biggest spill by itself from 30 beans, and offers Share from 100', () => {
    const game = testGame()
    const [small] = spill(game, 12)
    expect(small?.replay).toMatchObject({ auto: false, share: false })
    expect(small?.replay.label).toMatch(/^12 beans (at once\.|in \d\.\ds)$/)
    const [big] = spill(game, 40)
    expect(big?.replay).toMatchObject({ auto: true, share: false })
    const [smaller] = spill(game, 35)
    expect(smaller?.replay).toMatchObject({ auto: false, biggest: false })
    const [huge] = spill(game, 120)
    expect(huge?.replay).toMatchObject({ auto: true, share: true })
  })

  it('opens a tip-over by itself with Share, even mid-spill', () => {
    const game = testGame()
    emitBeans(game, 5, 1, 10)
    tipOver(game)
    const [cut] = run(game, 5)
    expect(cut?.replay).toMatchObject({ cause: 'tip', auto: true, share: true })
    expect(cut?.replay.label).toBe('605 beans at once.')
    expect(cut?.replay.blame).toMatch(/^Tipped it\. Grandma/)
  })

  it('cuts at once when you set the pot down', () => {
    const game = testGame()
    emitBeans(game, 8, 1, 10)
    run(game, 0.8)
    setDown(game)
    const cuts = run(game, 0.1)
    expect(cuts).toHaveLength(1)
  })

  it('formats run times for the doorstep caption', () => {
    expect(formatRunTime(65_000)).toBe('1:05')
    expect(formatRunTime(3_761_000)).toBe('1:02:41')
  })
})
