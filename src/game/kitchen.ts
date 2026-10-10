import { clamp } from '../shared'
import { caption, sound } from './effects'
import { throwBean } from './emit'
import { POT_DRAW_DEPTH, POT_OFFSET_X } from './fx'
import { splashFor } from './gossipFlow'
import { characterHit, dodged } from './hits'
import { line } from './lines'
import { openPickup } from './pickupFlow'
import { currentStretch, type Game } from './state'
import {
  BAT_SLIDE_MS,
  CAT_AWAKE_MS,
  CAT_BAT_EVERY_MS,
  CAT_BAT_REACH,
  CAT_ENTER_MS,
  CAT_FIRST_BAT_MS,
  CAT_GROOM_FIRST_MS,
  CAT_GROOM_MS,
  CAT_NOTICE,
  CAT_REACH,
  CAT_RUN_MS,
  CAT_SHOO_MS,
  CAT_SIT_OFF,
  CAT_SMUG_MS,
  CAT_STILL_SPEED,
  CAT_SWAT_KICK,
  CAT_SWAT_SPLASH,
  CAT_SWAT_TILT,
  CAT_WIGGLE_MS,
  CAT_WINDUP_MS,
  COUNTER_CAT_X,
  COUNTER_TOP,
  DOOR_CAT_X,
  FRIDGE_GAP_X,
  FRIDGE_GAP_Y,
  INTRO_DROP_MS,
  INTRO_PAW_MS,
  INTRO_WAIT_MS,
  RIM_HALF,
  SHOO_RADIUS,
  SPEED_RATE,
  STROLL_SPEED
} from './tuning'

/** The opening gag: the counter cat paws one bean off the rim, and you pick it up. */
export type IntroStep = 'wait' | 'paw' | 'fall' | 'pickup' | 'done'

/**
 * The cat in the walk view. It starts on the counter, trots to the kitchen doorway when
 * you lift the pot, then watches (awake, tail swishing) and grooms in turn. Walking past
 * while it watches gets the pot swatted.
 */
export type DoorCatPhase =
  'counter' | 'run' | 'awake' | 'groom' | 'windup' | 'smug'

export interface DoorCat {
  phase: DoorCatPhase
  /** Simulated ms spent in this phase. */
  ms: number
  /** Route x where the cat sits. */
  x: number
  /** Grooming windows started so far. The first lasts longer. */
  grooms: number
  /** True once your pot came within CAT_NOTICE. The awake timer waits for it. */
  noticed: boolean
  /** True while your pot is inside the paw's reach. */
  inReach: boolean
  /** True when the current pass through the reach got swatted. */
  swattedThisPass: boolean
  /** The side you entered the reach from: -1 left, 1 right. */
  enteredFrom: number
  /** True once getting past has paid its dodge, so walking back and forth can't farm coins. */
  dodgePaid: boolean
}

/** The cat in kitchen Pickup, which walks in, wiggles its bum and bats a bean under the fridge. */
export type PickupCatPhase = 'off' | 'enter' | 'wiggle' | 'leave'

export interface PickupCat {
  phase: PickupCatPhase
  ms: number
  /** Simulated ms until the cat next walks in. */
  wait: number
  x: number
  y: number
  fromX: number
  fromY: number
  /** Matter body id of the bean it is after. */
  target: number
  /** Beans batted under the fridge so far. */
  knocks: number
}

/** A batted bean sliding under the fridge, drawn only: the ledger already moved it. */
export interface BatSlide {
  fromX: number
  fromY: number
  ms: number
}

export interface KitchenState {
  intro: IntroStep
  introMs: number
  /** The zone holding the pawed bean, 0 when none. */
  introZone: number
  /** True while the pot sits on the counter at the very start. */
  potOnCounter: boolean
  cat: DoorCat
  pickupCat: PickupCat
  slide: BatSlide | null
  /** Tutorial captions already shown. */
  taught: { walk: boolean; cat: boolean; shoo: boolean }
}

/** Kitchen state for a new run (`intro` true) or a jump straight into the kitchen. */
export function createKitchen(intro: boolean): KitchenState {
  return {
    intro: intro ? 'wait' : 'done',
    introMs: 0,
    introZone: 0,
    potOnCounter: intro,
    cat: {
      phase: intro ? 'counter' : 'awake',
      ms: 0,
      x: intro ? COUNTER_CAT_X : DOOR_CAT_X,
      grooms: 0,
      noticed: false,
      inReach: false,
      swattedThisPass: false,
      enteredFrom: -1,
      dodgePaid: false
    },
    pickupCat: {
      phase: 'off',
      ms: 0,
      wait: CAT_FIRST_BAT_MS,
      x: 0,
      y: 0,
      fromX: 0,
      fromY: 0,
      target: -1,
      knocks: 0
    },
    slide: null,
    taught: { walk: false, cat: false, shoo: false }
  }
}

/** True while you are in your kitchen. */
export function inKitchen(game: Game): boolean {
  return currentStretch(game).id === 'kitchen'
}

/** True while the opening gag runs and the pot must stay on the counter. */
export function introBusy(game: Game): boolean {
  const step = game.kitchen.intro
  return (
    inKitchen(game) && (step === 'wait' || step === 'paw' || step === 'fall')
  )
}

/** Where the counter pot's right rim is, for the pawed bean. */
export function counterRim(game: Game): { x: number; y: number } {
  return {
    x: game.walker.x + POT_OFFSET_X + 30 + RIM_HALF,
    y: COUNTER_TOP - POT_DRAW_DEPTH
  }
}

/** One step of everything in the kitchen. Call every step while in the kitchen. */
export function updateKitchen(game: Game, simMs: number): void {
  const kitchen = game.kitchen
  if (kitchen.intro !== 'done') stepIntro(game, simMs)
  if (game.scene === 'walk' && game.walker.carrying) stepDoorCat(game, simMs)
  if (game.scene === 'pickup') stepPickupCat(game, simMs)
  if (kitchen.slide) {
    kitchen.slide.ms += simMs
    if (kitchen.slide.ms >= BAT_SLIDE_MS) kitchen.slide = null
  }
}

// ---------------------------------------------------------------- The opening gag

function stepIntro(game: Game, simMs: number): void {
  const kitchen = game.kitchen
  kitchen.introMs += simMs
  if (kitchen.intro === 'wait' && kitchen.introMs >= INTRO_WAIT_MS) {
    kitchen.intro = 'paw'
    kitchen.introMs = 0
    sound(game, 'meow', 0.5, 0.8)
  } else if (kitchen.intro === 'paw' && kitchen.introMs >= INTRO_PAW_MS) {
    kitchen.intro = 'fall'
    kitchen.introMs = 0
    const rim = counterRim(game)
    const zone = throwBean(game, rim.x, rim.y - 4, 40, -120)
    kitchen.introZone = zone.id
    game.stats.spilled++
    sound(game, 'pop', 0.7, 1.4)
    caption(game, 'The cat regrets nothing.', 'bad', '', 2200)
  } else if (kitchen.intro === 'fall') {
    if (kitchen.introMs - simMs < 900 && kitchen.introMs >= 900)
      caption(game, 'Grandma counts every one.', 'info', 'Every single one.')
    const zone = game.zones.list.find(z => z.id === kitchen.introZone)
    if (kitchen.introMs >= INTRO_DROP_MS && zone) {
      kitchen.intro = 'pickup'
      game.fx.particles.landAll(() => {})
      game.fx.captions.length = 0
      zone.shown = zone.count + zone.pile
      openPickup(game, zone)
      kitchenPickupOpened(game, zone.id)
      game.out.push({ type: 'scene' })
    }
  }
}

/** The pot leaves the counter: the counter cat jumps down and trots to the doorway. */
export function kitchenPotLifted(game: Game): void {
  const kitchen = game.kitchen
  kitchen.potOnCounter = false
  if (kitchen.intro === 'pickup') kitchen.intro = 'done'
  if (kitchen.cat.phase === 'counter') {
    kitchen.cat.phase = 'run'
    kitchen.cat.ms = 0
    sound(game, 'meow', 0.4, 1.1)
  }
  if (!kitchen.taught.walk) {
    kitchen.taught.walk = true
    if (game.touch)
      caption(
        game,
        'Hold your thumb down to walk.',
        'info',
        game.tiltButtons
          ? 'Hold the tilt buttons to keep it level.'
          : 'Tilt the phone to keep it level.',
        4200
      )
    else caption(game, 'Hold W to walk.', 'info', 'A and D tilt the pot.', 4200)
  }
}

// ---------------------------------------------------------------- The door cat

/** How long the current grooming window lasts. */
function groomLength(cat: DoorCat): number {
  return cat.grooms <= 1 ? CAT_GROOM_FIRST_MS : CAT_GROOM_MS
}

function stepDoorCat(game: Game, simMs: number): void {
  const cat = game.kitchen.cat
  const potX = game.walker.x + POT_OFFSET_X
  switch (cat.phase) {
    case 'counter':
      return
    case 'run':
      cat.ms += simMs
      cat.x =
        COUNTER_CAT_X +
        (DOOR_CAT_X - COUNTER_CAT_X) * clamp(cat.ms / CAT_RUN_MS, 0, 1)
      if (cat.ms >= CAT_RUN_MS) setPhase(cat, 'awake')
      return
    case 'awake':
      if (!cat.noticed && Math.abs(potX - cat.x) <= CAT_NOTICE) {
        cat.noticed = true
        if (!game.kitchen.taught.cat) {
          game.kitchen.taught.cat = true
          caption(game, 'Wait until it licks itself.', 'info', '', 3200)
          sound(game, 'meow', 0.5, 0.9)
        }
      }
      // Cats watch anything that moves: the timer only runs while you stand still.
      if (cat.noticed && Math.abs(game.walker.v) < CAT_STILL_SPEED)
        cat.ms += simMs
      if (cat.ms >= CAT_AWAKE_MS) {
        setPhase(cat, 'groom')
        cat.grooms++
      }
      break
    case 'groom':
      cat.ms += simMs
      if (cat.ms >= groomLength(cat)) setPhase(cat, 'awake')
      break
    case 'windup':
      cat.ms += simMs
      if (cat.ms >= CAT_WINDUP_MS) {
        setPhase(cat, 'smug')
        sound(game, 'meow', 0.9, 1.5)
        // The swat throws enough beans for the kitchen's gossip line.
        characterHit(game, {
          cause: 'cat',
          side: 1,
          kick: CAT_SWAT_KICK,
          tilt: CAT_SWAT_TILT,
          splash: splashFor(game, CAT_SWAT_SPLASH)
        })
      }
      return
    case 'smug':
      cat.ms += simMs
      if (cat.ms >= CAT_SMUG_MS) setPhase(cat, 'awake')
      break
  }

  const inside = Math.abs(potX - cat.x) <= CAT_REACH
  if (inside && !cat.inReach) {
    cat.inReach = true
    cat.swattedThisPass = false
    cat.enteredFrom = potX < cat.x ? -1 : 1
  }
  if (inside && cat.phase === 'awake' && !cat.swattedThisPass) {
    cat.swattedThisPass = true
    setPhase(cat, 'windup')
    sound(game, 'meow', 0.7, 1.3)
  } else if (!inside && cat.inReach) {
    cat.inReach = false
    const leftFrom = potX < cat.x ? -1 : 1
    if (
      leftFrom === 1 &&
      cat.enteredFrom === -1 &&
      !cat.swattedThisPass &&
      !cat.dodgePaid
    ) {
      cat.dodgePaid = true
      dodged(game, 'cat', 'Dodged the cat')
    }
  }
}

function setPhase(cat: DoorCat, phase: DoorCatPhase): void {
  cat.phase = phase
  cat.ms = 0
}

/** True while the door cat watches with its tail swishing, or is about to swat. */
export function catWatching(cat: DoorCat): boolean {
  return cat.phase === 'awake' || cat.phase === 'windup'
}

/**
 * Seconds until walking at a stroll from speed `v0` covers `distance` u, with speed
 * easing up to a stroll as it does in play. Returns Infinity when it never gets there.
 */
export function strollTime(distance: number, v0: number): number {
  if (distance <= 0) return 0
  // x(t) = S t - (S - v0)(1 - e^(-k t)) / k, solved by a few Newton steps.
  const S = STROLL_SPEED
  const k = SPEED_RATE
  let t = distance / S
  for (let i = 0; i < 8; i++) {
    const e = Math.exp(-k * t)
    const x = S * t - ((S - v0) * (1 - e)) / k
    const v = S - (S - v0) * e
    if (v <= 0) return Infinity
    t -= (x - distance) / v
  }
  return Math.max(0, t)
}

/**
 * Advice for a player who reads the cat: 'wait' when strolling on would bring the pot into
 * the paw's reach while the cat watches, otherwise 'walk'. It stops just short of the
 * reach, then walks once a grooming window leaves time to stroll all the way past.
 */
export function catAdvice(game: Game): 'walk' | 'wait' {
  if (!inKitchen(game) || game.scene !== 'walk') return 'walk'
  const cat = game.kitchen.cat
  if (cat.phase === 'counter' || cat.phase === 'run') return 'walk'
  const potX = game.walker.x + POT_OFFSET_X
  const exit = cat.x + CAT_REACH + 10
  if (potX >= exit) return 'walk'
  const v = Math.max(0, game.walker.v)
  if (cat.phase === 'groom' || cat.phase === 'smug') {
    const length = cat.phase === 'smug' ? CAT_SMUG_MS : groomLength(cat)
    const left = (length - cat.ms) / 1000
    if (strollTime(exit - potX, v) + 0.3 <= left) return 'walk'
  }
  // Speed eases off exponentially, so stopping from v takes v / SPEED_RATE u.
  const enter = cat.x - CAT_REACH
  return potX + v / SPEED_RATE + 4 >= enter ? 'wait' : 'walk'
}

// ---------------------------------------------------------------- The cat in Pickup

/** Pickup opened on a zone: the cat schedules its next visit unless this is the opening bean. */
export function kitchenPickupOpened(game: Game, zoneId: number): void {
  const pc = game.kitchen.pickupCat
  pc.phase = 'off'
  pc.ms = 0
  pc.wait = pc.knocks === 0 ? CAT_FIRST_BAT_MS : CAT_BAT_EVERY_MS
  if (zoneId === game.kitchen.introZone) pc.wait = Infinity
}

function stepPickupCat(game: Game, simMs: number): void {
  const pc = game.kitchen.pickupCat
  const world = game.pickup.world
  if (!world) return
  pc.ms += simMs
  if (pc.phase === 'off') {
    pc.wait -= simMs
    if (pc.wait > 0) return
    if (!chooseTarget(game)) {
      pc.wait = 4000
      return
    }
    pc.phase = 'enter'
    pc.ms = 0
    sound(game, 'meow', 0.45, 1)
  } else if (pc.phase === 'enter') {
    if (pc.ms >= CAT_ENTER_MS) {
      pc.phase = 'wiggle'
      pc.ms = 0
      sound(game, 'meow', 0.35, 1.25)
    }
  } else if (pc.phase === 'wiggle') {
    if (pc.ms >= CAT_WIGGLE_MS) bat(game)
  } else if (pc.ms >= 1000) {
    pc.phase = 'off'
    pc.ms = 0
  }
}

/** Picks a free bean, and where the cat sits to bat it toward the fridge. */
function chooseTarget(game: Game): boolean {
  const world = game.pickup.world
  const pc = game.kitchen.pickupCat
  if (!world || world.beans.length === 0) return false
  const body =
    world.beans[Math.floor(game.random.critters() * world.beans.length)]
  if (!body) return false
  const { x, y } = body.position
  const dx = FRIDGE_GAP_X - x
  const dy = FRIDGE_GAP_Y - y
  const length = Math.hypot(dx, dy) || 1
  pc.target = body.id
  pc.x = clamp(x - (dx / length) * CAT_SIT_OFF, 40, 560)
  pc.y = clamp(y - (dy / length) * CAT_SIT_OFF, 120, 620)
  pc.fromX = pc.x < 300 ? -60 : 660
  pc.fromY = pc.y + 40
  return true
}

/** The bat: the target bean, or the nearest free one in reach, goes under the fridge. */
function bat(game: Game): void {
  const world = game.pickup.world
  const kitchen = game.kitchen
  const pc = kitchen.pickupCat
  pc.phase = 'leave'
  pc.ms = 0
  pc.wait = CAT_BAT_EVERY_MS
  if (!world) return
  let body = world.beans.find(b => b.id === pc.target) ?? null
  if (
    !body ||
    Math.hypot(body.position.x - pc.x, body.position.y - pc.y) > CAT_BAT_REACH
  )
    body = world.nearest(pc.x, pc.y, CAT_BAT_REACH)
  if (!body) {
    caption(game, 'The cat lost interest.', 'info', '', 1800)
    return
  }
  kitchen.slide = { fromX: body.position.x, fromY: body.position.y, ms: 0 }
  world.sendToDrain(body)
  pc.knocks++
  sound(game, 'whoosh', 0.7, 1.3)
  sound(game, 'meow', 0.5, 0.8)
  if (pc.knocks === 1)
    caption(
      game,
      'Under the fridge. Of course.',
      'bad',
      game.touch
        ? 'Next time, tap the cat while it wiggles.'
        : 'Next time, click the cat while it wiggles.',
      4200
    )
  else caption(game, line(game, 'catBat'), 'bad', '', 2400)
}

/** Where the cat stands this step in Pickup, walking in or out. */
export function pickupCatPosition(
  pc: PickupCat,
  out = { x: 0, y: 0 }
): { x: number; y: number } {
  const t =
    pc.phase === 'enter'
      ? clamp(pc.ms / CAT_ENTER_MS, 0, 1)
      : pc.phase === 'leave'
        ? 1 - clamp(pc.ms / 1000, 0, 1)
        : 1
  out.x = pc.fromX + (pc.x - pc.fromX) * t
  out.y = pc.fromY + (pc.y - pc.fromY) * t
  return out
}

const at = { x: 0, y: 0 }

/** A tap or click at (x, y) in kitchen Pickup. Shoos the cat before it bats. Returns true when it did. */
export function shooPickupCat(game: Game, x: number, y: number): boolean {
  if (game.scene !== 'pickup' || !inKitchen(game)) return false
  const pc = game.kitchen.pickupCat
  if (pc.phase !== 'enter' && pc.phase !== 'wiggle') return false
  pickupCatPosition(pc, at)
  if (Math.hypot(x - at.x, y - at.y) > SHOO_RADIUS) return false
  // It runs back the way it came, from wherever it was.
  pc.x = at.x
  pc.y = at.y
  pc.phase = 'leave'
  pc.ms = 0
  pc.wait = CAT_SHOO_MS
  sound(game, 'meow', 0.8, 1.7)
  caption(game, 'The cat is furious.', 'good', 'It will be back.', 2200)
  return true
}

/** The cat leaves when Pickup closes; its next visit restarts the clock. */
export function kitchenPickupClosed(game: Game): void {
  const pc = game.kitchen.pickupCat
  pc.phase = 'off'
  game.kitchen.slide = null
}
