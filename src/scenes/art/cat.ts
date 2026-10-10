import {
  blobPoints,
  boilSeed,
  palette,
  sketchBlob,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchPolygon,
  sketchText,
  type SketchStyle
} from '../../shared'
import { shoutSize } from './shout'

const FUR: SketchStyle = { fill: palette.orange, width: 3, wobble: 1.6 }
const FUR_HATCH: SketchStyle = {
  fill: '#d9480f',
  fillStyle: 'hatch',
  hatchGap: 7,
  width: 0,
  wobble: 1
}
const EAR: SketchStyle = { fill: palette.orange, width: 2.5, wobble: 0.8 }
const EYE: SketchStyle = { fill: palette.paper, width: 2, wobble: 0.4 }
const PUPIL: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.2 }
const LINE: SketchStyle = { width: 2.5, wobble: 0.6, passes: 1 }
const PAW: SketchStyle = { fill: palette.orange, width: 2.5, wobble: 0.8 }
const TONGUE: SketchStyle = { fill: palette.pink, width: 1.5, wobble: 0.3 }
const TAIL: SketchStyle & { smooth: boolean } = {
  width: 9,
  wobble: 1,
  passes: 1,
  color: palette.orange,
  smooth: true
}
const TAIL_EDGE: SketchStyle & { smooth: boolean } = {
  width: 2.5,
  wobble: 1,
  passes: 1,
  smooth: true
}
const ARM: SketchStyle = {
  width: 8,
  wobble: 0.6,
  passes: 1,
  color: palette.orange
}
const body = new Float64Array(2 * 12)
const tail = new Float64Array(2 * 4)
const ear = new Float64Array(6)

/** Draws one triangle ear from three corners, without allocating. */
function drawEar(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): void {
  ear[0] = ax
  ear[1] = ay
  ear[2] = bx
  ear[3] = by
  ear[4] = cx
  ear[5] = cy
  sketchPolygon(ctx, ear, EAR)
}

/** How the cat looks this frame in the side view. */
export interface SideCatView {
  /** Where it sits, on the floor or the counter top. */
  x: number
  y: number
  /** 1 faces right, -1 faces left. */
  facing: number
  /** 'watch' swishes its tail and stares; 'groom' licks a paw with its eyes shut; 'smug' too. */
  mood: 'watch' | 'groom' | 'smug' | 'run'
  /** 0 to 1: how far a paw reaches toward (reachX, reachY). */
  reach: number
  reachX: number
  reachY: number
  timeMs: number
}

/**
 * Draws the orange cat side-on: a sitting blob with ears, a tail that swishes while it
 * watches you, round judging eyes, and slit eyes while it grooms. A paw reaches out for
 * swats and for the bean on the rim.
 */
export function drawSideCat(
  ctx: CanvasRenderingContext2D,
  view: SideCatView
): void {
  const boil = boilSeed(view.timeMs)
  const { x, facing } = view
  const hop =
    view.mood === 'run' ? Math.abs(Math.sin(view.timeMs / 70)) * 10 : 0
  const y = view.y - hop
  const t = view.timeMs / 1000

  // Tail first, behind the body. It lashes while the cat watches you.
  const swish = view.mood === 'watch' ? Math.sin(t * Math.PI * 5) * 0.9 : 0.15
  const baseX = x - facing * 22
  tail[0] = baseX
  tail[1] = y - 8
  tail[2] = baseX - facing * 22
  tail[3] = y - 14
  tail[4] = baseX - facing * (26 + swish * 10)
  tail[5] = y - 40 - swish * 6
  tail[6] = baseX - facing * (14 + swish * 22)
  tail[7] = y - 60
  TAIL.seed = 90 + boil
  sketchPath(ctx, tail, TAIL)
  TAIL_EDGE.seed = 91 + boil
  sketchPath(ctx, tail, TAIL_EDGE)

  blobPoints(x, y - 24, 26, 12, 92, 0.18, body)
  // Squash the blob into a sitting pear: wider at the bottom.
  for (let i = 0; i < 12; i++) {
    const dy = (body[i * 2 + 1] as number) - (y - 24)
    body[i * 2] = x + ((body[i * 2] as number) - x) * (dy > 0 ? 1.2 : 0.85)
  }
  FUR.seed = 93 + boil
  sketchBlob(ctx, body, FUR)
  FUR_HATCH.seed = 94
  sketchBlob(ctx, body, FUR_HATCH)

  const hx = x + facing * 12
  const hy = y - 56
  EAR.seed = 95 + boil
  drawEar(ctx, hx - 14, hy - 6, hx - 10, hy - 26, hx - 2, hy - 12)
  drawEar(ctx, hx + 2, hy - 12, hx + 10, hy - 26, hx + 14, hy - 6)
  FUR.seed = 96 + boil
  sketchCircle(ctx, hx, hy, 16, FUR)

  const eyeX = hx + facing * 5
  if (view.mood === 'watch' || view.mood === 'run') {
    EYE.seed = 97
    sketchCircle(ctx, eyeX - 6, hy - 2, 5, EYE)
    sketchCircle(ctx, eyeX + 6, hy - 2, 5, EYE)
    PUPIL.seed = 98
    sketchEllipse(ctx, eyeX - 5 + facing * 1.5, hy - 2, 1.6, 4, PUPIL)
    sketchEllipse(ctx, eyeX + 7 + facing * 1.5, hy - 2, 1.6, 4, PUPIL)
  } else {
    // Eyes shut in bliss, or half shut and smug.
    LINE.seed = 99
    const lid = view.mood === 'smug' ? 0 : 3
    sketchLine(ctx, eyeX - 10, hy - 2 + lid, eyeX - 3, hy - 2, LINE)
    sketchLine(ctx, eyeX + 3, hy - 2, eyeX + 10, hy - 2 + lid, LINE)
  }
  LINE.seed = 100
  sketchLine(ctx, hx + facing * 16, hy + 4, hx + facing * 30, hy + 1, LINE)
  sketchLine(ctx, hx + facing * 16, hy + 7, hx + facing * 29, hy + 9, LINE)

  if (view.mood === 'groom') {
    // A paw up at the mouth and a pink tongue on it.
    const lick = Math.sin(t * Math.PI * 6) * 2
    PAW.seed = 101
    sketchEllipse(ctx, hx + facing * 12, hy + 14 + lick, 6, 8, PAW)
    TONGUE.seed = 102
    sketchEllipse(ctx, hx + facing * 7, hy + 9, 3, 2, TONGUE)
  }
  if (view.reach > 0) drawCatPaw(ctx, view)
}

/**
 * Draws the reaching paw on its own, so a swat can show in front of the pot while the
 * cat sits behind it.
 */
export function drawCatPaw(
  ctx: CanvasRenderingContext2D,
  view: SideCatView
): void {
  const hop =
    view.mood === 'run' ? Math.abs(Math.sin(view.timeMs / 70)) * 10 : 0
  const shoulderX = view.x + view.facing * 14
  const shoulderY = view.y - hop - 30
  const px = shoulderX + (view.reachX - shoulderX) * view.reach
  const py = shoulderY + (view.reachY - shoulderY) * view.reach
  ARM.seed = 103
  sketchLine(ctx, shoulderX, shoulderY, px, py, ARM)
  PAW.seed = 104
  sketchCircle(ctx, px, py, 7, PAW)
}

/** A "SWAT!" burst next to a paw, drawn at the moment the swat lands. */
export function drawSwatText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeMs: number
): void {
  sketchText(ctx, 'SWAT!', x, y, {
    font: 'marker',
    size: shoutSize(30, timeMs),
    color: palette.red,
    outline: palette.paper,
    rotate: -0.2,
    seed: 105 + boilSeed(timeMs)
  })
}

const TOP_BODY: SketchStyle = { fill: palette.orange, width: 3, wobble: 1.4 }
/** The top-down cat draws this much bigger than its sketch units. */
const TOP_SCALE = 1.6
const TOP_STRIPE: SketchStyle = {
  color: '#d9480f',
  width: 3,
  wobble: 0.8,
  passes: 1
}

/**
 * Draws the cat from above in Pickup, facing `angle`. While it wiggles its bum swings
 * from side to side and a "!" pops over it, so you know a bat is coming.
 */
export function drawTopCat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  wiggling: boolean,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  const wiggle = wiggling ? Math.sin(timeMs / 45) * 0.35 : 0
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  // Bigger than life next to the beans, so it reads at phone size.
  ctx.scale(TOP_SCALE, TOP_SCALE)
  // Tail and bum swing together about the shoulders.
  ctx.save()
  ctx.rotate(wiggle)
  TAIL.seed = 110 + boil
  tail[0] = -18
  tail[1] = 0
  tail[2] = -34
  tail[3] = 4
  tail[4] = -44
  tail[5] = -6 + Math.sin(timeMs / 120) * 6
  tail[6] = -52
  tail[7] = -14
  sketchPath(ctx, tail, TAIL)
  TOP_BODY.seed = 111 + boil
  sketchEllipse(ctx, -6, 0, 24, 16, TOP_BODY)
  TOP_STRIPE.seed = 112
  sketchLine(ctx, -14, -10, -12, 10, TOP_STRIPE)
  sketchLine(ctx, -4, -12, -2, 12, TOP_STRIPE)
  ctx.restore()
  TOP_BODY.seed = 113 + boil
  sketchCircle(ctx, 18, 0, 12, TOP_BODY)
  EAR.seed = 114
  drawEar(ctx, 20, -10, 30, -14, 24, -4)
  drawEar(ctx, 20, 10, 30, 14, 24, 4)
  ctx.restore()
  if (wiggling)
    sketchText(ctx, '!', x, y - 56, {
      font: 'marker',
      size: 30,
      color: palette.red,
      outline: palette.paper,
      seed: 115
    })
}
