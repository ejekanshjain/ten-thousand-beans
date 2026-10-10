import { describe, expect, it } from 'vitest'

import { kick } from './game'
import {
  createPot,
  DEFAULT_POT_OPTIONS,
  marginFor,
  OMEGA,
  overflowDepth,
  spillRate,
  steerPot,
  stepSurface,
  stepTip,
  weirRate
} from './slosh'
import { simulate, STEP_MS, testGame } from './testing'
import {
  AUTO_LEVEL_RATE,
  KEY_RAMP_S,
  KEY_TILT_RATE,
  KEY_TOP_RATE,
  LID_SPILL_RATE,
  MAX_SPILL_RATE,
  SLOSH_ZETA,
  TEETER_MS,
  TIP_HOLD_MS
} from './tuning'
import { DEG } from './units'

const dt = STEP_MS / 1000

describe('spilling', () => {
  it('starts at 9.1 degrees relative with a full pot', () => {
    const margin = marginFor(10_000, 0, DEFAULT_POT_OPTIONS)
    expect(margin).toBe(9)
    expect(overflowDepth(9.0 * DEG, margin)).toBeLessThan(0)
    expect(overflowDepth(9.2 * DEG, margin)).toBeGreaterThan(0)
  })

  it('follows the weir law at 15, 25 and 35 degrees', () => {
    const rate = (deg: number) => weirRate(overflowDepth(deg * DEG, 10))
    expect(rate(15)).toBeCloseTo(44.8, 0)
    expect(rate(25)).toBeCloseTo(258.7, 0)
    expect(rate(35)).toBeCloseTo(631.5, 0)
  })

  it('caps the rate, lower still with the Pot Lid', () => {
    expect(spillRate(30, DEFAULT_POT_OPTIONS)).toBe(MAX_SPILL_RATE)
    expect(spillRate(30, { ...DEFAULT_POT_OPTIONS, lid: true })).toBe(
      LID_SPILL_RATE
    )
  })

  it('never spills a level pot at rest', () => {
    expect(simulate(testGame(), 20)).toBe(0)
  })

  it('never spills on a stroll from rest, and spills about 7 beans a second at a long hurry', () => {
    expect(simulate(testGame(), 20, i => void (i.walk.walk = 1))).toBe(0)
    const hurried = simulate(testGame(), 10, i => {
      i.walk.walk = 1
      i.walk.hurry = 1
    })
    expect(hurried).toBeGreaterThan(40)
    expect(hurried).toBeLessThan(110)
  })

  it('spills only whole beans and never more than the pot holds', () => {
    const game = testGame()
    game.counts.pot = 40
    game.counts.packets = 9_960
    simulate(game, 4, i => void (i.tilt.rate = 1))
    expect(Number.isInteger(game.counts.pot)).toBe(true)
    expect(game.counts.pot).toBeGreaterThanOrEqual(0)
    expect(game.counts.pot + game.counts.loose + game.counts.pile).toBe(40)
  })
})

describe('the bean surface', () => {
  it('rocks with damping ratio zeta: each swing shrinks by exp(-zeta omega T)', () => {
    const pot = createPot()
    pot.sigmaVel = 1
    const peaks: number[] = []
    let previous = 0
    let rising = true
    for (let i = 0; i < 400; i++) {
      stepSurface(pot, 0, 0, DEFAULT_POT_OPTIONS, dt)
      const level = Math.abs(pot.sigma)
      if (rising && level < previous) peaks.push(previous)
      rising = level >= previous
      previous = level
    }
    const period = Math.PI / (OMEGA * Math.sqrt(1 - SLOSH_ZETA ** 2))
    const expected = Math.exp(-SLOSH_ZETA * OMEGA * period)
    expect(peaks[1]! / peaks[0]!).toBeCloseTo(expected, 1)
    expect(peaks[0]).toBeCloseTo((0.8 * 1) / OMEGA, 1)
  })

  it('spills less when a phone player follows the surface after a kick', () => {
    const untouched = testGame()
    kick(untouched, 'test', 4)
    const spilledAlone = simulate(untouched, 4)

    const followed = testGame()
    kick(followed, 'test', 4)
    const history: number[] = []
    const spilledFollowing = simulate(followed, 4, (input, game) => {
      // A player watching the beans, reacting 150 ms late, leading the swing a little.
      history.push(game.pot.sigma + game.pot.sigmaVel * 0.1)
      const seen = history[Math.max(0, history.length - 10)] ?? 0
      input.tilt.absolute = seen / (40 * DEG)
    })
    expect(spilledAlone).toBeGreaterThan(10)
    expect(spilledFollowing).toBeLessThan(spilledAlone)
  })
})

describe('tilt control', () => {
  it('turns at the key rate, holds on release, then eases back slowly', () => {
    const pot = createPot()
    for (let i = 0; i < 30; i++) steerPot(pot, { rate: 1, absolute: null }, dt)
    // 0.5s: the first 0.2s rises from 30 to 75°/s, then 0.3s at 75°/s.
    expect(pot.psiTarget / DEG).toBeCloseTo(
      ((KEY_TILT_RATE + KEY_TOP_RATE) / 2) * KEY_RAMP_S +
        KEY_TOP_RATE * (0.5 - KEY_RAMP_S),
      0
    )
    const held = pot.psiTarget
    for (let i = 0; i < 6; i++) steerPot(pot, { rate: 0, absolute: null }, dt)
    expect((held - pot.psiTarget) / DEG).toBeCloseTo(AUTO_LEVEL_RATE * 0.1, 1)
  })

  it('starts the key speed slow for taps, speeds up on a hold, and restarts on a turn back', () => {
    const press = { rate: 1, absolute: null }
    const pot = createPot()
    for (let i = 0; i < 6; i++) steerPot(pot, press, dt)
    // A 0.1s tap turns about 4°, against 3° at a steady 30°/s and 7.5° at 75°/s.
    expect(pot.psiTarget / DEG).toBeGreaterThan(3.5)
    expect(pot.psiTarget / DEG).toBeLessThan(4.5)
    for (let i = 0; i < 12; i++) steerPot(pot, press, dt)
    let before = pot.psiTarget
    steerPot(pot, press, dt)
    expect((pot.psiTarget - before) / DEG / dt).toBeCloseTo(KEY_TOP_RATE, 5)
    before = pot.psiTarget
    steerPot(pot, { rate: -1, absolute: null }, dt)
    expect((before - pot.psiTarget) / DEG / dt).toBeCloseTo(KEY_TILT_RATE, 5)
  })

  it('maps absolute tilt straight to the target', () => {
    const pot = createPot()
    steerPot(pot, { rate: 0, absolute: -0.5 }, dt)
    expect(pot.psiTarget / DEG).toBeCloseTo(-20, 5)
  })
})

describe('tip-over', () => {
  it('teeters after the hold time, then tips with no counter-tilt', () => {
    const pot = createPot()
    let result = 'none'
    let ms = 0
    while (result !== 'teeter' && ms < 2_000) {
      result = stepTip(pot, 55 * DEG, DEFAULT_POT_OPTIONS, STEP_MS)
      ms += STEP_MS
    }
    expect(ms).toBeGreaterThanOrEqual(TIP_HOLD_MS)
    expect(ms).toBeLessThan(TIP_HOLD_MS + 2 * STEP_MS)
    ms = 0
    while (result !== 'tipped' && ms < 2_000) {
      result = stepTip(pot, 55 * DEG, DEFAULT_POT_OPTIONS, STEP_MS)
      ms += STEP_MS
    }
    expect(ms).toBeGreaterThanOrEqual(TEETER_MS - 2 * STEP_MS)
    expect(ms).toBeLessThan(TEETER_MS + 2 * STEP_MS)
  })

  it('is saved by turning back toward level during the teeter', () => {
    const pot = createPot()
    pot.psiTarget = 30 * DEG
    for (let i = 0; i < 20; i++)
      stepTip(pot, 55 * DEG, DEFAULT_POT_OPTIONS, STEP_MS)
    expect(pot.teeterMs).toBeGreaterThan(0)
    pot.psiTarget = 26 * DEG
    expect(stepTip(pot, 55 * DEG, DEFAULT_POT_OPTIONS, STEP_MS)).toBe('saved')
  })

  it('tips 600 beans into the pickup places and keeps the ledger whole', () => {
    const game = testGame()
    game.pot.psiTarget = game.pot.psi = 40 * DEG
    kick(game, 'test', 0, 45 * DEG)
    simulate(game, 2, input => void (input.tilt.rate = 0.01))
    expect(game.counts.loose + game.counts.pile).toBeGreaterThanOrEqual(600)
    expect(game.counts.pot + game.counts.loose + game.counts.pile).toBe(10_000)
  })
})
