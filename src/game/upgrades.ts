import { clamp, RubGesture } from '../shared'
import { caption, sound } from './effects'
import { emitBeans } from './emit'
import { GROUND_Y, POT_OFFSET_X, POT_RIM_Y } from './fx'
import { gateX, LEAVE_STRETCH } from './gate'
import { groundY, type StretchDef } from './route'
import { currentStretch, type Game } from './state'
import {
  BOX_SLOTS_BIG,
  CLUMP_MAX,
  DOOR_STOP_X,
  GATE_STOP,
  LID_FETCH,
  LID_FLIGHT_MS,
  LID_RATTLE_FROM,
  LID_RATTLE_PER,
  LID_THROW,
  MUD_STROKE_MIN,
  MUD_STROKES,
  SLIPPERY_CHANCE,
  STRETCH_EXIT,
  WHOA_MS,
  WHOA_MS_GRIPPY,
  WIDE_CLUMP_MAX,
  WIDE_GRAB,
  WIDE_SLIPPERY_CHANCE,
  WIDE_STRAIN_LIMIT
} from './tuning'

/** The chores the Pot Lid and Grippy Shoes add. Both hold the gate and the kiosk. */
export const LID_CHORE = 'fetch-lid'
export const MUD_CHORE = 'clean-mud'

/** Upgrade ids, as `economy.ts` defines them. */
export type UpgradeId = 'tweezers' | 'shoes' | 'net' | 'box' | 'lid' | 'tall'

/** The Pot Lid: on the pot, or knocked off by a big hit and lying on the route. */
export interface LidState {
  off: boolean
  /** Route x where it lies while off. */
  x: number
  /** Where it flew from, in world coordinates, and simulated ms since. */
  fromX: number
  fromY: number
  flightMs: number
  /** Simulated ms of rattle left, for the jitter. */
  rattleMs: number
  /** True once the first rattle explained itself. */
  taught: boolean
}

/** Mud caked on Grippy Shoes after the park, rubbed off at the kiosk. */
export interface MudState {
  on: boolean
  strokes: number
  rub: RubGesture
  /** True while a press that started on the boot is rubbing. */
  rubbing: boolean
}

/** The muddy boot's close-up at the kiosk, in design units, above the kiosk panel. */
export const MUD_BOOT = { x: 24, y: 78, w: 232, h: 236 } as const

export function createLid(): LidState {
  return {
    off: false,
    x: 0,
    fromX: 0,
    fromY: 0,
    flightMs: LID_FLIGHT_MS,
    rattleMs: 0,
    taught: false
  }
}

export function createMud(): MudState {
  return {
    on: false,
    strokes: 0,
    rub: new RubGesture({ minAmplitude: MUD_STROKE_MIN }),
    rubbing: false
  }
}

/** True when you own upgrade `id`. */
export function owns(game: Game, id: UpgradeId): boolean {
  return game.shop.owned(id)
}

/**
 * Refreshes what owning upgrades changes: the pot's switches, and the Bigger Window
 * Box's extra row of slots. Call every step.
 */
export function syncOptions(game: Game): void {
  game.options.lid = owns(game, 'lid') && !game.lid.off
  game.options.tall = owns(game, 'tall')
  const slots = game.box.slots
  if (owns(game, 'box'))
    while (slots.length < BOX_SLOTS_BIG)
      slots.push({ state: 'bare', strokes: 0, packets: [] })
}

// ---------------------------------------------------------------- Wider Tweezers

/** Grab radius for this press: wider with the Wider Tweezers. */
export function grabRadius(game: Game, base: number): number {
  return owns(game, 'tweezers') ? base * WIDE_GRAB : base
}

/** Most beans one grab lifts. */
export function clumpMax(game: Game): number {
  return owns(game, 'tweezers') ? WIDE_CLUMP_MAX : CLUMP_MAX
}

/** The strain that drops the beans: lower with the Wider Tweezers. */
export function strainLimit(game: Game): number {
  return owns(game, 'tweezers') ? WIDE_STRAIN_LIMIT : 1
}

/** Chance a carry gets a slippery bean. */
export function slipperyChance(game: Game): number {
  return owns(game, 'tweezers') ? WIDE_SLIPPERY_CHANCE : SLIPPERY_CHANCE
}

// ---------------------------------------------------------------- The Pot Lid

function carrying(game: Game): boolean {
  return game.scene === 'walk' && game.walker.carrying
}

/** True while the Pot Lid sits on the pot in your hands. */
export function lidOn(game: Game): boolean {
  return game.options.lid && carrying(game)
}

/**
 * Where a flying lid lands: on the route, and never further than the pot can reach to
 * put it back on. Before the gate that is the shut gate's stop, since the lid's chore
 * shuts it; past the gate the stretch end; at Grandma's the top step.
 */
export function lidLanding(game: Game, x: number): number {
  const def = currentStretch(game)
  const stop = !def.gate
    ? DOOR_STOP_X
    : game.gate.passed
      ? def.length - STRETCH_EXIT
      : gateX(game) - GATE_STOP
  // Half the fetch reach, so the pot gets well over the lid at either end.
  const reach = LID_FETCH / 2
  return clamp(x, POT_OFFSET_X - reach, stop + POT_OFFSET_X + reach)
}

/**
 * A kick of `strength` rad/s with the lid on: past LID_RATTLE_FROM it rattles, and
 * floor((J - 1) * LID_RATTLE_PER) beans hop out on `side`.
 */
export function lidRattle(game: Game, strength: number, side: number): void {
  if (!game.options.lid || !carrying(game) || strength <= LID_RATTLE_FROM)
    return
  const lid = game.lid
  lid.rattleMs = 450
  sound(game, 'rattle', 0.8, 1.1)
  const n = Math.min(
    game.counts.pot,
    Math.floor((strength - 1) * LID_RATTLE_PER)
  )
  if (n > 0) emitBeans(game, n, side, 6)
  if (!lid.taught) {
    lid.taught = true
    caption(
      game,
      'The lid rattles.',
      'info',
      'Big bumps still shake beans out.'
    )
  }
}

/**
 * A hard hit or a tip-over with the lid on: the lid flies LID_THROW u the way the beans
 * go, landing within the pot's reach, and "Fetch the lid" holds the gate until you walk
 * the pot over it. Returns true when it flew.
 */
export function lidLaunch(game: Game, side: number): boolean {
  if (!game.options.lid || !carrying(game)) return false
  const lid = game.lid
  lid.off = true
  game.options.lid = false
  game.chores.add({
    id: LID_CHORE,
    label: 'Fetch the lid',
    detail: 'Walk the pot over it to put it back on.',
    blocks: [LEAVE_STRETCH]
  })
  const pot = game.walker.x + POT_OFFSET_X
  lid.fromX = pot
  lid.fromY =
    groundY(currentStretch(game), game.walker.x) - (GROUND_Y - POT_RIM_Y)
  lid.x = lidLanding(game, pot + side * LID_THROW)
  lid.flightMs = 0
  sound(game, 'slam', 0.9, 1.3)
  sound(game, 'whoosh', 0.7, 1.4)
  caption(game, 'The lid!', 'bad', 'Go and fetch it.', 2600)
  return true
}

/**
 * A character hit the lid kept in: it rattles and clangs, and only `n` beans got out.
 * The lid stays on.
 */
export function lidHeld(game: Game, n: number): void {
  game.lid.rattleMs = 450
  sound(game, 'rattle', 0.9, 1)
  sound(game, 'slam', 0.4, 1.6)
  caption(
    game,
    'The lid held.',
    'good',
    `Only ${n} ${n === 1 ? 'bean' : 'beans'} got out.`,
    2200
  )
}

/** One step of the lid: it rattles down, flies, lands, and goes back on when you reach it. */
export function stepLid(game: Game, simMs: number): void {
  const lid = game.lid
  lid.rattleMs = Math.max(0, lid.rattleMs - simMs)
  if (!lid.off) return
  lid.flightMs = Math.min(LID_FLIGHT_MS, lid.flightMs + simMs)
  if (lid.flightMs < LID_FLIGHT_MS || !carrying(game)) return
  if (Math.abs(game.walker.x + POT_OFFSET_X - lid.x) > LID_FETCH) return
  lid.off = false
  game.chores.complete(LID_CHORE)
  sound(game, 'slam', 0.5, 1.6)
  caption(game, 'Lid back on.', 'good', '', 1600)
}

/** A new stretch: the lid is back on, whatever happened before a dev jump. */
export function resetLid(game: Game): void {
  game.lid.off = false
  game.lid.rattleMs = 0
  game.chores.complete(LID_CHORE)
}

// ---------------------------------------------------------------- Grippy Shoes

/** How long a "whoa" on wet grass gives you to save it, in ms. */
export function whoaWindow(game: Game): number {
  return owns(game, 'shoes') ? WHOA_MS_GRIPPY : WHOA_MS
}

/** You left the park: Grippy Shoes come away muddy, and cleaning them holds the kiosk. */
export function muddy(game: Game): void {
  if (!owns(game, 'shoes')) return
  const mud = game.mud
  mud.on = true
  mud.strokes = 0
  mud.rubbing = false
  game.chores.add({
    id: MUD_CHORE,
    label: 'Clean the mud off your shoes',
    detail: `Rub the boot back and forth ${MUD_STROKES} times.`,
    blocks: [LEAVE_STRETCH]
  })
}

function onBoot(x: number, y: number): boolean {
  return (
    x >= MUD_BOOT.x &&
    x <= MUD_BOOT.x + MUD_BOOT.w &&
    y >= MUD_BOOT.y &&
    y <= MUD_BOOT.y + MUD_BOOT.h
  )
}

/** A press at the kiosk: on the muddy boot it starts rubbing. Returns true when it did. */
export function mudPress(game: Game, x: number, y: number): boolean {
  const mud = game.mud
  if (game.scene !== 'kiosk' || !mud.on || !onBoot(x, y)) return false
  mud.rubbing = true
  mud.rub.reset()
  mud.rub.add(x, y)
  return true
}

export function mudDrag(game: Game, x: number, y: number): void {
  if (game.mud.rubbing && game.mud.rub.add(x, y)) rubbed(game)
}

export function mudRelease(game: Game): void {
  const mud = game.mud
  if (!mud.rubbing) return
  mud.rubbing = false
  if (mud.rub.end()) rubbed(game)
}

function rubbed(game: Game): void {
  const mud = game.mud
  if (!mud.on) return
  mud.strokes++
  sound(game, 'scrub', 0.5, 1 + game.random.fx() * 0.1)
  if (mud.strokes < MUD_STROKES) return
  mud.on = false
  mud.rubbing = false
  game.chores.complete(MUD_CHORE)
  sound(game, 'ding', 0.7, 1.3)
  if (game.kiosk) {
    game.kiosk.says = 'Squeaky clean. Off you go.'
    game.kiosk.saysMs = 3200
  }
  game.out.push({ type: 'scene' })
}

/** What you wear on your feet this frame, for drawing. */
export function shoeLook(game: Game): 'plain' | 'grippy' | 'muddy' {
  if (game.mud.on) return 'muddy'
  return owns(game, 'shoes') ? 'grippy' : 'plain'
}

// ---------------------------------------------------------------- Buying

/**
 * Why upgrade `id` can't help on any stretch after stretch `index`, or null. The kiosk's
 * shop disables it with this reason: Grippy Shoes only grip on wet grass, and the Pigeon
 * Net only guards against birds.
 */
export function pastItsUse(
  route: readonly StretchDef[],
  index: number,
  id: string
): string | null {
  const ahead = route.slice(index + 1)
  if (id === 'shoes' && !ahead.some(def => def.wet.length > 0))
    return "No wet grass ahead. The park's behind you."
  if (id === 'net' && !ahead.some(def => def.pigeonEveryMs !== null))
    return 'No pigeons between here and Grandma.'
  return null
}

const BOUGHT: Record<UpgradeId, string> = {
  tweezers: 'Wider tweezers. Grab more, drop more.',
  shoes: 'Grippy shoes. Mind the mud in the park.',
  net: 'A pigeon net. Good luck untangling it.',
  box: 'A bigger box. More watering, mind.',
  lid: 'A lid. It rattles, you know.',
  tall: 'A taller pot. Tips easier, mind.'
}

/** You bought upgrade `id` at the kiosk: a clunk and a word from the editor. */
export function bought(game: Game, id: string): void {
  sound(game, 'thud', 0.6, 1.2)
  const line = BOUGHT[id as UpgradeId]
  if (game.kiosk && line) {
    game.kiosk.says = line
    game.kiosk.saysMs = 3200
  }
  game.out.push({ type: 'scene' })
}

/** Dev: owns upgrade `id` without paying for it. */
export function devOwn(game: Game, id: UpgradeId): boolean {
  if (game.shop.owned(id)) return true
  // The shop only lists upgrades whose milestone made them work.
  if (!game.shop.list().some(u => u.id === id)) return false
  game.wallet.earn(game.shop.get(id).cost, 'Dev')
  return game.shop.buy(id).ok
}
