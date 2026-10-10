import { createStore, settings, type RealTimer } from '../shared'
import { currentStretch, zoneInReach, type Game, type SceneId } from './game'
import { LINES, pagesFound, secretShown, type LineStatus } from './gossip'
import { ambushPrompt } from './ambush'
import { bridgePrompt } from './bridge'
import { countPrompt, doorPrompt } from './door'
import { gossipShown } from './gossipFlow'
import { catAdvice, catWatching, inKitchen, introBusy } from './kitchen'
import type { KioskSummary } from './kiosk'
import { marketPrompt } from './market'
import { netPrompt } from './net'
import { parkPrompt, pickupDogPrompt } from './park'
import { pigeonPrompt } from './pigeons'
import { streetPrompt } from './street'
import { canPour, weatherPrompt } from './weather'
import { boxPrompt, plantNudge, podsReady } from './windowBox'
import { behind } from './zones'

/** A notebook page: a jotted line, and whether it has been sold yet. */
export interface NotebookPage {
  /** Index into LINES, for selling it. */
  line: number
  text: string
  price: number
  sold: boolean
}

/** Beans drying on the rack on your back: the timer that ends last, and how many there are. */
export interface DryingSnapshot {
  timer: RealTimer
  count: number
}

/** What React shows. Fast values (counts, slosh) are read straight from the game with LiveText and Meter. */
export interface HudSnapshot {
  started: boolean
  scene: SceneId
  /** The stretch's Title Case name, such as "The Street". */
  stretchName: string
  carrying: boolean
  /** True when setting down here opens Pickup. */
  nearZone: boolean
  /** True while beans sit in the tweezers or hands. */
  holding: boolean
  /** True while a scripted moment, such as the cat's opening gag, keeps the pot down. */
  busy: boolean
  /** One short line telling you what to do next. */
  prompt: string
  /** True when the latest input was a finger, so copy talks about taps. */
  touch: boolean
  /** True on a phone without working tilt: show Tilt Left and Tilt Right. */
  tiltButtons: boolean
  /** True while gossip waits on the ground to be jotted down. */
  jotReady: boolean
  /** Jotted lines. The reference only changes when a page is added or sold. */
  pages: readonly NotebookPage[]
  /** Grandma's secret with the letters your pages reveal. */
  secret: string
  /** The kiosk's report on the stretch you cleared, while you stand at it. */
  kiosk: KioskSummary | null
  /** Beans drying on your back, or null. The reference changes only when a timer starts or ends. */
  drying: DryingSnapshot | null
  /** Beans lost for good: in seed packets or growing in the window box. */
  lost: number
  /** The window box's grow timer, or null when nothing grows. */
  growing: RealTimer | null
  /** True when the window box wants you: pods to pick, or packets waiting to be planted. */
  boxWants: boolean
  /** True when Pour Off can tip rain out of the pot on the ground. */
  canPour: boolean
  /** True once Grandma's secret is spelled out and the ending screen opens. */
  ending: boolean
}

export const hud = createStore<HudSnapshot>({
  started: false,
  scene: 'walk',
  stretchName: '',
  carrying: true,
  nearZone: false,
  holding: false,
  busy: false,
  prompt: '',
  touch: false,
  tiltButtons: false,
  jotReady: false,
  pages: [],
  secret: secretShown(0),
  kiosk: null,
  drying: null,
  lost: 0,
  growing: null,
  boxWants: false,
  canPour: false,
  ending: false
})

let pagesKey = ''
let pagesCache: readonly NotebookPage[] = []

/** The notebook pages for these statuses, reusing the last array while nothing changed. */
function pagesFor(status: readonly LineStatus[]): readonly NotebookPage[] {
  const key = status.join()
  if (key === pagesKey) return pagesCache
  pagesKey = key
  pagesCache = LINES.flatMap((line, i) =>
    status[i] === 'found' || status[i] === 'sold'
      ? [
          {
            line: i,
            text: line.text,
            price: line.price,
            sold: status[i] === 'sold'
          }
        ]
      : []
  )
  return pagesCache
}

let dryingCache: DryingSnapshot | null = null

/** The drying snapshot for these timers, reusing the last object while nothing changed. */
function dryingFor(timers: readonly RealTimer[]): DryingSnapshot | null {
  const last = timers[timers.length - 1]
  if (!last) return (dryingCache = null)
  if (dryingCache?.timer === last && dryingCache.count === timers.length)
    return dryingCache
  return (dryingCache = { timer: last, count: timers.length })
}

/** How the player is playing, which changes the copy. */
export interface InputMode {
  touch: boolean
  tiltButtons: boolean
}

/** The next-step hint for the current state. */
export function promptFor(game: Game, mode: InputMode): string {
  const { touch, tiltButtons } = mode
  if (introBusy(game)) return 'The cat is up to something.'
  if (game.scene === 'box') return boxPrompt(game, touch)
  if (game.scene === 'count') return countPrompt(game, touch)
  if (game.scene === 'kiosk')
    return game.mud.on
      ? 'Rub the muddy boot back and forth to clean it.'
      : touch
        ? 'Sell your gossip, then tap Next Stretch.'
        : 'Sell your gossip, then Space for the next stretch.'
  if (gossipShown(game))
    return touch
      ? 'Hold Jot It Down to write the gossip down.'
      : 'Hold J to jot the gossip down.'
  if (game.scene === 'drain')
    return touch
      ? 'Drag the hanger under a bean, then lift it slowly.'
      : 'Hold the mouse button to steer the hanger. Lift beans slowly.'
  const zone = game.pickup.world?.zone
  if (
    game.scene === 'pickup' &&
    zone &&
    zone.drain > 0 &&
    !zone.count &&
    !zone.pile
  ) {
    const where = inKitchen(game)
      ? 'the gap under the fridge'
      : 'the drain grate'
    return `${touch ? 'Tap' : 'Click'} ${where} to fish ${zone.drain === 1 ? 'it' : 'them'} out.`
  }
  const critter =
    pickupDogPrompt(game, touch) ?? netPrompt(game) ?? pigeonPrompt(game, touch)
  if (critter) return critter
  const door = doorPrompt(game, touch)
  if (door) return door
  const world = game.pickup.world
  if (
    game.scene === 'pickup' &&
    world &&
    world.swollen.size > 0 &&
    world.dryFree === 0 &&
    world.zone.pile === 0
  )
    return touch && !settings.get().assist
      ? 'Pinch swollen beans onto the drying rack.'
      : 'Drag swollen beans onto the drying rack.'
  const bridge = bridgePrompt(game, touch)
  if (bridge) return bridge
  if (game.scene === 'pickup') {
    if (game.pickup.world?.clear) {
      const done =
        behind(game.zones.list, game.stretch) > 0
          ? 'This patch is clear.'
          : 'All clear.'
      return touch
        ? `${done} Tap Pick Up Pot.`
        : `${done} Space picks up the pot.`
    }
    // Hands scoop the pile, or any heap of CLUSTER_MIN beans when there is no pile.
    const heap = game.pickup.world?.zone.pile ? 'the pile' : 'a heap'
    if (!touch)
      return `Drag beans into the pot. Hold still on ${heap} to scoop.`
    return settings.get().assist
      ? 'Drag beans into the pot.'
      : `Pinch beans into the pot. Drag ${heap} to scoop.`
  }
  const box = boxHint(game, touch)
  const weather = weatherPrompt(game, touch, zoneInReach(game) !== null)
  if (game.scene === 'grounded')
    return (
      weather ??
      box ??
      (touch ? 'Tap Pick Up Pot to carry on.' : 'Space picks up the pot.')
    )
  const street =
    weather ??
    ambushPrompt(game, touch) ??
    streetPrompt(game, touch, tiltButtons) ??
    marketPrompt(game) ??
    parkPrompt(game, touch)
  if (street) return street
  if (
    inKitchen(game) &&
    game.scene === 'walk' &&
    catWatching(game.kitchen.cat) &&
    catAdvice(game) === 'wait'
  )
    return 'The cat is watching. Stop until it licks itself.'
  if (zoneInReach(game))
    return touch
      ? 'Spilled beans here. Tap Set Down.'
      : 'Spilled beans here. Space sets the pot down.'
  if (game.lid.off && game.scene === 'walk')
    return 'The lid is off. Walk the pot over it to put it back.'
  if (box) return box
  if (!touch) return 'Hold W to walk. A and D tilt the pot.'
  return tiltButtons
    ? 'Hold the street to walk. Hold the tilt buttons to level.'
    : 'Hold the street to walk. Tilt the phone to level.'
}

/** A nudge toward the window box when pods wait or packets pile up, or null. */
function boxHint(game: Game, touch: boolean): string | null {
  const open = touch ? 'Tap Box' : 'Press E'
  if (podsReady(game.box) > 0) return `Your beans grew. ${open} to pick them.`
  if (plantNudge(game)) return `Plant your packets. ${open} for the window box.`
  return null
}

/** Copies the slow-changing parts of the game into the HUD store. */
export function publish(game: Game, mode: InputMode): void {
  hud.set({
    scene: game.scene,
    stretchName: currentStretch(game).name,
    carrying: game.walker.carrying,
    nearZone: game.scene === 'walk' && zoneInReach(game) !== null,
    holding: game.pickup.carry.count > 0,
    busy: introBusy(game),
    jotReady: gossipShown(game),
    pages: pagesFor(game.gossip.status),
    secret: secretShown(pagesFound(game.gossip.status)),
    kiosk: game.scene === 'kiosk' ? (game.kiosk?.summary ?? null) : null,
    drying: dryingFor(game.drying),
    lost: game.counts.packets + game.counts.growing,
    growing: game.box.batch,
    boxWants: podsReady(game.box) > 0 || plantNudge(game),
    canPour: canPour(game),
    ending: game.door.phase === 'done',
    prompt: promptFor(game, mode),
    touch: mode.touch,
    tiltButtons: mode.tiltButtons
  })
}
