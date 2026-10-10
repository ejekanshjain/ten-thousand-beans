import { clamp, damp, lerp } from '../shared'
import {
  BACK_SPEED,
  CAP_RATE,
  HURRY_SPEED,
  SPEED_RATE,
  STRIDE,
  STROLL_SPEED,
  SWAY_ACCEL,
  THUMB_BACK,
  THUMB_HURRY_FROM,
  THUMB_HURRY_FULL
} from './tuning'

/** You, walking along the route. Positions in u, speeds in u/s. */
export interface WalkerState {
  x: number
  v: number
  /** Forward acceleration of the latest step, in u/s². */
  ax: number
  /** Steps taken, fractional. Each whole number is a footstep. */
  stepPhase: number
  /** True while you hold the pot. */
  carrying: boolean
  /** Walking range inside the current stretch. */
  minX: number
  maxX: number
}

/** Walking input for one step. */
export interface WalkInput {
  /** 1 forward, -1 back, 0 stand still. */
  walk: number
  /** 0 strolls, 1 hurries. Only applies when walking forward. */
  hurry: number
}

export function createWalker(minX = 0, maxX = 1_000): WalkerState {
  return {
    x: minX + 60,
    v: 0,
    ax: 0,
    stepPhase: 0,
    carrying: true,
    minX,
    maxX
  }
}

/** The speed walking input asks for, in u/s. Negative walks back. */
export function targetSpeed(input: WalkInput): number {
  if (input.walk > 0)
    return lerp(STROLL_SPEED, HURRY_SPEED, clamp(input.hurry, 0, 1))
  if (input.walk < 0) return -BACK_SPEED
  return 0
}

/**
 * Advances walking by one step. `cap` limits speed, such as a stroll on stairs; above it
 * you slow down quickly. `uphill` scales the forward speed you ask for, such as 0.7 on a
 * slope. Returns true when a foot lands, for the footstep sound and body squash.
 */
export function stepWalker(
  walker: WalkerState,
  input: WalkInput,
  dtS: number,
  cap = Infinity,
  uphill = 1
): boolean {
  const before = walker.v
  const asked = targetSpeed(input)
  const target = clamp(asked > 0 ? asked * uphill : asked, -cap, cap)
  // Above the cap you slow to it fast while still walking. Letting go slows you as
  // usual: the cap's own damping never quite reaches the cap, so it can't hold you there.
  const capping = Math.abs(walker.v) > cap && Math.abs(target) >= cap
  walker.v = damp(walker.v, target, capping ? CAP_RATE : SPEED_RATE, dtS)
  walker.ax = dtS > 0 ? (walker.v - before) / dtS : 0
  const next = walker.x + walker.v * dtS
  walker.x = clamp(next, walker.minX, walker.maxX)
  if (walker.x !== next) {
    walker.v = 0
    walker.ax = 0
  }
  const phase = walker.stepPhase
  walker.stepPhase += (Math.abs(walker.v) / STRIDE) * dtS
  return Math.floor(walker.stepPhase) !== Math.floor(phase)
}

/** Sideways sway acceleration from your gait, in u/s². Peaks at SWAY_ACCEL at hurry speed. */
export function swayAccel(walker: WalkerState): number {
  return (
    SWAY_ACCEL *
    (Math.abs(walker.v) / HURRY_SPEED) *
    Math.sin(Math.PI * walker.stepPhase)
  )
}

/** Body sway frequency in Hz at speed `v`: half the step rate. */
export function swayHz(v: number): number {
  return Math.abs(v) / (2 * STRIDE)
}

/**
 * Maps a held thumb's horizontal slide (u from where it pressed) to walking. A slide
 * right speeds up to a hurry, a slide left walks back.
 */
export function thumbWalk(slide: number): WalkInput {
  if (slide < -THUMB_BACK) return { walk: -1, hurry: 0 }
  return {
    walk: 1,
    hurry: clamp(
      (slide - THUMB_HURRY_FROM) / (THUMB_HURRY_FULL - THUMB_HURRY_FROM),
      0,
      1
    )
  }
}
