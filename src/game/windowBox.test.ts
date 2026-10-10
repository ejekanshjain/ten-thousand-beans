import { describe, expect, it } from 'vitest'

import { createGame, enterStretch, pickUp, setDown, type Game } from './game'
import { total } from './ledger'
import { checkPackets, loseBeans } from './packets'
import { ROUTE } from './route'
import { simulate } from './testing'
import { devOwn } from './upgrades'
import {
  BOX_FLOOD_MS,
  DIG_STROKES,
  PLANT_HOLD_MS,
  WATER_FILL_MS
} from './tuning'
import {
  boxDrag,
  boxPress,
  boxRelease,
  cardRect,
  checkBox,
  closeBox,
  openBox,
  plantNudge,
  podSpot,
  slotRect,
  updateGrowth
} from './windowBox'

/** The park with the pot on the ground, `beans` lost into packets, and the box open. */
function boxWith(beans: number, carrying = false): Game {
  const game = createGame(1, ROUTE)
  enterStretch(game, 3)
  loseBeans(game, 'pot', beans, 'pigeon')
  if (!carrying) setDown(game)
  expect(openBox(game)).toBe(true)
  return game
}

function center(game: Game, slot: number): { x: number; y: number } {
  const r = slotRect(slot, game.box.slots.length)
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

/** Rubs slot `slot` back and forth for `strokes` one-way strokes. */
function dig(game: Game, slot: number, strokes = DIG_STROKES): void {
  const { x, y } = center(game, slot)
  boxPress(game, x - 40, y)
  for (let i = 1; i <= strokes; i++)
    for (let k = 1; k <= 8; k++)
      boxDrag(game, x - 40 + (i % 2 ? k : 8 - k) * 10, y)
  boxRelease(game)
}

/** Holds (x, y) for `ms`, then lets go. */
function hold(game: Game, x: number, y: number, ms: number): void {
  boxPress(game, x, y)
  simulate(game, ms / 1000)
  boxRelease(game)
}

function tap(game: Game, x: number, y: number): void {
  boxPress(game, x, y)
  boxRelease(game)
}

/** Taps packet card `i`, then holds slot `slot` long enough to plant it. */
function plant(game: Game, card: number, slot: number): void {
  const r = cardRect(card)
  tap(game, r.x + r.w / 2, r.y + r.h / 2)
  const { x, y } = center(game, slot)
  hold(game, x, y, PLANT_HOLD_MS + 50)
}

function healthy(game: Game): void {
  expect(total(game.counts)).toBe(10_000)
  expect(checkPackets(game.counts, game.packets)).toBeNull()
  expect(checkBox(game.counts, game.box)).toBeNull()
}

describe('the window box', () => {
  it('pauses the world while open', () => {
    const game = boxWith(8)
    const before = game.timeMs
    simulate(game, 2)
    expect(game.timeMs).toBe(before)
    closeBox(game)
    expect(game.scene).toBe('grounded')
    simulate(game, 1)
    expect(game.timeMs).toBeGreaterThan(before)
  })

  it('needs 6 rub strokes to dig a slot', () => {
    const game = boxWith(8)
    dig(game, 0, DIG_STROKES - 2)
    expect(game.box.slots[0]!.state).toBe('bare')
    dig(game, 0, 2)
    expect(game.box.slots[0]!.state).toBe('dug')
  })

  it('plants a chosen packet with a hold, up to 3 packets a slot', () => {
    const game = boxWith(32)
    expect(game.packets.list).toHaveLength(4)
    dig(game, 0)
    plant(game, 0, 0)
    expect(game.box.slots[0]!.packets).toHaveLength(1)
    expect(game.counts.growing).toBe(8)
    // A short press doesn't plant.
    const r = cardRect(0)
    tap(game, r.x + r.w / 2, r.y + r.h / 2)
    const { x, y } = center(game, 0)
    hold(game, x, y, PLANT_HOLD_MS / 2)
    expect(game.box.slots[0]!.packets).toHaveLength(1)
    plant(game, 0, 0)
    plant(game, 0, 0)
    plant(game, 0, 0)
    expect(game.box.slots[0]!.packets).toHaveLength(3)
    expect(game.packets.list).toHaveLength(1)
    healthy(game)
  })

  it('floods when the can is held too long, and the seeds float back out', () => {
    const game = boxWith(16)
    dig(game, 0)
    plant(game, 0, 0)
    const { x, y } = center(game, 0)
    hold(game, x, y, BOX_FLOOD_MS + 100)
    const slot = game.box.slots[0]!
    expect(slot.state).toBe('bare')
    expect(game.counts.growing).toBe(0)
    expect(game.packets.list).toHaveLength(2)
    expect(game.box.batch).toBeNull()
    healthy(game)
  })

  it('grows every watered slot on one timer, and picked slots stay dug', () => {
    const game = boxWith(24)
    dig(game, 0)
    dig(game, 1)
    plant(game, 0, 0)
    plant(game, 0, 1)
    const { x, y } = center(game, 0)
    // Too short a pour doesn't count.
    hold(game, x, y, WATER_FILL_MS / 2)
    expect(game.box.batch).toBeNull()
    hold(game, x, y, WATER_FILL_MS + 100)
    // One can waters the whole small box, on one shared timer.
    expect(game.box.slots[0]!.state).toBe('watered')
    expect(game.box.slots[1]!.state).toBe('watered')
    const batch = game.box.batch!
    expect(batch).not.toBeNull()
    expect(updateGrowth(game, batch.endsAt - 1)).toBe(false)
    expect(updateGrowth(game, batch.endsAt)).toBe(true)
    expect(game.box.slots[0]!.state).toBe('grown')
    expect(game.packets.list.map(p => p.id)).not.toContain(game.box.pea)

    const pot = game.counts.pot
    const spot = podSpot(slotRect(0, 3), 0, 1)
    tap(game, spot.x, spot.y)
    expect(game.counts.pot).toBe(pot + 8)
    expect(game.box.slots[0]!.state).toBe('dug')
    healthy(game)
  })

  it('drops picked beans into the jar while you carry the pot, and tips it at the next set-down', () => {
    const game = boxWith(8, true)
    dig(game, 0)
    plant(game, 0, 0)
    const { x, y } = center(game, 0)
    hold(game, x, y, WATER_FILL_MS + 100)
    updateGrowth(game, game.box.batch!.endsAt)
    const spot = podSpot(slotRect(0, 3), 0, 1)
    const pot = game.counts.pot
    tap(game, spot.x, spot.y)
    expect(game.counts.regrown).toBe(8)
    expect(game.counts.pot).toBe(pot)
    closeBox(game)
    expect(game.scene).toBe('walk')
    setDown(game)
    expect(game.counts.regrown).toBe(0)
    expect(game.counts.pot).toBe(pot + 8)
    pickUp(game)
    healthy(game)
  })

  it('has 6 slots with the Bigger Window Box, each needing its own watering', () => {
    const game = boxWith(24)
    expect(devOwn(game, 'box')).toBe(true)
    simulate(game, 0.02)
    expect(game.box.slots).toHaveLength(6)
    dig(game, 0)
    dig(game, 4)
    dig(game, 5)
    plant(game, 0, 0)
    plant(game, 0, 4)
    plant(game, 0, 5)
    const first = center(game, 4)
    hold(game, first.x, first.y, WATER_FILL_MS + 100)
    expect(game.box.slots.map(s => s.state)).toEqual([
      'planted',
      'bare',
      'bare',
      'bare',
      'watered',
      'planted'
    ])
    const batch = game.box.batch
    expect(batch).not.toBeNull()
    // The next slot joins the same batch, and a flood drowns only the slot you hold.
    const second = center(game, 0)
    hold(game, second.x, second.y, WATER_FILL_MS + 100)
    expect(game.box.slots[0]!.state).toBe('watered')
    expect(game.box.batch).toBe(batch)
    const third = center(game, 5)
    hold(game, third.x, third.y, BOX_FLOOD_MS + 100)
    expect(game.box.slots.map(s => s.state)).toEqual([
      'watered',
      'bare',
      'bare',
      'bare',
      'watered',
      'bare'
    ])
    expect(game.packets.list).toHaveLength(1)
    healthy(game)
  })

  it('nudges you to plant once 3 packets wait and the box is idle', () => {
    const game = boxWith(16)
    expect(plantNudge(game)).toBe(false)
    loseBeans(game, 'pot', 8, 'pigeon')
    expect(plantNudge(game)).toBe(true)
    dig(game, 0)
    plant(game, 0, 0)
    const { x, y } = center(game, 0)
    hold(game, x, y, WATER_FILL_MS + 100)
    expect(plantNudge(game)).toBe(false)
  })
})
