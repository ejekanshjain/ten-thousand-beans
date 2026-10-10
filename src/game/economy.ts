import type { UpgradeDef } from '../shared'
import type { StretchId } from './route'
import { CLEAN_BONUS, CLEAN_FULL, CLEAN_HALF } from './tuning'

/** An upgrade from PLAN.md section 3. `built` is false until its milestone makes it work. */
export interface BeanUpgrade extends UpgradeDef {
  built: boolean
}

/**
 * The six upgrades and their downsides. They cost 720 coins in all, more than an average
 * run earns (about 550), so you pick about four or five. A careful run (about 420) still
 * affords the four cheapest.
 */
export const UPGRADES: readonly BeanUpgrade[] = [
  {
    id: 'tweezers',
    name: 'Wider Tweezers',
    cost: 70,
    helps: 'Grab wider and lift up to 5 beans at once',
    newChore: 'Beans slip out more often',
    built: true
  },
  {
    id: 'shoes',
    name: 'Grippy Shoes',
    cost: 80,
    helps: 'Twice as long to save a slip',
    newChore: 'Clean the mud off your shoes after the park',
    built: true
  },
  {
    id: 'net',
    name: 'Pigeon Net',
    cost: 90,
    helps: "Pigeons can't eat from the pot",
    newChore: 'Untangle it every time you set the pot down',
    built: true
  },
  {
    id: 'box',
    name: 'Bigger Window Box',
    cost: 120,
    helps: '6 slots instead of 3',
    newChore: 'Every slot needs its own watering',
    built: true
  },
  {
    id: 'lid',
    name: 'Pot Lid',
    cost: 160,
    helps: 'Stops big spills',
    newChore: 'Rattles, and beans hop out on bumps',
    built: true
  },
  {
    id: 'tall',
    name: 'Taller Pot',
    cost: 200,
    helps: 'Sloshes less',
    newChore: 'Tips over at a smaller angle',
    built: true
  }
]

/** Upgrades that work so far, which the kiosk's shop sells. */
export const SHOP_UPGRADES: readonly BeanUpgrade[] = UPGRADES.filter(
  u => u.built
)

/**
 * The clean stretch bonus for spilling `spilled` beans on stretch `id`: in full at
 * CLEAN_FULL or fewer, half (rounded down) at CLEAN_HALF or fewer, else nothing.
 */
export function cleanBonus(id: StretchId, spilled: number): number {
  const full = (CLEAN_BONUS as Partial<Record<StretchId, number>>)[id] ?? 0
  if (spilled <= CLEAN_FULL) return full
  if (spilled <= CLEAN_HALF) return Math.floor(full / 2)
  return 0
}

/** The full clean bonus a stretch can pay. */
export function fullBonus(id: StretchId): number {
  return (CLEAN_BONUS as Partial<Record<StretchId, number>>)[id] ?? 0
}
