import {
  boilSeed,
  hash01,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchRect,
  sketchRoundRect,
  type SketchStyle
} from '../../shared'
import { colors } from './colors'

const SKIN: SketchStyle = { fill: colors.skin, width: 3, wobble: 1.4 }
const DOT: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.3 }
const LINE: SketchStyle = { width: 2.5, wobble: 0.8, passes: 1 }
const LIMB: SketchStyle = { width: 7, wobble: 1.2, passes: 1 }
const CLOTH: SketchStyle = { width: 3, wobble: 1.6 }
const PROP: SketchStyle = { width: 2.5, wobble: 1 }
const COATS = [
  palette.green,
  palette.orange,
  '#868e96',
  palette.blue,
  '#e599f7',
  colors.brick
]
const BAGS = [palette.yellow, palette.paper, palette.red, colors.wood]

/**
 * A shopper walking against you with a bag of shopping: a seeded coat, hat and bag, so
 * the crowd isn't one person. `x` is the feet, facing left.
 */
export function drawShopper(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  seed: number,
  stepPhase: number,
  bumped: boolean,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  const swing = Math.sin(Math.PI * stepPhase) * 16
  const lean = bumped ? 0.18 : 0
  LIMB.color = palette.ink
  LIMB.seed = 500 + boil
  sketchLine(ctx, x - 4, ground - 70, x + swing - 3, ground - 4, LIMB)
  sketchLine(ctx, x + 4, ground - 70, x - swing + 3, ground - 4, LIMB)
  ctx.save()
  ctx.translate(x, ground - 70)
  ctx.rotate(lean)
  CLOTH.fill = COATS[Math.floor(hash01(seed, 1) * COATS.length)]
  CLOTH.seed = 501 + boil
  sketchRoundRect(ctx, -26, -96, 52, 104, 16, CLOTH)
  SKIN.seed = 502 + boil
  sketchCircle(ctx, -3, -118, 21, SKIN)
  DOT.seed = 503
  sketchCircle(ctx, -12, -121, 2.5, DOT)
  sketchCircle(ctx, -20, -121, 2.5, DOT)
  LINE.seed = 504 + boil
  if (bumped) sketchCircle(ctx, -16, -108, 4, LINE)
  else sketchLine(ctx, -22, -110, -12, -109, LINE)
  // A hat on some, a bag on everyone.
  if (hash01(seed, 2) < 0.6) {
    PROP.fill = COATS[Math.floor(hash01(seed, 3) * COATS.length)]
    PROP.seed = 505
    sketchRoundRect(ctx, -22, -146, 38, 14, 6, PROP)
  }
  PROP.fill = BAGS[Math.floor(hash01(seed, 4) * BAGS.length)]
  PROP.seed = 506
  sketchRect(ctx, 12, -30, 26, 30, PROP)
  LINE.seed = 507
  sketchLine(ctx, 16, -30, 24, -46, LINE)
  sketchLine(ctx, 34, -30, 24, -46, LINE)
  ctx.restore()
}

const APRON: SketchStyle = { fill: palette.paper, width: 2.5, wobble: 1.2 }
const SPOON: SketchStyle = {
  color: colors.woodDark,
  width: 5,
  wobble: 0.6,
  passes: 1
}
const BOWL: SketchStyle = { fill: '#dee2e6', width: 2.5, wobble: 0.8 }
const CHUTNEY: SketchStyle = { fill: palette.orange, width: 1.5, wobble: 1.4 }

/**
 * A stallholder behind the counter at `x`, whose counter top is at `counter`. The tasting
 * spoon reaches from their hand toward the walking line by `out` (0 held up, 1 at the
 * pot's rim height, `rimY`). A wind-up shakes it just before it pokes.
 */
export function drawStallholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  counter: number,
  rimY: number,
  out: number,
  shake: number,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  const top = counter - 12
  CLOTH.fill = palette.blue
  CLOTH.seed = 520 + boil
  sketchRoundRect(ctx, x - 22, top - 44, 44, 46, 12, CLOTH)
  APRON.seed = 521
  sketchRect(ctx, x - 14, top - 34, 28, 36, APRON)
  SKIN.seed = 522 + boil
  sketchCircle(ctx, x, top - 62, 17, SKIN)
  DOT.seed = 523
  sketchCircle(ctx, x - 7, top - 64, 2.2, DOT)
  sketchCircle(ctx, x + 2, top - 64, 2.2, DOT)
  LINE.seed = 524 + boil
  sketchLine(ctx, x - 9, top - 54, x + 2, top - 52, LINE)

  // The spoon, from the hand toward you, with a blob of chutney.
  const jitter = shake > 0 ? Math.sin(timeMs / 25) * 4 * shake : 0
  const handX = x - 16
  const handY = top - 30
  const tipX = handX - 4 + (-30 - -4) * out + jitter
  const tipY = handY - 50 + (rimY - (handY - 50)) * out
  LIMB.color = palette.blue
  LIMB.seed = 525 + boil
  sketchLine(ctx, x - 12, top - 36, handX, handY, LIMB)
  SPOON.seed = 526
  sketchLine(ctx, handX, handY, tipX, tipY, SPOON)
  BOWL.seed = 527
  sketchEllipse(ctx, tipX, tipY, 9, 6, BOWL)
  CHUTNEY.seed = 528 + boil
  sketchCircle(ctx, tipX, tipY - 3, 5, CHUTNEY)
}

const OVERALLS: SketchStyle = { fill: palette.blue, width: 3, wobble: 1.6 }
const CAP: SketchStyle = { fill: palette.red, width: 2.5, wobble: 1 }
const BRIM: SketchStyle = {
  color: palette.red,
  width: 4,
  wobble: 1,
  passes: 1
}
const RAIL: SketchStyle = {
  color: colors.woodDark,
  width: 5,
  wobble: 0.8,
  passes: 1
}
const RUNG: SketchStyle = {
  color: colors.wood,
  width: 3,
  wobble: 0.5,
  passes: 1
}

/**
 * The man in blue overalls turning round with a ladder on his shoulder. `half` is how far
 * the ladder reaches each way as seen side-on: about 130 broadside, 20 when it points at
 * you. `facing` flips with every turn.
 */
export function drawLadderMan(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  half: number,
  facing: number,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  LIMB.color = palette.blue
  LIMB.seed = 540 + boil
  sketchLine(ctx, x - 6, ground - 72, x - 8, ground - 4, LIMB)
  sketchLine(ctx, x + 6, ground - 72, x + 8, ground - 4, LIMB)
  OVERALLS.seed = 541 + boil
  sketchRoundRect(ctx, x - 26, ground - 166, 52, 100, 14, OVERALLS)
  SKIN.seed = 542 + boil
  sketchCircle(ctx, x + facing * 3, ground - 186, 21, SKIN)
  CAP.seed = 543
  sketchRoundRect(ctx, x - 18 + facing * 3, ground - 210, 36, 14, 6, CAP)
  BRIM.seed = 544
  sketchLine(
    ctx,
    x + facing * 18,
    ground - 199,
    x + facing * 34,
    ground - 197,
    BRIM
  )
  DOT.seed = 545
  sketchCircle(ctx, x + facing * 11, ground - 188, 2.5, DOT)
  // The ladder on his shoulder: two rails and rungs, foreshortened as he turns.
  const y = ground - 156
  RAIL.seed = 546 + boil
  sketchLine(ctx, x - half, y, x + half, y - 2, RAIL)
  sketchLine(ctx, x - half, y + 16, x + half, y + 14, RAIL)
  const rungs = Math.max(1, Math.round(half / 18))
  for (let i = 0; i <= rungs; i++) {
    const rx = x - half + (2 * half * i) / rungs
    RUNG.seed = 547 + i
    sketchLine(ctx, rx, y, rx, y + 15, RUNG)
  }
  // His hand on the ladder.
  SKIN.seed = 548
  sketchCircle(ctx, x - facing * 8, y + 8, 6, SKIN)
}
