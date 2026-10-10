import { FEATHER_MS, type Feather, type Pigeon } from '../../game/pigeons'
import type { BirdKind } from '../../game/route'
import { PIGEON_BITE_MS } from '../../game/tuning'
import {
  boilSeed,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPolygon,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'

const BODY: SketchStyle = { fill: '#adb5bd', width: 2.5, wobble: 1 }
const HEAD: SketchStyle = { fill: '#ced4da', width: 2.5, wobble: 0.8 }
const SHEEN: SketchStyle = {
  fill: 'rgba(56, 217, 169, 0.55)',
  width: 0,
  wobble: 0.6
}
const WING: SketchStyle = { color: '#495057', width: 2, wobble: 0.6, passes: 1 }
const FLAP: SketchStyle = { fill: '#868e96', width: 2, wobble: 0.8 }
const TAIL: SketchStyle = { fill: '#868e96', width: 2, wobble: 0.6 }
const BEAK: SketchStyle = { fill: palette.orange, width: 1.5, wobble: 0.3 }

/** Fill colours for each bird: a grey pigeon with a green sheen, or a white gull. */
const LOOKS: Record<
  BirdKind,
  {
    body: string
    head: string
    sheen: string
    wing: string
    flap: string
    beak: string
    scale: number
  }
> = {
  pigeon: {
    body: '#adb5bd',
    head: '#ced4da',
    sheen: 'rgba(56, 217, 169, 0.55)',
    wing: '#495057',
    flap: '#868e96',
    beak: palette.orange,
    scale: 1
  },
  gull: {
    body: '#f8f9fa',
    head: '#ffffff',
    sheen: 'rgba(0, 0, 0, 0)',
    wing: '#868e96',
    flap: '#ced4da',
    beak: palette.yellow,
    scale: 1.2
  }
}

/** Points the shared styles at `kind`'s colours. Returns its size multiplier. */
function dress(kind: BirdKind): number {
  const look = LOOKS[kind]
  BODY.fill = look.body
  HEAD.fill = look.head
  SHEEN.fill = look.sheen
  WING.color = look.wing
  FLAP.fill = look.flap
  TAIL.fill = look.flap
  BEAK.fill = look.beak
  return look.scale
}
const EYE: SketchStyle = { fill: palette.paper, width: 1.5, wobble: 0.3 }
const PUPIL: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.1 }
const LEG: SketchStyle = {
  color: palette.orange,
  width: 2.5,
  wobble: 0.4,
  passes: 1
}
const FEATHER: SketchStyle = { fill: '#e9ecef', width: 1.2, wobble: 0.5 }
const BITE: SketchTextStyle = {
  font: 'marker',
  size: 22,
  color: palette.red,
  outline: palette.paper
}
const poly = new Float64Array(8)
const tri = new Float64Array(6)

/** Pigeons draw this much bigger than life, so they read at phone size. */
const TOP_SCALE = 1.4
const SIDE_SCALE = 1.3

function triangle(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  style: SketchStyle
): void {
  tri[0] = ax
  tri[1] = ay
  tri[2] = bx
  tri[3] = by
  tri[4] = cx
  tri[5] = cy
  sketchPolygon(ctx, tri, style)
}

/** One wild eye, its pupil rolling about, and one normal one. */
function eyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  other: number,
  seed: number,
  timeMs: number
): void {
  EYE.seed = seed
  sketchCircle(ctx, x, y, 3.6, EYE)
  PUPIL.seed = seed + 1
  const roll = timeMs / 300 + seed
  sketchCircle(
    ctx,
    x + Math.cos(roll) * 1.6,
    y + Math.sin(roll) * 1.6,
    1.3,
    PUPIL
  )
  if (other !== 0) sketchCircle(ctx, x, y + other, 1.2, PUPIL)
}

/**
 * A pigeon, or a gull, from above in Pickup, facing `p.facing`. Its head bobs as it
 * waddles, darts down while it pecks, and its wings spread when it flies off.
 */
export function drawTopPigeon(
  ctx: CanvasRenderingContext2D,
  p: Pigeon,
  timeMs: number,
  kind: BirdKind = 'pigeon'
): void {
  const size = TOP_SCALE * dress(kind)
  const seed = p.id * 17 + boilSeed(timeMs)
  const fleeing = p.phase === 'flee'
  const pecking =
    p.phase === 'peck' || (p.phase === 'eat' && p.ms < PIGEON_BITE_MS * 0.35)
  const bob =
    p.phase === 'walk'
      ? Math.sin(timeMs / 80 + p.id) * 3
      : pecking
        ? 4 + Math.sin(timeMs / 40) * 3
        : 0
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.facing)
  ctx.scale(size, size)
  if (fleeing) {
    const flap = Math.sin(timeMs / 35) * 6
    FLAP.seed = seed
    sketchEllipse(ctx, -2, -16 - flap, 10, 14, FLAP)
    sketchEllipse(ctx, -2, 16 + flap, 10, 14, FLAP)
  } else if (p.phase === 'walk') {
    // Little orange feet paddling under the body.
    const step = Math.sin(timeMs / 80 + p.id) * 4
    LEG.seed = seed
    sketchLine(ctx, 2 + step, -6, 8 + step, -9, LEG)
    sketchLine(ctx, 2 - step, 6, 8 - step, 9, LEG)
  }
  poly[0] = -12
  poly[1] = -5
  poly[2] = -25
  poly[3] = -8
  poly[4] = -25
  poly[5] = 8
  poly[6] = -12
  poly[7] = 5
  TAIL.seed = seed + 1
  sketchPolygon(ctx, poly, TAIL)
  BODY.seed = seed + 2
  sketchEllipse(ctx, 0, 0, 16, 11, BODY)
  WING.seed = seed + 3
  sketchLine(ctx, -9, -8, 5, -5, WING)
  sketchLine(ctx, -9, 8, 5, 5, WING)
  const hx = 15 + bob
  SHEEN.seed = seed + 4
  sketchEllipse(ctx, 10 + bob * 0.5, 0, 5, 8, SHEEN)
  triangle(ctx, hx + 6, -2, hx + 12, 0, hx + 6, 2, BEAK)
  HEAD.seed = seed + 5
  sketchCircle(ctx, hx, 0, 7, HEAD)
  eyes(ctx, hx + 1, -4, 8, seed + 6, timeMs)
  ctx.restore()
  if (p.phase === 'eat' && p.ms < 500) drawBite(ctx, p, p.y - 30)
}

/**
 * A pigeon, or a gull, side-on in the walk view, standing on (x, y) and facing
 * `p.facing` (1 right). On the pot's rim it dips its head into the beans with every bite.
 */
export function drawSidePigeon(
  ctx: CanvasRenderingContext2D,
  p: Pigeon,
  timeMs: number,
  kind: BirdKind = 'pigeon'
): void {
  const size = SIDE_SCALE * dress(kind)
  const seed = p.id * 23 + boilSeed(timeMs)
  const f = p.facing < 0 ? -1 : 1
  const walking = p.phase === 'walk'
  const dipping = p.phase === 'eat' && p.ms < PIGEON_BITE_MS * 0.35
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(f * size, size)
  if (p.phase === 'flee') {
    const flap = Math.sin(timeMs / 35) * 12
    FLAP.seed = seed
    sketchEllipse(ctx, -2, -30 - flap, 8, 14, FLAP)
  } else {
    const step = walking ? Math.sin(timeMs / 70 + p.id) * 4 : 0
    LEG.seed = seed
    sketchLine(ctx, -2, -8, -3 + step, 0, LEG)
    sketchLine(ctx, 3, -8, 4 - step, 0, LEG)
  }
  // Leaning forward to peck tips the whole bird.
  const lean = dipping ? 0.55 : walking ? Math.sin(timeMs / 140) * 0.05 : 0
  ctx.translate(0, -16)
  ctx.rotate(lean)
  poly[0] = -12
  poly[1] = -3
  poly[2] = -26
  poly[3] = -9
  poly[4] = -26
  poly[5] = -2
  poly[6] = -12
  poly[7] = 4
  TAIL.seed = seed + 1
  sketchPolygon(ctx, poly, TAIL)
  BODY.seed = seed + 2
  sketchEllipse(ctx, 0, 0, 15, 10, BODY)
  WING.seed = seed + 3
  sketchLine(ctx, -10, -3, 6, 1, WING)
  const bob = walking ? Math.sin(timeMs / 80 + p.id) * 3 : 0
  const hx = 12 + bob
  const hy = -12
  SHEEN.seed = seed + 4
  sketchEllipse(ctx, 9, -5, 5, 7, SHEEN)
  triangle(ctx, hx + 6, hy - 1, hx + 12, hy + 2, hx + 6, hy + 3, BEAK)
  HEAD.seed = seed + 5
  sketchCircle(ctx, hx, hy, 7, HEAD)
  eyes(ctx, hx + 2, hy - 2, 0, seed + 6, timeMs)
  ctx.restore()
  if (p.phase === 'eat' && p.ms < 500) drawBite(ctx, p, p.y - 50)
}

/**
 * A "-1" floating up from a pigeon that just ate a bean from the pot, or a puzzled "?"
 * when the Pigeon Net stopped it.
 */
function drawBite(ctx: CanvasRenderingContext2D, p: Pigeon, y: number): void {
  BITE.alpha = 1 - p.ms / 500
  BITE.seed = 7
  BITE.color = p.foiled > 0 ? palette.ink : palette.red
  sketchText(ctx, p.foiled > 0 ? '?' : '-1', p.x, y - p.ms * 0.04, BITE)
}

/** Feathers drifting after a shoo, fading out. */
export function drawFeathers(
  ctx: CanvasRenderingContext2D,
  feathers: readonly Feather[]
): void {
  for (const f of feathers) {
    ctx.save()
    ctx.globalAlpha = 1 - f.ms / FEATHER_MS
    ctx.translate(f.x, f.y)
    ctx.rotate(f.angle)
    FEATHER.seed = 9
    sketchEllipse(ctx, 0, 0, 7, 2.5, FEATHER)
    ctx.restore()
  }
}
