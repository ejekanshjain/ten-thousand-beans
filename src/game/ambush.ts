import { clamp } from '../shared'
import { caption, sound } from './effects'
import { POT_OFFSET_X } from './fx'
import { splashFor } from './gossipFlow'
import { characterHit, dodged } from './hits'
import type { StretchDef } from './route'
import type { Game } from './state'
import {
  AMBUSH_BACK_MS,
  AMBUSH_KICK,
  AMBUSH_LUNGE_MS,
  AMBUSH_REACH,
  AMBUSH_SPLASH,
  AMBUSH_TELL,
  AMBUSH_TILT,
  AMBUSH_TRIGGER,
  AMBUSH_WARN_MS
} from './tuning'

/**
 * The street, market and park each have one hard encounter (PLAN.md Lead Decisions):
 * Mrs Pryce bursts out of her door, a sale stampedes out of a shop, or Bruno the Great
 * Dane wakes up on his long lead. They come for the pot once you are already in their
 * reach, so the usual stop doesn't help. Only hurrying past gets you clear.
 */
export type AmbushKind = 'pryce' | 'sale' | 'bruno'

/** Waiting, the early tell, the shout and wind-up, the lunge, going back, then done. */
export type AmbushPhase = 'idle' | 'tell' | 'warn' | 'lunge' | 'back' | 'done'

export interface AmbushState {
  kind: AmbushKind
  /** Route x of the door, shop or bench they come from. */
  at: number
  phase: AmbushPhase
  /** Simulated ms in this phase. */
  ms: number
  /** Route x where they stand now, and where the lunge started and ends. */
  x: number
  fromX: number
  toX: number
  /** True once they got the pot. */
  hit: boolean
  /** Speech bubble text, '' for none, and simulated ms it has left. */
  says: string
  saysMs: number
}

/** What each ambush says and shows. */
interface AmbushLines {
  /** Who it is, for prompts. */
  who: string
  /** The shout as they burst out, or '' when the art shouts it, like Bruno's bark. */
  shout: string
  /** The caption as they burst out, and how to escape. Each one comes once a run. */
  teach: string
  teachSub: string
  /** Their bubble when they get the pot, and when you got away. */
  got: string
  missed: string
}

export const AMBUSH_LINES: Record<AmbushKind, AmbushLines> = {
  pryce: {
    who: 'Mrs Pryce',
    shout: 'Ooh! Let me SEE!',
    teach: 'Mrs Pryce wants a look!',
    teachSub: 'She grabs anyone near her gate. Hurry past!',
    got: 'Beans! For Doris? I must tell everyone.',
    missed: 'Oi! Come back!'
  },
  sale: {
    who: 'The sale',
    shout: 'SALE! EVERYTHING A POUND!',
    teach: 'A sale! Here comes the stampede.',
    teachSub: 'They trample anyone near the shop. Hurry past!',
    got: 'Bargains!',
    missed: 'Where did the bean person go?'
  },
  bruno: {
    who: 'Bruno',
    shout: '',
    teach: 'Bruno is awake!',
    teachSub: 'His lead reaches the path. Hurry past!',
    got: 'Slurp.',
    missed: 'Wuff?'
  }
}

/** Where they stand ahead of the pot's centre while they shout, and while they grab it, in u. */
const AHEAD = 110
const GRAB = 70

/** The ambush on stretch `def`, or null on stretches without one. */
export function createAmbush(def: StretchDef): AmbushState | null {
  const spec = def.ambush
  if (!spec) return null
  return {
    kind: spec.kind,
    at: spec.at,
    phase: 'idle',
    ms: 0,
    x: spec.at,
    fromX: spec.at,
    toX: spec.at,
    hit: false,
    says: '',
    saysMs: 0
  }
}

/** True while you hold the pot in the walk view, where they can get it. */
function carrying(game: Game): boolean {
  return game.scene === 'walk' && game.walker.carrying
}

function potX(game: Game): number {
  return game.walker.x + POT_OFFSET_X
}

function setPhase(a: AmbushState, phase: AmbushPhase): void {
  a.phase = phase
  a.ms = 0
}

function say(a: AmbushState, text: string, ms: number): void {
  a.says = text
  a.saysMs = ms
}

/** True when the pot's centre is inside their reach. */
export function inAmbushReach(a: AmbushState, pot: number): boolean {
  return Math.abs(pot - a.at) <= AMBUSH_REACH
}

/** Route x where the pot's centre sets them off. */
export function ambushTrigger(a: AmbushState): number {
  return a.at - AMBUSH_REACH + AMBUSH_TRIGGER
}

/**
 * One step of this stretch's ambush. Call while the walk view shows (carrying or with the
 * pot on the ground).
 */
export function updateAmbush(game: Game, simMs: number): void {
  const a = game.ambush
  if (!a) return
  a.ms += simMs
  a.saysMs -= simMs
  if (a.saysMs <= 0) a.says = ''
  const pot = potX(game)
  switch (a.phase) {
    case 'idle':
      // A dev jump can put you past them; nobody chases you down the route.
      if (pot > a.at + AMBUSH_REACH) setPhase(a, 'done')
      else if (pot >= ambushTrigger(a) - AMBUSH_TELL) tell(game, a)
      return
    case 'tell':
      if (pot > a.at + AMBUSH_REACH) setPhase(a, 'done')
      else if (pot >= ambushTrigger(a) && carrying(game)) warn(game, a)
      return
    case 'warn': {
      // They come out toward a spot just ahead of the pot, so you see them coming.
      const spot = clamp(pot + AHEAD, a.at - AMBUSH_REACH, a.at + AMBUSH_REACH)
      a.x += (spot - a.x) * Math.min(1, (simMs / 1000) * 3)
      if (a.ms >= AMBUSH_WARN_MS) lunge(game, a)
      return
    }
    case 'lunge': {
      const t = Math.min(1, a.ms / AMBUSH_LUNGE_MS)
      a.x = a.fromX + (a.toX - a.fromX) * t
      if (t >= 1) land(game, a)
      return
    }
    case 'back':
      if (a.ms > AMBUSH_BACK_MS) {
        const step = (simMs / 1000) * 220
        a.x += Math.sign(a.at - a.x) * Math.min(step, Math.abs(a.at - a.x))
        if (a.x === a.at) {
          setPhase(a, 'done')
          if (a.kind === 'pryce') sound(game, 'slam', 0.4, 1.2)
        }
      }
      return
    case 'done':
      return
  }
}

/** The early tell: a twitching curtain, a sign going up, a snore. No caption. */
function tell(game: Game, a: AmbushState): void {
  setPhase(a, 'tell')
  if (a.kind === 'pryce') sound(game, 'creak', 0.4, 1.4)
  else if (a.kind === 'sale') sound(game, 'ding', 0.5, 0.9)
  else sound(game, 'rumble', 0.25, 1.6)
}

function warn(game: Game, a: AmbushState): void {
  setPhase(a, 'warn')
  const lines = AMBUSH_LINES[a.kind]
  say(a, lines.shout, AMBUSH_WARN_MS + AMBUSH_LUNGE_MS)
  if (a.kind === 'pryce') sound(game, 'slam', 0.7, 1.4)
  else if (a.kind === 'sale') sound(game, 'bell', 0.9, 0.8)
  else sound(game, 'bark', 1, 0.6)
  const keys = game.touch ? 'Slide your thumb right.' : 'Hold Shift with W.'
  caption(game, lines.teach, 'bad', `${lines.teachSub} ${keys}`, 3600)
}

/** They go for the pot: all the way to it while it is in reach, else to the edge of their reach. */
function lunge(game: Game, a: AmbushState): void {
  setPhase(a, 'lunge')
  const pot = potX(game)
  a.hit = carrying(game) && inAmbushReach(a, pot)
  a.fromX = a.x
  const side = Math.sign(pot - a.x) || -1
  a.toX = clamp(
    pot - side * GRAB,
    a.at - AMBUSH_REACH - GRAB,
    a.at + AMBUSH_REACH + GRAB
  )
  if (!a.hit) a.toX = clamp(a.toX, a.at - AMBUSH_REACH, a.at + AMBUSH_REACH)
  sound(game, 'whoosh', 0.8, 0.8)
}

/** The lunge ends: a hit with enough beans for the next gossip line, or a dodge. */
function land(game: Game, a: AmbushState): void {
  setPhase(a, 'back')
  const lines = AMBUSH_LINES[a.kind]
  if (a.hit && carrying(game)) {
    say(a, lines.got, 2400)
    sound(game, 'squish', 0.7, 0.7)
    characterHit(game, {
      cause: a.kind,
      side: Math.sign(potX(game) - a.x) || -1,
      kick: AMBUSH_KICK,
      tilt: AMBUSH_TILT,
      splash: splashFor(game, AMBUSH_SPLASH),
      hard: true
    })
    return
  }
  a.hit = false
  // Set Down is refused from the shout to here, so the pot is always in your hands.
  if (!carrying(game)) return
  say(a, lines.missed, 2400)
  dodged(game, a.kind, `Outran ${lines.who}`)
}

// ---------------------------------------------------------------- Advice and prompts

/** The next-step hint while an ambush comes for you, or null. */
export function ambushPrompt(game: Game, touch: boolean): string | null {
  const a = game.ambush
  if (!a || a.phase !== 'warn' || !carrying(game)) return null
  const who = AMBUSH_LINES[a.kind].who
  return touch
    ? `${who}! Slide your thumb right to hurry past.`
    : `${who}! Hold Shift with W to hurry past.`
}

/** True from the shout until the lunge lands, while only hurrying gets the pot clear. */
export function ambushComing(game: Game): boolean {
  const phase = game.ambush?.phase
  return phase === 'warn' || phase === 'lunge'
}

/** Which way the ambush would throw the beans, for the arrow over the pot, or 0. */
export function ambushWarningSide(game: Game): number {
  const a = game.ambush
  if (!a || a.phase !== 'warn') return 0
  return Math.sign(potX(game) - a.x) || -1
}

// ---------------------------------------------------------------- Dev

/** Dev: this stretch's ambush bursts out now, with the pot just inside its reach. */
export function devAmbush(game: Game): boolean {
  const a = game.ambush
  if (!a || !carrying(game) || a.phase === 'done') return false
  a.at = potX(game) + AMBUSH_REACH - AMBUSH_TRIGGER
  a.x = a.fromX = a.toX = a.at
  warn(game, a)
  return true
}
