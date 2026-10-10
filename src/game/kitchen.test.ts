import { describe, expect, it } from 'vitest'

import {
  createGame,
  devSpill,
  enterStretch,
  pickUp,
  pickupDrag,
  pickupPress,
  pickupRelease,
  leaveKiosk,
  pickupTap,
  setDown,
  updateGame
} from './game'
import { characterHit } from './hits'
import { pickupCatPosition } from './kitchen'
import { sellPage } from './kiosk'
import { total } from './ledger'
import { ROUTE } from './route'
import { idleInput, simulate, STEP_MS } from './testing'
import {
  CAT_AWAKE_MS,
  CAT_ENTER_MS,
  CAT_FIRST_BAT_MS,
  CAT_GROOM_FIRST_MS,
  CAT_GROOM_MS,
  CAT_SHOO_MS,
  CAT_WIGGLE_MS,
  DODGE_COINS,
  FRIDGE_GAP_X,
  FRIDGE_GAP_Y,
  POT_X,
  POT_Y
} from './tuning'
import { DEG } from './units'
import { checkZones } from './zones'

/** A run in the kitchen with the pot in your hands and the cat at the door. */
function atTheDoor(seed = 1) {
  const game = createGame(seed, ROUTE)
  enterStretch(game, 0)
  return game
}

const captions = (game: ReturnType<typeof createGame>) =>
  game.fx.captions.map(c => c.text)

describe('the opening gag', () => {
  it('has the counter cat paw one bean off within 15s, which opens Pickup', () => {
    const game = createGame(1, ROUTE)
    expect(game.scene).toBe('grounded')
    expect(game.kitchen.potOnCounter).toBe(true)
    expect(pickUp(game)).toBe(false)
    let seconds = 0
    while (game.scene !== 'pickup' && seconds < 15) {
      simulate(game, 0.5)
      seconds += 0.5
    }
    expect(game.scene).toBe('pickup')
    expect(seconds).toBeLessThan(8)
    expect(game.counts.loose).toBe(1)
    expect(game.pickup.world?.zone.id).toBe(game.kitchen.introZone)
  })

  it('makes that bean the first pickup, then sends the cat to the doorway', () => {
    const game = createGame(1, ROUTE)
    while (game.scene !== 'pickup') simulate(game, 0.5)
    const bean = game.pickup.world!.beans[0]!
    expect(pickupPress(game, bean.position.x, bean.position.y)).toBe(1)
    pickupDrag(game, POT_X, POT_Y)
    pickupRelease(game, { x: POT_X, y: POT_Y, vx: 0, vy: 0 })
    expect(game.counts.pot).toBe(10_000)
    expect(captions(game)).toContain('9,999 became 10,000 again.')
    expect(pickUp(game)).toBe(true)
    expect(game.kitchen.cat.phase).toBe('run')
    expect(game.kitchen.intro).toBe('done')
  })
})

describe('the door cat', () => {
  it('swats about 60 beans out of a pot that strolls past while it watches', () => {
    const game = atTheDoor()
    let swatted = false
    const seen = new Set<string>()
    simulate(game, 9, (input, g) => {
      input.walk.walk = 1
      swatted ||= g.kitchen.cat.phase === 'smug'
      for (const text of captions(g)) seen.add(text)
    })
    expect(swatted).toBe(true)
    const spilled = 10_000 - game.counts.pot
    expect(spilled).toBeGreaterThanOrEqual(60)
    expect(spilled).toBeLessThan(110)
    expect([...seen].some(t => t.startsWith('Cat swat.'))).toBe(true)
  })

  it('lets you past while it licks itself, once you stop and wait', () => {
    const game = atTheDoor()
    // Stroll to just short of the paw's reach, then stand still.
    simulate(game, 3.2, input => void (input.walk.walk = 1))
    // You take about 0.8s to come to a stop before the cat's timer starts.
    simulate(game, (CAT_AWAKE_MS + 1_000) / 1000)
    expect(game.kitchen.cat.phase).toBe('groom')
    simulate(game, 3.4, input => void (input.walk.walk = 1))
    expect(game.counts.pot).toBe(10_000)
    expect(captions(game)).toContain('Not today, cat.')
    expect(game.wallet.coins()).toBe(DODGE_COINS)
  })

  it('grooms for 3.5s the first time and 2.4s after that', () => {
    const game = atTheDoor()
    simulate(game, 3.2, input => void (input.walk.walk = 1))
    game.walker.x -= 60
    const groomStarts: number[] = []
    const groomEnds: number[] = []
    let last = game.kitchen.cat.phase
    simulate(game, 14, (_input, g) => {
      const phase = g.kitchen.cat.phase
      if (phase === 'groom' && last !== 'groom') groomStarts.push(g.timeMs)
      if (phase !== 'groom' && last === 'groom') groomEnds.push(g.timeMs)
      last = phase
    })
    expect(groomEnds[0]! - groomStarts[0]!).toBeCloseTo(CAT_GROOM_FIRST_MS, -2)
    expect(groomEnds[1]! - groomStarts[1]!).toBeCloseTo(CAT_GROOM_MS, -2)
  })
})

describe('character hits', () => {
  it('halve the splash when you lean against them', () => {
    const hit = { cause: 'cat', side: 1, kick: 2.6, tilt: 10, splash: 60 }
    const level = atTheDoor()
    expect(characterHit(level, hit)).toEqual({ splash: 60, leaned: false })
    const leaning = atTheDoor()
    leaning.pot.psiTarget = -6 * DEG
    expect(characterHit(leaning, hit)).toEqual({ splash: 30, leaned: true })
    expect(total(leaning.counts)).toBe(10_000)
  })
})

describe('the cat in kitchen Pickup', () => {
  /** Spills 20 beans by the counter and opens Pickup on them. */
  function pickupWithBeans() {
    const game = atTheDoor()
    devSpill(game, 20)
    setDown(game)
    expect(game.scene).toBe('pickup')
    return game
  }

  const batAfter = (CAT_FIRST_BAT_MS + CAT_ENTER_MS + CAT_WIGGLE_MS) / 1000

  it('bats exactly one bean under the fridge, through the ledger', () => {
    const game = pickupWithBeans()
    simulate(game, batAfter + 0.3)
    expect(game.counts.drain).toBe(1)
    expect(game.pickup.world!.zone.drain).toBe(1)
    expect(game.kitchen.pickupCat.knocks).toBe(1)
    expect(checkZones(game.counts, game.zones.list)).toBeNull()
    expect(captions(game)).toContain('Under the fridge. Of course.')
  })

  it('runs off for 12s when tapped during the wiggle', () => {
    const game = pickupWithBeans()
    simulate(game, (CAT_FIRST_BAT_MS + CAT_ENTER_MS + 300) / 1000)
    expect(game.kitchen.pickupCat.phase).toBe('wiggle')
    const cat = pickupCatPosition(game.kitchen.pickupCat)
    expect(pickupTap(game, cat.x + 10, cat.y)).toBe(true)
    simulate(game, (CAT_SHOO_MS - 1000) / 1000)
    expect(game.counts.drain).toBe(0)
    expect(captions(game)).not.toContain('Under the fridge. Of course.')
  })

  it('never comes for the opening bean', () => {
    const game = createGame(1, ROUTE)
    while (game.scene !== 'pickup') simulate(game, 0.5)
    simulate(game, batAfter + 5)
    expect(game.counts.drain).toBe(0)
  })
})

describe('a whole kitchen', () => {
  /** Tweezers every free bean into the pot, a clump at a time. */
  function potAll(game: ReturnType<typeof createGame>) {
    const world = game.pickup.world!
    for (let guard = 0; guard < 400 && world.beans.length > 0; guard++) {
      const bean = world.beans[0]!.position
      pickupPress(game, bean.x, bean.y)
      pickupDrag(game, POT_X, POT_Y)
      pickupRelease(game, { x: POT_X, y: POT_Y, vx: 0, vy: 0 })
    }
  }

  it('runs from the opening gag to the street with every bean back', () => {
    const game = createGame(3, ROUTE)
    while (game.scene !== 'pickup') simulate(game, 0.5)
    potAll(game)
    expect(pickUp(game)).toBe(true)

    // Stroll into the watching cat, then follow its beans and set the pot down there.
    simulate(game, 9, input => void (input.walk.walk = 1))
    const zone = game.zones.list.find(z => z.count > 0)!
    simulate(game, 8, input => {
      input.walk.walk = game.walker.x + 60 < zone.anchorX - 40 ? 1 : 0
    })
    setDown(game)
    expect(game.gossip.spelling?.line).toBe(0)

    // Jot the gossip while the cat comes for a bean, then pot the rest.
    game.gossip.jotHeld = true
    simulate(game, 7.8)
    game.gossip.jotHeld = false
    expect(game.gossip.status[0]).toBe('found')
    expect(game.counts.drain).toBe(1)
    potAll(game)

    // Fish the bean out from under the fridge and pot it too.
    expect(pickupTap(game, FRIDGE_GAP_X, FRIDGE_GAP_Y)).toBe(true)
    // Lower the hook under the bean, then lift slowly; try again if it misses.
    const input = idleInput()
    input.pointer.down = true
    input.pointer.x = game.drain!.world.hook.x
    input.pointer.y = game.drain!.world.hook.y
    let lifting = false
    // A call can change the scene, which TypeScript's narrowing doesn't see.
    const scene = (): string => game.scene
    for (let i = 0; i < 4_000 && scene() === 'drain'; i++) {
      const world = game.drain?.world
      const bean = world?.beans[0]?.position
      if (world && !world.held && bean) {
        if (lifting && world.hook.y < bean.y - 30) lifting = false
        if (!lifting) {
          input.pointer.x = bean.x
          input.pointer.y = Math.min(bean.y + 4, input.pointer.y + 2)
          if (world.hook.y >= bean.y + 2) lifting = true
        }
      }
      if (lifting || world?.held) input.pointer.y -= 1
      updateGame(game, STEP_MS, input)
      game.out.length = 0
    }
    expect(scene()).toBe('pickup')
    potAll(game)
    expect(pickUp(game)).toBe(true)

    // Walk out of the front door to the kiosk, sell the cat's line, and walk on.
    simulate(game, 14, input => void (input.walk.walk = 1))
    expect(game.scene).toBe('kiosk')
    expect(sellPage(game, 0)).toBe(true)
    expect(leaveKiosk(game)).toBe(true)
    expect(game.stretch).toBe(1)
    expect(game.counts.pot).toBe(10_000)
    expect(total(game.counts)).toBe(10_000)
  })
})
