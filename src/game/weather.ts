import { damp, HoldCharge } from '../shared'
import { caption, sound } from './effects'
import { emitBeans } from './emit'
import { introBusy } from './kitchen'
import { line, scoreDodge } from './lines'
import { loseBeans } from './packets'
import { marginFor } from './slosh'
import { currentStretch, type Game } from './state'
import {
  CROSSWIND,
  FLOAT_RATE,
  GUST_DRIFT_DECAY,
  GUST_DRIFT_RATE,
  GUST_MS,
  GUST_PUSH,
  GUST_WARN_MS,
  POUR_BEANS_BASE,
  POUR_BEANS_MAX,
  POUR_BEANS_PER,
  POUR_FILL_MS,
  POUR_GOOD_FROM,
  POUR_GOOD_TO,
  POUR_PROMPT_LEFTOVER,
  POUR_PROMPT_WATER,
  RAIN_RATE,
  ROLL_A,
  ROLL_B,
  ROLL_HZ,
  ROLL_HZ_B,
  ROLL_PHASE,
  SWAY_BLAME
} from './tuning'
import { DEG } from './units'

/** A wind gust: quiet, warning (leaves and rising wind), then blowing. */
export interface Gust {
  phase: 'idle' | 'warn' | 'blow'
  /** The way the wind blows: 1 forward (right), -1 back. */
  side: 1 | -1
  /** Simulated ms in this phase. */
  ms: number
  /** Simulated ms of carrying until the next gust warns. */
  waitMs: number
  /** Gusts so far on this stretch. */
  count: number
  /** Beans spilled on the stretch when this gust started, to tell a gust you rode out. */
  spilledAt: number
  /** Gusts ridden out without a spill, to rotate and then quieten the praise. */
  ridden: number
}

/** Rain, wind and the Pour Off chore on the current stretch. */
export interface WeatherState {
  gust: Gust
  /** The wind's push on the bean surface this step, in radians. */
  windPush: number
  /** The pot's drift from gusts, in radians. It fades after each gust. */
  gustDrift: number
  /** The rope bridge's deck roll this step, in radians, 0 off the bridge. */
  roll: number
  /** True while rain falls into the pot you carry. */
  raining: boolean
  /** Fractional beans waiting to float out of a flooded pot. */
  floatAcc: number
  /** Spill events whose beans rolled down the slope, for "Gravity: 2. You: 0.". */
  gravity: number
  /** Pour Off: hold to tip the pot, let go in the green. */
  pour: HoldCharge
  pouring: boolean
  /** Tutorial captions already shown this run. */
  told: {
    rain: boolean
    filling: boolean
    float: boolean
    gust: boolean
    deck: boolean
  }
}

export function createWeather(): WeatherState {
  return {
    gust: {
      phase: 'idle',
      side: 1,
      ms: 0,
      waitMs: Infinity,
      count: 0,
      spilledAt: 0,
      ridden: 0
    },
    windPush: 0,
    gustDrift: 0,
    roll: 0,
    raining: false,
    floatAcc: 0,
    gravity: 0,
    pour: new HoldCharge({ fillMs: POUR_FILL_MS }),
    pouring: false,
    told: {
      rain: false,
      filling: false,
      float: false,
      gust: false,
      deck: false
    }
  }
}

/** A new stretch: calm, with the first gust a full gap away. The pot's water stays. */
export function resetWeather(game: Game): void {
  const w = game.weather
  const gusts = currentStretch(game).gusts
  w.gust.phase = 'idle'
  w.gust.ms = 0
  w.gust.count = 0
  w.gust.waitMs = gusts ? nextGap(game) : Infinity
  w.windPush = 0
  w.gustDrift = 0
  w.roll = 0
  w.raining = false
  w.floatAcc = 0
  w.gravity = 0
  cancelPour(game)
}

/** The rope bridge's roll at simulated time `timeMs`, in radians: two sines. */
export function deckRoll(timeMs: number): number {
  const t = timeMs / 1000
  return (
    (ROLL_A * Math.sin(2 * Math.PI * ROLL_HZ * t) +
      ROLL_B * Math.sin(2 * Math.PI * ROLL_HZ_B * t + ROLL_PHASE)) *
    DEG
  )
}

function nextGap(game: Game): number {
  const gusts = currentStretch(game).gusts
  if (!gusts) return Infinity
  return gusts.min + game.random.weather() * (gusts.max - gusts.min)
}

// ---------------------------------------------------------------- Walking

/**
 * One step of weather while you carry the pot in the walk view: rain fills it, a flooded
 * pot loses beans that float out, gusts warn, push the beans and drift the pot, and the
 * rope bridge rolls it with a steady crosswind lean. Returns the wind's push on the bean
 * surface, in radians.
 */
export function stepWeather(game: Game, simMs: number): number {
  const def = currentStretch(game)
  const w = game.weather
  const pot = game.pot
  const dtS = simMs / 1000
  w.raining = def.rain
  if (def.rain) rain(game, dtS)
  const gust = w.gust
  if (def.gusts) {
    gust.ms += simMs
    if (gust.phase === 'idle') {
      gust.waitMs -= simMs
      if (gust.waitMs <= 0) warn(game)
    } else if (gust.phase === 'warn' && gust.ms >= GUST_WARN_MS) blow(game)
    else if (gust.phase === 'blow' && gust.ms >= GUST_MS) calm(game)
  }
  w.roll = def.deck ? deckRoll(game.timeMs) : 0
  // Spills while the deck leans hard blame the bridge, unless a gust is blowing.
  if (Math.abs(w.roll) > SWAY_BLAME * DEG)
    game.lastKick = { cause: 'sway', at: game.timeMs }
  const blowing = gust.phase === 'blow'
  if (blowing) {
    w.gustDrift += gust.side * GUST_DRIFT_RATE * DEG * dtS
    // Spills while it blows, and just after, blame the gust.
    game.lastKick = { cause: 'gust', at: game.timeMs }
  } else w.gustDrift = damp(w.gustDrift, 0, GUST_DRIFT_DECAY, dtS)
  pot.drift = w.gustDrift + (def.deck ? w.roll + CROSSWIND * DEG : 0)
  if (def.deck && !w.told.deck) {
    w.told.deck = true
    caption(
      game,
      'It sways.',
      'bad',
      game.touch
        ? 'Tilt against the roll to keep the beans in.'
        : 'Use A and D against the roll to keep the beans in.',
      3600
    )
  }
  if (gust.phase === 'idle' && gust.count > 0 && gust.spilledAt >= 0)
    praiseRide(game)
  // Downwind beans heap up, which tilts the surface against the wind. The push swells
  // and fades over the gust, so it rocks the beans without a sudden jolt.
  w.windPush = blowing
    ? -gust.side * GUST_PUSH * DEG * Math.sin((Math.PI * gust.ms) / GUST_MS)
    : 0
  return w.windPush
}

/** True when rain water has filled the pot past the brim, so beans float out even when it's level. */
export function flooded(game: Game): boolean {
  return game.pot.water > marginFor(game.counts.pot, 0, game.options)
}

/** Rain fills the pot, unless the Pot Lid keeps it out. Past the brim, beans swim out. */
function rain(game: Game, dtS: number): void {
  const w = game.weather
  const pot = game.pot
  if (!w.told.rain) {
    w.told.rain = true
    caption(
      game,
      'Rain.',
      'bad',
      game.options.lid
        ? 'The lid keeps it out. Smug.'
        : 'It fills the pot, so beans spill sooner.',
      3200
    )
  }
  if (game.options.lid) return
  pot.water += RAIN_RATE * dtS
  if (!w.told.filling && pot.water >= POUR_PROMPT_WATER) {
    w.told.filling = true
    caption(
      game,
      "The pot's filling up.",
      'bad',
      game.touch
        ? 'Set it down and hold Pour Off.'
        : 'Set it down and hold P to pour it off.',
      3600
    )
  }
  if (!flooded(game)) {
    w.floatAcc = 0
    return
  }
  // A flooded pot spills over the brim on its own, and the rain gets the blame.
  game.lastKick = { cause: 'rain', at: game.timeMs }
  w.floatAcc += FLOAT_RATE * dtS
  const n = Math.min(game.counts.pot, Math.floor(w.floatAcc))
  if (n === 0) return
  w.floatAcc -= n
  emitBeans(game, n, game.random.weather() < 0.5 ? -1 : 1, 2)
  if (!w.told.float) {
    w.told.float = true
    caption(game, "They're swimming for it!", 'bad', 'Pour it off. Now.', 3000)
  }
}

function warn(game: Game): void {
  const gust = game.weather.gust
  gust.phase = 'warn'
  gust.ms = 0
  gust.side = game.random.weather() < 0.5 ? -1 : 1
  gust.count++
  sound(game, 'wind', 0.5, 0.8)
  const told = game.weather.told
  if (!told.gust) {
    told.gust = true
    const key = gust.side > 0 ? 'A' : 'D'
    caption(
      game,
      'Wind!',
      'bad',
      game.touch
        ? 'Tilt into it when the leaves fly.'
        : `Lean into it: hold ${key} as it hits.`,
      2600
    )
  }
}

function blow(game: Game): void {
  const gust = game.weather.gust
  gust.phase = 'blow'
  gust.ms = 0
  gust.spilledAt = game.stretchSpilled
  sound(game, 'whoosh', 0.8, 0.6)
}

function calm(game: Game): void {
  const gust = game.weather.gust
  gust.phase = 'idle'
  gust.ms = 0
  gust.waitMs = nextGap(game)
}

/** Praise for a gust ridden out with nothing spilled, checked once things settle. */
function praiseRide(game: Game): void {
  const gust = game.weather.gust
  // Waits for the drift to settle, since a late swing still counts.
  if (gust.ms < 800) return
  const clean = game.stretchSpilled === gust.spilledAt
  gust.spilledAt = -1
  if (!clean) return
  gust.ridden++
  caption(game, line(game, 'rode'), 'good', '', 1600, {
    score: scoreDodge(game.scores, 'gust')
  })
}

/** True while a gust warns or blows, for the warning arrow: the side the beans would go, or 0. */
export function gustSide(game: Game): number {
  const gust = game.weather.gust
  return gust.phase === 'idle' ? 0 : gust.side
}

// ---------------------------------------------------------------- Set down and pick up

/** The pot went down: no gust can hit it, and on a rainy stretch the rain stops, of course. */
export function weatherSetDown(game: Game): void {
  const w = game.weather
  const gust = w.gust
  if (gust.phase !== 'idle') {
    gust.phase = 'idle'
    gust.ms = 0
    gust.waitMs = Math.max(gust.waitMs, nextGap(game) / 2)
    gust.spilledAt = -1
  }
  w.windPush = 0
  w.gustDrift = 0
  if (currentStretch(game).rain && w.raining)
    caption(game, 'Of course it stops now.', 'info', '', 2200)
  w.raining = false
}

/** The pot came back up: the rain was only waiting. */
export function weatherPickUp(game: Game): void {
  cancelPour(game)
  if (currentStretch(game).rain && game.weather.told.rain)
    caption(game, 'And the rain is back.', 'bad', '', 1800)
}

// ---------------------------------------------------------------- Pour Off

/** True when Pour Off can start: the pot sits on the ground in the walk view with water in it. */
export function canPour(game: Game): boolean {
  return game.scene === 'grounded' && game.pot.water > 0.05 && !introBusy(game)
}

/** P or the Pour Off button goes down. */
export function startPour(game: Game): boolean {
  const w = game.weather
  if (game.scene === 'pickup' && game.pot.water > 0.05 && !w.pouring) {
    sound(game, 'buzz', 0.4, 1.4)
    caption(
      game,
      'Not by the beans.',
      'bad',
      'Pick up the pot and pour it off on clear ground.',
      2400
    )
    return false
  }
  if (w.pouring || !canPour(game)) return false
  w.pour.start()
  w.pouring = true
  sound(game, 'thud', 0.4, 1.2)
  return true
}

/** One step of a pour: the pot tips further the longer you hold. */
export function updatePour(game: Game, dtMs: number): void {
  const w = game.weather
  if (!w.pouring) return
  if (game.scene !== 'grounded') {
    cancelPour(game)
    return
  }
  w.pour.update(dtMs)
}

/** What letting go at `level` pours: the share of the water, and beans lost with it. */
export function pourResult(level: number): { share: number; beans: number } {
  if (level < POUR_GOOD_FROM) return { share: level / POUR_GOOD_FROM, beans: 0 }
  if (level <= POUR_GOOD_TO) return { share: 1, beans: 0 }
  return {
    share: 1,
    beans: Math.min(
      POUR_BEANS_MAX,
      // The epsilon keeps a full hold at exactly POUR_BEANS_MAX despite rounding.
      Math.floor(
        POUR_BEANS_BASE + POUR_BEANS_PER * (level - POUR_GOOD_TO) + 1e-9
      )
    )
  }
}

/**
 * P or the Pour Off button lets go: in the green all the water goes, too early only
 * some, and too late beans go with it into seed packets. Returns the beans lost.
 */
export function endPour(game: Game): number {
  const w = game.weather
  if (!w.pouring) return 0
  w.pouring = false
  const level = w.pour.release()
  const pot = game.pot
  const { share, beans } = pourResult(level)
  pot.water = share >= 1 ? 0 : pot.water * (1 - share)
  sound(game, 'splash', 0.4 + 0.5 * share, 1.1)
  if (beans > 0) {
    const n = Math.min(beans, game.counts.pot)
    loseBeans(game, 'pot', n, 'pour')
    sound(game, 'fail', 0.6)
    caption(
      game,
      `Poured ${n} beans out too.`,
      'bad',
      'Let go in the green.',
      3000
    )
    return n
  }
  if (share >= 1) {
    sound(game, 'ding', 0.5, 1.4)
    caption(game, 'Poured off.', 'good', 'Not a bean lost.', 2000)
  } else
    caption(
      game,
      'Only some of it.',
      'info',
      'Hold until the needle reaches the green.',
      2400
    )
  return 0
}

/** Stops a pour without pouring, such as when the pot is picked up mid-pour. */
export function cancelPour(game: Game): void {
  const w = game.weather
  if (!w.pouring) return
  w.pour.reset()
  w.pouring = false
}

// ---------------------------------------------------------------- Prompts and dev

/** The next-step hint for the weather, or null. `nearBeans` is true when Space would open Pickup. */
export function weatherPrompt(
  game: Game,
  touch: boolean,
  nearBeans = false
): string | null {
  const pot = game.pot
  if (game.scene === 'grounded' && pot.water > 0.05)
    return touch
      ? 'Hold Pour Off. Let go in the green.'
      : 'Hold P to pour the rain off. Let go in the green.'
  if (game.scene !== 'walk' || !game.walker.carrying) return null
  const gust = game.weather.gust
  if (gust.phase !== 'idle') {
    const key = gust.side > 0 ? 'A' : 'D'
    return touch
      ? 'A gust! Tilt into the wind as it hits.'
      : `A gust! Lean into it with ${key}.`
  }
  const raining = currentStretch(game).rain
  if (pot.water >= (raining ? POUR_PROMPT_WATER : POUR_PROMPT_LEFTOVER)) {
    const what = raining
      ? 'Rain is filling the pot.'
      : 'Rain water is still in the pot.'
    // Setting down here opens Pickup, which can't pour.
    if (nearBeans) return `${what} Pour it off away from the spilled beans.`
    return touch
      ? `${what} Set it down and pour it off.`
      : `${what} Space sets it down, then hold P.`
  }
  return null
}

/** Dev: a gust starts warning now. Returns false off a windy stretch or without the pot. */
export function devGust(game: Game): boolean {
  if (!currentStretch(game).gusts || game.scene !== 'walk') return false
  if (!game.walker.carrying) return false
  warn(game)
  return true
}

/** Dev: `u` of rain water lands in the pot at once. */
export function devRain(game: Game, u: number): void {
  game.pot.water = Math.max(0, game.pot.water + u)
}
