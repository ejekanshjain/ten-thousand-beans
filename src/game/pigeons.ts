import type Matter from 'matter-js'

import { caption, sound } from './effects'
import { GROUND_POT_SHIFT, POT_OFFSET_X, potDepth } from './fx'
import { line } from './lines'
import { layNet, netGuards, tangleNet } from './net'
import { loseBeans, recordLost } from './packets'
import type { PickupWorld } from './pickupWorld'
import { groundY, type BirdKind } from './route'
import { currentStretch, type Game } from './state'
import {
  NET_GIVE_UP,
  PIGEON_BITE_MS,
  PIGEON_DIVERT,
  PIGEON_FIRST_SHARE,
  PIGEON_FLEE_SPEED,
  PIGEON_GROUND_START,
  PIGEON_MAX,
  PIGEON_PECK_MS,
  PIGEON_RETURN_MAX_MS,
  PIGEON_RETURN_MIN_MS,
  PIGEON_SHOO_RADIUS,
  PIGEON_SPEED,
  POT_RADIUS,
  POT_X,
  POT_Y,
  RIM_HALF
} from './tuning'

/** Walking in, pecking a loose bean, eating from the pot's rim, or flying off. */
export type PigeonPhase = 'walk' | 'peck' | 'eat' | 'flee'

export interface Pigeon {
  id: number
  phase: PigeonPhase
  /** Top-down position in Pickup. In the walk view: route x, and the y of its feet. */
  x: number
  y: number
  /** Facing: an angle in radians in Pickup, 1 (right) or -1 (left) in the walk view. */
  facing: number
  /** Simulated ms in this phase. On the rim, ms since the last bite. */
  ms: number
  /** Matter id of the bean it is after, or -1. */
  target: number
  /** Flight velocity while fleeing, in u/s. */
  vx: number
  vy: number
  /** Bites the untangled Pigeon Net blocked. It gives up after NET_GIVE_UP. */
  foiled: number
}

/** A feather from a scattered flock, drawn only. */
export interface Feather {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  ms: number
}

/** Where the flock lives: the top-down Pickup view, or the walk view with the pot down. */
export type FlockView = 'pickup' | 'grounded'

/** Pigeons coming for the pot while it sits on the ground. */
export interface Flock {
  /** The view the pigeons belong to, or null while you carry the pot. */
  view: FlockView | null
  pigeons: Pigeon[]
  /** Simulated ms until the next pigeon walks in. */
  waitMs: number
  nextId: number
  /** Pigeons that walked in since the pot went down. The first one tangles the Pigeon Net. */
  arrivals: number
  /** Beans the flock ate since the pot went down, for the running "Pigeon tax" caption. */
  eaten: number
  /** Times you scattered them this run, to rotate the shoo caption. */
  shoos: number
  feathers: Feather[]
}

/** How the captions name the stretch's birds. */
interface BirdWords {
  one: string
  many: string
  tax: string
}

const BIRD_WORDS: Record<BirdKind, BirdWords> = {
  pigeon: { one: 'pigeon', many: 'Pigeons', tax: 'Pigeon tax' },
  gull: { one: 'gull', many: 'Gulls', tax: 'Gull tax' }
}

/** The stretch's birds: pigeons, or the market's gulls. */
function birdOf(game: Game): BirdKind {
  return currentStretch(game).bird
}

function words(game: Game): BirdWords {
  return BIRD_WORDS[birdOf(game)]
}

/**
 * A bird noise: a coo, or a gull's croak a lot lower. `laugh` swaps a gull's croak for
 * its cackle, for an arrival or a first bite.
 */
function call(game: Game, volume: number, pitch: number, laugh = false): void {
  if (birdOf(game) === 'pigeon') sound(game, 'coo', volume, pitch)
  else if (laugh) sound(game, 'laugh', volume, 1.5)
  else sound(game, 'coo', volume, pitch * 0.55)
}

/** How long a feather drifts, in ms. */
export const FEATHER_MS = 900
/** Most feathers in the air at once. */
const MAX_FEATHERS = 24
/** A fleeing pigeon is gone after this long, in ms. */
const FLEE_MS = 1600
/** In the walk view a pigeon's body sits this far above its feet, in u. */
const BODY_LIFT = 14

export function createFlock(): Flock {
  return {
    view: null,
    pigeons: [],
    waitMs: Infinity,
    nextId: 1,
    arrivals: 0,
    eaten: 0,
    shoos: 0,
    feathers: []
  }
}

/** The pot left the ground or the stretch changed: every pigeon goes. */
export function clearFlock(flock: Flock): void {
  flock.view = null
  flock.pigeons.length = 0
  flock.feathers.length = 0
  flock.arrivals = 0
  flock.eaten = 0
  flock.waitMs = Infinity
}

/**
 * The pot just went down in `view`: the first pigeon comes after part of the usual gap,
 * and the Pigeon Net goes over the pot.
 */
function startFlock(game: Game, view: FlockView): void {
  const flock = game.flock
  clearFlock(flock)
  flock.view = view
  layNet(game)
  const every = currentStretch(game).pigeonEveryMs
  flock.waitMs = every === null ? Infinity : every * PIGEON_FIRST_SHARE
}

/** Pigeons on the ground or on the pot, not flying off. */
export function activePigeons(flock: Flock): number {
  let n = 0
  for (const p of flock.pigeons) if (p.phase !== 'flee') n++
  return n
}

/** Where the pot sits in the walk view once you set it down, in route x. */
export function groundPotX(game: Game): number {
  return game.walker.x + POT_OFFSET_X + GROUND_POT_SHIFT
}

/** The y of a pigeon's feet on the ground at route x, in the walk view. */
function feetY(game: Game, x: number): number {
  return groundY(currentStretch(game), x) + 2
}

/**
 * One step of the flock. Call while the pot sits on the ground in Pickup or the walk
 * view. Pigeons walk in on the stretch's rhythm, at most PIGEON_MAX at once.
 */
export function updateFlock(game: Game, simMs: number): void {
  const flock = game.flock
  stepFeathers(flock, simMs)
  const view: FlockView = game.scene === 'pickup' ? 'pickup' : 'grounded'
  if (flock.view !== view) startFlock(game, view)
  const every = currentStretch(game).pigeonEveryMs
  if (every !== null) {
    flock.waitMs -= simMs
    if (flock.waitMs <= 0) {
      flock.waitMs = every
      if (activePigeons(flock) < PIGEON_MAX) spawn(game)
    }
  }
  for (const pigeon of flock.pigeons) stepPigeon(game, pigeon, simMs)
  if (game.net.snapped) {
    // The net pulled tight under the pigeons on the rim.
    game.net.snapped = false
    for (const p of flock.pigeons) if (p.phase === 'eat') flyOff(game, p)
  }
  for (let i = flock.pigeons.length - 1; i >= 0; i--) {
    const p = flock.pigeons[i]!
    if (p.phase === 'flee' && p.ms >= FLEE_MS) flock.pigeons.splice(i, 1)
  }
}

/** A pigeon waddles in from one side. */
function spawn(game: Game): Pigeon {
  const flock = game.flock
  const r = game.random.critters
  const side = r() < 0.5 ? -1 : 1
  const pickup = flock.view === 'pickup'
  const x = pickup
    ? side < 0
      ? -60
      : 660
    : groundPotX(game) + side * PIGEON_GROUND_START
  const pigeon: Pigeon = {
    id: flock.nextId++,
    phase: 'walk',
    x,
    y: pickup ? 260 + r() * 460 : feetY(game, x),
    facing: pickup ? (side < 0 ? 0 : Math.PI) : -side,
    ms: 0,
    target: -1,
    vx: 0,
    vy: 0,
    foiled: 0
  }
  flock.pigeons.push(pigeon)
  call(game, 0.6, 0.9 + r() * 0.2, true)
  if (flock.arrivals++ === 0) tangleNet(game)
  const kind = birdOf(game)
  if (!game.taught[kind]) {
    game.taught[kind] = true
    caption(
      game,
      `${words(game).many}!`,
      'bad',
      game.touch ? 'Tap one to shoo the lot.' : 'Click one to shoo the lot.',
      3600
    )
  }
  return pigeon
}

function stepPigeon(game: Game, p: Pigeon, simMs: number): void {
  p.ms += simMs
  if (p.phase === 'walk') walk(game, p, simMs)
  else if (p.phase === 'peck') peck(game, p)
  else if (p.phase === 'eat') eat(game, p)
  else {
    p.x += (p.vx * simMs) / 1000
    p.y += (p.vy * simMs) / 1000
  }
}

/** The free bean with Matter id `id`, or null once it was grabbed or eaten. */
function freeBean(world: PickupWorld, id: number): Matter.Body | null {
  for (const body of world.beans) if (body.id === id) return body
  return null
}

/**
 * Walks toward the pot, or toward a loose bean that caught its eye on the way. Arriving
 * starts a peck, or a perch on the rim.
 */
function walk(game: Game, p: Pigeon, simMs: number): void {
  const step = (PIGEON_SPEED * simMs) / 1000
  if (game.flock.view === 'grounded') {
    const pot = groundPotX(game)
    const dx = pot - p.x
    p.facing = dx < 0 ? -1 : 1
    if (Math.abs(dx) <= RIM_HALF + 4) {
      // Hops up onto the near rim.
      p.phase = 'eat'
      p.ms = PIGEON_BITE_MS * 0.6
      p.x = pot - p.facing * 30
      p.y = groundY(currentStretch(game), pot) - potDepth(game.options.tall) - 2
      call(game, 0.5, 1.1)
      return
    }
    p.x += p.facing * Math.min(step, Math.abs(dx))
    p.y = feetY(game, p.x)
    return
  }
  const world = game.pickup.world
  if (!world) return
  let bean = p.target >= 0 ? freeBean(world, p.target) : null
  if (!bean) {
    bean = world.nearest(p.x, p.y, PIGEON_DIVERT)
    p.target = bean ? bean.id : -1
  }
  const tx = bean ? bean.position.x : POT_X
  const ty = bean ? bean.position.y : POT_Y
  const stop = bean ? 10 : POT_RADIUS + 4
  const dx = tx - p.x
  const dy = ty - p.y
  const d = Math.hypot(dx, dy) || 1
  p.facing = Math.atan2(dy, dx)
  // A little slack, since each step only closes the gap down to `stop`.
  if (d > stop + 0.5) {
    const move = Math.min(step, d - stop)
    p.x += (dx / d) * move
    p.y += (dy / d) * move
    return
  }
  p.ms = 0
  if (bean) {
    p.phase = 'peck'
    return
  }
  // Perches on the rim, facing the beans.
  p.phase = 'eat'
  p.ms = PIGEON_BITE_MS * 0.6
  p.x = POT_X - (dx / d) * (POT_RADIUS - 6)
  p.y = POT_Y - (dy / d) * (POT_RADIUS - 6)
  call(game, 0.5, 1.1)
}

/** Pecks at a loose bean for PIGEON_PECK_MS, then it's gone into a seed packet. */
function peck(game: Game, p: Pigeon): void {
  const world = game.pickup.world
  const bean = world ? freeBean(world, p.target) : null
  if (!world || !bean) {
    p.phase = 'walk'
    p.target = -1
    p.ms = 0
    return
  }
  // It keeps its beak on the bean if the bean rolls.
  p.x = bean.position.x - Math.cos(p.facing) * 10
  p.y = bean.position.y - Math.sin(p.facing) * 10
  if (p.ms < PIGEON_PECK_MS) return
  p.phase = 'walk'
  p.target = -1
  p.ms = 0
  if (!world.loseBean(bean)) return
  recordLost(game, 1, birdOf(game))
  game.flock.eaten++
  call(game, 0.7, 1.3)
  sound(game, 'pop', 0.4, 0.7)
  const said = words(game)
  if (world.clear)
    caption(
      game,
      'All clear.',
      'good',
      `The ${said.many.toLowerCase()} helped. Sort of.`,
      3200
    )
  else if (!game.taught.pigeonBean) {
    game.taught.pigeonBean = true
    caption(
      game,
      `A ${said.one} ate a bean.`,
      'bad',
      "Lost for good. It's a seed packet now.",
      3200
    )
  } else taxCaption(game)
}

/** On the rim: one bean from the pot every PIGEON_BITE_MS, unless the net is on. */
function eat(game: Game, p: Pigeon): void {
  if (p.ms < PIGEON_BITE_MS) return
  p.ms = 0
  if (netGuards(game)) {
    peckNet(game, p)
    return
  }
  if (game.counts.pot === 0) return
  loseBeans(game, 'pot', 1, birdOf(game))
  const flock = game.flock
  flock.eaten++
  call(game, 0.45, 1 + game.random.fx() * 0.3, flock.eaten === 1)
  sound(game, 'pop', 0.3, 0.8)
  const said = words(game)
  if (flock.eaten === 1)
    caption(
      game,
      `${said.tax}.`,
      'bad',
      `${game.touch ? 'Tap' : 'Click'} a ${said.one} to shoo the lot.`,
      3000
    )
  else taxCaption(game)
}

/** A beak on the untangled net: a boing, a puzzled "?", and after NET_GIVE_UP it flies off. */
function peckNet(game: Game, p: Pigeon): void {
  p.foiled++
  sound(game, 'boing', 0.35, 1.5 + game.random.critters() * 0.3)
  if (!game.net.told) {
    game.net.told = true
    caption(
      game,
      'The net says no.',
      'good',
      `That ${words(game).one} is very confused.`,
      2600
    )
  }
  if (p.foiled >= NET_GIVE_UP) flyOff(game, p)
}

/** "Pigeon tax: 10." every fifth bean, so the bill reads as it runs up. */
function taxCaption(game: Game): void {
  const eaten = game.flock.eaten
  if (eaten % 5 === 0)
    caption(
      game,
      `${words(game).tax}: ${eaten}.`,
      'bad',
      'Every one is a seed packet now.',
      2400
    )
}

/**
 * A tap or click at (x, y), in Pickup or world coordinates of the walk view. Within
 * PIGEON_SHOO_RADIUS of any pigeon it scatters the whole flock in a burst of feathers,
 * and they come back 6 to 10s later. Returns true when it did.
 */
export function shooPigeons(game: Game, x: number, y: number): boolean {
  const flock = game.flock
  if (!flock.view) return false
  const lift = flock.view === 'grounded' ? BODY_LIFT : 0
  let near = false
  for (const p of flock.pigeons)
    if (
      p.phase !== 'flee' &&
      Math.hypot(x - p.x, y - (p.y - lift)) <= PIGEON_SHOO_RADIUS
    )
      near = true
  if (!near) return false
  scatter(game)
  return true
}

/** Every pigeon flies off at once with a flurry of feathers. */
function scatter(game: Game): void {
  const flock = game.flock
  const r = game.random.critters
  for (const p of flock.pigeons) if (p.phase !== 'flee') flyOff(game, p)
  flock.waitMs =
    PIGEON_RETURN_MIN_MS + r() * (PIGEON_RETURN_MAX_MS - PIGEON_RETURN_MIN_MS)
  call(game, 0.8, 1.6)
  sound(game, 'whoosh', 0.6, 1.4)
  caption(
    game,
    line(game, 'shoo'),
    'good',
    flock.shoos === 0 ? "They'll be back." : '',
    1800
  )
  flock.shoos++
}

/** One pigeon flies off, away from the pot, shedding feathers. */
function flyOff(game: Game, p: Pigeon): void {
  const flock = game.flock
  const r = game.random.critters
  const grounded = flock.view === 'grounded'
  const potX = grounded ? groundPotX(game) : POT_X
  p.phase = 'flee'
  p.ms = 0
  p.target = -1
  if (grounded) {
    const away = p.x < potX ? -1 : 1
    p.facing = away
    p.vx = away * PIGEON_FLEE_SPEED * 0.8
    p.vy = -PIGEON_FLEE_SPEED * 0.6
  } else {
    // Away from the pot and up the screen, a little different for each bird.
    const a =
      Math.atan2(p.y - POT_Y - 120, p.x - POT_X || 1) + (r() - 0.5) * 0.6
    p.facing = a
    p.vx = Math.cos(a) * PIGEON_FLEE_SPEED
    p.vy = Math.sin(a) * PIGEON_FLEE_SPEED
  }
  for (let i = 0; i < 5 && flock.feathers.length < MAX_FEATHERS; i++) {
    const a = r() * Math.PI * 2
    const speed = 40 + r() * 80
    flock.feathers.push({
      x: p.x,
      y: p.y - (grounded ? BODY_LIFT : 0),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - (grounded ? 40 : 0),
      angle: r() * Math.PI,
      spin: (r() - 0.5) * 8,
      ms: 0
    })
  }
  call(game, 0.5, 1.4)
}

/** Feathers drift, slow down and fall. */
function stepFeathers(flock: Flock, simMs: number): void {
  const dt = simMs / 1000
  const fall = flock.view === 'grounded' ? 60 : 0
  for (let i = flock.feathers.length - 1; i >= 0; i--) {
    const f = flock.feathers[i]!
    f.ms += simMs
    if (f.ms >= FEATHER_MS) {
      flock.feathers.splice(i, 1)
      continue
    }
    const drag = Math.max(0, 1 - 3 * dt)
    f.vx *= drag
    f.vy = f.vy * drag + fall * dt
    f.x += f.vx * dt
    f.y += f.vy * dt
    f.angle += f.spin * dt
  }
}

/** The next-step hint while pigeons are about, or null. */
export function pigeonPrompt(game: Game, touch: boolean): string | null {
  const flock = game.flock
  const scene = game.scene
  if (!flock.view || (scene !== 'pickup' && scene !== 'grounded')) return null
  if (activePigeons(flock) === 0) return null
  return `${touch ? 'Tap' : 'Click'} a ${words(game).one} to shoo the whole flock.`
}

/** Dev: a pigeon walks in now, wherever the pot sits on the ground. Returns false while you carry it. */
export function devPigeon(game: Game): boolean {
  if (game.scene !== 'pickup' && game.scene !== 'grounded') return false
  const view: FlockView = game.scene === 'pickup' ? 'pickup' : 'grounded'
  if (game.flock.view !== view) startFlock(game, view)
  spawn(game)
  return true
}
