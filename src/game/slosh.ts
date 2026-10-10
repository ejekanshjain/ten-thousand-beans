import { clamp, damp } from '../shared'
import {
  ASSIST_MARGIN,
  AUTO_LEVEL_RATE,
  BEANS_PER_UNIT,
  G_EFF,
  KEY_RAMP_S,
  KEY_TILT_RATE,
  KEY_TOP_RATE,
  KICK_DECAY_RATE,
  LID_SPILL_RATE,
  MAX_PHI,
  MAX_SPILL_RATE,
  MAX_TILT,
  POT_LAG_RATE,
  REPOSE,
  REPOSE_TALL,
  RIM_HALF,
  SLOSH_HZ,
  SLOSH_ZETA,
  SLOSH_ZETA_TALL,
  TALL_OWN_TILT,
  TEETER_MS,
  TEETER_SAVE,
  TIP_ANGLE,
  TIP_ANGLE_TALL,
  TIP_HOLD_MS,
  TOTAL_BEANS,
  WEIR_K
} from './tuning'
import { DEG } from './units'

/** The pot's angles and the bean surface. Angles are radians, clockwise positive. */
export interface PotState {
  /** Where input wants the pot. */
  psiTarget: number
  /** The pot's own angle, following the target with lag. */
  psi: number
  /** A decaying extra pot angle from bumps. */
  kick: number
  /** Extra pot angle characters put on it this step, such as a neighbour's pull, in radians. */
  lean: number
  /** Extra pot angle from the weather, such as a gust's drift, in radians. */
  drift: number
  /** The bean surface angle in world space. */
  sigma: number
  sigmaVel: number
  /** Rain water in u, which eats into the margin. */
  water: number
  /** Fractional beans waiting to spill. */
  spillAcc: number
  /** Latest surface angle relative to the pot. */
  phi: number
  /** Latest overflow depth in u. Above 0 means beans are leaving. */
  overflow: number
  /** |phi| as a share of the spill angle. 1 is the spill line. */
  danger: number
  /** How long |psiEff| has stayed past the tip angle, in ms. */
  overMs: number
  /** Time spent teetering on one edge, in ms. 0 when not teetering. */
  teeterMs: number
  /** 1 when teetering on the right edge, -1 on the left. */
  teeterSide: number
  /** The target angle when the teeter started, to measure the save. */
  teeterFrom: number
  /** The way keys or tilt buttons are turning the pot (1, -1, or 0 when none), and for how long, in seconds. */
  keyDir: number
  keyHeldS: number
}

/** Degrees per second a key held one way for `heldS` seconds turns the pot. */
export function keyRate(heldS: number): number {
  return (
    KEY_TILT_RATE +
    (KEY_TOP_RATE - KEY_TILT_RATE) * Math.min(heldS / KEY_RAMP_S, 1)
  )
}

/** Upgrade and setting switches that change the pot. */
export interface PotOptions {
  tall: boolean
  lid: boolean
  assist: boolean
}

export const DEFAULT_POT_OPTIONS: PotOptions = {
  tall: false,
  lid: false,
  assist: false
}

/** Tilt input for one step. `rate` comes from keys and tilt buttons; `absolute` from device tilt or a dev override. */
export interface TiltInput {
  /** -1 to 1. Turns the target at the key speed (`keyRate`). */
  rate: number
  /** -1 to 1 of MAX_TILT, or null when no absolute source is active. */
  absolute: number | null
}

export const OMEGA = 2 * Math.PI * SLOSH_HZ

export function createPot(): PotState {
  return {
    psiTarget: 0,
    psi: 0,
    kick: 0,
    lean: 0,
    drift: 0,
    sigma: 0,
    sigmaVel: 0,
    water: 0,
    spillAcc: 0,
    phi: 0,
    overflow: -REPOSE,
    danger: 0,
    overMs: 0,
    teeterMs: 0,
    teeterSide: 0,
    teeterFrom: 0,
    keyDir: 0,
    keyHeldS: 0
  }
}

/** Levels the pot and calms the beans, for picking it up or setting it down. */
export function resetPot(pot: PotState): void {
  pot.psiTarget = pot.psi = pot.kick = pot.lean = pot.drift = 0
  pot.sigma = pot.sigmaVel = 0
  pot.spillAcc = 0
  pot.phi = 0
  pot.danger = 0
  pot.overMs = pot.teeterMs = 0
  pot.teeterSide = 0
  pot.keyDir = pot.keyHeldS = 0
}

/**
 * Turns the target angle from input, then makes the pot follow it with lag. Keys turn it
 * at the key speed, which rises while held, and the angle holds on release, easing back
 * to level slowly.
 */
export function steerPot(pot: PotState, tilt: TiltInput, dtS: number): void {
  const max = MAX_TILT * DEG
  const dir = tilt.absolute === null ? Math.sign(tilt.rate) : 0
  pot.keyHeldS = dir !== 0 && dir === pot.keyDir ? pot.keyHeldS + dtS : 0
  pot.keyDir = dir
  if (tilt.absolute !== null) {
    pot.psiTarget = clamp(tilt.absolute, -1, 1) * max
  } else if (tilt.rate !== 0) {
    const speed = keyRate(pot.keyHeldS)
    pot.psiTarget = clamp(
      pot.psiTarget + clamp(tilt.rate, -1, 1) * speed * DEG * dtS,
      -max,
      max
    )
  } else {
    const step = AUTO_LEVEL_RATE * DEG * dtS
    pot.psiTarget =
      pot.psiTarget > 0
        ? Math.max(0, pot.psiTarget - step)
        : Math.min(0, pot.psiTarget + step)
  }
  pot.psi = damp(pot.psi, pot.psiTarget, POT_LAG_RATE, dtS)
  pot.kick = damp(pot.kick, 0, KICK_DECAY_RATE, dtS)
}

/** The pot's angle including bumps, characters' pulls and the weather's drift. */
export function effectiveAngle(pot: PotState, extra = 0): number {
  return pot.psi + pot.kick + pot.lean + pot.drift + extra
}

/** Applies a bump: `surface` rad/s to the bean surface, `pot` rad to the pot angle. */
export function kickPot(pot: PotState, surface: number, potKick = 0): void {
  pot.sigmaVel += surface
  pot.kick += potKick
}

/**
 * Advances the bean surface spring by one step. `drive` is the sideways acceleration
 * in u/s² that tips the surface, and `windPush` adds a straight angle in radians.
 */
export function stepSurface(
  pot: PotState,
  drive: number,
  windPush: number,
  options: PotOptions,
  dtS: number
): void {
  const zeta = options.tall ? SLOSH_ZETA_TALL : SLOSH_ZETA
  const target = Math.atan(drive / G_EFF) + windPush
  pot.sigmaVel +=
    (OMEGA * OMEGA * (target - pot.sigma) - 2 * zeta * OMEGA * pot.sigmaVel) *
    dtS
  pot.sigma += pot.sigmaVel * dtS
}

/** Distance in u the surface can tilt before beans reach the rim. */
export function marginFor(
  potCount: number,
  water: number,
  options: PotOptions
): number {
  return (
    (options.tall ? REPOSE_TALL : REPOSE) +
    (TOTAL_BEANS - potCount) / BEANS_PER_UNIT -
    water +
    (options.assist ? ASSIST_MARGIN : 0)
  )
}

/** The relative angle in radians where beans start leaving. */
export function spillAngle(margin: number): number {
  return Math.atan(Math.max(0, margin) / RIM_HALF)
}

/** How far in u the surface rises past the rim at relative angle `phi`. */
export function overflowDepth(phi: number, margin: number): number {
  return RIM_HALF * Math.tan(Math.min(Math.abs(phi), MAX_PHI * DEG)) - margin
}

/** The raw weir law: beans per second for overflow depth `d`. */
export function weirRate(d: number): number {
  return d > 0 ? WEIR_K * d ** 1.5 : 0
}

/** Beans per second actually spilling, after the global and Lid caps. */
export function spillRate(d: number, options: PotOptions): number {
  return Math.min(options.lid ? LID_SPILL_RATE : MAX_SPILL_RATE, weirRate(d))
}

/** The rim beans leave over: -1 for the left (back) rim, 1 for the right (front) rim. */
export function spillSide(phi: number): number {
  return phi > 0 ? -1 : 1
}

/**
 * Measures the surface against the pot and accumulates spilling. Returns the whole beans
 * that leave this step, never more than `potCount`.
 */
export function stepSpill(
  pot: PotState,
  psiEff: number,
  potCount: number,
  options: PotOptions,
  dtS: number
): number {
  const margin = marginFor(potCount, pot.water, options)
  pot.phi = pot.sigma - psiEff
  pot.overflow = overflowDepth(pot.phi, margin)
  const line = spillAngle(margin)
  pot.danger = line > 0 ? Math.abs(pot.phi) / line : 2
  if (pot.overflow > 0) pot.spillAcc += spillRate(pot.overflow, options) * dtS
  else pot.spillAcc = 0
  const n = Math.min(potCount, Math.floor(pot.spillAcc))
  pot.spillAcc -= n
  return n
}

export type TipResult = 'none' | 'teeter' | 'saved' | 'tipped'

/** The tip angle in radians for these options. */
export function tipAngle(options: PotOptions): number {
  return (options.tall ? TIP_ANGLE_TALL : TIP_ANGLE) * DEG
}

/**
 * True when `psiEff` is past the tip angle. The Taller Pot also needs your own tilt to
 * lean at least TALL_OWN_TILT degrees the same way, so bumps, pulls and gusts alone
 * can't tip it.
 */
export function pastTipAngle(
  pot: PotState,
  psiEff: number,
  options: PotOptions
): boolean {
  if (Math.abs(psiEff) <= tipAngle(options)) return false
  return !options.tall || pot.psi * Math.sign(psiEff) >= TALL_OWN_TILT * DEG
}

/**
 * Checks for a tip-over. Past the tip angle for TIP_HOLD_MS the pot teeters on one edge.
 * During the teeter only the player's counter-tilt saves it; otherwise it falls.
 */
export function stepTip(
  pot: PotState,
  psiEff: number,
  options: PotOptions,
  dtMs: number
): TipResult {
  if (pot.teeterMs > 0) {
    pot.teeterMs += dtMs
    const backTowardLevel = (pot.teeterFrom - pot.psiTarget) * pot.teeterSide
    if (backTowardLevel >= TEETER_SAVE * DEG) {
      endTeeter(pot)
      // The save swings the pot back the other way a little.
      pot.kick = -pot.teeterSide * 6 * DEG
      return 'saved'
    }
    if (pot.teeterMs >= TEETER_MS) {
      endTeeter(pot)
      return 'tipped'
    }
    return 'none'
  }
  if (pastTipAngle(pot, psiEff, options)) {
    pot.overMs += dtMs
    if (pot.overMs >= TIP_HOLD_MS) {
      pot.teeterMs = Math.max(1e-3, dtMs)
      pot.teeterSide = Math.sign(psiEff)
      pot.teeterFrom = pot.psiTarget
      return 'teeter'
    }
  } else {
    pot.overMs = 0
  }
  return 'none'
}

function endTeeter(pot: PotState): void {
  pot.teeterMs = 0
  pot.overMs = 0
}

/** True while the pot balances on one edge. */
export function isTeetering(pot: PotState): boolean {
  return pot.teeterMs > 0
}
