import Matter from 'matter-js'
import { describe, expect, it } from 'vitest'

import { POT_OFFSET_X } from './fx'
import {
  createGame,
  devPickUpAll,
  devSpill,
  enterStretch,
  leaveKiosk,
  pickupPress,
  setDown,
  tipOver,
  type Game
} from './game'
import { gateOpen, gateX } from './gate'
import { characterHit } from './hits'
import { openKiosk } from './kiosk'
import { total } from './ledger'
import { strainFor } from './pickup'
import { createPot, DEFAULT_POT_OPTIONS, marginFor, stepTip } from './slosh'
import { ROUTE } from './route'
import { groundKick } from './terrain'
import { simulate, STEP_MS, testGame } from './testing'
import {
  BOX_SLOTS,
  BOX_SLOTS_BIG,
  CLUMP_MAX,
  GATE_STOP,
  GRAB_RADIUS,
  LID_HIT_SHARE,
  LID_SPILL_RATE,
  LID_THROW,
  LID_TIP_SHARE,
  MUD_STROKES,
  TIP_LOOSE,
  TIP_PILE,
  WHOA_MS,
  WHOA_MS_GRIPPY,
  WIDE_CLUMP_MAX,
  WIDE_STRAIN_LIMIT
} from './tuning'
import { DEG } from './units'
import {
  devOwn,
  LID_CHORE,
  MUD_BOOT,
  MUD_CHORE,
  mudDrag,
  mudPress,
  mudRelease,
  pastItsUse
} from './upgrades'

/** The street, carrying the pot at 1,000, owning `ids`. */
function street(...ids: Parameters<typeof devOwn>[1][]): Game {
  const game = createGame(1, ROUTE)
  enterStretch(game, 1)
  game.walker.x = 1_000
  for (const id of ids) expect(devOwn(game, id)).toBe(true)
  simulate(game, 0.05)
  return game
}

describe('the shop', () => {
  it('sells all six upgrades for 720 coins in all', () => {
    const game = createGame(1, ROUTE)
    expect(game.shop.list().map(u => [u.id, u.cost])).toEqual([
      ['tweezers', 70],
      ['shoes', 80],
      ['net', 90],
      ['box', 120],
      ['lid', 160],
      ['tall', 200]
    ])
    game.wallet.earn(80, 'test')
    expect(game.shop.buy('lid').ok).toBe(false)
    expect(game.shop.buy('tweezers').ok).toBe(true)
    expect(game.wallet.coins()).toBe(10)
  })

  it('stops offering Grippy Shoes after the park, and the Pigeon Net after the bridge', () => {
    const at = (id: string) => ROUTE.findIndex(def => def.id === id)
    expect(pastItsUse(ROUTE, at('market'), 'shoes')).toBeNull()
    expect(pastItsUse(ROUTE, at('park'), 'shoes')).toMatch(/park/)
    expect(pastItsUse(ROUTE, at('hill'), 'net')).toBeNull()
    expect(pastItsUse(ROUTE, at('bridge'), 'net')).toMatch(/pigeons/)
    for (const id of ['tweezers', 'box', 'lid', 'tall'])
      expect(pastItsUse(ROUTE, at('bridge'), id)).toBeNull()
  })
})

describe('Wider Tweezers', () => {
  /** Street Pickup with its beans lined up 30 u apart in a row at y 400. */
  function pickup(...ids: Parameters<typeof devOwn>[1][]): Game {
    const game = street(...ids)
    devSpill(game, 12)
    simulate(game, 1)
    game.walker.x = 1_080
    setDown(game)
    expect(game.scene).toBe('pickup')
    for (const [i, body] of game.pickup.world!.beans.entries()) {
      Matter.Body.setPosition(body, { x: 100 + i * 30, y: 400 })
      Matter.Body.setVelocity(body, { x: 0, y: 0 })
    }
    return game
  }

  it('grab from 1.6 times as far', () => {
    const plain = pickup()
    expect(pickupPress(plain, 100, 400 - GRAB_RADIUS * 1.3)).toBe(0)
    const wide = pickup('tweezers')
    expect(pickupPress(wide, 100, 400 - GRAB_RADIUS * 1.3)).toBeGreaterThan(0)
  })

  it('lift clumps of up to 5 instead of 3', () => {
    for (const [ids, most] of [
      [[], CLUMP_MAX],
      [['tweezers'], WIDE_CLUMP_MAX]
    ] as const) {
      const game = pickup(...ids)
      // A tight bunch of six touching beans.
      const world = game.pickup.world!
      for (const [i, body] of world.beans.slice(0, 6).entries())
        Matter.Body.setPosition(body, {
          x: 300 + (i % 3) * 12,
          y: 500 + (i > 2 ? 12 : 0)
        })
      expect(pickupPress(game, 312, 506)).toBe(most)
    }
  })

  it('drop beans at a lower strain', () => {
    expect(strainFor(0.8, 0, 1).strain).toBeLessThan(1)
    expect(strainFor(0.8, 0, 1, WIDE_STRAIN_LIMIT).strain).toBeGreaterThan(1)
  })
})

describe('the Pot Lid', () => {
  it('caps a held tilt at 6 beans a second', () => {
    const tilt = (game: Game) =>
      simulate(game, 2, input => void (input.tilt.absolute = 0.8))
    expect(tilt(street('lid'))).toBeLessThanOrEqual(LID_SPILL_RATE * 2 + 1)
    expect(tilt(street())).toBeGreaterThan(50)
  })

  it('stays quiet over a pothole at a stroll', () => {
    const game = street('lid')
    game.walker.x = 700
    simulate(game, 5, input => void (input.walk.walk = 1))
    expect(game.walker.x).toBeGreaterThan(900)
    expect(game.counts.pot).toBe(10_000)
  })

  it('rattles floor((J - 1) * 3) beans out on a hard kick', () => {
    const game = street('lid')
    groundKick(game, 'pothole', 1, 2.0)
    expect(10_000 - game.counts.pot).toBe(3)
    groundKick(game, 'pothole', 1, 1.1)
    expect(10_000 - game.counts.pot).toBe(3)
  })

  it('keeps all but a quarter of an elbow in, and stays on', () => {
    const elbow = { cause: 'neighbour', side: -1, kick: 2.4, tilt: 10 }
    const plain = characterHit(street(), { ...elbow, splash: 35 })
    const game = street('lid')
    const lidded = characterHit(game, { ...elbow, splash: 35 })
    expect(plain.splash).toBe(35)
    expect(lidded.splash).toBe(Math.round(35 * LID_HIT_SHARE))
    expect(game.lid.off).toBe(false)
    expect(game.chores.has(LID_CHORE)).toBe(false)
    // Even a small splash lets one bean out.
    expect(characterHit(game, { ...elbow, splash: 1 }).splash).toBe(1)
  })

  it('stays on through a hard hit you lean against', () => {
    const game = street('lid')
    // Leaning back raises the rear rim the ladder throws toward.
    game.pot.psiTarget = 8 * DEG
    const hit = characterHit(game, {
      cause: 'ladder',
      side: -1,
      kick: 3.5,
      tilt: 18,
      splash: 100,
      hard: true
    })
    expect(hit.leaned).toBe(true)
    expect(hit.splash).toBe(Math.round(50 * LID_HIT_SHARE))
    expect(game.lid.off).toBe(false)
  })

  it('flies off on a hard hit, holds the gate, and goes back on when you walk over it', () => {
    const game = street('lid')
    // The next neighbour would elbow the lid off again on the walk.
    game.street.neighbours.length = 0
    const pot = game.walker.x + POT_OFFSET_X
    const hit = characterHit(game, {
      cause: 'ladder',
      side: 1,
      kick: 2.8,
      tilt: 10,
      splash: 50,
      hard: true
    })
    expect(hit.splash).toBe(50)
    expect(game.lid.off).toBe(true)
    expect(game.options.lid).toBe(false)
    expect(game.lid.x).toBeCloseTo(pot + LID_THROW)
    expect(game.chores.has(LID_CHORE)).toBe(true)
    expect(gateOpen(game)).toBe(false)
    simulate(game, 8, input => void (input.walk.walk = 1))
    expect(game.lid.off).toBe(false)
    expect(game.chores.has(LID_CHORE)).toBe(false)
    expect(total(game.counts)).toBe(10_000)
  })

  it('flies off when the pot tips over, and holds half the loose beans in', () => {
    const scattered = (game: Game) =>
      game.counts.loose + game.counts.drain + game.counts.puddle
    const plain = testGame()
    tipOver(plain)
    expect(scattered(plain)).toBe(TIP_LOOSE)
    const game = testGame()
    devOwn(game, 'lid')
    simulate(game, 0.05)
    tipOver(game)
    expect(game.lid.off).toBe(true)
    expect(game.chores.has(LID_CHORE)).toBe(true)
    expect(scattered(game)).toBe(TIP_LOOSE * LID_TIP_SHARE)
    expect(game.counts.pile).toBe(TIP_PILE)
    expect(total(game.counts)).toBe(10_000)
  })

  /** A lidded pot stopped at the shut gate by beans behind it, then tipped toward `side`. */
  function tippedAtGate(side: number): Game {
    const game = testGame()
    devOwn(game, 'lid')
    game.walker.x = gateX(game) - 700
    simulate(game, 0.05)
    devSpill(game, 12)
    simulate(game, 12, input => void (input.walk.walk = 1))
    expect(game.walker.x).toBe(gateX(game) - GATE_STOP)
    game.pot.teeterSide = side
    tipOver(game)
    simulate(game, 1)
    devPickUpAll(game)
    simulate(game, 0.1)
    return game
  }

  it('lands where a pot stopped at the shut gate can fetch it, and the gate opens', () => {
    const game = tippedAtGate(1)
    expect(game.lid.x).toBeLessThanOrEqual(gateX(game) - 100)
    simulate(game, 6, input => void (input.walk.walk = 1))
    expect(game.lid.off).toBe(false)
    expect(game.chores.list()).toHaveLength(0)
    expect(game.walker.x).toBeGreaterThan(gateX(game))
  })

  it('makes the shut gate point back at it once every bean is in', () => {
    const game = tippedAtGate(-1)
    expect(game.lid.off).toBe(true)
    game.walker.x = gateX(game) - GATE_STOP - 20
    simulate(game, 1, input => void (input.walk.walk = 1))
    const texts = game.fx.captions.map(c => c.text)
    expect(texts).toContain("The lid's still back there.")
    expect(texts.some(t => t.startsWith('0 beans'))).toBe(false)
  })
})

describe('Grippy Shoes', () => {
  /** Hurries onto the park's second wet patch and returns how long the wobble lasted. */
  function wobble(shoes: boolean): number {
    const game = createGame(1, ROUTE)
    enterStretch(game, 3)
    if (shoes) devOwn(game, 'shoes')
    game.walker.x = 2_650
    let started = -1
    let slipped = -1
    simulate(game, 4, (input, g) => {
      input.walk.walk = 1
      input.walk.hurry = 1
      if (started < 0 && g.park.wet[1]!.whoaMs >= 0) started = g.timeMs
      if (slipped < 0 && g.lastKick?.cause === 'wet') slipped = g.timeMs
    })
    return slipped - started
  }

  it('double the time to save a slip', () => {
    expect(wobble(false)).toBeCloseTo(WHOA_MS, -2)
    expect(wobble(true)).toBeCloseTo(WHOA_MS_GRIPPY, -2)
  })

  it('come out of the park muddy, and 24 rubs clean them so you can leave', () => {
    const game = createGame(1, ROUTE)
    enterStretch(game, 3)
    devOwn(game, 'shoes')
    game.walker.x = ROUTE[3]!.length - 120
    openKiosk(game)
    expect(game.mud.on).toBe(true)
    expect(game.chores.has(MUD_CHORE)).toBe(true)
    expect(leaveKiosk(game)).toBe(false)
    const x = MUD_BOOT.x + MUD_BOOT.w / 2
    const y = MUD_BOOT.y + MUD_BOOT.h / 2
    expect(mudPress(game, x - 50, y)).toBe(true)
    for (let i = 1; i <= MUD_STROKES; i++)
      for (let k = 1; k <= 10; k++)
        mudDrag(game, x - 50 + (i % 2 ? k : 10 - k) * 10, y)
    mudRelease(game)
    expect(game.mud.strokes).toBe(MUD_STROKES)
    expect(game.mud.on).toBe(false)
    expect(leaveKiosk(game)).toBe(true)
  })

  it('stay clean without the upgrade', () => {
    const game = createGame(1, ROUTE)
    enterStretch(game, 3)
    game.walker.x = ROUTE[3]!.length - 120
    openKiosk(game)
    expect(game.mud.on).toBe(false)
    expect(game.chores.has(MUD_CHORE)).toBe(false)
  })
})

describe('the Taller Pot', () => {
  it('doubles the room above a full pot and spills far less on a long hurry', () => {
    const hurry = (game: Game) =>
      simulate(game, 10, input => {
        input.walk.walk = 1
        input.walk.hurry = 1
      })
    const tall = testGame()
    expect(devOwn(tall, 'tall')).toBe(true)
    simulate(tall, 0.05)
    expect(tall.options.tall).toBe(true)
    expect(marginFor(10_000, 0, tall.options)).toBe(20)
    const plain = hurry(testGame())
    expect(plain).toBeGreaterThan(20)
    expect(hurry(tall)).toBeLessThan(plain / 4)
  })

  /** Steps a pot held at `own` degrees with `push` degrees from outside for 2s. */
  function tips(tall: boolean, own: number, push: number): boolean {
    const pot = createPot()
    pot.psi = own * DEG
    const options = { ...DEFAULT_POT_OPTIONS, tall }
    for (let t = 0; t < 2000; t += STEP_MS)
      if (stepTip(pot, (own + push) * DEG, options, STEP_MS) !== 'none')
        return true
    return false
  }

  it('tips at 42 degrees, but only when your own tilt leans that way', () => {
    // Outside forces alone never tip it, however hard they push.
    expect(tips(true, 0, 60)).toBe(false)
    expect(tips(true, -5, 60)).toBe(false)
    // Your own lean plus a push past 42 degrees does.
    expect(tips(true, 30, 14)).toBe(true)
    expect(tips(true, -30, -14)).toBe(true)
    // The plain pot holds at 44 degrees and tips past 50 from anything.
    expect(tips(false, 30, 14)).toBe(false)
    expect(tips(false, 0, 55)).toBe(true)
  })
})

describe('the Bigger Window Box', () => {
  it('adds a second row of three slots once you own it', () => {
    const game = street()
    expect(game.box.slots).toHaveLength(BOX_SLOTS)
    game.box.slots[0]!.state = 'dug'
    devOwn(game, 'box')
    simulate(game, 0.05)
    expect(game.box.slots).toHaveLength(BOX_SLOTS_BIG)
    expect(game.box.slots[0]!.state).toBe('dug')
    expect(game.box.slots.slice(BOX_SLOTS).every(s => s.state === 'bare')).toBe(
      true
    )
  })
})
