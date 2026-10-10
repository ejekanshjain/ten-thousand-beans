import {
  boilSeed,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchRoundRect,
  type SketchStyle
} from '../../shared'
import { colors } from './colors'

const LEG: SketchStyle = { width: 5, wobble: 1.5, passes: 1 }
const SHOE: SketchStyle = { fill: palette.ink, width: 2, wobble: 1 }
const MUD: SketchStyle = { fill: colors.mud, width: 2, wobble: 2.5 }
const SOLE: SketchStyle = {
  color: palette.yellow,
  width: 1.5,
  wobble: 0.3,
  passes: 1
}
const sole = new Float64Array(10)
const JUMPER_BASE: SketchStyle = { fill: '#d0ebff', width: 0, wobble: 2 }
const JUMPER: SketchStyle = {
  fill: colors.jumper,
  fillStyle: 'hatch',
  hatchGap: 6,
  width: 3,
  wobble: 2
}
const HEAD: SketchStyle = { fill: colors.skin, width: 3, wobble: 1.5 }
const EYE: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.3 }
const LINE: SketchStyle = { width: 2.5, wobble: 0.8, passes: 1 }
const ARM: SketchStyle = {
  width: 6,
  wobble: 1.5,
  passes: 1,
  color: colors.jumper
}
const HAIR: SketchStyle & { smooth: boolean } = {
  width: 3,
  wobble: 1.5,
  passes: 1,
  smooth: true
}
const hair = new Float64Array(10)
const mouth = new Float64Array(8)

/** Your pose for one frame, in world coordinates. */
export interface PlayerView {
  /** Feet x. */
  x: number
  ground: number
  stepPhase: number
  /** Walking speed in u/s, for how far the legs swing. */
  speed: number
  /** Body squash, 1 at rest. */
  squash: number
  /** Slosh danger: 1 is the spill line. Eyebrows climb with it. */
  danger: number
  /** True while spilling: the mouth makes an "O". */
  gasp: boolean
  /** Plain shoes, Grippy Shoes with zigzag soles, or the same caked in park mud. */
  shoes?: 'plain' | 'grippy' | 'muddy'
  timeMs: number
}

/** Where your shoulder is, so arms can reach the pot handles. */
export function shoulderOf(view: PlayerView, out = { x: 0, y: 0 }) {
  out.x = view.x + 4
  out.y = view.ground - (72 + 70) * view.squash
  return out
}

/** Draws your legs, body and face. Arms are drawn separately so the pot can sit between them. */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  view: PlayerView
): void {
  const boil = boilSeed(view.timeMs)
  const sq = view.squash
  const swing =
    Math.sin(Math.PI * view.stepPhase) * 24 * Math.min(1, view.speed / 80)
  const hipX = view.x
  const hipY = view.ground - 72 * sq
  LEG.seed = 60 + boil
  sketchLine(ctx, hipX - 4, hipY, view.x + swing, view.ground - 4, LEG)
  sketchLine(ctx, hipX + 4, hipY, view.x - swing, view.ground - 4, LEG)
  for (const foot of [swing, -swing]) {
    const fx = view.x + foot + 6
    if (view.shoes === 'muddy') {
      MUD.seed = 61 + boil
      sketchEllipse(ctx, fx, view.ground - 5, 15, 8, MUD)
      continue
    }
    SHOE.seed = 61
    sketchEllipse(ctx, fx, view.ground - 3, 11, 5, SHOE)
    if (view.shoes !== 'grippy') continue
    for (let k = 0; k < 5; k++) {
      sole[k * 2] = fx - 9 + k * 4.5
      sole[k * 2 + 1] = view.ground + 1 + (k % 2) * 2
    }
    SOLE.seed = 62
    sketchPath(ctx, sole, SOLE)
  }

  const torsoTop = hipY - 92 * sq
  // A pale base under the hatching keeps the jumper readable on busy backgrounds.
  JUMPER_BASE.seed = 62 + boil
  sketchRoundRect(ctx, hipX - 25, torsoTop, 50, 98 * sq, 16, JUMPER_BASE)
  JUMPER.seed = 62 + boil
  sketchRoundRect(ctx, hipX - 25, torsoTop, 50, 98 * sq, 16, JUMPER)

  const hx = hipX - 4
  const hy = torsoTop - 24
  HEAD.seed = 63 + boil
  sketchCircle(ctx, hx, hy, 24, HEAD)
  for (let i = 0; i < 5; i++) {
    hair[i * 2] = hx - 20 + i * 9
    hair[i * 2 + 1] = hy - 20 - (i % 2) * 8
  }
  HAIR.seed = 64 + boil
  sketchPath(ctx, hair, HAIR)

  // Eyes watch the pot; eyebrows climb and tilt as the slosh nears the spill line.
  EYE.seed = 65
  sketchCircle(ctx, hx + 9, hy - 2, 2.6, EYE)
  sketchCircle(ctx, hx + 18, hy - 2, 2.6, EYE)
  const worry = Math.min(1.3, view.danger)
  LINE.seed = 66 + boil
  const browY = hy - 10 - 7 * worry
  sketchLine(ctx, hx + 5, browY + 2 * worry, hx + 12, browY - 1, LINE)
  sketchLine(ctx, hx + 15, browY - 1, hx + 22, browY + 2 * worry, LINE)
  if (view.gasp) {
    sketchCircle(ctx, hx + 14, hy + 11, 4.5, LINE)
  } else if (view.danger > 0.7) {
    for (let i = 0; i < 4; i++) {
      mouth[i * 2] = hx + 7 + i * 5
      mouth[i * 2 + 1] = hy + 11 + (i % 2 === 0 ? -2 : 2)
    }
    sketchPath(ctx, mouth, LINE)
  } else {
    sketchLine(ctx, hx + 8, hy + 11, hx + 20, hy + 10, LINE)
  }
}

/** Draws one arm from the shoulder to a hand position. */
export function drawArm(
  ctx: CanvasRenderingContext2D,
  shoulderX: number,
  shoulderY: number,
  handX: number,
  handY: number,
  timeMs: number
): void {
  ARM.seed = 67 + boilSeed(timeMs)
  const midX = (shoulderX + handX) / 2
  const midY = Math.max(shoulderY, handY) + 14
  sketchLine(ctx, shoulderX, shoulderY, midX, midY, ARM)
  sketchLine(ctx, midX, midY, handX, handY, ARM)
  sketchCircle(ctx, handX, handY, 6, HEAD)
}
