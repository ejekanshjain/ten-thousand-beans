import type Matter from 'matter-js'

import { caption, sound } from './effects'
import { POT_OFFSET_X } from './fx'
import { splashFor } from './gossipFlow'
import { characterHit, dodged, leaningAgainst } from './hits'
import { dodgeLine, scoreDodge } from './lines'
import { recordLost } from './packets'
import type { PickupWorld } from './pickupWorld'
import { whoaWindow } from './upgrades'
import type { Kick as KickDef, StretchDef } from './route'
import { kickPot } from './slosh'
import { currentStretch, type Game } from './state'
import {
  BALL_FLIGHT_MS,
  BALL_REACH,
  DOG_BARK_MS,
  DOG_KICK,
  DOG_SIT_MS,
  DOG_TILT,
  FOOTBALL_KICK,
  FOOTBALL_SPLASH,
  FOOTBALL_TILT,
  KICK_LEAD,
  KID_WINDUP_MS,
  PARK_DOG_BARK_MS,
  PARK_DOG_EATS,
  PARK_DOG_EVERY_MS,
  PARK_DOG_FIRST_MS,
  PARK_DOG_PUSH,
  PARK_DOG_REACH,
  PARK_DOG_SHOO,
  PARK_DOG_SPEED,
  STILL_SPEED,
  WET_KICK,
  WET_SPEED,
  WET_TILT
} from './tuning'

/** The kid's kick: waiting for you, winding up with "Heads up!", the ball in the air, done. */
export type KickPhase = 'idle' | 'windup' | 'flight' | 'done'

export interface Kick extends KickDef {
  phase: KickPhase
  ms: number
  /** True when the ball hit the pot. */
  hit: boolean
}

/**
 * An off-lead dog: lying on the grass, barking as it runs at you once you pass, then
 * jumping up at a walking pot or sitting by a still one, then trotting off.
 */
export type DogPhase = 'lying' | 'bark' | 'jump' | 'sit' | 'leave' | 'gone'

export interface ParkDog {
  /** Route x where it lies until you pass. */
  home: number
  phase: DogPhase
  ms: number
  /** Route x of the dog. */
  x: number
}

/** A wet patch on the path and its "whoa" wobble. */
export interface WetPatch {
  from: number
  to: number
  /** The way a slip here throws the beans: alternate patches alternate sides. */
  side: number
  /** Simulated ms into the wobble, or -1 when not wobbling. */
  whoaMs: number
  /** True once saving a slip here paid its dodge. */
  paid: boolean
}

/** The dog in park Pickup: off screen, barking at the edge, dashing across, or running off. */
export type PickupDogPhase = 'off' | 'bark' | 'dash' | 'leave'

export interface PickupDog {
  phase: PickupDogPhase
  ms: number
  /** Simulated ms until the next visit. */
  wait: number
  x: number
  y: number
  /** Dash direction, a unit vector. */
  dx: number
  dy: number
  /** Beans it ate on this dash. */
  eaten: number
  /** Matter ids of beans already pushed on this dash. */
  pushed: Set<number>
}

/** The park's characters for the current stretch. */
export interface ParkState {
  kicks: Kick[]
  dogs: ParkDog[]
  wet: WetPatch[]
  pickupDog: PickupDog
}

/** Beans this close to the Pickup dog's line end up in its mouth, in u. */
const DOG_MOUTH = 20
/** A dog starts this far behind you when it barks, so it reaches you DOG_BARK_MS later. */
const DOG_RUN = 300

export function createPark(def: StretchDef): ParkState {
  return {
    kicks: def.kicks.map(k => ({ ...k, phase: 'idle', ms: 0, hit: false })),
    dogs: def.dogs.map(home => ({ home, phase: 'lying', ms: 0, x: home })),
    wet: def.wet.map((span, i) => ({
      from: span.from,
      to: span.to,
      side: i % 2 === 0 ? -1 : 1,
      whoaMs: -1,
      paid: false
    })),
    pickupDog: {
      phase: 'off',
      ms: 0,
      wait: PARK_DOG_FIRST_MS,
      x: 0,
      y: 0,
      dx: 1,
      dy: 0,
      eaten: 0,
      pushed: new Set()
    }
  }
}

/** True while you hold the pot in the walk view, where characters can hit it. */
function carrying(game: Game): boolean {
  return game.scene === 'walk' && game.walker.carrying
}

function potX(game: Game): number {
  return game.walker.x + POT_OFFSET_X
}

/**
 * One step of the kid and the dogs. Call before walking while the walk view shows
 * (carrying or with the pot on the ground).
 */
export function updatePark(game: Game, simMs: number): void {
  const park = game.park
  for (const kick of park.kicks) stepKick(game, kick, simMs)
  for (const dog of park.dogs) stepDog(game, dog, simMs)
}

// ---------------------------------------------------------------- The football

/** Where the ball is along its flight, 0 at the kid's foot and 1 at the crossing. */
export function ballProgress(kick: Kick): number {
  return kick.phase === 'flight' ? Math.min(1, kick.ms / BALL_FLIGHT_MS) : 0
}

function stepKick(game: Game, kick: Kick, simMs: number): void {
  if (kick.phase === 'idle') {
    const pot = potX(game)
    // A dev jump can put you past the crossing; the kid doesn't kick at your back.
    if (pot > kick.cross - BALL_REACH) {
      kick.phase = 'done'
      kick.ms = Infinity
    } else if (carrying(game) && pot >= kick.cross - KICK_LEAD)
      windUp(game, kick)
    return
  }
  kick.ms += simMs
  if (kick.phase === 'done') return
  if (kick.phase === 'windup') {
    if (kick.ms >= KID_WINDUP_MS) {
      kick.phase = 'flight'
      kick.ms = 0
      sound(game, 'thud', 0.6, 1.3)
      sound(game, 'whoosh', 0.8, 1.2)
    }
    return
  }
  if (kick.ms < BALL_FLIGHT_MS) return
  kick.phase = 'done'
  kick.ms = 0
  if (!carrying(game)) return
  if (Math.abs(potX(game) - kick.cross) <= BALL_REACH) {
    kick.hit = true
    sound(game, 'boing', 0.8, 0.8)
    characterHit(game, {
      cause: 'football',
      // The ball flies away from the kid, and throws the beans that way.
      side: Math.sign(kick.cross - kick.kid) || -1,
      kick: FOOTBALL_KICK,
      tilt: FOOTBALL_TILT,
      splash: splashFor(game, FOOTBALL_SPLASH)
    })
    return
  }
  sound(game, 'boing', 0.5, 1.2)
  dodged(game, 'football', 'Dodged a football')
}

function windUp(game: Game, kick: Kick): void {
  kick.phase = 'windup'
  kick.ms = 0
  sound(game, 'whoosh', 0.4, 0.7)
  if (!game.taught.football) {
    game.taught.football = true
    caption(
      game,
      'Heads up!',
      'bad',
      'Stop short of where the ball lands.',
      3000
    )
  }
}

// ---------------------------------------------------------------- Dogs in the walk view

function stepDog(game: Game, dog: ParkDog, simMs: number): void {
  if (dog.phase === 'gone') return
  if (dog.phase === 'lying') {
    const pot = potX(game)
    // A dev jump can put you far past; the dog doesn't chase you down the park.
    if (pot > dog.home + 400) dog.phase = 'gone'
    else if (carrying(game) && pot >= dog.home + 60) bark(game, dog)
    return
  }
  dog.ms += simMs
  const pot = potX(game)
  if (dog.phase === 'bark') {
    // Timed so it reaches the pot exactly DOG_BARK_MS after the bark.
    dog.x = pot - 40 - (DOG_RUN * Math.max(0, DOG_BARK_MS - dog.ms)) / 1000
    if (dog.ms >= DOG_BARK_MS) arrive(game, dog)
  } else if (dog.phase === 'jump' || dog.phase === 'sit') {
    const stay = dog.phase === 'sit' ? DOG_SIT_MS : 600
    if (dog.ms >= stay) {
      dog.phase = 'leave'
      dog.ms = 0
    }
  } else if (dog.phase === 'leave') {
    dog.x -= (200 * simMs) / 1000
    if (dog.ms > 4_000) dog.phase = 'gone'
  }
}

function bark(game: Game, dog: ParkDog): void {
  dog.phase = 'bark'
  dog.ms = 0
  dog.x = potX(game) - 40 - DOG_RUN
  sound(game, 'bark', 0.9, 1)
  if (!game.taught.dog) {
    game.taught.dog = true
    caption(game, 'A dog!', 'bad', 'Stop and it sits.', 2600)
  }
}

/** The dog reaches you: a walking pot gets jumped at, a still one gets a sitting dog. */
function arrive(game: Game, dog: ParkDog): void {
  dog.ms = 0
  if (carrying(game) && Math.abs(game.walker.v) > STILL_SPEED) {
    dog.phase = 'jump'
    sound(game, 'bark', 1, 1.2)
    characterHit(game, {
      cause: 'dog',
      side: 1,
      kick: DOG_KICK,
      tilt: DOG_TILT,
      splash: 0
    })
    return
  }
  dog.phase = 'sit'
  sound(game, 'bark', 0.5, 1.5)
  if (!carrying(game)) return
  kickPot(game.pot, -0.3, 0)
  dodged(game, 'dog', 'A dog sat')
}

// ---------------------------------------------------------------- Wet grass

/**
 * Wet grass under your feet after walking from `x0`. Hurrying onto a patch faster than
 * WET_SPEED starts a "whoa" wobble; slowing under it or leaning against the slip before
 * its window ends (longer in Grippy Shoes) saves you, otherwise the pot lurches. Call after walking moves you.
 */
export function stepWet(game: Game, x0: number, simMs: number): void {
  const walker = game.walker
  for (const patch of game.park.wet) {
    if (patch.whoaMs >= 0) {
      patch.whoaMs += simMs
      const saved =
        Math.abs(walker.v) <= WET_SPEED ||
        leaningAgainst(game.pot.psiTarget, patch.side)
      if (saved) savedSlip(game, patch)
      else if (patch.whoaMs >= whoaWindow(game)) slip(game, patch)
      continue
    }
    const entered = x0 < patch.from && walker.x >= patch.from
    if (entered && walker.v > WET_SPEED) startWhoa(game, patch)
  }
}

function startWhoa(game: Game, patch: WetPatch): void {
  patch.whoaMs = 0
  sound(game, 'whoosh', 0.6, 1.7)
  sound(game, 'squish', 0.6, 1.4)
  caption(
    game,
    'Whoa!',
    'bad',
    !game.touch
      ? patch.side < 0
        ? 'Let go of W, or lean on D!'
        : 'Let go of W, or lean on A!'
      : 'Let go, or tilt against it!',
    1200
  )
}

function savedSlip(game: Game, patch: WetPatch): void {
  patch.whoaMs = -1
  if (patch.paid) {
    sound(game, 'pop', 0.6, 1.3)
    caption(game, dodgeLine(game, 'wet'), 'good', '', 1400, {
      score: scoreDodge(game.scores, 'wet')
    })
    return
  }
  patch.paid = true
  dodged(game, 'wet', 'Saved a slip')
}

function slip(game: Game, patch: WetPatch): void {
  patch.whoaMs = -1
  sound(game, 'squish', 0.9, 0.8)
  characterHit(game, {
    cause: 'wet',
    side: patch.side,
    kick: WET_KICK,
    tilt: WET_TILT,
    splash: 0
  })
}

/** The wet patch wobbling you right now, or null. */
export function whoa(game: Game): WetPatch | null {
  for (const patch of game.park.wet) if (patch.whoaMs >= 0) return patch
  return null
}

// ---------------------------------------------------------------- The dog in Pickup

/** Park Pickup opened: the first dog comes PARK_DOG_FIRST_MS later. */
export function resetPickupDog(game: Game): void {
  const dog = game.park.pickupDog
  dog.phase = 'off'
  dog.ms = 0
  dog.wait = PARK_DOG_FIRST_MS
}

/**
 * Park Pickup's dog: every PARK_DOG_EVERY_MS it barks at an edge for PARK_DOG_BARK_MS,
 * then dashes across through the beans, knocking them aside and eating up to
 * PARK_DOG_EATS. A tap during the bark sends it off.
 */
export function updatePickupDog(game: Game, simMs: number): void {
  const world = game.pickup.world
  if (!world || currentStretch(game).id !== 'park') return
  const dog = game.park.pickupDog
  const r = game.random.critters
  dog.ms += simMs
  if (dog.phase === 'off') {
    dog.wait -= simMs
    if (dog.wait > 0) return
    const side = r() < 0.5 ? -1 : 1
    dog.phase = 'bark'
    dog.ms = 0
    dog.x = side < 0 ? 30 : 570
    dog.y = 220 + r() * 300
    // It aims through the middle of the beans, or the middle of the view.
    let tx = 300
    let ty = 360
    if (world.beans.length > 0) {
      tx = ty = 0
      for (const body of world.beans) {
        tx += body.position.x
        ty += body.position.y
      }
      tx /= world.beans.length
      ty /= world.beans.length
    }
    const d = Math.hypot(tx - dog.x, ty - dog.y) || 1
    dog.dx = (tx - dog.x) / d
    dog.dy = (ty - dog.y) / d
    dog.eaten = 0
    dog.pushed.clear()
    sound(game, 'bark', 0.9, 1)
    if (!game.taught.dogPickup) {
      game.taught.dogPickup = true
      caption(
        game,
        'A dog!',
        'bad',
        game.touch ? 'Tap it before it dashes.' : 'Click it before it dashes.',
        3000
      )
    }
    return
  }
  if (dog.phase === 'bark') {
    if (dog.ms >= PARK_DOG_BARK_MS) {
      dog.phase = 'dash'
      dog.ms = 0
      sound(game, 'bark', 1, 1.3)
      sound(game, 'whoosh', 0.7, 1)
    }
    return
  }
  if (dog.phase === 'leave') {
    dog.x += (dog.dx * 400 * simMs) / 1000
    dog.y += (dog.dy * 400 * simMs) / 1000
    if (dog.ms > 1500) endVisit(dog)
    return
  }
  dog.x += (dog.dx * PARK_DOG_SPEED * simMs) / 1000
  dog.y += (dog.dy * PARK_DOG_SPEED * simMs) / 1000
  dash(game, world)
  if (dog.x < -80 || dog.x > 680 || dog.y < -80 || dog.y > 880) {
    endVisit(dog)
    if (dog.eaten > 0)
      caption(
        game,
        `Dog tax: ${dog.eaten}.`,
        'bad',
        dog.eaten === 1 ? 'It ate one on the way.' : 'It ate two on the way.',
        2600
      )
  }
}

function endVisit(dog: PickupDog): void {
  dog.phase = 'off'
  dog.ms = 0
  dog.wait = PARK_DOG_EVERY_MS
}

/**
 * Beans near the dashing dog fly aside. Beans right on its line wait until it reaches
 * them and get eaten, up to PARK_DOG_EATS a dash; after that they fly aside too.
 */
function dash(game: Game, world: PickupWorld): void {
  const dog = game.park.pickupDog
  let eat: Matter.Body | null = null
  for (const body of world.beans) {
    if (dog.pushed.has(body.id)) continue
    const rx = body.position.x - dog.x
    const ry = body.position.y - dog.y
    const d = Math.hypot(rx, ry)
    if (d > PARK_DOG_REACH) continue
    // Signed distance from the dog's line: which side the bean lies on, and how far.
    const across = rx * -dog.dy + ry * dog.dx
    if (Math.abs(across) < DOG_MOUTH && dog.eaten < PARK_DOG_EATS) {
      if (d < DOG_MOUTH + 4 && !eat) eat = body
      continue
    }
    dog.pushed.add(body.id)
    const side = across < 0 ? -1 : 1
    world.push(
      body,
      (-dog.dy * side + dog.dx * 0.4) * PARK_DOG_PUSH,
      (dog.dx * side + dog.dy * 0.4) * PARK_DOG_PUSH
    )
  }
  if (eat && world.loseBean(eat)) {
    dog.eaten++
    dog.pushed.add(eat.id)
    recordLost(game, 1, 'dog')
    sound(game, 'squish', 0.6, 1.5)
  }
}

/** A tap at (x, y) in park Pickup sends a barking dog off before it dashes. Returns true when it did. */
export function shooPickupDog(game: Game, x: number, y: number): boolean {
  if (game.scene !== 'pickup' || currentStretch(game).id !== 'park')
    return false
  const dog = game.park.pickupDog
  if (dog.phase !== 'bark') return false
  if (Math.hypot(x - dog.x, y - dog.y) > PARK_DOG_SHOO) return false
  dog.phase = 'leave'
  dog.ms = 0
  dog.dx = dog.x < 300 ? -1 : 1
  dog.dy = 0
  sound(game, 'bark', 0.5, 1.6)
  caption(game, 'Good boy. Off you go.', 'good', '', 1800)
  return true
}

// ---------------------------------------------------------------- Advice and prompts

/** For scripted players: a key naming the park event that says stop now, or null. */
export function parkWait(game: Game): string | null {
  if (game.scene !== 'walk') return null
  const park = game.park
  for (let i = 0; i < park.wet.length; i++)
    if (park.wet[i]!.whoaMs >= 0) return `whoa-${i}`
  for (let i = 0; i < park.dogs.length; i++)
    if (park.dogs[i]!.phase === 'bark') return `dog-${i}`
  const pot = potX(game)
  for (let i = 0; i < park.kicks.length; i++) {
    const kick = park.kicks[i]!
    const coming = kick.phase === 'windup' || kick.phase === 'flight'
    if (coming && pot < kick.cross + BALL_REACH) return `kick-${i}`
  }
  return null
}

/** The next-step hint for the park's characters, or null when none is about. */
export function parkPrompt(game: Game, touch: boolean): string | null {
  if (!carrying(game)) return null
  const park = game.park
  if (whoa(game))
    return touch
      ? 'Whoa! Let go, or tilt against it.'
      : 'Whoa! Let go of W, or lean against it.'
  if (park.dogs.some(d => d.phase === 'bark')) return 'A dog! Stop and it sits.'
  if (park.kicks.some(k => k.phase === 'windup' || k.phase === 'flight'))
    return 'Heads up! Stop short of where the ball lands.'
  const def = currentStretch(game)
  const x = game.walker.x
  for (const span of def.wet)
    if (span.from > x && span.from - x < 220)
      return 'Wet grass ahead. Slow down before it.'
  return null
}

/** The hint while the park dog barks at the edge of Pickup, or null. */
export function pickupDogPrompt(game: Game, touch: boolean): string | null {
  if (game.scene !== 'pickup' || currentStretch(game).id !== 'park') return null
  if (game.park.pickupDog.phase !== 'bark') return null
  return `A dog! ${touch ? 'Tap' : 'Click'} it before it dashes.`
}

/**
 * Which way a coming park hit would throw the beans, for the warning arrow over the pot:
 * 1 forward, -1 back, 0 when nothing is coming.
 */
export function parkWarningSide(game: Game): number {
  const park = game.park
  const patch = whoa(game)
  if (patch) return patch.side
  if (park.dogs.some(d => d.phase === 'bark')) return 1
  for (const kick of park.kicks)
    if (kick.phase === 'windup' || kick.phase === 'flight')
      return Math.sign(kick.cross - kick.kid) || -1
  return 0
}

// ---------------------------------------------------------------- Dev

/** Dev: the kid kicks at you now, aimed where a stroll would carry you. */
export function devFootball(game: Game): boolean {
  if (!carrying(game)) return false
  const kick = game.park.kicks.find(k => k.phase === 'idle')
  if (!kick) return false
  kick.cross = potX(game) + KICK_LEAD
  kick.kid = kick.cross + 250
  windUp(game, kick)
  return true
}

/** Dev: a dog barks behind you now, or in park Pickup one comes to the edge now. */
export function devDog(game: Game): boolean {
  if (game.scene === 'pickup' && currentStretch(game).id === 'park') {
    const dog = game.park.pickupDog
    dog.phase = 'off'
    dog.wait = 0
    return true
  }
  if (!carrying(game)) return false
  const dog = game.park.dogs.find(d => d.phase === 'lying')
  if (!dog) return false
  dog.home = potX(game) - 60
  bark(game, dog)
  return true
}

/** Dev: you skid on wet grass now, as if you hurried onto it. */
export function devWhoa(game: Game): boolean {
  const patch = game.park.wet[0]
  if (!carrying(game) || !patch) return false
  startWhoa(game, patch)
  return true
}
