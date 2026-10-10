import { describe, expect, it } from 'vitest'

import {
  devSpill,
  pickUp,
  pickupDrag,
  pickupPress,
  pickupRelease,
  setDown
} from './game'
import {
  dustpanScoop,
  handScoop,
  popPitch,
  scoopsToClear,
  slipsAt,
  strainFor,
  streakCaption
} from './pickup'
import { simulate, testGame } from './testing'
import { PILE_X, PILE_Y, POT_X, POT_Y } from './tuning'

describe('strain', () => {
  it('reads the larger of jolt and carry speed, and clumps strain more', () => {
    expect(strainFor(0.5, 0, 1)).toEqual({ strain: 0.5, cause: 'jerky' })
    expect(strainFor(0.1, 1_400, 1)).toEqual({ strain: 1, cause: 'fast' })
    expect(strainFor(0.5, 0, 3).strain).toBeCloseTo(0.5 * 1.25 ** 2, 5)
    expect(strainFor(0.5, 0, 1, 0.65).strain).toBeCloseTo(0.5 / 0.65, 5)
  })

  it('lets a slippery bean slip only above the safe speed', () => {
    expect(slipsAt(100)).toBe(false)
    expect(slipsAt(200)).toBe(true)
  })
})

describe('streaks', () => {
  it('raises the pop pitch per bean up to a cap', () => {
    expect(popPitch(1)).toBe(1)
    expect(popPitch(11)).toBeCloseTo(1.4, 5)
    expect(popPitch(100)).toBe(1.6)
  })

  it('captions each mark once as it is crossed', () => {
    expect(streakCaption(8, 10)).toBe('10 in a row!')
    expect(streakCaption(10, 11)).toBeNull()
    expect(streakCaption(24, 27)).toBe('25 in a row. Show-off.')
  })
})

describe('a pickup round trip', () => {
  it('spills, sets down near the zone, tweezes every bean back and keeps the ledger whole', () => {
    const game = testGame()
    simulate(game, 0.7, input => void (input.tilt.rate = 1))
    // Level, so the beans stop pouring and the pot can go down.
    simulate(game, 1, input => void (input.tilt.absolute = 0))
    const spilled = game.counts.loose
    expect(spilled).toBeGreaterThan(0)
    expect(game.counts.pile).toBe(0)
    setDown(game)
    expect(game.scene).toBe('pickup')
    const world = game.pickup.world!
    const inZone = world.count
    let guard = 0
    while (world.count > 0 && guard++ < 500) {
      const body = world.beans[0]!
      pickupPress(game, body.position.x, body.position.y)
      game.pickup.world!.moveHeld(POT_X, POT_Y)
      pickupRelease(game, { x: POT_X, y: POT_Y, vx: 0, vy: 0 })
    }
    expect(game.stats.pickedUp).toBe(inZone)
    expect(game.counts.pot).toBe(10_000 - spilled + inZone)
    const others = game.zones.list.filter(z => z !== world.zone)
    expect(pickUp(game)).toBe(true)
    expect(game.zones.list).toEqual(others)
    expect(game.scene).toBe('walk')
  })

  it('points at beans set down beside but out of reach', () => {
    const game = testGame()
    devSpill(game, 5, 'loose', 300)
    setDown(game)
    expect(game.scene).toBe('grounded')
    expect(game.fx.captions.at(-1)).toMatchObject({
      text: 'Too far from the beans.',
      sub: 'Pick the pot up and set it down further on.'
    })
  })

  it('names the drain when the floor of a patch is clear but beans sit down it', () => {
    const game = testGame()
    devSpill(game, 2, 'drain')
    devSpill(game, 2)
    setDown(game)
    const world = game.pickup.world!
    while (world.count > 0) {
      const body = world.beans[0]!
      pickupPress(game, body.position.x, body.position.y)
      world.moveHeld(POT_X, POT_Y)
      pickupRelease(game, { x: POT_X, y: POT_Y, vx: 0, vy: 0 })
    }
    expect(game.fx.captions.at(-1)).toMatchObject({
      text: 'This patch is clear.',
      sub: '2 still down the drain. Click the grate.'
    })
  })

  it('says only this patch is clear while beans wait in another', () => {
    const game = testGame()
    devSpill(game, 4, 'loose', 1000)
    devSpill(game, 3)
    setDown(game)
    const world = game.pickup.world!
    while (world.count > 0) {
      const body = world.beans[0]!
      pickupPress(game, body.position.x, body.position.y)
      world.moveHeld(POT_X, POT_Y)
      pickupRelease(game, { x: POT_X, y: POT_Y, vx: 0, vy: 0 })
    }
    expect(game.fx.captions.at(-1)).toMatchObject({
      text: 'This patch is clear.',
      sub: '4 still out there.'
    })
  })
})

describe('scoop sizes', () => {
  it('clears a 400-bean tip pile in 14 hand scoops and a doorstep pile in 17 dustpan scoops', () => {
    expect(handScoop(400)).toBe(35)
    expect(scoopsToClear(400, handScoop)).toBe(14)
    expect(dustpanScoop(9_800)).toBe(1_180)
    expect(scoopsToClear(9_800, dustpanScoop)).toBe(17)
  })
})

describe('cupped hands', () => {
  it('turn a still press on the pile into a scoop that empties into the pot', () => {
    const game = testGame()
    devSpill(game, 300)
    setDown(game)
    const zone = game.pickup.world!.zone
    expect(zone.pile).toBe(100)
    pickupPress(game, PILE_X, PILE_Y)
    simulate(game, 0.4, input => {
      input.pointer.x = PILE_X
      input.pointer.y = PILE_Y
    })
    expect(game.pickup.carry.mode).toBe('hands')
    expect(game.pickup.carry.count).toBe(handScoop(100))
    // Rushing the hands at 900 u/s for half a second dribbles about four beans.
    simulate(game, 0.5, input => {
      input.pointer.vx = 900
    })
    const kept = game.pickup.carry.count
    expect(kept).toBeLessThan(handScoop(100) - 2)
    expect(game.counts.pile + game.counts.loose).toBe(300)
    pickupDrag(game, POT_X, POT_Y)
    pickupRelease(game, { x: POT_X, y: POT_Y, vx: 0, vy: 0 })
    expect(game.counts.pot).toBe(10_000 - 300 + kept)
  })

  it('keep the tweezers when the press moves before the cup fills', () => {
    const game = testGame()
    devSpill(game, 300)
    setDown(game)
    const body = game.pickup.world!.beans[0]!
    const { x, y } = body.position
    pickupPress(game, x, y)
    simulate(game, 0.4, input => {
      input.pointer.x = x + 20
      input.pointer.y = y
    })
    expect(game.pickup.carry.mode).toBe('tweezers')
  })
})
