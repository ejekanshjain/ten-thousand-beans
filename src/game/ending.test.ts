import { describe, expect, it } from 'vitest'

import { startTimer } from '../shared'
import { COUNT_FULL, countAt, doorDrag, doorPress, doorRelease } from './door'
import {
  createGame,
  enterStretch,
  updateGame,
  type Game,
  type GameInput
} from './game'
import { move, total } from './ledger'
import { loseBeans } from './packets'
import { dustpanScoop, scoopsToClear } from './pickup'
import { ROUTE } from './route'
import type { ReplayRequest } from './replays'
import { idleInput, simulate, STEP_MS } from './testing'
import {
  CLEAN_BONUS,
  COUNT_MS,
  DOOR_BARK_X,
  GROW_MS,
  MAT_X,
  MAT_Y,
  SECRET_MS,
  STEW_X,
  STEW_Y,
  TASTE_MS
} from './tuning'
import { checkBox } from './windowBox'

/** A run on Grandma's door stretch with the pot in your hands. */
function atTheDoor(seed = 1): Game {
  const game = createGame(seed, ROUTE)
  enterStretch(game, 6)
  return game
}

/** Strolls up the steps until the dog barks. */
function walkToTheDog(game: Game): void {
  const input = idleInput()
  input.walk.walk = 1
  for (let i = 0; i < 2000 && game.door.dog === 'waiting'; i++) {
    updateGame(game, STEP_MS, input)
    game.out.length = 0
  }
}

/** Walks on with `drive` setting anything else, for `seconds`. */
function walk(
  game: Game,
  seconds: number,
  drive: (input: GameInput) => void = () => {}
): void {
  simulate(game, seconds, input => {
    input.walk.walk = 1
    drive(input)
  })
}

describe("Grandma's door", () => {
  it('barks on the steps, and stopping hides exactly one bean', () => {
    const game = atTheDoor()
    walkToTheDog(game)
    expect(game.door.dog).toBe('bark')
    expect(game.walker.x).toBeGreaterThanOrEqual(DOOR_BARK_X)
    simulate(game, 1.5)
    expect(game.door.dog).toBe('made')
    expect(game.counts.hidden).toBe(1)
    expect(game.counts.pot).toBe(COUNT_FULL)
    expect(total(game.counts)).toBe(10_000)
  })

  it('leaning toward the dog saves you too', () => {
    const game = atTheDoor()
    walkToTheDog(game)
    walk(game, 1.5, input => {
      input.tilt.absolute = game.door.dog === 'bark' ? 6 / 40 : 0
    })
    expect(game.door.dog).toBe('made')
    expect(game.counts.hidden).toBe(1)
    // Leaning on the stairs costs a bean or two, but the pot stays up.
    expect(game.counts.pot).toBeGreaterThan(COUNT_FULL - 5)
  })

  it('walking on tips the whole pot, and one bean still hides', () => {
    const game = atTheDoor()
    walkToTheDog(game)
    const replays: ReplayRequest[] = []
    const input = idleInput()
    input.walk.walk = 1
    for (let ms = 0; ms < 6000; ms += STEP_MS) {
      updateGame(game, STEP_MS, input)
      for (const e of game.out) if (e.type === 'replay') replays.push(e.replay)
      game.out.length = 0
    }
    expect(game.door.dog).toBe('tipped')
    expect(game.door.dustpan).toBe(true)
    expect(game.counts.pot).toBe(0)
    expect(game.counts.hidden).toBe(1)
    expect(game.counts.loose).toBe(40)
    expect(game.counts.pile).toBe(COUNT_FULL - 40)
    expect(total(game.counts)).toBe(10_000)
    expect(replays).toHaveLength(1)
    expect(replays[0]).toMatchObject({ auto: true, share: true })
    expect(replays[0]?.label).toMatch(/^Carried for \d+:\d\d\. So close\.$/)
    // Grandma's dustpan clears the whole pile in about 17 scoops.
    const scoops = scoopsToClear(game.counts.pile, dustpanScoop)
    expect(scoops).toBeGreaterThanOrEqual(15)
    expect(scoops).toBeLessThanOrEqual(19)
  })

  it('counts with seed packets still unplanted', () => {
    const game = atTheDoor()
    loseBeans(game, 'pot', 5, 'pigeon')
    walkToTheDog(game)
    simulate(game, 1.5)
    walk(game, 4)
    expect(game.scene).toBe('count')
    expect(game.packets.list).toHaveLength(1)
    expect(game.chores.list()).toHaveLength(0)
  })

  it('grows packets the busy box can’t take on her windowsill, into the stew', () => {
    const game = atTheDoor()
    loseBeans(game, 'pot', 20, 'river')
    walkToTheDog(game)
    simulate(game, 1.5)
    walk(game, 4)
    expect(game.scene).toBe('count')
    // With the box idle, the packets wait for you to plant them.
    simulate(game, 0.5)
    expect(game.packets.list).toHaveLength(3)
    // You plant the first packet and water it: the batch starts.
    const first = game.packets.list.shift()!
    game.counts.packets -= first.beans
    game.counts.growing += first.beans
    game.box.slots[0]!.packets.push(first)
    game.box.slots[0]!.state = 'watered'
    game.box.batch = startTimer('Beans growing', GROW_MS)
    simulate(game, 0.1)
    expect(game.packets.list).toHaveLength(0)
    expect(game.box.sill).toHaveLength(2)
    expect(game.door.says).toMatch(/windowsill/)
    expect(game.fx.captions.map(c => c.text)).toContain(
      'Grandma took 2 seed packets.'
    )
    expect(checkBox(game.counts, game.box)).toBeNull()
    const pot = game.counts.pot
    game.box.batch.endsAt = Date.now() - 1
    simulate(game, 0.1)
    expect(game.counts.pot).toBe(pot + 20 - first.beans)
    expect(game.box.sill).toHaveLength(0)
    expect(game.box.slots[0]!.state).toBe('grown')
    expect(checkBox(game.counts, game.box)).toBeNull()
    expect(total(game.counts)).toBe(10_000)
  })
})

describe('the count and the ending', () => {
  /** Reaches the count with `growing` beans still in the window box. */
  function counting(growing = 0): Game {
    const game = atTheDoor()
    if (growing > 0) {
      game.counts.pot -= growing
      game.counts.growing += growing
    }
    walkToTheDog(game)
    simulate(game, 1.5)
    walk(game, 4)
    expect(game.scene).toBe('count')
    return game
  }

  it('counts along a rising curve that never goes back', () => {
    let last = 0
    for (let p = 0; p <= 1; p += 0.01) {
      const n = countAt(p)
      expect(n).toBeGreaterThanOrEqual(last)
      last = n
    }
    expect(countAt(1)).toBe(COUNT_FULL)
    expect(countAt(0.5)).toBeLessThan(COUNT_FULL / 4)
  })

  it('stretches the count to reach the shortfall as the batch grows', () => {
    const game = counting(16)
    const batch = startTimer('Beans growing', 40_000)
    game.box.batch = batch
    // The wall clock runs with the simulation.
    const tick = () => void (batch.endsAt -= STEP_MS)
    simulate(game, COUNT_MS / 1000, tick)
    expect(game.door.holding).toBe(false)
    expect(game.door.counted).toBeLessThan(COUNT_FULL - 16)
    simulate(game, 40 - COUNT_MS / 1000 - 1, tick)
    expect(game.door.counted).toBeLessThan(COUNT_FULL - 16)
    simulate(game, 1.1, tick)
    expect(game.door.counted).toBe(COUNT_FULL - 16)
  })

  it('pays the door clean bonus when she starts counting after a clean walk', () => {
    const game = counting()
    expect(game.wallet.coins()).toBe(CLEAN_BONUS.door)
    expect(game.stats.stretches[6]?.bonus).toBe(CLEAN_BONUS.door)
  })

  it('stops at 9,999 and asks for the doormat', () => {
    const game = counting()
    simulate(game, COUNT_MS / 1000 + 0.5)
    expect(game.door.counted).toBe(COUNT_FULL)
    expect(game.door.phase).toBe('doormat')
  })

  it('holds at the shortfall while beans grow, then carries on after the harvest', () => {
    const game = counting(16)
    simulate(game, COUNT_MS / 1000 + 2)
    expect(game.door.counted).toBe(COUNT_FULL - 16)
    expect(game.door.phase).toBe('count')
    expect(game.door.says).toBe('Still 16 short, dear.')
    // The harvest goes straight into the stew at the door.
    game.counts.growing -= 16
    game.counts.pot += 16
    simulate(game, 0.1)
    expect(game.door.says).toBe('There we are.')
    simulate(game, 1.9)
    expect(game.door.counted).toBe(COUNT_FULL)
    expect(game.door.phase).toBe('doormat')
    expect(game.door.says).toBe('One is missing.')
  })

  it('names the packets she takes even as harvested beans arrive', () => {
    const game = atTheDoor()
    loseBeans(game, 'pot', 30, 'river')
    walkToTheDog(game)
    simulate(game, 1.5)
    walk(game, 4)
    simulate(game, COUNT_MS / 1000 + 2)
    expect(game.door.says).toBe('Still 30 short, dear.')
    // In one visit to the box: a pod goes into the stew, and you plant and water a packet.
    const pod = game.packets.list.shift()!
    move(game.counts, 'packets', 'pot', pod.beans)
    const planted = game.packets.list.shift()!
    move(game.counts, 'packets', 'growing', planted.beans)
    game.box.slots[0]!.packets.push(planted)
    game.box.slots[0]!.state = 'watered'
    game.box.batch = startTimer('Beans growing', GROW_MS)
    const left = game.packets.list.length
    simulate(game, 0.1)
    expect(game.door.says).toBe(
      "There we are. Pass those here, dear. They'll grow on my windowsill."
    )
    expect(game.fx.captions.map(c => c.text)).toContain(
      `Grandma took ${left} seed packets.`
    )
    // Once she has said it, she says how short she still is.
    simulate(game, 6)
    expect(game.door.says).toMatch(/^Still \d+ short, dear\.$/)
  })

  it('finds the doormat bean, drops it in to make 10,000, and ends', () => {
    const game = counting()
    simulate(game, COUNT_MS / 1000 + 0.5)
    // A short lift drops the mat back down.
    expect(doorPress(game, MAT_X, MAT_Y)).toBe(true)
    doorDrag(game, MAT_X, MAT_Y - 30)
    doorRelease(game)
    expect(game.door.matUp).toBe(false)
    doorPress(game, MAT_X, MAT_Y)
    doorDrag(game, MAT_X, MAT_Y - 90)
    doorRelease(game)
    expect(game.door.matUp).toBe(true)
    // Dropped short of the stew, it stays out.
    const bean = game.door.bean
    expect(doorPress(game, bean.x, bean.y)).toBe(true)
    doorDrag(game, 60, 300)
    doorRelease(game)
    expect(game.counts.hidden).toBe(1)
    doorPress(game, 60, 300)
    doorDrag(game, STEW_X, STEW_Y)
    doorRelease(game)
    expect(game.counts.pot).toBe(10_000)
    expect(game.counts.hidden).toBe(0)
    expect(game.door.phase).toBe('taste')
    simulate(game, TASTE_MS / 1000 + 0.1)
    expect(game.door.phase).toBe('secret')
    expect(game.door.secret?.count).toBeGreaterThan(20)
    simulate(game, SECRET_MS / 1000)
    expect(game.door.phase).toBe('done')
    expect(total(game.counts)).toBe(10_000)
  })
})
