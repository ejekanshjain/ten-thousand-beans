import Matter from 'matter-js'
import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import { DrainWorld, type DrainEvent } from './drainWorld'
import {
  createGame,
  devSpill,
  enterStretch,
  pickupTap,
  setDown,
  updateGame,
  type Game
} from './game'
import { FISH_CHORE } from './gate'
import { ROUTE } from './route'
import { idleInput, STEP_MS } from './testing'
import {
  FRIDGE_GAP_X,
  FRIDGE_GAP_Y,
  GUNK_TOP,
  SHAFT_LEFT,
  SHAFT_RIGHT
} from './tuning'
import { checkZones } from './zones'

/** A shaft with `beans` beans, settled on the gunk. */
function settled(beans: number) {
  const world = new DrainWorld('drain', beans, rng(4))
  for (let i = 0; i < 180; i++)
    world.step(STEP_MS, { x: 300, y: 130, down: false })
  return world
}

/** Puts the hook at (x, y) as if it had been steered there and left. */
function placeHook(world: DrainWorld, x: number, y: number) {
  Object.assign(world.hook, { x, y, targetX: x, targetY: y, vx: 0, vy: 0 })
}

/** Moves the pointer in a straight line from the hook to (toX, toY) at `speed` u/s. Returns every event. */
function steer(world: DrainWorld, toX: number, toY: number, speed = 60) {
  const events: DrainEvent[] = []
  let x = world.hook.x
  let y = world.hook.y
  const stepLength = (speed * STEP_MS) / 1000
  for (let i = 0; i < 2_000; i++) {
    const gap = Math.hypot(toX - x, toY - y)
    if (gap <= 0.5) break
    const k = Math.min(1, stepLength / gap)
    x += (toX - x) * k
    y += (toY - y) * k
    events.push(world.step(STEP_MS, { x, y, down: true }))
  }
  return events
}

describe('the coat hanger', () => {
  it('catches a bean only when the rising cup comes within 10 u of it', () => {
    const near = settled(1)
    const bean = near.beans[0]!.position
    placeHook(near, bean.x, bean.y + 4)
    expect(steer(near, bean.x, bean.y - 60)).toContain('caught')

    const far = settled(1)
    const other = far.beans[0]!.position
    placeHook(far, other.x + 26, other.y + 4)
    expect(steer(far, other.x + 26, other.y - 60)).not.toContain('caught')
  })

  it('keeps a bean on a slow lift and drops it on a jerk', () => {
    const world = settled(1)
    const bean = world.beans[0]!.position
    placeHook(world, bean.x, bean.y + 4)
    expect(steer(world, bean.x, 300)).not.toContain('jerked')
    expect(world.held).not.toBeNull()
    // A sudden yank: the pointer jumps 250 u in one step.
    expect(world.step(STEP_MS, { x: 300, y: 50, down: true })).toBe('jerked')
    expect(world.held).toBeNull()
  })

  it('scrapes a bean off on the wall when moving fast beside it', () => {
    const world = settled(1)
    const bean = world.beans[0]!.position
    placeHook(world, bean.x, bean.y + 4)
    steer(world, bean.x, 420)
    steer(world, SHAFT_LEFT + 4, 420)
    expect(world.held).not.toBeNull()
    // Speed up gently, so only the scrape can drop it.
    const events: DrainEvent[] = []
    let y = world.hook.y
    for (let v = 20; v < 900 && world.held; v += 15) {
      y -= (v * STEP_MS) / 1000
      events.push(world.step(STEP_MS, { x: SHAFT_LEFT + 4, y, down: true }))
    }
    expect(events).toContain('scraped')
  })

  it('snags the sock instead of a bean and drops it on release', () => {
    const world = new DrainWorld('drain', 0, rng(1))
    const sock = world.junk.find(j => j.id === 'sock')!
    placeHook(world, sock.x, sock.y + 6)
    expect(steer(world, sock.x, sock.y - 80)).toContain('snagged')
    expect(world.heldJunk).toBe(sock)
    world.step(STEP_MS, { x: sock.x, y: 300, down: false })
    expect(world.heldJunk).toBeNull()
    expect(sock.y).toBe(sock.homeY)
  })

  it('puts a wedged bean back on top of the gunk after 2s', () => {
    const world = settled(1)
    const body = world.beans[0]!
    Matter.Body.setPosition(body, { x: SHAFT_LEFT - 30, y: 400 })
    Matter.Body.setStatic(body, true)
    for (let i = 0; i < 130; i++)
      world.step(STEP_MS, { x: 300, y: 130, down: false })
    expect(body.position.x).toBeGreaterThan(SHAFT_LEFT)
    expect(body.position.x).toBeLessThan(SHAFT_RIGHT)
    expect(body.position.y).toBeLessThan(GUNK_TOP)
  })
})

describe('fishing beans out from under the fridge', () => {
  /** Steps the whole game with the pointer pressed at (x, y). */
  function hold(game: Game, x: number, y: number, steps = 1) {
    const input = idleInput()
    input.pointer.x = x
    input.pointer.y = y
    input.pointer.down = true
    for (let i = 0; i < steps; i++) {
      updateGame(game, STEP_MS, input)
      game.out.length = 0
    }
  }

  it('lifts each bean out as a loose bean, then clears the chore', () => {
    const game = createGame(1, ROUTE)
    enterStretch(game, 0)
    devSpill(game, 2, 'drain')
    updateGame(game, STEP_MS, idleInput())
    expect(game.chores.list().map(c => c.label)).toContain('Fish 2 beans out')
    setDown(game)
    expect(pickupTap(game, FRIDGE_GAP_X, FRIDGE_GAP_Y)).toBe(true)
    expect(game.scene).toBe('drain')

    for (let round = 0; round < 2; round++) {
      // Let the beans settle, then hook the first one and lift it slowly.
      hold(game, 300, 200, 90)
      const bean = game.drain!.world.beans[0]!.position
      hold(game, bean.x, bean.y + 4, 60)
      for (
        let y = bean.y;
        y > 60 && game.drain?.world.held !== undefined;
        y -= 1
      )
        hold(game, bean.x, y)
    }
    expect(game.counts.drain).toBe(0)
    expect(game.counts.loose).toBe(2)
    expect(game.stats.fished).toBe(2)
    expect(game.chores.has(FISH_CHORE)).toBe(false)
    expect(checkZones(game.counts, game.zones.list)).toBeNull()
    hold(game, 300, 200, 90)
    expect(game.scene).toBe('pickup')
  })
})
