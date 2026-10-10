import type { Rng } from '../shared'
import { caption, sound } from './effects'
import { POT_OFFSET_X } from './fx'
import { splashFor } from './gossipFlow'
import { characterHit, dodged } from './hits'
import type { StretchDef } from './route'
import { kickPot } from './slosh'
import type { Game } from './state'
import {
  BELL_LEAD_MS,
  CYCLIST_DELAY_MAX_MS,
  CYCLIST_DELAY_MIN_MS,
  CYCLIST_KICK,
  CYCLIST_KICK_STILL,
  CYCLIST_SPEED,
  ELBOW_KICK,
  ELBOW_SPLASH,
  ELBOW_TILT,
  LEAN_RELEASE_RATE,
  NEIGHBOUR_MEET,
  NEIGHBOUR_NOTICE,
  NEIGHBOUR_STEP_MS,
  NEIGHBOUR_WALK,
  PEEK_LEAN_RATE,
  PEEK_MS,
  STARTLE_HZ,
  STARTLE_JITTER,
  STARTLE_MS,
  STILL_SPEED
} from './tuning'
import { DEG } from './units'

/** How each neighbour looks: a dressing gown with curlers, a cardigan with tea, a hoodie with headphones. */
export const NEIGHBOUR_LOOKS = ['gown', 'cardigan', 'hoodie'] as const
export type NeighbourLook = (typeof NEIGHBOUR_LOOKS)[number]

/** What a neighbour says at each step, and the caption for getting past them. */
interface NeighbourLines {
  hello: string
  peek: string
  bye: string
  oops: string
  dodge: string
}

const LINES: Record<NeighbourLook, NeighbourLines> = {
  gown: {
    hello: "Ooh, what's in the pot?",
    peek: 'Is it soup? It looks like soup.',
    bye: 'Beans? For Doris? She counts them, you know.',
    oops: 'Oops! Clumsy me.',
    dodge: 'Not today, curlers.'
  },
  cardigan: {
    hello: 'Morning! What have you got there?',
    peek: 'Beans. Smells like a Tuesday.',
    bye: 'Give Doris my best.',
    oops: 'Mind my tea!',
    dodge: 'Not today, cardigan.'
  },
  hoodie: {
    hello: "Yo, what's in the pot?",
    peek: 'Wait. Can I film this?',
    bye: 'Bean content. Respect.',
    oops: 'My bad.',
    dodge: 'Not today, headphones.'
  }
}

/**
 * A neighbour's visit: shut indoors, stepping out of the door, walking over, peeking into
 * the pot while pulling its front rim down, then going back in.
 */
export type NeighbourPhase = 'home' | 'out' | 'walk' | 'peek' | 'leave' | 'gone'

export interface Neighbour {
  look: NeighbourLook
  /** Route x of their front door. */
  door: number
  /** Route x where they stand. */
  x: number
  phase: NeighbourPhase
  /** Simulated ms in this phase. */
  ms: number
  /** Their pull on the pot's front rim, in radians. Positive lowers the front rim. */
  lean: number
  /** Beans in the pot when the peek began, or -1 when the pot was on the ground. */
  potAtPeek: number
  /** True once this visit has been settled: dodged, spilled or elbowed. */
  judged: boolean
  /** True when they elbowed the pot. */
  elbowed: boolean
  /** Speech bubble text, '' for none. */
  says: string
  /** Simulated ms the bubble has left. */
  saysMs: number
}

/** A cyclist: waiting for you to pass a point, a seeded pause, the bell, then the pass. */
export type CyclistPhase = 'waiting' | 'due' | 'bell' | 'past' | 'done'

export interface Cyclist {
  /** Route x that starts the countdown once you walk past it. */
  trigger: number
  phase: CyclistPhase
  ms: number
  /** Seeded pause between the trigger and the bell, in ms. */
  delay: number
  /** Route x of the bike. */
  x: number
  /** Simulated ms of startle jitter left. */
  startleMs: number
  /** True when the pass startled you. */
  startled: boolean
}

/** The street's characters for the current stretch. */
export interface StreetState {
  neighbours: Neighbour[]
  cyclists: Cyclist[]
}

/** Characters for stretch `def`, with seeded cyclist pauses. */
export function createStreet(def: StretchDef, random: Rng): StreetState {
  return {
    neighbours: def.neighbours.map((door, i) => ({
      look: NEIGHBOUR_LOOKS[i % NEIGHBOUR_LOOKS.length]!,
      door,
      x: door,
      phase: 'home',
      ms: 0,
      lean: 0,
      potAtPeek: -1,
      judged: false,
      elbowed: false,
      says: '',
      saysMs: 0
    })),
    cyclists: def.cyclists.map(trigger => ({
      trigger,
      phase: 'waiting',
      ms: 0,
      delay:
        CYCLIST_DELAY_MIN_MS +
        random() * (CYCLIST_DELAY_MAX_MS - CYCLIST_DELAY_MIN_MS),
      x: -1_000,
      startleMs: 0,
      startled: false
    }))
  }
}

/**
 * One step of the street's characters. Call before walking while the walk view shows
 * (carrying or with the pot on the ground). Writes their pull on the pot to `pot.lean`.
 */
export function updateStreet(game: Game, simMs: number): void {
  const street = game.street
  let lean = 0
  for (const neighbour of street.neighbours) {
    stepNeighbour(game, neighbour, simMs)
    lean += neighbour.lean
  }
  for (const cyclist of street.cyclists) {
    stepCyclist(game, cyclist, simMs)
    lean += startleLean(cyclist)
  }
  game.pot.lean = carrying(game) ? lean : 0
}

/** True while you hold the pot in the walk view, where characters can hit it. */
function carrying(game: Game): boolean {
  return game.scene === 'walk' && game.walker.carrying
}

/** Where the pot's centre is along the route. */
function potX(game: Game): number {
  return game.walker.x + POT_OFFSET_X
}

// ---------------------------------------------------------------- Neighbours

function setNeighbour(n: Neighbour, phase: NeighbourPhase): void {
  n.phase = phase
  n.ms = 0
}

function say(n: Neighbour, text: string, ms = Infinity): void {
  n.says = text
  n.saysMs = ms
}

function stepNeighbour(game: Game, n: Neighbour, simMs: number): void {
  const dtS = simMs / 1000
  const walker = game.walker
  const pot = potX(game)
  n.ms += simMs
  n.saysMs -= simMs
  if (n.saysMs <= 0) n.says = ''
  switch (n.phase) {
    case 'home':
      // A dev jump can put you past the door; nobody chases you down the street.
      if (pot > n.door + 40) setNeighbour(n, 'gone')
      else if (pot >= n.door - NEIGHBOUR_NOTICE) stepOut(game, n)
      return
    case 'out':
      if (n.ms >= NEIGHBOUR_STEP_MS) setNeighbour(n, 'walk')
      return
    case 'walk': {
      const meet = pot + NEIGHBOUR_MEET
      n.x = Math.max(meet, n.x - NEIGHBOUR_WALK * dtS)
      if (n.x > meet + 0.5) return
      if (carrying(game) && Math.abs(walker.v) > STILL_SPEED) elbow(game, n)
      else startPeek(game, n)
      return
    }
    case 'peek':
      n.x = pot + NEIGHBOUR_MEET
      if (carrying(game) && Math.abs(walker.v) > STILL_SPEED) {
        elbow(game, n)
        return
      }
      if (carrying(game)) {
        n.lean += PEEK_LEAN_RATE * DEG * dtS
        // Spills while they pull get blamed on them.
        game.lastKick = { cause: 'peek', at: game.timeMs }
      } else {
        // A pot on the ground can't be pulled, so picking it up mid-peek starts fresh.
        n.lean = Math.max(0, n.lean - LEAN_RELEASE_RATE * DEG * dtS)
      }
      if (n.ms >= PEEK_MS) {
        setNeighbour(n, 'leave')
        say(n, LINES[n.look].bye, 3200)
      }
      return
    case 'leave':
      // They let go gently, so a held counter-tilt has time to come back.
      n.lean = Math.max(0, n.lean - LEAN_RELEASE_RATE * DEG * dtS)
      if (n.lean === 0 && !n.judged) judgePeek(game, n)
      if (n.ms > 600) n.x = Math.min(n.door, n.x + NEIGHBOUR_WALK * dtS)
      if (n.x >= n.door && n.lean === 0 && n.saysMs <= 0) {
        setNeighbour(n, 'gone')
        sound(game, 'slam', 0.3, 1.3)
      }
      return
    case 'gone':
      return
  }
}

function stepOut(game: Game, n: Neighbour): void {
  setNeighbour(n, 'out')
  n.x = n.door
  say(n, LINES[n.look].hello)
  sound(game, 'slam', 0.3, 1.5)
  if (!game.taught.neighbour && carrying(game)) {
    game.taught.neighbour = true
    caption(game, 'A nosy neighbour.', 'info', 'Stop and let them peek.', 3600)
  }
}

function startPeek(game: Game, n: Neighbour): void {
  setNeighbour(n, 'peek')
  n.potAtPeek = carrying(game) ? game.counts.pot : -1
  say(n, LINES[n.look].peek)
  sound(game, 'pop', 0.5, 0.8)
  if (carrying(game) && !game.taught.peek) {
    game.taught.peek = true
    caption(
      game,
      'Hold it level while they peek.',
      'info',
      !game.touch
        ? 'Hold A against the pull.'
        : game.tiltButtons
          ? 'Hold Tilt Left against the pull.'
          : 'Tilt the phone against the pull.',
      3600
    )
  }
}

/** Walking on into a neighbour: an elbow throws beans back over the rim. */
function elbow(game: Game, n: Neighbour): void {
  setNeighbour(n, 'leave')
  n.elbowed = true
  n.judged = true
  say(n, LINES[n.look].oops, 2400)
  sound(game, 'squish', 0.6, 0.7)
  characterHit(game, {
    cause: 'neighbour',
    side: -1,
    kick: ELBOW_KICK,
    tilt: ELBOW_TILT,
    // Big hits throw enough beans for the next gossip line.
    splash: splashFor(game, ELBOW_SPLASH)
  })
}

/** The peek is over: holding the pot level the whole time pays a dodge. */
function judgePeek(game: Game, n: Neighbour): void {
  n.judged = true
  if (n.potAtPeek >= 0 && carrying(game) && game.counts.pot >= n.potAtPeek)
    dodged(game, 'neighbour', 'Dodged a nosy neighbour', LINES[n.look].dodge)
}

// ---------------------------------------------------------------- Cyclists

function setCyclist(c: Cyclist, phase: CyclistPhase): void {
  c.phase = phase
  c.ms = 0
}

function stepCyclist(game: Game, c: Cyclist, simMs: number): void {
  const pot = potX(game)
  switch (c.phase) {
    case 'waiting':
      if (game.walker.x >= c.trigger && carrying(game)) setCyclist(c, 'due')
      return
    case 'due':
      c.ms += simMs
      if (c.ms >= c.delay) ring(game, c)
      return
    case 'bell': {
      c.ms += simMs
      // Timed so the bike reaches the pot exactly BELL_LEAD_MS after the bell.
      c.x = pot - (CYCLIST_SPEED * Math.max(0, BELL_LEAD_MS - c.ms)) / 1000
      const second = BELL_LEAD_MS * 0.4
      if (c.ms - simMs < second && c.ms >= second)
        sound(game, 'bell', 0.8, 1.05)
      if (c.ms >= BELL_LEAD_MS) pass(game, c)
      return
    }
    case 'past':
      c.ms += simMs
      c.x += (CYCLIST_SPEED * simMs) / 1000
      c.startleMs = Math.max(0, c.startleMs - simMs)
      if (c.ms > 4_000 && c.startleMs === 0) setCyclist(c, 'done')
      return
    case 'done':
      return
  }
}

function ring(game: Game, c: Cyclist): void {
  setCyclist(c, 'bell')
  c.x = potX(game) - (CYCLIST_SPEED * BELL_LEAD_MS) / 1000
  sound(game, 'bell', 0.9)
  if (!game.taught.bell && carrying(game)) {
    game.taught.bell = true
    caption(
      game,
      'A bell behind you!',
      'info',
      'Stop before the bike passes.',
      3000
    )
  }
}

/** The bike passes the pot: walking gets you startled, standing still earns a dodge. */
function pass(game: Game, c: Cyclist): void {
  setCyclist(c, 'past')
  c.x = potX(game)
  sound(game, 'whoosh', 0.9, 1.15)
  if (!carrying(game)) return
  if (Math.abs(game.walker.v) > STILL_SPEED) {
    c.startled = true
    c.startleMs = STARTLE_MS
    characterHit(game, {
      cause: 'cyclist',
      side: 1,
      kick: CYCLIST_KICK,
      tilt: 0,
      splash: 0
    })
    return
  }
  // The wind of the bike still rocks the beans a little.
  kickPot(game.pot, -CYCLIST_KICK_STILL, 0)
  dodged(game, 'cyclist', 'Dodged a cyclist')
}

/** The startle's shake on the pot angle this step, in radians. */
export function startleLean(c: Cyclist): number {
  if (c.startleMs <= 0) return 0
  const t = (STARTLE_MS - c.startleMs) / 1000
  return (
    STARTLE_JITTER *
    DEG *
    Math.sin(2 * Math.PI * STARTLE_HZ * t) *
    (c.startleMs / STARTLE_MS)
  )
}

// ---------------------------------------------------------------- Advice and prompts

/**
 * For scripted players: a key naming the street event that says stop now (a neighbour
 * on the way or peeking, a bell ringing), or null when walking is safe.
 */
export function streetWait(game: Game): string | null {
  const { neighbours, cyclists } = game.street
  for (let i = 0; i < neighbours.length; i++) {
    const phase = neighbours[i]!.phase
    if (phase === 'out' || phase === 'walk' || phase === 'peek')
      return `neighbour-${i}`
  }
  for (let i = 0; i < cyclists.length; i++)
    if (cyclists[i]!.phase === 'bell') return `cyclist-${i}`
  return null
}

/** The neighbour peeking into your pot right now, or null. */
export function peeking(game: Game): Neighbour | null {
  return game.street.neighbours.find(n => n.phase === 'peek') ?? null
}

/** The next-step hint for the street's characters, or null when none is about. */
export function streetPrompt(
  game: Game,
  touch: boolean,
  tiltButtons: boolean
): string | null {
  if (!carrying(game)) return null
  const { neighbours, cyclists } = game.street
  if (cyclists.some(c => c.phase === 'bell'))
    return 'A bell! Stop before the bike passes.'
  if (peeking(game))
    return !touch
      ? 'Hold A against the pull. Keep it level.'
      : tiltButtons
        ? 'Hold Tilt Left against the pull.'
        : 'Tilt the phone against the pull.'
  if (neighbours.some(n => n.phase === 'out' || n.phase === 'walk'))
    return 'A neighbour is coming. Stop and let them peek.'
  // Once they let go, a held counter-tilt tips the pot the other way.
  if (
    neighbours.some(n => n.phase === 'leave' && !n.elbowed && n.lean > 0) &&
    Math.abs(game.pot.psiTarget) > 4 * DEG
  )
    return !touch
      ? 'They let go. Press D to bring it back level.'
      : tiltButtons
        ? 'They let go. Hold Tilt Right to level it.'
        : 'They let go. Tilt the phone back level.'
  return null
}

// ---------------------------------------------------------------- Dev

/** Dev: the next neighbour still indoors steps out just ahead of you now. */
export function devNeighbour(game: Game): boolean {
  const n = game.street.neighbours.find(m => m.phase === 'home')
  if (!n) return false
  n.door = potX(game) + 260
  stepOut(game, n)
  return true
}

/** Dev: the next cyclist rings their bell now. */
export function devCyclist(game: Game): boolean {
  const c = game.street.cyclists.find(
    m => m.phase === 'waiting' || m.phase === 'due'
  )
  if (!c) return false
  ring(game, c)
  return true
}
