import { describe, expect, it } from 'vitest'

import { addCaption, flightTime, Particles, type Caption } from './fx'

describe('bean particles', () => {
  it('land where the flight time says, thrown up or down', () => {
    for (const vy of [-250, -60, 0, 80]) {
      const particles = new Particles()
      particles.spawn(0, 500, 100, vy, 0, 640, 1)
      let landedAt = -1
      let t = 0
      const dt = 1 / 600
      while (landedAt < 0 && t < 3) {
        t += dt
        particles.step(dt, () => (landedAt = t))
      }
      expect(landedAt).toBeCloseTo(flightTime(500, vy, 640), 1)
    }
  })
})

describe('captions', () => {
  const base = {
    sub: '',
    score: '',
    x: 0,
    y: 0,
    world: true,
    tone: 'bad',
    lifeMs: 3000
  } as const

  it('replaces a caption with the same key instead of stacking another', () => {
    const list: Caption[] = []
    addCaption(list, { ...base, text: 'Hurried. 3 beans.', key: '' })
    addCaption(list, {
      ...base,
      text: '4 beans are still back there.',
      key: 'gate'
    })
    addCaption(list, {
      ...base,
      text: '4 beans are still back there!',
      key: 'gate'
    })
    expect(list.map(c => c.text)).toEqual([
      'Hurried. 3 beans.',
      '4 beans are still back there!'
    ])
  })
})
