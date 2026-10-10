import { describe, expect, it } from 'vitest'

import { STEP_MS } from './testing'
import { BACK_SPEED, HURRY_SPEED, STROLL_SPEED } from './tuning'
import {
  createWalker,
  stepWalker,
  swayHz,
  targetSpeed,
  thumbWalk
} from './walk'

const dt = STEP_MS / 1000

describe('walking', () => {
  it('reaches 90% of stroll speed in about a second', () => {
    const walker = createWalker(0, 10_000)
    let t = 0
    while (walker.v < 0.9 * STROLL_SPEED) {
      stepWalker(walker, { walk: 1, hurry: 0 }, dt)
      t += dt
    }
    expect(t).toBeGreaterThan(0.9)
    expect(t).toBeLessThan(1.2)
  })

  it('walks back at stroll speed and stops at the stretch edges', () => {
    expect(targetSpeed({ walk: -1, hurry: 1 })).toBe(-BACK_SPEED)
    expect(targetSpeed({ walk: 1, hurry: 1 })).toBe(HURRY_SPEED)
    const walker = createWalker(0, 1_000)
    for (let i = 0; i < 600; i++) stepWalker(walker, { walk: -1, hurry: 0 }, dt)
    expect(walker.x).toBe(0)
    expect(walker.v).toBe(0)
  })

  it('slows to the stroll cap on stairs, and still stops when you let go', () => {
    const walker = createWalker(0, 10_000)
    walker.v = HURRY_SPEED
    for (let i = 0; i < 60; i++)
      stepWalker(walker, { walk: 1, hurry: 1 }, dt, STROLL_SPEED)
    expect(walker.v).toBeCloseTo(STROLL_SPEED, 0)
    // Letting go on the stairs stops you in about a second, as on flat ground.
    for (let i = 0; i < 60; i++)
      stepWalker(walker, { walk: 0, hurry: 0 }, dt, STROLL_SPEED)
    expect(walker.v).toBeLessThan(0.15 * STROLL_SPEED)
  })

  it('sways at half the step rate, on the slosh frequency at a hurry', () => {
    expect(swayHz(STROLL_SPEED)).toBeCloseTo(0.53, 2)
    expect(swayHz(HURRY_SPEED)).toBeCloseTo(1.13, 2)
  })

  it('counts footsteps once per stride', () => {
    const walker = createWalker(0, 10_000)
    walker.v = STROLL_SPEED
    let steps = 0
    for (let i = 0; i < 60 * 15.2; i++)
      if (stepWalker(walker, { walk: 1, hurry: 0 }, dt)) steps++
    // 15.2s at 80 u/s with a 75 u stride is 16.2 strides.
    expect(steps).toBe(16)
  })

  it('maps a thumb slide to stroll, hurry and back', () => {
    expect(thumbWalk(0)).toEqual({ walk: 1, hurry: 0 })
    expect(thumbWalk(70)).toEqual({ walk: 1, hurry: 0.5 })
    expect(thumbWalk(200)).toEqual({ walk: 1, hurry: 1 })
    expect(thumbWalk(-50)).toEqual({ walk: -1, hurry: 0 })
  })
})
