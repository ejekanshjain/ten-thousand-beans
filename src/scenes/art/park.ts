import {
  boilSeed,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPolygon,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { colors } from './colors'
import { shoutSize } from './shout'

const SKIN: SketchStyle = { fill: colors.skin, width: 2.5, wobble: 1.2 }
const SHIRT: SketchStyle = {
  fill: palette.orange,
  fillStyle: 'hatch',
  hatchGap: 6,
  width: 2.5,
  wobble: 1.4
}
const SHIRT_BASE: SketchStyle = { fill: '#ffe8cc', width: 0, wobble: 1.4 }
const SHORTS: SketchStyle = { fill: palette.blue, width: 2.5, wobble: 1 }
const CAP: SketchStyle = { fill: palette.red, width: 2.5, wobble: 0.8 }
const LIMB: SketchStyle = { width: 5, wobble: 1, passes: 1 }
const DOT: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.3 }
const LINE: SketchStyle = { width: 2.5, wobble: 0.6, passes: 1 }
const BALL: SketchStyle = { fill: palette.paper, width: 2.5, wobble: 0.6 }
const PATCH: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.4 }
const DASH: SketchStyle = {
  color: palette.red,
  width: 3,
  wobble: 0.4,
  passes: 1
}
const TARGET: SketchStyle = {
  color: palette.red,
  width: 3,
  wobble: 1.5,
  passes: 1
}
const FUR: SketchStyle = { fill: '#f8f9fa', width: 2.5, wobble: 1.6 }
const SPOT: SketchStyle = { fill: colors.woodDark, width: 0, wobble: 1 }
const EAR: SketchStyle = { fill: colors.woodDark, width: 2, wobble: 0.8 }
const TONGUE: SketchStyle = { fill: palette.pink, width: 1.5, wobble: 0.5 }
const NOSE: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.3 }
const DOG_LEG: SketchStyle = { width: 5, wobble: 0.8, passes: 1 }
const TAIL: SketchStyle = { width: 4, wobble: 1, passes: 1 }
const WOOF: SketchTextStyle = {
  font: 'marker',
  size: 26,
  color: palette.red,
  outline: palette.paper,
  rotate: -0.15
}
const BENCH: SketchStyle = { fill: colors.wood, width: 2.5, wobble: 1 }
const BENCH_LEG: SketchStyle = {
  color: colors.woodDark,
  width: 5,
  wobble: 0.6,
  passes: 1
}
const POND: SketchStyle = {
  fill: 'rgba(116, 192, 252, 0.9)',
  color: colors.riverDeep,
  width: 3,
  wobble: 2
}
const REED: SketchStyle = {
  color: colors.grassDark,
  width: 3,
  wobble: 0.8,
  passes: 1
}
const WET: SketchStyle = {
  fill: 'rgba(116, 192, 252, 0.45)',
  color: 'rgba(77, 171, 247, 0.8)',
  width: 2,
  wobble: 2
}
const GLINT: SketchStyle = {
  color: palette.paper,
  width: 2.5,
  wobble: 0.5,
  passes: 1
}
const tri = new Float64Array(6)

/** How high the football's arc rises above its higher end, in u. */
const ARC_RISE = 150

/**
 * The park kid with a backwards cap, standing at (x, feet) and facing `facing` (1 right).
 * `windup` pulls the kicking leg back from 0 to 1; `kicked` swings it through.
 */
export function drawKid(
  ctx: CanvasRenderingContext2D,
  x: number,
  feet: number,
  facing: number,
  windup: number,
  kicked: boolean,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  ctx.save()
  ctx.translate(x, feet)
  ctx.scale(facing * 0.85, 0.85)
  LIMB.color = colors.skin
  LIMB.seed = 600 + boil
  // Standing leg, then the kicking leg: back for the wind-up, forward for the kick.
  sketchLine(ctx, -4, -46, -6, 0, LIMB)
  const swing = kicked ? 0.9 : -1.1 * windup
  sketchLine(
    ctx,
    4,
    -46,
    4 + Math.sin(swing) * 44,
    -46 + Math.cos(swing) * 44,
    LIMB
  )
  SHORTS.seed = 601
  sketchRoundRect(ctx, -14, -60, 28, 20, 6, SHORTS)
  SHIRT_BASE.seed = 602 + boil
  sketchRoundRect(ctx, -18, -110, 36, 54, 10, SHIRT_BASE)
  SHIRT.seed = 602 + boil
  sketchRoundRect(ctx, -18, -110, 36, 54, 10, SHIRT)
  LIMB.color = colors.skin
  sketchLine(ctx, -14, -100, -26 - windup * 8, -74, LIMB)
  sketchLine(ctx, 14, -100, 26 + windup * 6, -80, LIMB)
  SKIN.seed = 603 + boil
  sketchCircle(ctx, 0, -126, 17, SKIN)
  // A backwards cap: the peak points behind.
  CAP.seed = 604
  sketchRoundRect(ctx, -16, -146, 30, 14, 6, CAP)
  sketchRoundRect(ctx, -30, -138, 18, 7, 3, CAP)
  DOT.seed = 605
  sketchCircle(ctx, 6, -128, 2.2, DOT)
  sketchCircle(ctx, 13, -128, 2.2, DOT)
  LINE.seed = 606 + boil
  sketchLine(ctx, 4, -117, 14, -119, LINE)
  ctx.restore()
}

/** A doodled football: a white ball with black patches, turned by `spin` radians. */
export function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  spin: number
): void {
  BALL.seed = 610
  sketchCircle(ctx, x, y, 12, BALL)
  for (let k = 0; k < 3; k++) {
    const a = spin + (k * Math.PI * 2) / 3
    PATCH.seed = 611 + k
    sketchCircle(ctx, x + Math.cos(a) * 6, y + Math.sin(a) * 6, 3.2, PATCH)
  }
}

/** Where the football is at `t` along its arc from (x0, y0) to (x1, y1); past 1 it keeps falling. */
export function arcPoint(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: number,
  out: { x: number; y: number }
): { x: number; y: number } {
  const top = Math.min(y0, y1) - ARC_RISE
  // A parabola through both ends that peaks at `top`.
  const a = 2 * (y0 + y1 - 2 * top)
  const b = 4 * top - 3 * y0 - y1
  out.x = x0 + (x1 - x0) * t
  out.y = y0 + b * t + a * t * t
  return out
}

const arc = { x: 0, y: 0 }

/**
 * The football's flight path as a dashed red arc, and a dashed ring on the path where it
 * lands, `reach` u either side of the crossing. `alpha` fades it in during the wind-up.
 */
export function drawBallPath(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ground: number,
  reach: number,
  alpha: number
): void {
  ctx.globalAlpha = alpha
  const steps = 18
  for (let i = 0; i < steps; i += 2) {
    arcPoint(x0, y0, x1, y1, i / steps, arc)
    const ax = arc.x
    const ay = arc.y
    arcPoint(x0, y0, x1, y1, (i + 1) / steps, arc)
    DASH.seed = 620 + i
    sketchLine(ctx, ax, ay, arc.x, arc.y, DASH)
  }
  TARGET.seed = 630
  sketchEllipse(ctx, x1, ground, reach, 12, TARGET)
  ctx.globalAlpha = 1
}

/** How a dog looks side-on this frame. */
export type SideDogPose = 'lying' | 'run' | 'jump' | 'sit'

/** Bruno, the park's Great Dane: 1.7 times the size, grey with black spots. */
export const BRUNO = { scale: 1.7, fur: '#adb5bd', spot: palette.ink }

/**
 * A scruffy white dog with brown spots and a long tongue, standing on (x, feet) and
 * facing `facing` (1 right): lying in the grass, running, up on its hind legs, or sitting.
 * `big` draws Bruno instead.
 */
export function drawSideDog(
  ctx: CanvasRenderingContext2D,
  x: number,
  feet: number,
  facing: number,
  pose: SideDogPose,
  barking: boolean,
  timeMs: number,
  big: typeof BRUNO | null = null
): void {
  const boil = boilSeed(timeMs)
  FUR.fill = big?.fur ?? '#f8f9fa'
  SPOT.fill = big?.spot ?? colors.woodDark
  EAR.fill = big?.spot ?? colors.woodDark
  const scale = big?.scale ?? 1
  ctx.save()
  ctx.translate(x, feet)
  ctx.scale(facing * scale, scale)
  if (pose === 'jump') ctx.rotate(-0.8)
  else if (pose === 'sit') ctx.rotate(-0.35)
  const run = pose === 'run' ? Math.sin(timeMs / 50) * 10 : 0
  const bodyY = pose === 'lying' ? -14 : -30
  DOG_LEG.seed = 640 + boil
  if (pose !== 'lying') {
    sketchLine(ctx, -18, bodyY + 6, -20 - run, 0, DOG_LEG)
    sketchLine(ctx, 16, bodyY + 6, 18 + run, 0, DOG_LEG)
  }
  TAIL.seed = 641 + boil
  const wag = Math.sin(timeMs / 70) * 8
  sketchLine(ctx, -30, bodyY - 4, -46, bodyY - 18 + wag, TAIL)
  FUR.seed = 642 + boil
  sketchEllipse(ctx, 0, bodyY, 32, 15, FUR)
  SPOT.seed = 643
  sketchEllipse(ctx, -8, bodyY - 4, 9, 6, SPOT)
  sketchEllipse(ctx, 14, bodyY + 3, 6, 5, SPOT)
  FUR.seed = 644 + boil
  sketchCircle(ctx, 32, bodyY - 14, 13, FUR)
  EAR.seed = 645 + boil
  sketchEllipse(ctx, 26, bodyY - 12 + Math.sin(timeMs / 90) * 2, 5, 11, EAR)
  NOSE.seed = 646
  sketchCircle(ctx, 45, bodyY - 16, 3.5, NOSE)
  DOT.seed = 647
  sketchCircle(ctx, 36, bodyY - 20, 2.2, DOT)
  // The long tongue flaps while it runs and barks.
  TONGUE.seed = 648 + boil
  const lick = pose === 'lying' ? 4 : 10 + Math.sin(timeMs / 60) * 3
  sketchRoundRect(ctx, 37, bodyY - 8, 6, lick, 3, TONGUE)
  ctx.restore()
  if (barking)
    sketchText(ctx, 'WOOF!', x + facing * 30 * scale, feet - 84 * scale, {
      ...WOOF,
      size: shoutSize(26 * scale, timeMs),
      seed: 649 + boil
    })
}

/**
 * The same dog from above in Pickup, facing `angle`: legs paddling while it dashes,
 * "WOOF!" while it barks.
 */
export function drawTopDog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  running: boolean,
  barking: boolean,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  // Bruno shares these styles in the walk view, so set the park dog's colours back.
  FUR.fill = '#f8f9fa'
  SPOT.fill = EAR.fill = colors.woodDark
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(1.3, 1.3)
  const paddle = running ? Math.sin(timeMs / 40) * 8 : 0
  DOG_LEG.seed = 650 + boil
  sketchLine(ctx, 14, -10, 18 + paddle, -18, DOG_LEG)
  sketchLine(ctx, 14, 10, 18 - paddle, 18, DOG_LEG)
  sketchLine(ctx, -14, -10, -18 - paddle, -18, DOG_LEG)
  sketchLine(ctx, -14, 10, -18 + paddle, 18, DOG_LEG)
  TAIL.seed = 651 + boil
  sketchLine(ctx, -26, 0, -40, Math.sin(timeMs / 70) * 8, TAIL)
  FUR.seed = 652 + boil
  sketchEllipse(ctx, 0, 0, 28, 13, FUR)
  SPOT.seed = 653
  sketchEllipse(ctx, -6, -3, 8, 5, SPOT)
  sketchEllipse(ctx, 10, 4, 5, 4, SPOT)
  FUR.seed = 654 + boil
  sketchCircle(ctx, 30, 0, 11, FUR)
  EAR.seed = 655
  sketchEllipse(ctx, 26, -11, 7, 4, EAR)
  sketchEllipse(ctx, 26, 11, 7, 4, EAR)
  NOSE.seed = 656
  sketchCircle(ctx, 41, 0, 3, NOSE)
  TONGUE.seed = 657 + boil
  sketchRoundRect(ctx, 40, -2, 10 + (running ? 4 : 0), 5, 2, TONGUE)
  ctx.restore()
  if (barking)
    sketchText(ctx, 'WOOF!', x, y - 48, {
      ...WOOF,
      size: shoutSize(26, timeMs),
      seed: 658 + boil
    })
}

/** A park bench behind the path, with its feet on the grass at `base`. */
export function paintBench(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number
): void {
  BENCH_LEG.seed = Math.round(x)
  sketchLine(ctx, x - 50, base - 34, x - 50, base, BENCH_LEG)
  sketchLine(ctx, x + 50, base - 34, x + 50, base, BENCH_LEG)
  BENCH.seed = Math.round(x) + 1
  sketchRect(ctx, x - 64, base - 40, 128, 10, BENCH)
  sketchRect(ctx, x - 64, base - 76, 128, 10, BENCH)
  sketchRect(ctx, x - 64, base - 60, 128, 10, BENCH)
}

/** A pond in the grass behind the path, with reeds. */
export function paintPond(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number
): void {
  POND.seed = Math.round(x)
  sketchEllipse(ctx, x, base - 30, 170, 26, POND)
  GLINT.seed = Math.round(x) + 1
  sketchLine(ctx, x - 90, base - 38, x - 40, base - 42, GLINT)
  sketchLine(ctx, x + 40, base - 22, x + 80, base - 24, GLINT)
  for (let k = 0; k < 5; k++) {
    const rx = x - 175 + k * 9
    REED.seed = Math.round(x) + 2 + k
    sketchLine(
      ctx,
      rx,
      base - 26,
      rx + (k % 2) * 4 - 2,
      base - 66 - k * 4,
      REED
    )
  }
}

/** Wet grass on the walking line from `from` to `to`: a shiny patch with glints. */
export function paintWet(
  ctx: CanvasRenderingContext2D,
  from: number,
  to: number,
  y: number
): void {
  const x = (from + to) / 2
  const half = (to - from) / 2
  WET.seed = Math.round(from)
  sketchEllipse(ctx, x, y + 4, half + 10, 14, WET)
  GLINT.seed = Math.round(from) + 1
  sketchLine(ctx, x - half * 0.5, y, x - half * 0.15, y - 3, GLINT)
  sketchLine(ctx, x + half * 0.25, y + 8, x + half * 0.55, y + 6, GLINT)
  // A sparkle so it reads as slippery from a distance.
  tri[0] = x + half * 0.6
  tri[1] = y - 14
  tri[2] = x + half * 0.6 + 4
  tri[3] = y - 6
  tri[4] = x + half * 0.6 - 4
  tri[5] = y - 6
  sketchPolygon(ctx, tri, { fill: palette.paper, width: 1, seed: 1 })
}
