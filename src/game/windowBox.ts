import {
  HoldCharge,
  isDone,
  now,
  RubGesture,
  startTimer,
  type RealTimer
} from '../shared'
import { caption, sound } from './effects'
import { introBusy } from './kitchen'
import { move, type Counts } from './ledger'
import type { Packet, PacketSet } from './packets'
import type { Game, SceneId } from './state'
import {
  BOX_FLOOD_MS,
  BOX_SLOTS,
  BOX_TAP_MOVE,
  DIG_STROKE_MIN,
  DIG_STROKES,
  GROW_MS,
  PLANT_HOLD_MS,
  PLANT_NUDGE,
  SLOT_PACKETS,
  WATER_FILL_MS
} from './tuning'

/**
 * A slot's life: dig it, plant up to SLOT_PACKETS packets, water it, wait for the batch,
 * pick the pods. Picked slots stay dug; a flood fills the hole back in.
 */
export type SlotState = 'bare' | 'dug' | 'planted' | 'watered' | 'grown'

export interface Slot {
  state: SlotState
  /** Dig strokes so far while bare. */
  strokes: number
  /** Packets planted here, each one pod once grown. Their beans are in `growing`. */
  packets: Packet[]
}

/** What the press in progress does. */
export type BoxMode = 'none' | 'dig' | 'plant' | 'water' | 'tap'

/** A short flash on a slot after something happened to it, for juice. */
export interface BoxFlash {
  slot: number
  kind: 'dig' | 'plant' | 'water' | 'flood' | 'pick'
  ms: number
}

/** The window box strapped to your back. It opens over any scene and pauses the world. */
export interface WindowBoxState {
  /** The scene to go back to when the box closes. */
  returnTo: SceneId
  slots: Slot[]
  /** The batch's shared grow timer, or null when nothing grows. */
  batch: RealTimer | null
  /**
   * Packets on Grandma's windowsill at the door. They grow with the running batch and
   * go straight into the stew when it's due. Their beans are in `growing`.
   */
  sill: Packet[]
  /** The packet chosen for planting, by id, or -1. */
  selected: number
  mode: BoxMode
  /** The slot under the press, or -1. */
  slot: number
  pressX: number
  pressY: number
  x: number
  y: number
  rub: RubGesture
  water: HoldCharge
  /** Ms the current plant hold has lasted. */
  plantMs: number
  /** Pods picked this run, to rotate the harvest gags. */
  picked: number
  /** The packet whose pod is this batch's pea in disguise, or -1. */
  pea: number
  flash: BoxFlash | null
  /** Tutorial captions already shown. */
  taught: { dig: boolean; plant: boolean; water: boolean; pick: boolean }
}

/** A rectangle in the box view, in design units. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Seed packet cards: three to a row, two rows. More packets wait their turn. */
export const CARDS_PER_ROW = 3
export const MAX_CARDS = 6
const CARD_W = 176
const CARD_H = 92
/** The planter's inner soil, where the slots sit. */
export const SOIL = { x: 40, y: 430, w: 520, h: 170 } as const
/** Pods closer than this to a tap get picked, in u. */
const POD_REACH = 34

const HARVEST_GAGS = [
  'Fresh beans. Grandma will never know.',
  'This one winked at you.',
  'Grown in a minute. Science.',
  'They look like the old ones. Mostly.',
  'Still warm. Somehow.'
]

export function createWindowBox(slots = BOX_SLOTS): WindowBoxState {
  return {
    returnTo: 'walk',
    slots: Array.from({ length: slots }, () => ({
      state: 'bare' as SlotState,
      strokes: 0,
      packets: []
    })),
    batch: null,
    sill: [],
    selected: -1,
    mode: 'none',
    slot: -1,
    pressX: 0,
    pressY: 0,
    x: 0,
    y: 0,
    rub: new RubGesture({ minAmplitude: DIG_STROKE_MIN }),
    water: new HoldCharge({ fillMs: WATER_FILL_MS }),
    plantMs: 0,
    picked: 0,
    pea: -1,
    flash: null,
    taught: { dig: false, plant: false, water: false, pick: false }
  }
}

// ---------------------------------------------------------------- Layout

/** Packet card `i` (0 to MAX_CARDS - 1). */
export function cardRect(i: number): Rect {
  return {
    x: 24 + (i % CARDS_PER_ROW) * 188,
    y: 140 + Math.floor(i / CARDS_PER_ROW) * 104,
    w: CARD_W,
    h: CARD_H
  }
}

/** Slot `i` of `count`: one row of three, or two rows with the Bigger Window Box. */
export function slotRect(i: number, count: number): Rect {
  const perRow = Math.min(count, 3)
  const rows = Math.ceil(count / perRow)
  const w = SOIL.w / perRow
  const h = SOIL.h / rows
  return {
    x: SOIL.x + (i % perRow) * w,
    y: SOIL.y + Math.floor(i / perRow) * h,
    w,
    h
  }
}

/** Where pod `j` of a slot's `count` pods stands. */
export function podSpot(
  rect: Rect,
  j: number,
  count: number
): { x: number; y: number } {
  return {
    x: rect.x + rect.w / 2 + (j - (count - 1) / 2) * 50,
    y: rect.y + rect.h * 0.42
  }
}

function inside(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  )
}

/** The packet card under (x, y), as an index into the packet list, or -1. */
export function cardAt(set: PacketSet, x: number, y: number): number {
  const shown = Math.min(set.list.length, MAX_CARDS)
  for (let i = 0; i < shown; i++) if (inside(cardRect(i), x, y)) return i
  return -1
}

/** The slot under (x, y), or -1. */
export function slotAt(box: WindowBoxState, x: number, y: number): number {
  for (let i = 0; i < box.slots.length; i++)
    if (inside(slotRect(i, box.slots.length), x, y)) return i
  return -1
}

// ---------------------------------------------------------------- Queries

/** Planting waits while a batch grows or pods wait to be picked. */
export function canPlant(box: WindowBoxState): boolean {
  return box.batch === null && !box.slots.some(s => s.state === 'grown')
}

/** Pods ready to pick. */
export function podsReady(box: WindowBoxState): number {
  let n = 0
  for (const slot of box.slots)
    if (slot.state === 'grown') n += slot.packets.length
  return n
}

/** True when the box sits idle: nothing growing, nothing to pick. */
export function boxIdle(box: WindowBoxState): boolean {
  return canPlant(box)
}

/** "Plant your packets": PLANT_NUDGE or more packets wait and the box is idle. */
export function plantNudge(game: Game): boolean {
  return game.packets.list.length >= PLANT_NUDGE && boxIdle(game.box)
}

/** True when the Bigger Window Box makes every slot need its own watering. */
function waterEachSlot(game: Game): boolean {
  return game.shop.owned('box')
}

/** Beans planted in the box and on Grandma's windowsill, which the ledger keeps in `growing`. */
export function boxBeans(box: WindowBoxState): number {
  let sum = 0
  for (const slot of box.slots)
    for (const packet of slot.packets) sum += packet.beans
  for (const packet of box.sill) sum += packet.beans
  return sum
}

/**
 * Grandma takes every waiting seed packet onto her windowsill, where they grow with the
 * box's running batch. Only while a batch grows. Returns how many packets she took.
 */
export function sillPackets(game: Game): number {
  const box = game.box
  const list = game.packets.list
  if (!box.batch || list.length === 0) return 0
  const n = list.length
  for (const packet of list) {
    move(game.counts, 'packets', 'growing', packet.beans)
    box.sill.push(packet)
  }
  list.length = 0
  box.selected = -1
  game.out.push({ type: 'scene' })
  return n
}

/** The windowsill's beans grew with the batch: they go straight into the stew. Returns how many. */
function harvestSill(game: Game): number {
  const box = game.box
  let n = 0
  for (const packet of box.sill) n += packet.beans
  box.sill.length = 0
  if (n === 0) return 0
  move(game.counts, 'growing', 'pot', n)
  game.stats.regrown += n
  game.out.push({ type: 'potted', n })
  return n
}

/** Returns a problem description when the box disagrees with the ledger, or null. */
export function checkBox(counts: Counts, box: WindowBoxState): string | null {
  const sum = boxBeans(box)
  if (sum !== counts.growing)
    return `the window box holds ${sum} beans but the ledger says ${counts.growing}`
  for (const [i, slot] of box.slots.entries())
    if (slot.packets.length > SLOT_PACKETS)
      return `slot ${i} holds ${slot.packets.length} packets`
  return null
}

// ---------------------------------------------------------------- Open and close

/**
 * Opens the box over whatever you are doing, which pauses the world. Refused while you
 * hold beans and while the cat's opening gag plays. Returns true when it opened.
 */
export function openBox(game: Game): boolean {
  if (game.scene === 'box') return true
  if (game.pickup.carry.count > 0) {
    caption(game, 'Hands full.', 'info', 'Drop the beans first.', 1600)
    return false
  }
  if (introBusy(game)) return false
  const box = game.box
  box.returnTo = game.scene
  box.mode = 'none'
  box.water.reset()
  game.scene = 'box'
  // Walk captions sit in the world; the box draws its own.
  game.fx.captions.length = 0
  sound(game, 'thud', 0.4, 1.3)
  game.out.push({ type: 'scene' })
  return true
}

/** Closes the box and carries on where you left off. */
export function closeBox(game: Game): void {
  if (game.scene !== 'box') return
  const box = game.box
  endPress(game)
  game.scene = box.returnTo
  game.fx.captions.length = 0
  sound(game, 'thud', 0.3, 1.1)
  game.out.push({ type: 'scene' })
}

/** E, or the Window Box button. */
export function toggleBox(game: Game): boolean {
  if (game.scene === 'box') {
    closeBox(game)
    return true
  }
  return openBox(game)
}

function endPress(game: Game): void {
  const box = game.box
  if (box.mode === 'water') box.water.release()
  box.mode = 'none'
  box.slot = -1
}

// ---------------------------------------------------------------- Input

/** The pointer goes down at (x, y) in the box view. */
export function boxPress(game: Game, x: number, y: number): void {
  if (game.scene !== 'box') return
  const box = game.box
  box.pressX = box.x = x
  box.pressY = box.y = y
  box.mode = 'none'
  box.slot = -1
  if (cardAt(game.packets, x, y) >= 0) {
    box.mode = 'tap'
    return
  }
  const index = slotAt(box, x, y)
  if (index < 0) return
  const slot = box.slots[index]!
  box.slot = index
  if (slot.state === 'bare') {
    box.mode = 'dig'
    box.rub.reset()
    box.rub.add(x, y)
    return
  }
  if (slot.state === 'grown') {
    box.mode = 'tap'
    return
  }
  if (slot.state === 'watered') {
    caption(game, 'Growing.', 'info', 'Leave it be.', 1600)
    return
  }
  const chosen = game.packets.list.some(p => p.id === box.selected)
  const room = slot.packets.length < SLOT_PACKETS
  if (chosen && room && canPlant(box)) {
    box.mode = 'plant'
    box.plantMs = 0
    return
  }
  if (slot.state === 'planted') {
    box.mode = 'water'
    box.water.start()
    return
  }
  // A dug hole and nothing to plant in it.
  if (!canPlant(box)) caption(game, 'Pick this batch first.', 'info', '', 1800)
  else if (game.packets.list.length === 0)
    caption(game, 'No seed packets.', 'info', 'Lost beans end up here.', 2200)
  else
    caption(
      game,
      `${game.touch ? 'Tap' : 'Click'} a packet first.`,
      'info',
      '',
      1800
    )
}

/** The pointer moves to (x, y) while pressed. */
export function boxDrag(game: Game, x: number, y: number): void {
  if (game.scene !== 'box') return
  const box = game.box
  box.x = x
  box.y = y
  if (box.mode === 'dig' && box.rub.add(x, y)) dugStroke(game)
  // A plant hold that wanders off the hole doesn't count.
  if (
    box.mode === 'plant' &&
    Math.hypot(x - box.pressX, y - box.pressY) > BOX_TAP_MOVE * 2
  )
    box.mode = 'none'
}

/** The pointer lifts. */
export function boxRelease(game: Game): void {
  if (game.scene !== 'box') return
  const box = game.box
  const mode = box.mode
  box.mode = 'none'
  if (mode === 'dig') {
    if (box.rub.end()) dugStroke(game)
  } else if (mode === 'water') {
    const level = box.water.release()
    if (level >= 1) watered(game)
    else
      caption(
        game,
        'Not enough water.',
        'bad',
        'Hold until the bar fills.',
        1800
      )
  } else if (
    mode === 'tap' &&
    Math.hypot(box.x - box.pressX, box.y - box.pressY) < BOX_TAP_MOVE
  )
    tap(game, box.pressX, box.pressY)
  box.slot = -1
}

/** One step of the box while it is open: plant and water holds. */
export function updateBox(game: Game, dtMs: number): void {
  const box = game.box
  if (box.flash) {
    box.flash.ms += dtMs
    if (box.flash.ms > 700) box.flash = null
  }
  if (box.mode === 'plant') {
    box.plantMs += dtMs
    if (box.plantMs >= PLANT_HOLD_MS) {
      box.mode = 'none'
      plant(game, box.slot)
    }
  } else if (box.mode === 'water') {
    box.water.update(dtMs)
    if (box.water.heldMs >= BOX_FLOOD_MS) {
      box.water.release()
      box.mode = 'none'
      flood(game)
    }
  }
}

// ---------------------------------------------------------------- Actions

/** The slots one watering covers: every planted slot, or just the one with the bigger box. */
function wateringSlots(game: Game): number[] {
  const box = game.box
  if (waterEachSlot(game)) return box.slot >= 0 ? [box.slot] : []
  const out: number[] = []
  for (const [i, slot] of box.slots.entries())
    if (slot.state === 'planted') out.push(i)
  return out
}

function dugStroke(game: Game): void {
  const box = game.box
  const slot = box.slots[box.slot]
  if (!slot || slot.state !== 'bare') return
  slot.strokes++
  sound(game, 'scrub', 0.5, 0.8 + game.random.fx() * 0.1)
  if (slot.strokes < DIG_STROKES) return
  slot.state = 'dug'
  slot.strokes = 0
  box.flash = { slot: box.slot, kind: 'dig', ms: 0 }
  sound(game, 'pop', 0.6, 0.7)
  if (!box.taught.dig) {
    box.taught.dig = true
    caption(
      game,
      'Dug.',
      'good',
      `${game.touch ? 'Tap' : 'Click'} a packet, then hold the hole.`,
      2800
    )
  } else caption(game, 'Dug.', 'good', '', 1200)
}

/** Plants the chosen packet in slot `index`. Its beans start growing. */
function plant(game: Game, index: number): void {
  const box = game.box
  const slot = box.slots[index]
  const at = game.packets.list.findIndex(p => p.id === box.selected)
  if (!slot || at < 0 || slot.packets.length >= SLOT_PACKETS) return
  const packet = game.packets.list.splice(at, 1)[0]!
  move(game.counts, 'packets', 'growing', packet.beans)
  slot.packets.push(packet)
  slot.state = 'planted'
  box.flash = { slot: index, kind: 'plant', ms: 0 }
  // Empty-handed again, so the next hold on this slot waters it.
  box.selected = -1
  sound(game, 'scrub', 0.5, 0.6)
  sound(game, 'pop', 0.6, 1.1)
  const room = SLOT_PACKETS - slot.packets.length
  if (!box.taught.plant) {
    box.taught.plant = true
    caption(
      game,
      `Planted ${packet.beans}.`,
      'good',
      'Now hold the slot to water it.',
      2800
    )
  } else
    caption(
      game,
      `Planted ${packet.beans}.`,
      'good',
      room > 0 ? `Room for ${room} more here.` : 'This slot is full.',
      1800
    )
  game.out.push({ type: 'scene' })
}

/** A full can: the slots start growing, and the first watering starts the batch's timer. */
function watered(game: Game): void {
  const box = game.box
  const slots = wateringSlots(game)
  if (slots.length === 0) return
  for (const i of slots) box.slots[i]!.state = 'watered'
  box.flash = { slot: slots.length > 1 ? -1 : slots[0]!, kind: 'water', ms: 0 }
  const fresh = box.batch === null
  box.batch ??= startTimer('Beans growing', GROW_MS)
  sound(game, 'drip', 0.6, 1.2)
  sound(game, 'ding', 0.4, 1.5)
  if (!box.taught.water) {
    box.taught.water = true
    caption(game, 'Watered.', 'good', 'They grow while you carry on.', 3000)
  } else
    caption(
      game,
      'Watered.',
      'good',
      fresh ? 'One minute.' : 'They join this batch.',
      1800
    )
  game.out.push({ type: 'scene' })
}

/** Held the can too long: the watered slots flood and the seeds float back into their packets. */
function flood(game: Game): void {
  const box = game.box
  const slots = wateringSlots(game)
  for (const i of slots) {
    const slot = box.slots[i]!
    for (const packet of slot.packets) {
      move(game.counts, 'growing', 'packets', packet.beans)
      game.packets.list.push(packet)
    }
    slot.packets = []
    slot.state = 'bare'
    slot.strokes = 0
  }
  box.flash = {
    slot: slots.length > 1 ? -1 : (slots[0] ?? -1),
    kind: 'flood',
    ms: 0
  }
  sound(game, 'splash', 0.9, 0.8)
  sound(game, 'fail', 0.5, 1.2)
  caption(
    game,
    'Drowned it.',
    'bad',
    'The seeds floated out. Dig it again.',
    3000
  )
  game.out.push({ type: 'scene' })
}

/** A tap on a packet card chooses it; a tap on a pod picks it. */
function tap(game: Game, x: number, y: number): void {
  const box = game.box
  const card = cardAt(game.packets, x, y)
  if (card >= 0) {
    const packet = game.packets.list[card]!
    box.selected = box.selected === packet.id ? -1 : packet.id
    sound(game, 'click', 0.5, box.selected === -1 ? 0.8 : 1.2)
    return
  }
  const index = slotAt(box, x, y)
  const slot = box.slots[index]
  if (!slot || slot.state !== 'grown') return
  const rect = slotRect(index, box.slots.length)
  let best = -1
  let bestD = POD_REACH
  for (let j = 0; j < slot.packets.length; j++) {
    const spot = podSpot(rect, j, slot.packets.length)
    const d = Math.hypot(x - spot.x, y - spot.y)
    if (d <= bestD) {
      best = j
      bestD = d
    }
  }
  // A tap anywhere on a slot with one pod picks it.
  if (best < 0 && slot.packets.length === 1) best = 0
  if (best >= 0) pick(game, index, best)
}

/**
 * Picks pod `j` of slot `index`. Its beans go into the pot when it sits on the ground,
 * or into the jar while you carry it.
 */
function pick(game: Game, index: number, j: number): void {
  const box = game.box
  const slot = box.slots[index]!
  const packet = slot.packets.splice(j, 1)[0]!
  const ground = !game.walker.carrying
  move(game.counts, 'growing', ground ? 'pot' : 'regrown', packet.beans)
  game.stats.regrown += packet.beans
  if (slot.packets.length === 0) slot.state = 'dug'
  box.flash = { slot: index, kind: 'pick', ms: 0 }
  sound(game, 'pop', 0.8, 1.1 + 0.1 * box.picked)
  if (ground) game.out.push({ type: 'potted', n: packet.beans })
  const where = ground
    ? `+${packet.beans} beans in the pot.`
    : `+${packet.beans} beans in the jar.`
  if (packet.id === box.pea)
    caption(
      game,
      'A pea in disguise.',
      'good',
      `${where} It was hiding them.`,
      2600
    )
  else if (!ground && !box.taught.pick) {
    box.taught.pick = true
    caption(
      game,
      `+${packet.beans} beans in the jar.`,
      'good',
      'It tips in when you set the pot down.',
      3200
    )
  } else
    caption(
      game,
      where,
      'good',
      HARVEST_GAGS[box.picked % HARVEST_GAGS.length]!,
      2200
    )
  box.picked++
  game.out.push({ type: 'scene' })
}

// ---------------------------------------------------------------- Waits

/**
 * The batch's timer ran out: every watered slot grows its pods, one of them a pea in
 * disguise. Runs on the wall clock in every scene. Returns true when a batch grew.
 */
export function updateGrowth(game: Game, at = now()): boolean {
  const box = game.box
  if (!box.batch || !isDone(box.batch, at)) return false
  box.batch = null
  const grown: Packet[] = []
  for (const slot of box.slots)
    if (slot.state === 'watered') {
      slot.state = 'grown'
      grown.push(...slot.packets)
    }
  box.pea = grown[Math.floor(game.random.fx() * grown.length)]?.id ?? -1
  sound(game, 'ding', 0.8, 1.1)
  sound(game, 'pop', 0.6, 1.4)
  const sill = harvestSill(game)
  if (sill > 0)
    caption(
      game,
      "Grandma's windowsill grew.",
      'good',
      `+${sill} beans in the stew.`,
      3200
    )
  if (grown.length === 0) {
    game.out.push({ type: 'scene' })
    return true
  }
  if (game.scene === 'box')
    caption(
      game,
      'They grew!',
      'good',
      `${game.touch ? 'Tap' : 'Click'} the pods to pick them.`,
      2600
    )
  else
    caption(
      game,
      'Your beans grew.',
      'good',
      game.touch ? 'Tap Box to pick them.' : 'Press E to open the window box.',
      3200
    )
  game.out.push({ type: 'scene' })
  return true
}

/** The pot went down: the jar of regrown beans tips into it. Returns how many. */
export function tipJar(game: Game): number {
  const n = game.counts.regrown
  if (n === 0) return 0
  move(game.counts, 'regrown', 'pot', n)
  sound(game, 'pop', 0.7, 0.9)
  caption(game, 'The jar tipped in.', 'good', `+${n} beans.`, 2200)
  game.out.push({ type: 'potted', n })
  return n
}

// ---------------------------------------------------------------- Prompts

/** The next step in the box, for the HUD. */
export function boxPrompt(game: Game, touch: boolean): string {
  const box = game.box
  const tapWord = touch ? 'Tap' : 'Click'
  const hole = box.slots.some(
    s =>
      s.state === 'dug' ||
      (s.state === 'planted' && s.packets.length < SLOT_PACKETS)
  )
  if (podsReady(box) > 0) return `${tapWord} the pods to pick them.`
  if (box.selected >= 0 && canPlant(box) && hole)
    return 'Hold a hole to plant the packet.'
  if (box.batch)
    return box.slots.some(s => s.state === 'planted')
      ? 'Hold a planted slot to water it into this batch.'
      : 'Growing. Close the box and carry on.'
  if (box.slots.some(s => s.state === 'planted'))
    return 'Hold a planted slot to water it. Let go when the bar fills.'
  if (game.packets.list.length === 0)
    return 'No seed packets. Lost beans end up here.'
  if (!hole) return 'Rub a slot back and forth to dig it.'
  return `${tapWord} a packet, then hold a dug hole.`
}

/** Dev: ends the batch's grow timer now. */
export function devFinishGrowing(game: Game): void {
  if (game.box.batch) game.box.batch.endsAt = Date.now()
}
