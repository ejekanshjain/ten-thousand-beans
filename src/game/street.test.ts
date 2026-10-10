import { describe, expect, it } from 'vitest'

import { clamp } from '../shared'
import { throwBean } from './emit'
import { POT_OFFSET_X } from './fx'
import {
  createGame,
  enterStretch,
  pickupPress,
  pickupRelease,
  setDown,
  type Game
} from './game'
import { LINES } from './gossip'
import { total } from './ledger'
import { ROUTE } from './route'
import { noteSpill } from './spill'
import { simulate } from './testing'
import {
  BELL_LEAD_MS,
  DODGE_COINS,
  DRAIN_EVENT_CAP,
  GRATE_HALF_H,
  GRATE_TOP_Y,
  MAX_TILT,
  NEIGHBOUR_NOTICE,
  PEEK_LEAN_RATE
} from './tuning'
import { DEG } from './units'
import { checkZones } from './zones'

/** A run on the street with the pot in your hands, at walker x `x`. */
function onStreet(x = 60, seed = 1): Game {
  const game = createGame(seed, ROUTE)
  enterStretch(game, 1)
  game.walker.x = x
  return game
}

/** Every caption seen while a drive runs, with its second line. */
function watch(game: Game, seen: Set<string>) {
  for (const c of game.fx.captions) seen.add(`${c.text} ${c.sub}`.trim())
}

/** Absolute tilt that cancels the characters' pull on the pot, like a player leaning against it. */
function holdLevel(game: Game): number {
  return clamp(-game.pot.lean / (MAX_TILT * DEG), -1, 1)
}

describe('nosy neighbours', () => {
  it('step out 350 u ahead and elbow a pot that walks on, throwing a gossip line back', () => {
    const game = onStreet()
    const neighbour = game.street.neighbours[0]!
    let outAt = -1
    const seen = new Set<string>()
    simulate(game, 9, (input, g) => {
      input.walk.walk = 1
      if (outAt < 0 && neighbour.phase !== 'home')
        outAt = g.walker.x + POT_OFFSET_X
      watch(g, seen)
    })
    expect(outAt - (neighbour.door - NEIGHBOUR_NOTICE)).toBeLessThan(3)
    expect(neighbour.elbowed).toBe(true)
    expect([...seen].some(t => t.startsWith('Elbowed by a neighbour.'))).toBe(
      true
    )
    // The elbow throws the beans back, enough in one zone to spell the street's first line.
    const zone = game.zones.list.reduce((a, b) => (b.count > a.count ? b : a))
    expect(zone.anchorX).toBeLessThan(game.walker.x)
    expect(zone.count + zone.pile).toBeGreaterThanOrEqual(LINES[1]!.need)
    expect(game.wallet.coins()).toBe(0)
    expect(total(game.counts)).toBe(10_000)
  })

  it('peek when you stop, pulling at 14°/s, and pay a dodge when you hold it level', () => {
    const game = onStreet()
    const neighbour = game.street.neighbours[0]!
    simulate(game, 4, input => void (input.walk.walk = 1))
    expect(neighbour.phase).not.toBe('home')
    const seen = new Set<string>()
    let peekLean = -1
    simulate(game, 12, (input, g) => {
      input.tilt.absolute = holdLevel(g)
      if (neighbour.phase === 'peek' && neighbour.ms >= 1000 && peekLean < 0)
        peekLean = neighbour.lean
      watch(g, seen)
    })
    expect(peekLean / DEG).toBeCloseTo(PEEK_LEAN_RATE, 0)
    expect(neighbour.elbowed).toBe(false)
    expect(game.counts.pot).toBe(10_000)
    expect(game.wallet.coins()).toBe(DODGE_COINS)
    expect(seen).toContain(`Not today, curlers. +${DODGE_COINS} coins`)
  })

  it('pour beans toward them when you let them pull, and blame the peek', () => {
    const game = onStreet()
    simulate(game, 4, input => void (input.walk.walk = 1))
    const seen = new Set<string>()
    simulate(game, 12, (_input, g) => watch(g, seen))
    expect(game.counts.pot).toBeLessThan(10_000)
    expect([...seen].some(t => t.startsWith('Nosy neighbour.'))).toBe(true)
    expect(game.wallet.coins()).toBe(0)
  })
})

describe('cyclists', () => {
  /**
   * On the street just past the first pothole, short of the first cyclist's trigger, with
   * the neighbours kept indoors.
   */
  const nearBike = () => {
    const game = onStreet(1_905)
    game.street.neighbours.length = 0
    return game
  }

  it('ring 1.5s before passing, and startle you when you walk', () => {
    const game = nearBike()
    const bike = game.street.cyclists[0]!
    let bellAt = -1
    let passAt = -1
    simulate(game, 7, (input, g) => {
      input.walk.walk = 1
      if (bellAt < 0 && bike.phase === 'bell') bellAt = g.timeMs
      if (passAt < 0 && bike.phase === 'past') passAt = g.timeMs
    })
    expect(passAt - bellAt).toBeCloseTo(BELL_LEAD_MS, -2)
    expect(bike.startled).toBe(true)
    expect(game.wallet.coins()).toBe(0)
  })

  it('pass harmlessly and pay a dodge when you stop at the bell', () => {
    const game = nearBike()
    const bike = game.street.cyclists[0]!
    simulate(game, 7, input => {
      input.walk.walk = bike.phase === 'waiting' || bike.phase === 'due' ? 1 : 0
    })
    expect(bike.phase).toBe('past')
    expect(bike.startled).toBe(false)
    expect(game.counts.pot).toBe(10_000)
    expect(game.wallet.coins()).toBe(DODGE_COINS)
  })
})

describe('street drains', () => {
  /** Throws `n` beans straight down onto route x in one spill event. */
  function spillOnto(game: Game, x: number, n: number) {
    noteSpill(game.spill, n, 1, game.timeMs, () => 'test')
    for (let i = 0; i < n; i++) throwBean(game, x, 500, 0, -100)
    game.stats.spilled += n
  }

  it('take at most 5 beans from each spill event, and the rest land loose', () => {
    const game = onStreet(2_500)
    const drain = ROUTE[1]!.drains[0]!
    spillOnto(game, drain, 12)
    expect(game.counts.drain).toBe(DRAIN_EVENT_CAP)
    expect(game.counts.loose).toBe(12 - DRAIN_EVENT_CAP)
    simulate(game, 1)
    spillOnto(game, drain, 12)
    expect(game.counts.drain).toBe(2 * DRAIN_EVENT_CAP)
    expect(checkZones(game.counts, game.zones.list)).toBeNull()
  })

  it('show a grate in Pickup where slow beans fall through and fast ones roll on', () => {
    const game = onStreet(2_560)
    spillOnto(game, ROUTE[1]!.drains[0]!, 30)
    simulate(game, 1)
    setDown(game)
    const world = game.pickup.world!
    const grate = world.grate!
    expect(grate).toEqual({ x: 300, y: GRATE_TOP_Y })
    // Beans that landed on the grate start just below it.
    for (const body of world.beans)
      expect(world.onGrate(body.position.x, body.position.y)).toBe(false)
    const drained = game.counts.drain

    // A bean flicked hard off the grate's edge rolls clear.
    let bean = world.beans[0]!.position
    pickupPress(game, bean.x, bean.y)
    world.moveHeld(grate.x, grate.y + GRATE_HALF_H - 4)
    pickupRelease(game, { x: 0, y: 0, vx: 0, vy: 400 })
    simulate(game, 1)
    expect(game.counts.drain).toBe(drained)

    // A bean set down on it falls through.
    bean = world.beans[0]!.position
    pickupPress(game, bean.x, bean.y)
    world.moveHeld(grate.x, grate.y)
    pickupRelease(game, { x: 0, y: 0, vx: 0, vy: 0 })
    simulate(game, 0.2)
    expect(game.counts.drain).toBeGreaterThan(drained)
    expect(world.zone.drain).toBe(game.counts.drain)
    expect(game.fx.captions.map(c => c.text)).toContain(
      'Slow beans fall through the grate.'
    )
    expect(checkZones(game.counts, game.zones.list)).toBeNull()
  })
})
