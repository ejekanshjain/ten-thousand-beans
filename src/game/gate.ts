import { caption, sound } from './effects'
import { line } from './lines'
import { currentStretch, type Game } from './state'
import { GATE_BUZZ_MS, GATE_FROM_END, GATE_STOP, STRETCH_EXIT } from './tuning'
import { formatBeans } from './units'
import { behind } from './zones'

/** The chore that holds the gate shut while beans lie behind you. */
export const PICK_UP_CHORE = 'pick-up-beans'
/** The chore that holds it shut while beans sit down a drain or under the fridge. */
export const FISH_CHORE = 'fish-beans'
/** The action every stretch-end chore blocks. */
export const LEAVE_STRETCH = 'leave-stretch'
/** Grandma's count at the door, which beans on the ground hold up too. */
export const COUNT_ACTION = 'count'

/** Route x of the gate at the end of the current stretch. */
export function gateX(game: Game): number {
  return currentStretch(game).length - GATE_FROM_END
}

/** True when no chore blocks leaving the stretch. */
export function gateOpen(game: Game): boolean {
  return game.chores.canDo(LEAVE_STRETCH)
}

/**
 * Keeps "Pick up N beans" and "Fish N beans out" on the chore board in step with the
 * beans behind you. Chores only change when a count does.
 */
export function syncChores(game: Game): void {
  const n = behind(game.zones.list, game.stretch)
  const down = drainBehind(game)
  if (n === game.lastBehind && down === game.lastDrain) return
  game.lastBehind = n
  game.lastDrain = down
  const chores = game.chores
  chores.complete(PICK_UP_CHORE)
  chores.complete(FISH_CHORE)
  const ground = n - down
  if (ground > 0)
    chores.add({
      id: PICK_UP_CHORE,
      label: `Pick up ${formatBeans(ground)} ${ground === 1 ? 'bean' : 'beans'}`,
      detail: 'Nobody leaves until every bean is back.',
      blocks: [LEAVE_STRETCH, COUNT_ACTION]
    })
  if (down > 0)
    chores.add({
      id: FISH_CHORE,
      label: `Fish ${formatBeans(down)} ${down === 1 ? 'bean' : 'beans'} out`,
      detail: fishDetail(game),
      blocks: [LEAVE_STRETCH, COUNT_ACTION]
    })
}

/** Where the fishing starts: the gap under the fridge in the kitchen, a drain grate elsewhere. */
function fishDetail(game: Game): string {
  const tap = game.touch ? 'tap' : 'click'
  return currentStretch(game).id === 'kitchen'
    ? `Set the pot down by the fridge, then ${tap} the gap under it.`
    : `Set the pot down by the drain, then ${tap} its grate.`
}

/** Beans down drains or under the fridge in this stretch. */
export function drainBehind(game: Game): number {
  let sum = 0
  for (const zone of game.zones.list)
    if (zone.stretch === game.stretch) sum += zone.drain
  return sum
}

/**
 * What a shut gate says: how many beans are still behind you, or else the first other
 * chore that holds it, such as the Pot Lid lying back on the route.
 */
export function gateRefusal(game: Game): [text: string, sub: string] {
  const n = behind(game.zones.list, game.stretch)
  if (n > 0)
    return [
      `${formatBeans(n)} ${n === 1 ? 'bean is' : 'beans are'} still back there.`,
      line(game, 'gate')
    ]
  if (game.lid.off) return ["The lid's still back there.", 'Go and fetch it.']
  const chore = game.chores.blockersFor(LEAVE_STRETCH)[0]
  return chore
    ? [`${chore.label} first.`, chore.detail ?? '']
    : ['Not yet.', '']
}

/**
 * Stops you at a shut gate with a buzz and a caption that points back at what holds it.
 * Past the gate, the stretch end leads on once nothing lies behind; beans spilled past
 * an open gate hold you at the end instead. Call after walking moves you. Returns true
 * when you walk off the end into the next stretch.
 */
export function updateGate(game: Game, dtMs: number): boolean {
  const gate = game.gate
  gate.wobbleMs = Math.max(0, gate.wobbleMs - dtMs)
  gate.cooldownMs = Math.max(0, gate.cooldownMs - dtMs)
  gate.arrowMs = Math.max(0, gate.arrowMs - dtMs)
  const def = currentStretch(game)
  if (!def.gate) return false
  const walker = game.walker
  const open = gateOpen(game)
  const stop = gate.passed ? def.length - STRETCH_EXIT : gateX(game) - GATE_STOP
  if (walker.x < stop) return false
  if (open) {
    if (gate.passed) return true
    gate.passed = true
    return false
  }
  walker.x = stop
  walker.v = Math.min(0, walker.v)
  if (gate.cooldownMs > 0) return false
  gate.cooldownMs = GATE_BUZZ_MS
  gate.wobbleMs = 500
  gate.arrowMs = 3000
  sound(game, 'buzz', 0.7)
  const [text, sub] = gateRefusal(game)
  caption(game, text, 'bad', sub, 3000, { key: 'gate' })
  return false
}
