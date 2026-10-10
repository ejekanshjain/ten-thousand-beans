import { describe, expect, it } from 'vitest'

import { POT_OFFSET_X } from './fx'
import {
  createGame,
  devSpill,
  enterStretch,
  pickupTap,
  setDown,
  type Game
} from './game'
import { total } from './ledger'
import { checkPackets } from './packets'
import { devDog } from './park'
import { activePigeons } from './pigeons'
import { ROUTE } from './route'
import { simulate } from './testing'
import {
  DODGE_COINS,
  FOOTBALL_SPLASH,
  KICK_LEAD,
  PARK_DOG_BARK_MS,
  PARK_DOG_EATS
} from './tuning'
import { checkZones } from './zones'

const PARK = ROUTE[3]!

/** The park with your pot `gap` u short of route x `x`, standing still. */
function before(x: number, gap: number): Game {
  const game = createGame(1, ROUTE)
  enterStretch(game, 3)
  game.walker.x = x - gap - POT_OFFSET_X
  return game
}

/** Every caption seen while a drive runs. */
function seen(game: Game, into: Set<string>) {
  for (const c of game.fx.captions) {
    into.add(`${c.text} ${c.sub}`.trim())
    if (c.score) into.add(c.score)
  }
}

function healthy(game: Game): void {
  expect(total(game.counts)).toBe(10_000)
  expect(checkZones(game.counts, game.zones.list)).toBeNull()
  expect(checkPackets(game.counts, game.packets)).toBeNull()
}

describe('the football', () => {
  const kick = PARK.kicks[0]!

  it('hits a pot that strolls on into the crossing, and throws at least 90 beans', () => {
    const game = before(kick.cross - KICK_LEAD, 300)
    const captions = new Set<string>()
    simulate(game, 8, (input, g) => {
      input.walk.walk = 1
      seen(g, captions)
    })
    expect(game.park.kicks[0]!.hit).toBe(true)
    expect(10_000 - game.counts.pot).toBeGreaterThanOrEqual(FOOTBALL_SPLASH)
    expect(captions).toContain('Kid: 1. You: 0.')
    expect([...captions].some(c => c.startsWith('Football to the pot.'))).toBe(
      true
    )
    healthy(game)
  })

  it('misses a pot that stops at "Heads up!", which pays a dodge', () => {
    const game = before(kick.cross - KICK_LEAD, 300)
    const captions = new Set<string>()
    simulate(game, 8, (input, g) => {
      input.walk.walk = g.park.kicks[0]!.phase === 'idle' ? 1 : 0
      seen(g, captions)
    })
    expect(game.park.kicks[0]!.phase).toBe('done')
    expect(game.park.kicks[0]!.hit).toBe(false)
    expect(game.counts.pot).toBe(10_000)
    expect(captions).toContain(`Not today, kid. +${DODGE_COINS} coins`)
  })
})

describe('off-lead dogs', () => {
  const dog = PARK.dogs[0]!

  it('jump up at a pot that keeps walking', () => {
    const game = before(dog, 200)
    let jumped = false
    simulate(game, 6, (input, g) => {
      input.walk.walk = 1
      if (g.lastKick?.cause === 'dog') jumped = true
    })
    expect(jumped).toBe(true)
    expect(game.wallet.coins()).toBe(0)
  })

  it('sit beside a pot that stops at the bark', () => {
    const game = before(dog, 200)
    const captions = new Set<string>()
    simulate(game, 6, (input, g) => {
      input.walk.walk = g.park.dogs[0]!.phase === 'lying' ? 1 : 0
      seen(g, captions)
    })
    expect(game.park.dogs[0]!.phase).not.toBe('jump')
    expect(captions).toContain(`Good dog. +${DODGE_COINS} coins`)
  })
})

describe('wet grass', () => {
  // The second patch throws beans forward, so leaning back saves it.
  const patch = PARK.wet[1]!

  it('never wobbles you at a stroll', () => {
    const game = before(patch.from, 300 - POT_OFFSET_X)
    simulate(game, 6, input => {
      input.walk.walk = 1
    })
    expect(game.park.wet[1]!.paid).toBe(false)
    expect(game.counts.pot).toBe(10_000)
  })

  it('slips a pot that keeps hurrying through the wobble', () => {
    const game = before(patch.from, 300 - POT_OFFSET_X)
    let slipped = false
    simulate(game, 4, (input, g) => {
      input.walk.walk = 1
      input.walk.hurry = 1
      if (g.lastKick?.cause === 'wet') slipped = true
    })
    expect(slipped).toBe(true)
  })

  it('is saved by letting go of walk, which pays once', () => {
    const game = before(patch.from, 300 - POT_OFFSET_X)
    let wobbled = false
    let slipped = false
    simulate(game, 5, (input, g) => {
      const wobbling = g.park.wet[1]!.whoaMs >= 0
      wobbled ||= wobbling
      input.walk.walk = wobbling || wobbled ? 0 : 1
      input.walk.hurry = 0.5
      if (g.lastKick?.cause === 'wet') slipped = true
    })
    expect(wobbled).toBe(true)
    expect(slipped).toBe(false)
    expect(game.wallet.coins()).toBe(DODGE_COINS)
  })

  it('is saved by leaning against the slip', () => {
    const game = before(patch.from, 300 - POT_OFFSET_X)
    let wobbled = false
    let slipped = false
    simulate(game, 4, (input, g) => {
      input.walk.walk = 1
      input.walk.hurry = 1
      if (g.park.wet[1]!.whoaMs >= 0) wobbled = true
      // Raise the front rim, against the forward slip.
      input.tilt.absolute = wobbled ? -0.2 : null
      if (g.lastKick?.cause === 'wet') slipped = true
    })
    expect(wobbled).toBe(true)
    expect(slipped).toBe(false)
  })
})

describe('park Pickup', () => {
  /** Park Pickup on a 40-bean spill. */
  function inPickup(): Game {
    const game = createGame(1, ROUTE)
    enterStretch(game, 3)
    game.walker.x = 600
    devSpill(game, 40)
    simulate(game, 1)
    setDown(game)
    expect(game.scene).toBe('pickup')
    game.flock.waitMs = Infinity
    return game
  }

  it('sends a dog barking then dashing through the beans, eating at most 2', () => {
    const game = inPickup()
    expect(devDog(game)).toBe(true)
    simulate(game, 0.1)
    expect(game.park.pickupDog.phase).toBe('bark')
    simulate(game, PARK_DOG_BARK_MS / 1000 + 3)
    const eaten = game.park.pickupDog.eaten
    expect(eaten).toBeLessThanOrEqual(PARK_DOG_EATS)
    expect(game.counts.packets).toBe(eaten)
    expect(game.packets.list.every(p => p.cause === 'dog')).toBe(true)
    expect(game.park.pickupDog.pushed.size).toBeGreaterThan(eaten)
    healthy(game)
  })

  it('lets a tap during the bark send the dog off before it dashes', () => {
    const game = inPickup()
    devDog(game)
    simulate(game, 0.1)
    const dog = game.park.pickupDog
    expect(pickupTap(game, dog.x + 10, dog.y)).toBe(true)
    expect(dog.phase).toBe('leave')
    simulate(game, 3)
    expect(game.counts.packets).toBe(0)
  })

  it('brings pigeons every 15s', () => {
    const game = createGame(1, ROUTE)
    enterStretch(game, 3)
    game.walker.x = 1_000
    setDown(game)
    simulate(game, 7)
    expect(activePigeons(game.flock)).toBe(0)
    simulate(game, 1)
    expect(activePigeons(game.flock)).toBe(1)
    simulate(game, 15)
    expect(activePigeons(game.flock)).toBe(2)
  })
})
