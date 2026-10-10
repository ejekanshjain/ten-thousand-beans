import type { Rng } from '../shared'
import { caption, sound } from './effects'
import { POT_OFFSET_X } from './fx'
import { splashFor } from './gossipFlow'
import { characterHit, dodged } from './hits'
import { strollTime } from './kitchen'
import type { Span, StretchDef } from './route'
import { kickPot } from './slosh'
import { currentStretch, type Game } from './state'
import {
  AMBUSH_REACH,
  FEET_EVERY_MS,
  FEET_REACH,
  FEET_SPEED,
  LADDER_CYCLE_MS,
  LADDER_KICK,
  LADDER_NOTICE,
  LADDER_REACH,
  LADDER_SPLASH,
  LADDER_SWING_MS,
  LADDER_TILT,
  SCUFF_MAX,
  SCUFF_MIN,
  SHOPPER_CLEAR,
  SHOPPER_EVERY_MAX,
  SHOPPER_EVERY_MIN,
  SHOPPER_KICK,
  SHOPPER_KICK_STILL,
  SHOPPER_LEAD_MS,
  SHOPPER_MEET,
  SHOPPER_SPEED,
  SHOPPER_TILT,
  SPEED_RATE,
  SPOON_CYCLE_MS,
  SPOON_KICK,
  SPOON_OUT_MS,
  SPOON_REACH,
  SPOON_TILT,
  STILL_SPEED
} from './tuning'

/** A shopper walking against you through the crowd: on the way, then squeezing past. */
export interface Shopper {
  /** Picks the shopper's coat, hat and bag. */
  seed: number
  phase: 'coming' | 'past'
  ms: number
  /** Route x where they walk. */
  x: number
  bumped: boolean
  /** Speech bubble text, '' for none. */
  says: string
}

/** A market stall whose stallholder pokes a tasting spoon out on a fixed rhythm. */
export interface Stall {
  x: number
  /** Where this stall's spoon starts in its cycle, in ms, so stalls don't poke together. */
  offset: number
  /** True while your pot is inside the spoon's reach. */
  inReach: boolean
  /** True when this pass through the reach got poked. */
  poked: boolean
  /** The side you entered the reach from: -1 left, 1 right. */
  enteredFrom: number
  /** True once passing has paid its dodge, so walking back and forth can't farm coins. */
  paid: boolean
}

/** The man who keeps turning round with a ladder on his shoulder. */
export interface Ladder {
  x: number
  inReach: boolean
  hit: boolean
  enteredFrom: number
  /** True once passing has paid its dodge. */
  paid: boolean
  /** True once your pot came close enough for his warning. */
  noticed: boolean
}

/** Shoppers' feet crossing market Pickup and scuffing beans out of the way. */
export interface Feet {
  active: boolean
  /** Simulated ms until the next pair walks across. */
  waitMs: number
  x: number
  y: number
  /** 1 walks right, -1 left. */
  dir: number
  /** Matter ids of beans already scuffed on this crossing. */
  scuffed: Set<number>
}

/** The market's characters for the current stretch. */
export interface MarketState {
  /** Simulated ms of the walk view, which drives the spoons' and the ladder's rhythms. */
  ms: number
  stalls: Stall[]
  ladder: Ladder | null
  crowd: Span | null
  shopper: Shopper | null
  /** Route x your pot must reach, through the crowd, before the next shopper comes. */
  nextShopperAt: number
  /** Shoppers so far, for their looks and the bots' advice keys. */
  shoppers: number
  feet: Feet
}

/** Characters for stretch `def`, with seeded spoon rhythms and shopper gaps. */
export function createMarket(def: StretchDef, random: Rng): MarketState {
  return {
    ms: 0,
    stalls: def.stalls.map(x => ({
      x,
      offset: Math.floor(random() * SPOON_CYCLE_MS),
      inReach: false,
      poked: false,
      enteredFrom: -1,
      paid: false
    })),
    ladder:
      def.ladder === null
        ? null
        : {
            x: def.ladder,
            inReach: false,
            hit: false,
            enteredFrom: -1,
            paid: false,
            noticed: false
          },
    crowd: def.crowd,
    shopper: null,
    nextShopperAt: (def.crowd?.from ?? 0) + shopperGap(random),
    shoppers: 0,
    feet: {
      active: false,
      waitMs: FEET_EVERY_MS,
      x: 0,
      y: 0,
      dir: 1,
      scuffed: new Set()
    }
  }
}

function shopperGap(random: Rng): number {
  return SHOPPER_EVERY_MIN + random() * (SHOPPER_EVERY_MAX - SHOPPER_EVERY_MIN)
}

/** True while you hold the pot in the walk view, where characters can hit it. */
function carrying(game: Game): boolean {
  return game.scene === 'walk' && game.walker.carrying
}

function potX(game: Game): number {
  return game.walker.x + POT_OFFSET_X
}

/** True while stall `stall`'s spoon is out at market time `ms`. */
export function spoonOut(stall: Stall, ms: number): boolean {
  return (ms + stall.offset) % SPOON_CYCLE_MS < SPOON_OUT_MS
}

/** Where the ladder man is in his turn, in ms from the start of a swing. */
export function ladderPhase(ms: number): number {
  return ms % LADDER_CYCLE_MS
}

/** True while the ladder sweeps the path. */
export function ladderSwinging(ms: number): boolean {
  return ladderPhase(ms) < LADDER_SWING_MS
}

/**
 * One step of the market's characters. Call while the walk view shows (carrying or with
 * the pot on the ground), before walking.
 */
export function updateMarket(game: Game, simMs: number): void {
  const market = game.market
  const before = market.ms
  market.ms += simMs
  for (const stall of market.stalls) stepStall(game, stall)
  if (market.ladder) stepLadder(game, market.ladder, before)
  stepShopper(game, simMs)
}

// ---------------------------------------------------------------- Stalls

/** Tracks a pass through a stall's reach: a poke while the spoon is out, a dodge if not. */
function stepStall(game: Game, stall: Stall): void {
  const pot = potX(game)
  const inside = Math.abs(pot - stall.x) <= SPOON_REACH
  if (inside && !stall.inReach) {
    stall.inReach = true
    stall.poked = false
    stall.enteredFrom = pot < stall.x ? -1 : 1
  }
  if (
    inside &&
    carrying(game) &&
    !stall.poked &&
    spoonOut(stall, game.market.ms)
  ) {
    stall.poked = true
    sound(game, 'squish', 0.7, 1.3)
    characterHit(game, {
      cause: 'spoon',
      side: 1,
      kick: SPOON_KICK,
      tilt: SPOON_TILT,
      splash: 0
    })
  } else if (!inside && stall.inReach) {
    stall.inReach = false
    const leftFrom = pot < stall.x ? -1 : 1
    // Only a forward pass pays, once, so walking back and forth can't farm coins.
    if (
      leftFrom === 1 &&
      stall.enteredFrom === -1 &&
      !stall.poked &&
      !stall.paid &&
      carrying(game)
    ) {
      stall.paid = true
      dodged(game, 'spoon', 'Dodged a tasting spoon')
    }
  }
}

// ---------------------------------------------------------------- The ladder

function stepLadder(game: Game, ladder: Ladder, before: number): void {
  const ms = game.market.ms
  const pot = potX(game)
  if (!ladder.noticed && pot >= ladder.x - LADDER_NOTICE && carrying(game)) {
    ladder.noticed = true
    caption(
      game,
      'A man with a ladder.',
      'info',
      'Cross while it points away.',
      3600
    )
  }
  // Each swing starts with a whoosh you can hear coming.
  const near = Math.abs(pot - ladder.x) < LADDER_NOTICE + 200
  if (near && ladderPhase(ms) < ladderPhase(before))
    sound(game, 'whoosh', 0.5, 0.7)
  const inside = Math.abs(pot - ladder.x) <= LADDER_REACH
  if (inside && !ladder.inReach) {
    ladder.inReach = true
    ladder.hit = false
    ladder.enteredFrom = pot < ladder.x ? -1 : 1
  }
  if (inside && carrying(game) && !ladder.hit && ladderSwinging(ms)) {
    ladder.hit = true
    sound(game, 'whoosh', 0.9, 0.9)
    characterHit(game, {
      cause: 'ladder',
      side: -1,
      kick: LADDER_KICK,
      tilt: LADDER_TILT,
      // Big hits throw enough beans for the next gossip line.
      splash: splashFor(game, LADDER_SPLASH),
      hard: true
    })
  } else if (!inside && ladder.inReach) {
    ladder.inReach = false
    const leftFrom = pot < ladder.x ? -1 : 1
    if (
      leftFrom === 1 &&
      ladder.enteredFrom === -1 &&
      !ladder.hit &&
      !ladder.paid &&
      carrying(game)
    ) {
      ladder.paid = true
      dodged(game, 'ladder', 'Dodged the ladder')
    }
  }
}

// ---------------------------------------------------------------- Shoppers

/** True when your pot is in the crowd and clear of the stalls and the ladder, so a shopper can come. */
function crowdFree(game: Game): boolean {
  const market = game.market
  const pot = potX(game)
  if (!market.crowd || pot < market.crowd.from || pot > market.crowd.to)
    return false
  for (const stall of market.stalls)
    if (pot > stall.x - SHOPPER_CLEAR && pot < stall.x + SPOON_REACH)
      return false
  // The sale's stampede needs the path to itself.
  const sale = game.ambush
  if (
    sale &&
    sale.phase !== 'done' &&
    pot > sale.at - AMBUSH_REACH - SHOPPER_CLEAR &&
    pot < sale.at + AMBUSH_REACH
  )
    return false
  const ladder = market.ladder
  return !(
    ladder &&
    pot > ladder.x - SHOPPER_CLEAR &&
    pot < ladder.x + LADDER_REACH
  )
}

function stepShopper(game: Game, simMs: number): void {
  const market = game.market
  const shopper = market.shopper
  if (!shopper) {
    if (!carrying(game)) return
    // Near a stall or the ladder, the next shopper waits until you are 240 u clear of it.
    if (!crowdFree(game))
      market.nextShopperAt = Math.max(market.nextShopperAt, potX(game) + 240)
    else if (potX(game) >= market.nextShopperAt) spawnShopper(game)
    return
  }
  shopper.ms += simMs
  if (shopper.phase === 'coming') {
    // Timed so they reach the pot exactly SHOPPER_LEAD_MS after "Excuse me!".
    const left = Math.max(0, SHOPPER_LEAD_MS - shopper.ms)
    shopper.x = potX(game) + SHOPPER_MEET + (SHOPPER_SPEED * left) / 1000
    if (shopper.ms >= SHOPPER_LEAD_MS) meetShopper(game, shopper)
    return
  }
  shopper.x -= (SHOPPER_SPEED * simMs) / 1000
  if (shopper.ms > 900) shopper.says = ''
  if (shopper.ms > 3_000) {
    market.shopper = null
    market.nextShopperAt = potX(game) + shopperGap(game.random.events)
  }
}

function spawnShopper(game: Game): void {
  const market = game.market
  market.shoppers++
  market.shopper = {
    seed: market.shoppers,
    phase: 'coming',
    ms: 0,
    x: potX(game) + SHOPPER_MEET + (SHOPPER_SPEED * SHOPPER_LEAD_MS) / 1000,
    bumped: false,
    says: 'Excuse me!'
  }
  sound(game, 'pop', 0.4, 0.8)
  if (!game.taught.shopper) {
    game.taught.shopper = true
    caption(
      game,
      'Shoppers walk against you.',
      'info',
      'Stop and let them pass.',
      3200
    )
  }
}

/** The shopper reaches the pot: walking gets a bump, standing still lets them squeeze past. */
function meetShopper(game: Game, shopper: Shopper): void {
  shopper.phase = 'past'
  shopper.ms = 0
  if (!carrying(game)) return
  if (Math.abs(game.walker.v) > STILL_SPEED) {
    shopper.bumped = true
    shopper.says = 'Oi! Watch it!'
    characterHit(game, {
      cause: 'shopper',
      side: -1,
      kick: SHOPPER_KICK,
      tilt: SHOPPER_TILT,
      splash: 0
    })
    return
  }
  shopper.says = 'Ta, love.'
  kickPot(game.pot, SHOPPER_KICK_STILL, 0)
  dodged(game, 'shopper', 'Let a shopper past')
}

// ---------------------------------------------------------------- Feet in Pickup

/** Pickup opened: the next feet come FEET_EVERY_MS later. */
export function resetFeet(game: Game): void {
  const feet = game.market.feet
  feet.active = false
  feet.waitMs = FEET_EVERY_MS
}

/**
 * Market Pickup's twist: every FEET_EVERY_MS a shopper's feet cross the view and scuff
 * every bean they pass 40 to 80 u along their way.
 */
export function updateFeet(game: Game, simMs: number): void {
  const world = game.pickup.world
  if (!world || currentStretch(game).id !== 'market') return
  const feet = game.market.feet
  const r = game.random.critters
  if (!feet.active) {
    feet.waitMs -= simMs
    if (feet.waitMs > 0) return
    feet.active = true
    feet.dir = r() < 0.5 ? 1 : -1
    feet.x = feet.dir > 0 ? -60 : 660
    feet.y = 170 + r() * 360
    feet.scuffed.clear()
    sound(game, 'thud', 0.5, 1.2)
    if (!game.taught.feet) {
      game.taught.feet = true
      caption(
        game,
        'Feet!',
        'bad',
        'Shoppers kick beans about. Be quick.',
        3000
      )
    }
    return
  }
  feet.x += (feet.dir * FEET_SPEED * simMs) / 1000
  let scuffed = 0
  for (const body of world.beans) {
    if (feet.scuffed.has(body.id)) continue
    const dx = body.position.x - feet.x
    const dy = body.position.y - feet.y
    if (Math.abs(dx) > FEET_REACH || Math.abs(dy) > FEET_REACH + 14) continue
    feet.scuffed.add(body.id)
    // Air friction stops a bean after about speed / 7.2 u, so aim for 40 to 80 u.
    const distance = SCUFF_MIN + r() * (SCUFF_MAX - SCUFF_MIN)
    world.push(body, feet.dir * distance * 7.2, (r() - 0.5) * 120)
    scuffed++
  }
  if (scuffed > 0) sound(game, 'tick', 0.4, 0.7 + r() * 0.3)
  if (feet.x < -80 || feet.x > 680) {
    feet.active = false
    feet.waitMs = FEET_EVERY_MS
  }
}

// ---------------------------------------------------------------- Advice and prompts

/**
 * True when nothing that hits for `danger` ms at the start of every `period` ms (now at
 * `phase` ms into its cycle) catches a crossing that starts in `enterMs` and ends in
 * `exitMs`.
 */
export function clearCrossing(
  phase: number,
  period: number,
  danger: number,
  enterMs: number,
  exitMs: number
): boolean {
  const at = (((phase + enterMs) % period) + period) % period
  return at >= danger && exitMs - enterMs <= period - at
}

/**
 * Advice for a reach on a rhythm: 'wait' when strolling on would cross it while it hits,
 * and you are near enough to stop short; 'walk' once a gap leaves time to stroll across.
 */
function rhythmAdvice(
  game: Game,
  center: number,
  reach: number,
  phase: number,
  period: number,
  danger: number
): 'walk' | 'wait' {
  const pot = potX(game)
  const from = center - reach
  const to = center + reach + 10
  if (pot >= from) return 'walk'
  const v = Math.max(0, game.walker.v)
  const enter = strollTime(from - pot, v) * 1000
  const exit = strollTime(to - pot, v) * 1000
  if (clearCrossing(phase, period, danger, enter, exit)) return 'walk'
  // Speed eases off exponentially, so stopping from v takes v / SPEED_RATE u.
  return pot + v / SPEED_RATE + 4 >= from ? 'wait' : 'walk'
}

/** For scripted players: a key naming the market event that says stop now, or null. */
export function marketWait(game: Game): string | null {
  if (game.scene !== 'walk') return null
  const market = game.market
  if (market.shopper?.phase === 'coming') return `shopper-${market.shoppers}`
  for (let i = 0; i < market.stalls.length; i++) {
    const stall = market.stalls[i]!
    const phase = (market.ms + stall.offset) % SPOON_CYCLE_MS
    if (
      rhythmAdvice(
        game,
        stall.x,
        SPOON_REACH,
        phase,
        SPOON_CYCLE_MS,
        SPOON_OUT_MS
      ) === 'wait'
    )
      return `spoon-${i}`
  }
  const ladder = market.ladder
  if (
    ladder &&
    rhythmAdvice(
      game,
      ladder.x,
      LADDER_REACH,
      ladderPhase(market.ms),
      LADDER_CYCLE_MS,
      LADDER_SWING_MS
    ) === 'wait'
  )
    return 'ladder'
  return null
}

/** The next-step hint for the market's characters, or null when none is near. */
export function marketPrompt(game: Game): string | null {
  if (!carrying(game)) return null
  const market = game.market
  if (market.shopper?.phase === 'coming')
    return 'A shopper! Stop and let them squeeze past.'
  const pot = potX(game)
  const ladder = market.ladder
  if (ladder && pot > ladder.x - LADDER_NOTICE && pot < ladder.x + LADDER_REACH)
    return 'Cross while the ladder points away.'
  for (const stall of market.stalls)
    if (pot > stall.x - 260 && pot < stall.x + SPOON_REACH)
      return 'Pass the stall while the spoon is pulled back.'
  return null
}

// ---------------------------------------------------------------- Dev

/** Dev: a shopper says "Excuse me!" and comes at you now. */
export function devShopper(game: Game): boolean {
  if (game.market.shopper || !game.market.crowd) return false
  spawnShopper(game)
  return true
}

/** Dev: in market Pickup, a shopper's feet start across now. */
export function devFeet(game: Game): boolean {
  if (game.scene !== 'pickup' || currentStretch(game).id !== 'market')
    return false
  game.market.feet.active = false
  game.market.feet.waitMs = 0
  return true
}

/** Dev: the nearest stall pokes the pot now, wherever you are. */
export function devSpoon(game: Game): boolean {
  if (!carrying(game) || game.market.stalls.length === 0) return false
  sound(game, 'squish', 0.7, 1.3)
  characterHit(game, {
    cause: 'spoon',
    side: 1,
    kick: SPOON_KICK,
    tilt: SPOON_TILT,
    splash: 0
  })
  return true
}

/** Dev: the ladder swings into the pot now, wherever you are. */
export function devLadder(game: Game): boolean {
  const ladder = game.market.ladder
  if (!carrying(game) || !ladder) return false
  sound(game, 'whoosh', 0.9, 0.9)
  characterHit(game, {
    cause: 'ladder',
    side: -1,
    kick: LADDER_KICK,
    tilt: LADDER_TILT,
    splash: splashFor(game, LADDER_SPLASH),
    hard: true
  })
  return true
}
