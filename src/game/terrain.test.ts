import { describe, expect, it } from 'vitest'

import { devSpill, enterStretch, leaveKiosk } from './game'
import {
  bumpsCrossed,
  defineStretch,
  dropSpan,
  groundDrop,
  ROUTE,
  type StretchDef
} from './route'
import { cobbleSide, terrainKick } from './terrain'
import { simulate, testGame } from './testing'
import {
  GATE_FROM_END,
  GATE_STOP,
  HURRY_SPEED,
  KERB_DROP,
  POTHOLE_KICK,
  STAIR_RISE,
  STROLL_SPEED,
  TITLE_MS
} from './tuning'

/** A flat stretch with one hazard list, long enough to reach any speed first. */
function stretchWith(spec: Partial<Parameters<typeof defineStretch>[0]>) {
  return [
    defineStretch({
      id: 'test',
      name: 'Test Street',
      length: 6_000,
      gossipSlots: 0,
      ...spec
    })
  ]
}

/** Walks at a steady speed from x = 60 for `seconds`, with a level pot. Returns beans spilled. */
function walkAt(route: readonly StretchDef[], speed: number, seconds: number) {
  const game = testGame(1, route)
  game.walker.v = speed
  const hurry = (speed - STROLL_SPEED) / (HURRY_SPEED - STROLL_SPEED)
  return simulate(game, seconds, input => {
    input.walk.walk = 1
    input.walk.hurry = hurry
  })
}

describe('the route', () => {
  it('has the seven stretches of the plan, with the gate on all but the door', () => {
    expect(ROUTE.map(s => s.length)).toEqual([
      1_500, 7_800, 7_800, 8_400, 6_000, 4_000, 800
    ])
    expect(ROUTE.map(s => s.gate)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      false
    ])
  })

  it('dips at kerb crossings, steps down the street stairs and up to the door', () => {
    const street = ROUTE[1]!
    expect(groundDrop(street, 1_300)).toBe(0)
    expect(groundDrop(street, 1_420)).toBe(KERB_DROP)
    expect(groundDrop(street, 1_520)).toBe(0)
    expect(groundDrop(street, 7_300)).toBe(5 * STAIR_RISE)
    expect(groundDrop(ROUTE[6]!, 790)).toBe(-4 * STAIR_RISE)
  })

  it('keeps every hazard before the point where a shut gate stops you', () => {
    for (const def of ROUTE.filter(s => s.gate)) {
      const stop = def.length - GATE_FROM_END - GATE_STOP
      for (const bump of def.bumps) expect(bump.x).toBeLessThan(stop)
      for (const span of def.cobbles) expect(span.to).toBeLessThan(stop)
      for (const x of [
        ...def.drains,
        ...def.neighbours,
        ...def.cyclists,
        ...def.stalls,
        ...def.puddles.map(p => p.to),
        def.ladder ?? 0,
        def.crowd?.to ?? 0
      ])
        expect(x).toBeLessThan(stop)
    }
  })

  it('puts each neighbour at a painted front door, clear of the other hazards', () => {
    const street = ROUTE[1]!
    for (const door of street.neighbours) {
      expect((door - 149) % 200).toBe(0)
      for (const drain of street.drains)
        expect(Math.abs(door - drain)).toBeGreaterThan(300)
    }
  })

  it('gives the ground range under a stretch of route, for tiles sized to it', () => {
    const hill = ROUTE.find(def => def.id === 'hill')!
    const [low, high] = dropSpan(hill, 1_200, 2_000)
    expect(high - low).toBeCloseTo(800 * Math.tan((12 * Math.PI) / 180), 0)
    expect(low).toBeCloseTo(groundDrop(hill, 2_000))
    const [flatLow, flatHigh] = dropSpan(hill, 3_000, 3_800)
    expect(flatHigh - flatLow).toBeLessThan(high - low)
  })

  it('crosses each bump once, walking either way', () => {
    const [def] = stretchWith({ potholes: [500] })
    expect(bumpsCrossed(def!, 490, 500)).toHaveLength(1)
    expect(bumpsCrossed(def!, 500, 510)).toHaveLength(0)
    expect(bumpsCrossed(def!, 510, 500)).toHaveLength(1)
    expect(bumpsCrossed(def!, 500, 490)).toHaveLength(0)
  })
})

describe('ground hazards', () => {
  it('scale with speed squared', () => {
    expect(terrainKick(POTHOLE_KICK, STROLL_SPEED)).toBeCloseTo(POTHOLE_KICK)
    expect(terrainKick(POTHOLE_KICK, HURRY_SPEED)).toBeCloseTo(
      POTHOLE_KICK * 4.52,
      2
    )
  })

  it('let a stroll over a pothole pass, and make a brisk walk or a hurry spill', () => {
    const pothole = stretchWith({ potholes: [800] })
    const flat = stretchWith({})
    expect(walkAt(pothole, STROLL_SPEED, 12)).toBe(0)
    const brisk = walkAt(pothole, 130, 8) - walkAt(flat, 130, 8)
    const hurry = walkAt(pothole, HURRY_SPEED, 6) - walkAt(flat, HURRY_SPEED, 6)
    expect(brisk).toBeGreaterThan(0)
    expect(hurry).toBeGreaterThan(brisk)
  })

  it('blame the pothole, and the hurry, in the spill caption', () => {
    // 130 u/s is too slow to spill on flat ground, so only the pothole can be blamed.
    const game = testGame(1, stretchWith({ potholes: [900] }))
    game.walker.v = 130
    simulate(game, 10, input => {
      input.walk.walk = 1
      input.walk.hurry = 5 / 9
    })
    const texts = game.fx.captions.map(c => c.text)
    expect(texts.some(t => t.startsWith('Hurried into a pothole.'))).toBe(true)
  })

  it('kick on every footstep over cobbles, back then forward', () => {
    expect([0.2, 1.2, 2.2, 3.2].map(cobbleSide)).toEqual([-1, 1, -1, 1])
    const game = testGame(1, stretchWith({ cobbles: [[100, 2_000]] }))
    const sides: number[] = []
    let lastAt = -1
    simulate(game, 6, (input, g) => {
      input.walk.walk = 1
      if (g.lastKick && g.lastKick.at !== lastAt) {
        lastAt = g.lastKick.at
        sides.push(g.fx.kick.side)
      }
    })
    expect(sides.length).toBeGreaterThan(3)
    for (let i = 1; i < sides.length; i++) expect(sides[i]).toBe(-sides[i - 1]!)
  })

  it('cap speed at a stroll on the stairs, so strolling down them spills nothing', () => {
    const route = stretchWith({
      stairs: { from: 1_000, count: 5, rise: STAIR_RISE }
    })
    const game = testGame(1, route)
    game.walker.x = 600
    game.walker.v = HURRY_SPEED
    let fastest = 0
    simulate(game, 6, (input, g) => {
      input.walk.walk = 1
      input.walk.hurry = 1
      if (g.walker.x > 1_050 && g.walker.x < 1_250)
        fastest = Math.max(fastest, g.walker.v)
    })
    expect(fastest).toBeLessThan(STROLL_SPEED + 1)
    expect(walkAt(route, STROLL_SPEED, 20)).toBe(0)
  })
})

describe('stretch transitions', () => {
  it('lead on through an open gate and the kiosk to the next stretch with a title card', () => {
    const game = testGame(1, ROUTE)
    enterStretch(game, 0)
    game.walker.x = 1_200
    simulate(game, 6, input => void (input.walk.walk = 1))
    expect(game.scene).toBe('kiosk')
    expect(leaveKiosk(game)).toBe(true)
    expect(game.stretch).toBe(1)
    expect(game.walker.x).toBeLessThan(300)
    expect(game.fx.title?.text).toBe('The Street')
    simulate(game, TITLE_MS / 1000 + 0.1)
    expect(game.fx.title).toBeNull()
  })

  it('hold you at the end when beans were spilled past the open gate', () => {
    const game = testGame(1, ROUTE)
    enterStretch(game, 1)
    game.walker.x = 7_560
    devSpill(game, 3)
    simulate(game, 5, input => void (input.walk.walk = 1))
    expect(game.stretch).toBe(1)
    expect(game.gate.passed).toBe(true)
    expect(game.walker.x).toBeLessThanOrEqual(7_760)
  })

  it('never walk back into the previous stretch', () => {
    const game = testGame(1, ROUTE)
    enterStretch(game, 2)
    simulate(game, 3, input => void (input.walk.walk = -1))
    expect(game.stretch).toBe(2)
    expect(game.walker.x).toBe(0)
  })
})
