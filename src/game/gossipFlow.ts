import { caption, sound } from './effects'
import { chooseLine, LINES, slotsOpen } from './gossip'
import { GOSSIP_FONT, layoutLine } from './gossipFont'
import { currentStretch, type Game } from './state'
import {
  GOSSIP_MARGIN,
  LETTER_TOUCH,
  LETTER_WIGGLE_MS,
  SCRAMBLE_SPEED
} from './tuning'

/**
 * The letter block's middle: below the captions at the top, or lower down when a pile
 * takes the middle. Lines wrap to at most 2 rows, which clear the pot from either spot.
 */
const HIGH_Y = 340
const LOW_Y = 560

/**
 * Pickup just opened: if a gossip slot is open and this zone has enough free beans, the
 * first line that fits spells itself out. Only one line is out at a time.
 */
export function maybeSpell(game: Game): void {
  const world = game.pickup.world
  const gossip = game.gossip
  if (!world || gossip.spelling || world.letters.length > 0) return
  if (slotsOpen(game.route, game.stretch, gossip.started) === 0) return
  const def = currentStretch(game)
  const line = chooseLine(gossip.status, def.id, world.dryFree)
  if (line < 0) return
  const text = LINES[line]!.text
  const centerY = world.zone.pile > 0 ? LOW_Y : HIGH_Y
  const laid = layoutLine(text, { ...GOSSIP_FONT, centerY })
  if (world.spell(laid.beans, game.random.zones) === 0) return
  const first = gossip.started === 0
  gossip.started++
  gossip.status[line] = 'shown'
  gossip.spelling = {
    line,
    zoneId: world.zone.id,
    phase: 'shown',
    locked: first,
    warned: false,
    wiggleMs: 0
  }
  sound(game, 'whoosh', 0.6, 0.7)
  sound(game, 'ding', 0.5, 1.4)
  caption(
    game,
    'The beans spell something…',
    'info',
    first ? 'Jot it down before you touch a bean.' : 'Jot it down, or lose it.',
    3600
  )
}

/** True while this Pickup shows a line you haven't jotted down. */
export function gossipShown(game: Game): boolean {
  const spelling = game.gossip.spelling
  return (
    game.scene === 'pickup' &&
    spelling !== null &&
    spelling.phase === 'shown' &&
    spelling.zoneId === game.pickup.world?.zone.id
  )
}

/**
 * A press in Pickup at (x, y). The first gossip blocks every grab until jotted. Later
 * lines warn on the first touch of a letter and scramble on the next. Returns true when
 * gossip stopped the grab.
 */
export function gossipPress(game: Game, x: number, y: number): boolean {
  if (!gossipShown(game)) return false
  const spelling = game.gossip.spelling!
  const world = game.pickup.world!
  if (spelling.locked) {
    sound(game, 'buzz', 0.4, 1.4)
    caption(game, 'Jot it down first.', 'bad', 'Grandma loves gossip.', 1800)
    return true
  }
  if (!world.letterNear(x, y, LETTER_TOUCH)) return false
  if (!spelling.warned) {
    spelling.warned = true
    spelling.wiggleMs = LETTER_WIGGLE_MS
    sound(game, 'rattle', 0.4, 1.6)
    caption(game, "Careful. That's gossip.", 'bad', 'Jot it down first.', 2000)
    return true
  }
  scramble(game)
  return true
}

/** The letters fly apart and the line goes back in the queue for a later spill. */
export function scramble(game: Game): void {
  const gossip = game.gossip
  const spelling = gossip.spelling
  const world = game.pickup.world
  if (!spelling || !world) return
  world.releaseLetters(SCRAMBLE_SPEED, game.random.fx)
  gossip.status[spelling.line] = 'waiting'
  gossip.started--
  gossip.spelling = null
  gossip.jot.reset()
  sound(game, 'squish', 0.8, 0.8)
  caption(
    game,
    'You forgot the gossip already.',
    'bad',
    'Maybe the next spill will tell you again.',
    2600
  )
}

/** One step of gossip in Pickup: the letters slide, wiggle, and Jot It Down fills while held. */
export function updateGossip(game: Game, dtMs: number): void {
  const world = game.pickup.world
  if (world) world.stepLetters(dtMs)
  const gossip = game.gossip
  const spelling = gossip.spelling
  if (spelling) spelling.wiggleMs = Math.max(0, spelling.wiggleMs - dtMs)
  const jot = gossip.jot
  const ready = gossipShown(game) && !world?.sliding
  if (ready && gossip.jotHeld) {
    jot.start()
    jot.update(dtMs)
    gossip.scratchMs += dtMs
    if (gossip.scratchMs >= 260) {
      gossip.scratchMs = 0
      sound(game, 'scrub', 0.35, 1.6 + game.random.fx() * 0.2)
    }
    if (jot.level >= 1) jotted(game)
  } else if (jot.holding) jot.release()
}

/** The line is in your notebook. Its beans are ordinary beans again, still spelling it out. */
function jotted(game: Game): void {
  const gossip = game.gossip
  const spelling = gossip.spelling
  const world = game.pickup.world
  if (!spelling || !world) return
  gossip.jot.reset()
  gossip.status[spelling.line] = 'found'
  spelling.phase = 'jotted'
  world.releaseLetters()
  gossip.spelling = null
  game.stats.gossip++
  sound(game, 'ding', 0.8, 1.2)
  sound(game, 'coin', 0.4, 1.4)
  caption(
    game,
    'Jotted it down.',
    'good',
    'The Weekly Whisper will pay for that.',
    3000
  )
  game.out.push({ type: 'scene' })
}

/** Beans a big scripted hit throws so the next line can spell itself. */
export function splashFor(game: Game, base: number): number {
  const def = currentStretch(game)
  const line = chooseLine(game.gossip.status, def.id, Infinity)
  if (
    line < 0 ||
    slotsOpen(game.route, game.stretch, game.gossip.started) === 0
  )
    return base
  return Math.max(base, (LINES[line]?.need ?? 0) + GOSSIP_MARGIN)
}

/**
 * Dev: forgets a line spelled out but not jotted down, quietly, for dev shortcuts that
 * put its beans back without Pickup. Otherwise the line would keep its slot and no later
 * spill could spell anything.
 */
export function devForgetSpelling(game: Game): void {
  const gossip = game.gossip
  const spelling = gossip.spelling
  if (!spelling) return
  gossip.status[spelling.line] = 'waiting'
  gossip.started--
  gossip.spelling = null
  gossip.jot.reset()
}

/** Dev: marks the next `count` waiting lines as found. */
export function devGiveGossip(game: Game, count = 1): void {
  const status = game.gossip.status
  for (let i = 0; i < status.length && count > 0; i++)
    if (status[i] === 'waiting') {
      status[i] = 'found'
      game.gossip.started++
      game.stats.gossip++
      count--
    }
  game.out.push({ type: 'scene' })
}
