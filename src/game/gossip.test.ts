import { describe, expect, it } from 'vitest'

import {
  createGame,
  devPickUpAll,
  devSpill,
  enterStretch,
  pickUp,
  pickupPress,
  setDown,
  type Game
} from './game'
import {
  chooseLine,
  funniestLine,
  LINES,
  lettersRevealed,
  SECRET_ORDER,
  secretShown,
  slotsOpen
} from './gossip'
import { layoutLine } from './gossipFont'
import { ROUTE } from './route'
import { simulate } from './testing'
import {
  CAT_SWAT_SPLASH,
  GOSSIP_BEAN_SPACING,
  GOSSIP_MAX_WIDTH,
  JOT_MS,
  LETTER_SLIDE_MS
} from './tuning'
import { checkZones } from './zones'

/** Opens Pickup on `n` spilled beans at the start of the street. */
function streetPickup(n: number, started = 1): Game {
  const game = createGame(1, ROUTE)
  enterStretch(game, 1)
  game.gossip.started = started
  devSpill(game, n)
  setDown(game)
  return game
}

/** Holds Jot It Down for `ms`. */
function jot(game: Game, ms: number) {
  game.gossip.jotHeld = true
  simulate(game, ms / 1000)
  game.gossip.jotHeld = false
}

const captions = (game: Game) => game.fx.captions.map(c => c.text)

describe('the stroke font', () => {
  it('spells every line in 45 to 95 beans, at most 2 rows inside 520 u', () => {
    for (const line of LINES) {
      expect(line.need).toBeGreaterThanOrEqual(45)
      expect(line.need).toBeLessThanOrEqual(95)
      const laid = layoutLine(line.text)
      expect(laid.count).toBe(line.need)
      expect(laid.rows.length).toBeLessThanOrEqual(2)
      for (let i = 0; i < laid.count; i++) {
        const x = laid.beans[i * 3]!
        expect(x).toBeGreaterThanOrEqual(300 - GOSSIP_MAX_WIDTH / 2 - 1)
        expect(x).toBeLessThanOrEqual(300 + GOSSIP_MAX_WIDTH / 2 + 1)
      }
    }
  })

  it('never stacks two beans on one spot', () => {
    const laid = layoutLine(LINES[3]!.text)
    for (let i = 0; i < laid.count; i++)
      for (let j = i + 1; j < laid.count; j++)
        expect(
          Math.hypot(
            laid.beans[i * 3]! - laid.beans[j * 3]!,
            laid.beans[i * 3 + 1]! - laid.beans[j * 3 + 1]!
          )
        ).toBeGreaterThan(GOSSIP_BEAN_SPACING * 0.5)
  })

  it('needs no more than the cat swat throws for the kitchen line', () => {
    expect(LINES[0]!.text).toBe('THE CAT KNOWS')
    expect(LINES[0]!.need).toBeLessThan(CAT_SWAT_SPLASH + 15)
  })
})

describe('gossip slots and lines', () => {
  it('adds each stretch slots, carries them forward and ends at the bridge', () => {
    expect(slotsOpen(ROUTE, 0, 0)).toBe(1)
    expect(slotsOpen(ROUTE, 0, 1)).toBe(0)
    expect(slotsOpen(ROUTE, 1, 1)).toBe(2)
    expect(slotsOpen(ROUTE, 1, 0)).toBe(3)
    expect(slotsOpen(ROUTE, 5, 3)).toBe(9)
    expect(slotsOpen(ROUTE, 6, 0)).toBe(0)
  })

  it('keeps the first line for the kitchen and takes the first that fits elsewhere', () => {
    const status = LINES.map(() => 'waiting' as const)
    expect(chooseLine(status, 'kitchen', 500)).toBe(0)
    expect(chooseLine(status, 'kitchen', 10)).toBe(-1)
    expect(chooseLine(status, 'street', 500)).toBe(1)
    const choirMimes = LINES[2]!.need
    expect(chooseLine(status, 'street', choirMimes)).toBe(
      LINES[1]!.need <= choirMimes ? 1 : 2
    )
  })

  it('spells a missed kitchen line on later stretches once every other line is out', () => {
    const status = LINES.map((_, i) => (i === 0 ? 'waiting' : 'found'))
    expect(chooseLine(status, 'park', 500)).toBe(0)
    status[5] = 'waiting'
    expect(chooseLine(status, 'park', 500)).toBe(5)
  })

  it('reveals the secret hangman style, readable from about 3 pages', () => {
    expect([...SECRET_ORDER].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i)
    )
    expect(secretShown(0)).toBe('_______ _______ ___ ___')
    expect(secretShown(3)).toBe('GR_NDM_ _______ TH_ D_G')
    expect(secretShown(6)).toBe('GR_NDM_ TR__N_D TH_ D_G')
    expect(secretShown(12)).toBe('GRANDMA TRAINED THE DOG')
    // Every page reveals at least one more letter, and only all 12 reveal the last.
    for (let pages = 1; pages <= 12; pages++)
      expect(lettersRevealed(pages)).toBeGreaterThan(lettersRevealed(pages - 1))
    // The stew spells unearned letters as a short line of beans.
    expect(layoutLine('_').count).toBeGreaterThan(0)
  })

  it('picks the funniest page you found for the ending card', () => {
    const status = LINES.map(() => 'waiting' as const)
    expect(funniestLine(status)).toBeNull()
    const found = [...status] as ('waiting' | 'found' | 'sold')[]
    found[0] = 'sold'
    found[6] = 'found'
    expect(funniestLine(found)).toBe('BAKER BUYS BREAD')
    found[2] = 'sold'
    expect(funniestLine(found)).toBe('CHOIR MIMES')
  })
})

describe('gossip in Pickup', () => {
  it('locks every grab on the first line until you jot it down', () => {
    const game = streetPickup(120, 0)
    expect(game.gossip.spelling?.locked).toBe(true)
    simulate(game, LETTER_SLIDE_MS / 1000 + 0.1)
    const world = game.pickup.world!
    const free = world.beans[0]!.position
    expect(pickupPress(game, free.x, free.y)).toBe(0)
    expect(captions(game)).toContain('Jot it down first.')
    jot(game, JOT_MS * 0.5)
    expect(game.gossip.status[1]).toBe('shown')
    jot(game, JOT_MS + 100)
    expect(game.gossip.status[1]).toBe('found')
    expect(world.letters).toHaveLength(0)
    expect(pickupPress(game, free.x, free.y)).toBeGreaterThan(0)
    expect(checkZones(game.counts, game.zones.list)).toBeNull()
  })

  it('warns on the first touch of a later line and scrambles it on the next', () => {
    const game = streetPickup(120)
    simulate(game, LETTER_SLIDE_MS / 1000 + 0.1)
    const world = game.pickup.world!
    const letter = world.letters[0]!
    expect(pickupPress(game, letter.toX, letter.toY)).toBe(0)
    expect(game.gossip.spelling?.warned).toBe(true)
    expect(world.letters.length).toBe(LINES[1]!.need)
    expect(pickupPress(game, letter.toX, letter.toY)).toBe(0)
    expect(world.letters).toHaveLength(0)
    expect(game.gossip.status[1]).toBe('waiting')
    expect(game.gossip.started).toBe(1)
    expect(captions(game)).toContain('You forgot the gossip already.')
    expect(checkZones(game.counts, game.zones.list)).toBeNull()
  })

  it('keeps other beans off the letters, so the line reads', () => {
    const game = streetPickup(160)
    simulate(game, 2)
    const world = game.pickup.world!
    for (const body of world.beans)
      for (const letter of world.letters)
        expect(
          Math.hypot(body.position.x - letter.toX, body.position.y - letter.toY)
        ).toBeGreaterThan(12)
  })

  it('keeps unjotted letters spelled when you leave and come back', () => {
    const game = streetPickup(120)
    simulate(game, LETTER_SLIDE_MS / 1000 + 0.1)
    expect(pickUp(game)).toBe(true)
    setDown(game)
    expect(game.scene).toBe('pickup')
    expect(game.pickup.world!.letters).toHaveLength(LINES[1]!.need)
    expect(game.gossip.started).toBe(2)
    expect(checkZones(game.counts, game.zones.list)).toBeNull()
  })

  it('lets the dev Pick Up All forget an unjotted line, so the next spill spells again', () => {
    const game = streetPickup(120)
    simulate(game, LETTER_SLIDE_MS / 1000 + 0.1)
    devPickUpAll(game)
    expect(game.gossip.spelling).toBeNull()
    expect(game.gossip.status[1]).toBe('waiting')
    expect(pickUp(game)).toBe(true)
    devSpill(game, 120)
    setDown(game)
    expect(game.gossip.spelling?.line).toBe(1)
    expect(game.gossip.started).toBe(2)
  })

  it('spells THE CAT KNOWS from the cat swat in the kitchen', () => {
    const game = createGame(2, ROUTE)
    enterStretch(game, 0)
    simulate(game, 9, input => void (input.walk.walk = 1))
    simulate(game, 2)
    setDown(game)
    expect(game.scene).toBe('pickup')
    expect(game.gossip.spelling?.line).toBe(0)
    expect(game.pickup.world!.letters).toHaveLength(LINES[0]!.need)
  })
})
