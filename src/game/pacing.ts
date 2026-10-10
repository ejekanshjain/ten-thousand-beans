import type { StretchRun } from './bot'
import type { StretchId } from './route'

/**
 * How a kind of player turns a bot's run into real minutes (PLAN.md section 5): bots walk
 * without reading captions or hesitating, and pick beans up in no time at all.
 */
export interface Pace {
  /** Real walking time per bot walking minute. */
  walkFactor: number
  /** Seconds per bean picked up in Pickup. */
  tb: number
  /** Seconds per bean fished out of a drain. */
  td: number
  /** Scale on the chore minutes in CHORE_MINUTES. */
  choreFactor: number
}

/** The players section 5 estimates: average on a desktop and a phone, and unskilled on a phone. */
export const PACES = {
  desktop: { walkFactor: 1.5, tb: 1.5, td: 15, choreFactor: 1 },
  phone: { walkFactor: 1.5, tb: 1.95, td: 15, choreFactor: 1 },
  unskilled: { walkFactor: 1.95, tb: 2.3, td: 25, choreFactor: 1.3 }
} satisfies Record<string, Pace>

/**
 * Minutes of chores per stretch from the first plan: gossip jotting, the window box, the
 * mud, tutorials and the start screen (counted with the kitchen).
 */
const CHORE_MINUTES: Partial<Record<StretchId, number>> = {
  kitchen: 1.5,
  street: 1,
  market: 1,
  park: 2.5,
  hill: 2,
  bridge: 2,
  door: 2
}

/** Minutes at each kiosk, which every stretch but the last ends at. */
const KIOSK_MINUTES = 1

/** A tip-over on Grandma's steps: dustpan scoops of 4s each, and loose beans to tweeze. */
const DOOR_SCOOPS = 17
const DOOR_SCOOP_S = 4
const DOOR_LOOSE = 40

/** One run's estimated minutes, split the way section 5's table splits them. */
export interface RunMinutes {
  walking: number
  pickup: number
  chores: number
  total: number
  /** Pickup and drains as a share of the total. */
  pickupShare: number
}

/** Estimates the real minutes of a whole-route bot run (`runRoute`) for a kind of player. */
export function runMinutes(
  runs: readonly StretchRun[],
  ids: readonly StretchId[],
  pace: Pace
): RunMinutes {
  let walking = 0
  let pickup = 0
  let chores = 0
  runs.forEach((run, i) => {
    const id = ids[i]!
    walking += (run.seconds * pace.walkFactor + run.backSeconds) / 60
    // A tip on Grandma's steps puts the whole pot down, which the dustpan scoops up.
    if (run.doorTipped)
      pickup += (DOOR_SCOOPS * DOOR_SCOOP_S + DOOR_LOOSE * pace.tb) / 60
    else pickup += (run.picked * pace.tb) / 60
    pickup += (run.fished * pace.td) / 60
    chores += (CHORE_MINUTES[id] ?? 0) * pace.choreFactor
    if (id !== 'door') chores += KIOSK_MINUTES
  })
  const total = walking + pickup + chores
  return { walking, pickup, chores, total, pickupShare: pickup / total }
}
