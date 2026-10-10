import { beforeAll, describe, expect, it } from 'vitest'

import {
  Bot,
  BOTS,
  runRoute,
  runStretch,
  type BotName,
  type BotProfile,
  type StretchRun
} from './bot'
import { UPGRADES } from './economy'
import { createGame, enterStretch } from './game'
import { PACES, runMinutes } from './pacing'
import { ROUTE, type StretchDef, type StretchId } from './route'

const SEEDS = [1, 2, 3, 4, 5]
/** Whole-route runs average over more seeds, since one hit more or less swings a stretch. */
const ROUTE_SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)

/** Beans an average player spills per stretch, from PLAN.md section 5. */
const SPILL_BUDGET: Partial<Record<StretchId, number>> = {
  kitchen: 50,
  street: 330,
  market: 315,
  park: 340,
  hill: 255,
  bridge: 175
}

/** Runs a bot through one stretch for each seed. */
function runs(
  profile: BotProfile,
  stretch: number,
  route: readonly StretchDef[] = ROUTE
): StretchRun[] {
  return SEEDS.map(seed => {
    const game = createGame(seed, route)
    enterStretch(game, stretch)
    return runStretch(game, new Bot(profile, seed))
  })
}

const mean = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length

/** Whole-route runs for each of ROUTE_SEEDS, per bot, made once before the tests. */
const routeRuns = new Map<BotName, StretchRun[][]>()
const route = (name: BotName) => routeRuns.get(name)!

/** Mean of `pick` over every seed's run of stretch `index`. */
function stretchMean(
  name: BotName,
  index: number,
  pick: (run: StretchRun) => number
): number {
  return mean(route(name).map(runs => pick(runs[index]!)))
}

/** Beans spilled from the kitchen to the bridge, averaged over seeds. */
function routeSpill(name: BotName): number {
  return mean(
    route(name).map(runs =>
      runs.slice(0, 6).reduce((sum, run) => sum + run.spilled, 0)
    )
  )
}

describe('balance', () => {
  // About 1s of simulation per bot, longer while other test files run alongside.
  beforeAll(() => {
    for (const name of Object.keys(BOTS) as BotName[])
      routeRuns.set(
        name,
        ROUTE_SEEDS.map(seed => runRoute(BOTS[name], seed))
      )
  }, 60_000)

  it('every bot walks the whole route to Grandma', () => {
    for (const name of Object.keys(BOTS) as BotName[])
      for (const runs of route(name)) {
        expect(runs).toHaveLength(ROUTE.length)
        expect(runs.every(run => run.finished)).toBe(true)
      }
  })

  it.each(ROUTE.slice(0, 6).map((def, index) => [def.id, index] as const))(
    'the average bot spills the %s budget within 25%',
    (id, index) => {
      const budget = SPILL_BUDGET[id]!
      const spilled = stretchMean('average', index, run => run.spilled)
      expect(spilled).toBeGreaterThan(budget * 0.75)
      expect(spilled).toBeLessThan(budget * 1.25)
    }
  )

  it('the sloppy bot spills about 1.8 times what the average bot does', () => {
    const ratio = routeSpill('sloppy') / routeSpill('average')
    expect(ratio).toBeGreaterThan(1.5)
    expect(ratio).toBeLessThan(2.2)
  })

  it('a careful bot spills only its three ambushes to the park, and little in the wind', () => {
    expect(stretchMean('careful', 0, run => run.spilled)).toBe(0)
    // Stopping doesn't save you from Mrs Pryce, the sale or Bruno, and careful players stop.
    for (const index of [1, 2, 3]) {
      expect(stretchMean('careful', index, run => run.spilled)).toBeGreaterThan(
        50
      )
      expect(stretchMean('careful', index, run => run.spilled)).toBeLessThan(
        160
      )
    }
    // Gusts cost even careful players a few beans on the long hill and bridge.
    for (const index of [4, 5])
      expect(stretchMean('careful', index, run => run.spilled)).toBeLessThan(60)
  })

  it('every kind of player earns four upgrades by the end of the route', () => {
    const costs = UPGRADES.map(u => u.cost).sort((a, b) => a - b)
    const four = costs.slice(0, 4).reduce((sum, cost) => sum + cost, 0)
    for (const name of Object.keys(BOTS) as BotName[]) {
      const coins = mean(
        route(name).map(runs => runs.reduce((sum, run) => sum + run.coins, 0))
      )
      expect(coins, name).toBeGreaterThan(four)
    }
  })

  it('finds 7 to 9 pages on an average run, more on a sloppy one, and 3 on a careful one', () => {
    const pages = (name: BotName) =>
      route(name).map(runs =>
        runs.reduce((sum, run) => sum + run.pages.length, 0)
      )
    expect(mean(pages('average'))).toBeGreaterThanOrEqual(7)
    expect(mean(pages('average'))).toBeLessThanOrEqual(9)
    expect(mean(pages('sloppy'))).toBeGreaterThan(mean(pages('average')))
    // The three ambushes spell one line each, even for players who never spill.
    expect(Math.min(...pages('careful'))).toBeGreaterThanOrEqual(3)
  })

  it('takes an average player 65 to 120 minutes on a desktop and on a phone', () => {
    const ids = ROUTE.map(def => def.id)
    for (const pace of [PACES.desktop, PACES.phone]) {
      const minutes = mean(
        route('average').map(runs => runMinutes(runs, ids, pace).total)
      )
      expect(minutes).toBeGreaterThanOrEqual(65)
      expect(minutes).toBeLessThanOrEqual(120)
    }
  })

  it('about half the average bots tip the pot on Grandma’s steps', () => {
    const tipped = (name: BotName) =>
      mean(route(name).map(runs => +runs[6]!.doorTipped))
    expect(tipped('average')).toBeGreaterThan(0.3)
    expect(tipped('average')).toBeLessThan(0.7)
    expect(tipped('careful')).toBe(0)
    expect(tipped('sloppy')).toBeGreaterThan(tipped('average'))
  })

  it('hurrying the street spills far more than strolling it', () => {
    // A street with nobody on it, so only the ground's kicks differ.
    const still = { gain: 0, stopAt: 9, heed: 1 }
    const calm = ROUTE.map(def => ({
      ...def,
      neighbours: [],
      cyclists: [],
      ambush: null
    }))
    const stroll = runs({ ...BOTS.average, ...still, hurryRate: 0 }, 1, calm)
    const hurry = runs(
      { ...BOTS.average, ...still, hurryRate: 100, hurryS: 1e3, hurry: 1 },
      1,
      calm
    )
    expect(mean(stroll.map(r => r.spilled))).toBe(0)
    expect(mean(hurry.map(r => r.spilled))).toBeGreaterThan(150)
  })

  it('the river keeps about 30% of what spills on the bridge', () => {
    // Each bean rolls its own chance, so one run can lose a little more.
    const lost = stretchMean('average', 5, run => run.lost)
    const spilled = stretchMean('average', 5, run => run.spilled)
    expect(lost).toBeGreaterThan(spilled * 0.2)
    expect(lost).toBeLessThan(spilled * 0.33)
  })

  // A bot that never pours floods the pot on the long hill and never reaches the kiosk,
  // so its runs last the full 900s of simulation.
  it('pouring the rain off keeps the hill down', () => {
    const average = mean(runs(BOTS.average, 4).map(r => r.spilled))
    // Never pouring the rain off lowers the spill line for the whole climb.
    const soggy = mean(
      runs({ ...BOTS.average, pourAt: Infinity }, 4).map(r => r.spilled)
    )
    expect(soggy).toBeGreaterThan(average)
  }, 30_000)

  it.each([
    ['street', 1, 200],
    ['market', 2, 80],
    ['park', 3, 180]
  ] as const)(
    'walking the %s without reading anyone costs its big hits',
    (_id, index, least) => {
      const blind = mean(
        runs({ ...BOTS.careful, heed: 0 }, index).map(r => r.spilled)
      )
      expect(blind).toBeGreaterThan(least)
    }
  )

  it('replays the same run from the same seed', () => {
    const a = runs(BOTS.average, 1).map(r => r.spilled)
    const b = runs(BOTS.average, 1).map(r => r.spilled)
    expect(a).toEqual(b)
  })
})
