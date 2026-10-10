import { describe, expect, it } from 'vitest'

import {
  createGame,
  devSpill,
  enterStretch,
  pickUp,
  setDown,
  type Game
} from './game'
import { total } from './ledger'
import { knotSpot, netDrag, netPress, netRelease } from './net'
import { checkPackets } from './packets'
import { devPigeon } from './pigeons'
import { ROUTE } from './route'
import { simulate } from './testing'
import {
  NET_GIVE_UP,
  NET_KNOT_CIRCLES,
  NET_KNOT_MAX,
  NET_KNOTS
} from './tuning'
import { devOwn } from './upgrades'

/** The park with the pot set down on open ground, owning the Pigeon Net unless `net` is false. */
function grounded(net = true): Game {
  const game = createGame(1, ROUTE)
  enterStretch(game, 3)
  if (net) expect(devOwn(game, 'net')).toBe(true)
  game.walker.x = 1_000
  setDown(game)
  expect(game.scene).toBe('grounded')
  simulate(game, 0.02)
  game.flock.waitMs = Infinity
  return game
}

let clock = 0

/** Draws `turns` circles of radius 22 round knot `i`, clockwise for `dir` 1. */
function circle(game: Game, i: number, dir: 1 | -1, turns: number): void {
  const at = knotSpot(game, i, { x: 0, y: 0 })
  const r = 22
  expect(netPress(game, at.x + r, at.y, clock)).toBe(true)
  // One sample past the last full turn, so rounding can't leave it a hair short.
  for (let k = 1; k <= 24 * turns + 1; k++) {
    const a = (dir * k * Math.PI * 2) / 24
    clock += 16
    netDrag(game, at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, clock)
  }
  netRelease(game)
}

/** Untangles every knot the right way. */
function untangle(game: Game): void {
  for (const [i, knot] of game.net.knots.entries())
    if (knot.left > 0) circle(game, i, knot.dir, knot.left)
}

/** Seconds until the first pigeon has walked over and perched on the rim. */
const PERCH_S = 9

describe('the Pigeon Net', () => {
  it('goes over the pot at a set-down and tangles when the first pigeon arrives', () => {
    const game = grounded()
    expect(game.net.phase).toBe('laid')
    devPigeon(game)
    expect(game.net.phase).toBe('tangled')
    expect(game.net.knots).toHaveLength(NET_KNOTS)
    expect(game.net.knots.every(k => k.left === NET_KNOT_CIRCLES)).toBe(true)
    // Neighbouring knots turn opposite ways.
    expect(game.net.knots[0]!.dir).toBe(-game.net.knots[1]!.dir)
    // A second pigeon doesn't tangle it again.
    untangle(game)
    devPigeon(game)
    expect(game.net.phase).toBe('ready')
  })

  it('protects nothing while tangled, so pigeons on the rim eat from the pot', () => {
    const game = grounded()
    devPigeon(game)
    simulate(game, PERCH_S + 3)
    expect(game.flock.eaten).toBeGreaterThan(0)
    expect(game.counts.pot).toBe(10_000 - game.flock.eaten)
  })

  it('loosens a knot one circle at a time the right way, and tightens it the wrong way', () => {
    const game = grounded()
    devPigeon(game)
    const knot = game.net.knots[0]!
    circle(game, 0, knot.dir, 1)
    expect(knot.left).toBe(NET_KNOT_CIRCLES - 1)
    circle(game, 0, -knot.dir as 1 | -1, 1)
    expect(knot.left).toBe(NET_KNOT_CIRCLES)
    for (let i = 0; i < 6; i++) circle(game, 0, -knot.dir as 1 | -1, 1)
    expect(knot.left).toBe(NET_KNOT_MAX)
    circle(game, 0, knot.dir, NET_KNOT_MAX)
    expect(knot.left).toBe(0)
    expect(game.net.phase).toBe('tangled')
    // An undone knot ignores presses; the others still take them.
    const at = knotSpot(game, 0, { x: 0, y: 0 })
    expect(netPress(game, at.x, at.y, clock)).toBe(false)
    untangle(game)
    expect(game.net.phase).toBe('ready')
  })

  it('keeps pigeons out of the pot once untangled: they peck the net, give up and fly off', () => {
    const game = grounded()
    devPigeon(game)
    untangle(game)
    let foiled = 0
    simulate(game, PERCH_S + 4, (_, g) => {
      for (const p of g.flock.pigeons) foiled = Math.max(foiled, p.foiled)
    })
    expect(foiled).toBe(NET_GIVE_UP)
    expect(game.flock.eaten).toBe(0)
    expect(game.counts.pot).toBe(10_000)
    expect(game.flock.pigeons.every(p => p.phase === 'flee')).toBe(true)
  })

  it('flings pigeons off the rim the moment it pulls tight', () => {
    const game = grounded()
    devPigeon(game)
    simulate(game, PERCH_S)
    expect(game.flock.pigeons[0]!.phase).toBe('eat')
    untangle(game)
    simulate(game, 0.02)
    expect(game.flock.pigeons[0]!.phase).toBe('flee')
  })

  it('needs untangling again after every set-down', () => {
    const game = grounded()
    devPigeon(game)
    untangle(game)
    expect(pickUp(game)).toBe(true)
    setDown(game)
    simulate(game, 0.02)
    expect(game.net.phase).toBe('laid')
    devPigeon(game)
    expect(game.net.phase).toBe('tangled')
  })

  it('works the same in Pickup, round the pot seen from above', () => {
    const game = createGame(1, ROUTE)
    enterStretch(game, 3)
    devOwn(game, 'net')
    game.walker.x = 1_000
    devSpill(game, 20)
    simulate(game, 1)
    setDown(game)
    expect(game.scene).toBe('pickup')
    simulate(game, 0.02)
    devPigeon(game)
    expect(game.net.phase).toBe('tangled')
    untangle(game)
    expect(game.net.phase).toBe('ready')
    expect(total(game.counts)).toBe(10_000)
    expect(checkPackets(game.counts, game.packets)).toBeNull()
  })

  it('does nothing without the upgrade', () => {
    const game = grounded(false)
    expect(game.net.phase).toBe('off')
    devPigeon(game)
    expect(game.net.phase).toBe('off')
    const at = knotSpot(game, 0, { x: 0, y: 0 })
    expect(netPress(game, at.x, at.y, 0)).toBe(false)
  })
})
