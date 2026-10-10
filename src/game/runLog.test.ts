import { describe, expect, it } from 'vitest'

import {
  createGame,
  devKiosk,
  devPickUpAll,
  devSpill,
  enterStretch,
  setDown
} from './game'
import { devGiveGossip } from './gossipFlow'
import { dodged } from './hits'
import { sellPage } from './kiosk'
import { replayLabel } from './replays'
import { ROUTE } from './route'
import {
  reportText,
  runReport,
  startTrial,
  stretchLog,
  trialResult
} from './runLog'
import { simulate, testGame } from './testing'

describe('the run log', () => {
  it('splits played time by stretch and scene, and mirrors the stretch’s spills', () => {
    const game = createGame(1, ROUTE)
    enterStretch(game, 1)
    simulate(game, 2, input => void (input.walk.walk = 1))
    setDown(game)
    expect(game.scene).toBe('grounded')
    simulate(game, 1)
    enterStretch(game, 2)
    simulate(game, 0.5)
    const [kitchen, street, market] = game.stats.stretches
    expect(kitchen?.ms.walk).toBe(0)
    expect(street?.ms.walk).toBeCloseTo(2_000, -1)
    expect(street?.ms.grounded).toBeCloseTo(1_000, -1)
    expect(market?.ms.walk).toBeCloseTo(500, -1)
    expect(game.stats.playedMs).toBeCloseTo(3_500, -1)

    game.stretchSpilled = 12
    simulate(game, 0.1)
    expect(stretchLog(game).spilled).toBe(12)
    expect(street?.spilled).toBe(0)
  })

  it('reports the pickup share and the seconds per bean potted', () => {
    const game = testGame()
    simulate(game, 4, input => void (input.walk.walk = 1))
    devSpill(game, 10)
    setDown(game)
    expect(game.scene).toBe('pickup')
    simulate(game, 6)
    stretchLog(game).pickedUp = 4
    const report = runReport(game, game.stats.startedAt + 60_000)
    expect(report.pickupShare).toBeCloseTo(0.6, 2)
    expect(report.secondsPerBean).toBeCloseTo(1.5, 1)
    expect(report.stretches[0]?.pickup).toBeCloseTo(0.1, 2)
    expect(report.played).toBeCloseTo(10 / 60, 2)
    expect(report.wall).toBe(1)
  })

  it('splits coins into dodges, clean bonuses and pages', () => {
    const game = createGame(1, ROUTE)
    enterStretch(game, 1)
    dodged(game, 'cyclist', 'Dodged a bike')
    expect(devKiosk(game)).toBe(true)
    devGiveGossip(game, 1)
    expect(sellPage(game, 0)).toBe(true)
    const { coins } = runReport(game, Date.now())
    expect(coins.dodges).toBe(15)
    expect(coins.bonuses).toBe(90)
    expect(coins.pages).toBe(126)
    expect(coins.left).toBe(231)
  })

  it('times the doorstep replay by play, not by time spent in menus', () => {
    const game = testGame()
    // An hour sat in Settings and the Notebook doesn't count.
    game.stats.startedAt = Date.now() - 3_600_000
    simulate(game, 65.5)
    expect(replayLabel(game, 9_999, 'doorstep', 0)).toBe(
      'Carried for 1:05. So close.'
    )
  })

  it('times a pickup from its spill until no bean lies behind', () => {
    const game = testGame()
    simulate(game, 4, input => void (input.walk.walk = 1))
    // Pickup time and beans from before the trial don't count.
    stretchLog(game).ms.pickup = 9_000
    stretchLog(game).pickedUp = 7
    const trial = startTrial(game)
    devSpill(game, 50)
    setDown(game)
    simulate(game, 30)
    expect(trialResult(game, trial)).toBeNull()
    stretchLog(game).pickedUp += 50
    devPickUpAll(game)
    expect(trialResult(game, trial)).toEqual({
      beans: 50,
      seconds: 30,
      secondsPerBean: 0.6
    })
  })

  it('writes the report as short lines that fit a phone', () => {
    const game = createGame(1, ROUTE)
    enterStretch(game, 1)
    simulate(game, 60)
    const text = reportText(runReport(game, game.stats.startedAt + 90_000), [
      { beans: 50, seconds: 72, secondsPerBean: 1.44 }
    ])
    expect(text).toContain('Played 1.0 min, wall clock 1.5 min.')
    expect(text).toContain('Pickup 0% of play, no beans potted.')
    expect(text).toContain('The Street: 1.0 min')
    expect(text).toContain('  50 beans in 72.0s, 1.44s a bean')
    for (const line of text.split('\n')) expect(line.length).toBeLessThan(44)
  })
})
