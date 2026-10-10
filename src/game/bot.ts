import { clamp, hash01, rng, type Rng } from '../shared'
import {
  createGame,
  enterStretch,
  leaveKiosk,
  pickUp,
  returnZone,
  setDown,
  updateGame,
  zoneInReach
} from './game'
import { gateX } from './gate'
import { atDoorStretch, doorWait } from './door'
import { POT_OFFSET_X } from './fx'
import { chooseLine, slotsOpen } from './gossip'
import { catAdvice } from './kitchen'
import { sellPage } from './kiosk'
import { currentStretch, type Game, type GameInput } from './state'
import { marketWait } from './market'
import { ROUTE, type StretchDef } from './route'
import { parkWait } from './park'
import { streetWait } from './street'
import { STEP_MS } from './testing'
import {
  BACK_SPEED,
  DOOR_STOP_X,
  GATE_STOP,
  MAX_TILT,
  PICKUP_REACH,
  POUR_PROMPT_LEFTOVER,
  STROLL_SPEED,
  UPHILL_SCALE
} from './tuning'
import { DEG } from './units'
import { endPour, startPour } from './weather'
import { behind, pruneZones } from './zones'

/** How a scripted player walks and levels the pot. */
export interface BotProfile {
  /** True holds tilt keys (rate control); false tilts a phone (absolute). */
  keyboard: boolean
  /** How late the bot sees the beans move, in ms. */
  reactionMs: number
  /** Share of the bean surface's angle the bot turns the pot to follow. */
  gain: number
  /** Chance per second of starting to hurry while walking. */
  hurryRate: number
  /** How long each hurry lasts, in seconds. */
  hurryS: number
  /** How hard it hurries, 0 strolls and 1 is a full hurry. */
  hurry: number
  /** Stops walking once the slosh danger passes `stopAt`, and walks on below `resumeAt`. */
  stopAt: number
  resumeAt: number
  /** Stops hurrying when a bump or cobbles lie this close ahead, in u. 0 never looks. */
  lookAhead: number
  /** Chance the bot reads each character's telegraph and waits for a safe moment. */
  heed: number
  /** Sets the pot down to pour off rain once this much water is in it, in u. */
  pourAt: number
  /** How long it holds Pour Off, in seconds, and how much that varies either way. */
  pourS: number
  pourSpread: number
}

/**
 * The scripted players the balance tests and the dev panel use. Careful never hurries
 * and stops when the beans rock. Average hurries now and then and reacts late. Keyboard
 * holds A and D like a desktop player. Sloppy hurries often, reads few telegraphs and
 * reacts later still, like the unskilled player in PLAN.md section 5.
 */
export const BOTS = {
  careful: {
    keyboard: false,
    reactionMs: 150,
    gain: 0.8,
    hurryRate: 0,
    hurryS: 0,
    hurry: 0,
    stopAt: 0.75,
    resumeAt: 0.35,
    lookAhead: 250,
    heed: 1,
    pourAt: 3,
    pourS: 1.6,
    pourSpread: 0
  },
  average: {
    keyboard: false,
    reactionMs: 250,
    gain: 0.5,
    hurryRate: 0.1,
    hurryS: 3,
    hurry: 0.7,
    stopAt: 1.1,
    resumeAt: 0.5,
    lookAhead: 0,
    heed: 0.5,
    pourAt: 5.5,
    pourS: 1.6,
    pourSpread: 0.45
  },
  keyboard: {
    keyboard: true,
    reactionMs: 250,
    gain: 0.6,
    hurryRate: 0.06,
    hurryS: 2.5,
    hurry: 1,
    stopAt: 0.95,
    resumeAt: 0.5,
    lookAhead: 120,
    heed: 0.7,
    pourAt: 4.5,
    pourS: 1.6,
    pourSpread: 0.25
  },
  sloppy: {
    keyboard: false,
    reactionMs: 350,
    gain: 0.4,
    hurryRate: 0.15,
    hurryS: 3,
    hurry: 0.8,
    stopAt: 1.3,
    resumeAt: 0.6,
    lookAhead: 0,
    heed: 0.3,
    pourAt: 6.5,
    pourS: 1.6,
    pourSpread: 0.6
  }
} satisfies Record<string, BotProfile>

export type BotName = keyof typeof BOTS

/** After a spill a player steps back this far for beans, in u. Further ones wait for the gate. */
const STEP_BACK = 400
/** Keys that turn the pot hold still inside this error, so the bot doesn't buzz between A and D. */
const KEY_DEADBAND = 1.5 * DEG
/** The bot reads the surface a little ahead of where it is, like a player watching it swing. */
const LEAD_S = 0.1

/** A seeded scripted player. Call `drive` before every simulation step. */
export class Bot {
  private readonly random: Rng
  private readonly seen: Float64Array
  /** Characters' pull on the pot, seen with the same delay as the beans. */
  private readonly seenLean: Float64Array
  private seenIndex = 0
  private hurryLeft = 0
  private stopped = false
  /** Seconds left holding Pour Off, or -1 while not pouring. */
  private pourLeft = -1
  /** True from a gust it read until the gust's drift has settled. */
  private braced = false
  /** Whether this bot reads each telegraph, rolled once per event and kept. */
  private readonly heeded = new Map<string, boolean>()

  constructor(
    readonly profile: BotProfile,
    private readonly seed = 1
  ) {
    this.random = rng(seed)
    const size = Math.max(1, Math.round(profile.reactionMs / STEP_MS) + 1)
    this.seen = new Float64Array(size)
    this.seenLean = new Float64Array(size)
  }

  /** True when this bot reads the telegraph of the event named `key`. */
  private heeds(key: string): boolean {
    let heeds = this.heeded.get(key)
    if (heeds === undefined) {
      // Its own hash per event, so new events don't shift the bot's other rolls.
      heeds = hash01(this.seed, 1_000 + this.heeded.size) < this.profile.heed
      this.heeded.set(key, heeds)
    }
    return heeds
  }

  /**
   * Rain in the pot past `pourAt`: sets it down away from spilled beans, holds Pour Off
   * for about `pourS` seconds, and picks it up again. Returns true while the pot is down.
   */
  private pour(input: GameInput, game: Game, dtS: number): boolean {
    const p = this.profile
    if (this.pourLeft < 0) {
      if (
        game.scene !== 'walk' ||
        !game.walker.carrying ||
        game.pot.water < pourLevel(game, p) ||
        zoneInReach(game) !== null
      )
        return false
      // Mid-spill or mid-teeter the pot can't go down, so the bot walks on and tries again.
      if (!setDown(game)) return false
      if (!startPour(game)) {
        pickUp(game)
        return false
      }
      this.pourLeft = p.pourS + (this.random() - 0.5) * 2 * p.pourSpread
    }
    input.walk.walk = 0
    input.walk.hurry = 0
    input.tilt.rate = 0
    input.tilt.absolute = p.keyboard ? null : 0
    this.pourLeft -= dtS
    if (this.pourLeft > 0) return true
    endPour(game)
    pickUp(game)
    this.pourLeft = -1
    return true
  }

  /** Sets walking and tilt for one step from what the bot saw `reactionMs` ago. */
  drive(input: GameInput, game: Game, dtS: number): void {
    const p = this.profile
    const pot = game.pot
    // The ring holds the last reaction window; the slot about to be overwritten is the oldest.
    this.seen[this.seenIndex] = pot.sigma + pot.sigmaVel * LEAD_S
    this.seenLean[this.seenIndex] = pot.lean + pot.drift
    this.seenIndex = (this.seenIndex + 1) % this.seen.length
    if (this.pour(input, game, dtS)) return
    const gust = game.weather.gust
    const event =
      catAdvice(game) === 'wait'
        ? 'cat'
        : (streetWait(game) ??
          marketWait(game) ??
          parkWait(game) ??
          doorWait(game) ??
          (gust.phase === 'idle' ? null : `gust-${gust.count}`))
    const waiting = event !== null && this.heeds(event)
    // A slow steady pull is easy to see, so every bot leans fully against it. A bot that
    // read a gust's leaves leans into it as it hits instead of a reaction later.
    if (waiting && gust.phase === 'blow') this.braced = true
    else if (Math.abs(pot.drift) < 0.5 * DEG) this.braced = false
    const braced = this.braced
    const want =
      (this.seen[this.seenIndex] as number) * p.gain -
      (braced
        ? pot.lean + pot.drift - game.weather.windPush * p.gain
        : (this.seenLean[this.seenIndex] as number))
    if (p.keyboard) {
      const error = want - pot.psiTarget
      input.tilt.rate = Math.abs(error) > KEY_DEADBAND ? Math.sign(error) : 0
      input.tilt.absolute = null
    } else {
      input.tilt.rate = 0
      input.tilt.absolute = clamp(want / (MAX_TILT * DEG), -1, 1)
    }

    if (this.stopped) {
      if (pot.danger < p.resumeAt) this.stopped = false
    } else if (pot.danger > p.stopAt) {
      this.stopped = true
      this.hurryLeft = 0
    }
    if (this.hurryLeft > 0) this.hurryLeft -= dtS
    else if (!this.stopped && this.random() < p.hurryRate * dtS)
      this.hurryLeft = p.hurryS
    const hurry =
      this.hurryLeft > 0 && !hazardAhead(game, p.lookAhead) ? p.hurry : 0
    input.walk.walk = this.stopped || waiting ? 0 : 1
    input.walk.hurry = waiting ? 0 : hurry
  }
}

/**
 * Water that makes a bot pour off. Out of the rain the prompt asks for it from
 * POUR_PROMPT_LEFTOVER u, and waiting can only make things worse, so every bot obeys.
 */
function pourLevel(game: Game, p: BotProfile): number {
  return currentStretch(game).rain
    ? p.pourAt
    : Math.min(p.pourAt, POUR_PROMPT_LEFTOVER)
}

/** True when a bump, cobbles or wet grass lie within `reach` u ahead of you. */
function hazardAhead(game: Game, reach: number): boolean {
  if (reach <= 0) return false
  const def = currentStretch(game)
  const x = game.walker.x
  for (const bump of def.bumps)
    if (bump.x > x && bump.x - x <= reach) return true
  for (const span of def.cobbles)
    if (span.to >= x && span.from - x <= reach) return true
  for (const span of def.wet)
    if (span.to >= x && span.from - x <= reach) return true
  return false
}

/** What one scripted walk through a stretch cost. */
export interface StretchRun {
  /** Beans that left the pot. */
  spilled: number
  /** Simulated seconds of walking and waiting, from the start to the kiosk or Grandma's top step. */
  seconds: number
  /** Times the bot set the pot down to pick beans up. */
  pickups: number
  /** Beans it picked off the ground: loose, swollen and piled. */
  picked: number
  /** Beans it fished out of drains. */
  fished: number
  /** Beans lost for good into seed packets on this stretch. */
  lost: number
  /** Seconds a player would spend walking back to beans out of reach, and returning. */
  backSeconds: number
  /** Gossip lines its spills spelled out, as indexes into `LINES`. */
  pages: number[]
  /** Coins earned: dodges, the clean bonus, and the pages it sold at the kiosk. */
  coins: number
  /** True when the whole pot tipped onto Grandma's steps. */
  doorTipped: boolean
  /** True when the bot reached the kiosk, or Grandma's top step, inside the time limit. */
  finished: boolean
}

/**
 * Walks a bot through stretch `game.stretch` to the kiosk, or to Grandma's top step.
 * Picking up takes no simulated time: once a spill ends, and again at the gate, the bot
 * picks up like a player would (`pickUpBehind`). At the kiosk it sells every page.
 */
export function runStretch(game: Game, bot: Bot, maxSeconds = 900): StretchRun {
  const input: GameInput = {
    walk: { walk: 0, hurry: 0 },
    tilt: { rate: 0, absolute: null },
    pointer: { x: 0, y: 0, vx: 0, vy: 0, down: false }
  }
  const index = game.stretch
  const run: StretchRun = {
    spilled: 0,
    seconds: 0,
    pickups: 0,
    picked: 0,
    fished: 0,
    lost: 0,
    backSeconds: 0,
    pages: [],
    coins: 0,
    doorTipped: false,
    finished: false
  }
  const startSpilled = game.stats.spilled
  const startLost = game.stats.lost
  const startCoins = game.wallet.coins()
  const steps = Math.round((maxSeconds * 1000) / STEP_MS)
  const dtS = STEP_MS / 1000
  let spilling = false
  let step = 0
  for (; step < steps && !stretchDone(game, index); step++) {
    bot.drive(input, game, dtS)
    updateGame(game, STEP_MS, input)
    game.out.length = 0
    const ended = spilling && !game.spill.active
    spilling = game.spill.active
    const atGate = game.walker.x >= gateX(game) - GATE_STOP - 0.5
    if ((ended || atGate) && behind(game.zones.list, index) > 0)
      pickUpBehind(game, run, atGate || stretchDone(game, index))
  }
  if (game.scene === 'kiosk')
    game.gossip.status.forEach((status, line) => {
      if (status === 'found') sellPage(game, line)
    })
  run.spilled = game.stats.spilled - startSpilled
  run.lost = game.stats.lost - startLost
  run.coins = game.wallet.coins() - startCoins
  run.seconds = (step * STEP_MS) / 1000
  run.doorTipped = game.door.dog === 'tipped'
  run.finished = stretchDone(game, index)
  return run
}

/** True once a bot run through stretch `index` has reached its kiosk or Grandma's top step. */
function stretchDone(game: Game, index: number): boolean {
  if (game.stretch !== index || game.scene === 'kiosk') return true
  if (game.scene === 'count') return true
  const dog = game.door.dog
  return (
    atDoorStretch(game) &&
    game.walker.x >= DOOR_STOP_X - 1 &&
    (dog === 'made' || dog === 'tipped')
  )
}

/**
 * The bot sets the pot down by its spilled beans, like a player would: zones within
 * reach right after a spill, and everything else once the gate stops it, with one walk
 * back to the furthest zone. Each zone that fits the next gossip line spells it out and
 * gets jotted down, then its beans go back in the pot.
 */
function pickUpBehind(game: Game, run: StretchRun, all: boolean): void {
  game.fx.particles.landAll(() => {})
  const def = currentStretch(game)
  const x = game.walker.x + POT_OFFSET_X
  let away = 0
  let picked = false
  for (const zone of game.zones.list) {
    if (zone.stretch !== game.stretch) continue
    if (zone.count + zone.pile + zone.drain === 0) continue
    const distance = Math.abs(zone.anchorX - x)
    if (!all && distance > STEP_BACK) continue
    const line =
      slotsOpen(game.route, game.stretch, game.gossip.started) > 0
        ? chooseLine(game.gossip.status, def.id, zone.count - zone.puddle)
        : -1
    if (line >= 0) {
      game.gossip.status[line] = 'found'
      game.gossip.started++
      game.stats.gossip++
      run.pages.push(line)
    }
    run.picked += zone.count + zone.pile
    run.fished += zone.drain
    away = Math.max(away, distance - PICKUP_REACH)
    returnZone(game, zone)
    picked = true
  }
  if (!picked) return
  run.pickups++
  const forward = STROLL_SPEED * (def.slope ? UPHILL_SCALE : 1)
  run.backSeconds += away / BACK_SPEED + away / forward
  pruneZones(game.zones)
}

/**
 * Walks a bot from the kitchen to Grandma's top step on one game, so gossip slots,
 * pages and coins carry from stretch to stretch. Each stretch gets a fresh bot on the
 * same seed, like `runStretch` on its own. Stops early at a stretch it can't finish.
 */
export function runRoute(
  profile: BotProfile,
  seed: number,
  route: readonly StretchDef[] = ROUTE
): StretchRun[] {
  const game = createGame(seed, route)
  enterStretch(game, 0)
  const runs: StretchRun[] = []
  for (let i = 0; i < route.length; i++) {
    if (i > 0 && !leaveKiosk(game)) break
    const run = runStretch(game, new Bot(profile, seed))
    runs.push(run)
    if (!run.finished) break
  }
  return runs
}
