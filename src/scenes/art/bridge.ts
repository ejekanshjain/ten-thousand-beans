import { DECK_GAP, DECK_LEFT, DECK_PLANK, DECK_RIGHT } from '../../game/tuning'
import {
  boilSeed,
  palette,
  sketchArrow,
  sketchCircle,
  sketchEllipse,
  sketchPath,
  sketchRect,
  type SketchStyle
} from '../../shared'
import { colors } from './colors'

const DUCK_BODY: SketchStyle = { fill: palette.yellow, width: 2.5, wobble: 1 }
const DUCK_BEAK: SketchStyle = { fill: palette.orange, width: 2, wobble: 0.5 }
const DUCK_EYE: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.2 }
const RAIL: SketchStyle & { closed: boolean; smooth: boolean } = {
  color: colors.woodDark,
  width: 4,
  wobble: 1.5,
  passes: 1,
  closed: false,
  smooth: true
}
const RIPPLE: SketchStyle = {
  color: palette.paper,
  width: 2.5,
  wobble: 1,
  passes: 1
}
const PLANK: SketchStyle = { fill: colors.wood, width: 2.5, wobble: 1 }
const POST: SketchStyle = { fill: colors.woodDark, width: 2.5, wobble: 1 }
const WAVE: SketchStyle & { closed: boolean; smooth: boolean } = {
  color: palette.paper,
  width: 2.5,
  wobble: 2,
  passes: 1,
  closed: false,
  smooth: true
}
const wave = new Float64Array(6)
/** Columns of ripples in the river either side of the deck, in u. */
const RIVER_WAVES_X = [
  -260,
  -170,
  -80,
  DECK_LEFT - 34,
  DECK_RIGHT + 6,
  DECK_RIGHT + 130,
  DECK_RIGHT + 220
]
const TIP: SketchStyle & { head: number } = {
  color: 'rgba(33, 37, 41, 0.45)',
  width: 7,
  wobble: 1,
  passes: 1,
  head: 20
}
const rail = new Float64Array(2 * 24)

/**
 * A rubber-looking duck paddling at (x, y), facing `facing` (1 right), drawn `scale`
 * times its size. With `bean` it carries a bean on its head, looking pleased.
 */
export function drawDuck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  scale: number,
  timeMs: number,
  bean: ((x: number, y: number, angle: number) => void) | null
): void {
  const bob = Math.sin(timeMs / 220) * 2
  const seed = boilSeed(timeMs)
  ctx.save()
  ctx.translate(x, y + bob)
  ctx.scale(facing * scale, scale)
  RIPPLE.seed = 80 + seed
  sketchEllipse(ctx, 0, 10, 26, 5, RIPPLE)
  DUCK_BODY.seed = 81 + seed
  sketchEllipse(ctx, -2, 2, 18, 11, DUCK_BODY)
  sketchCircle(ctx, 12, -12, 8, DUCK_BODY)
  DUCK_BEAK.seed = 82
  sketchEllipse(ctx, 22, -10, 6, 3, DUCK_BEAK)
  DUCK_EYE.seed = 83
  sketchCircle(ctx, 14, -14, 1.8, DUCK_EYE)
  ctx.restore()
  if (bean) bean(x + facing * 12 * scale, y + bob - 24 * scale, 0.3)
}

/**
 * A rope handrail sagging between posts from `left` to `right` at height `y`, lifted by
 * `lift` u so the bridge's roll shows: the near rail drops as the far one rises.
 */
export function drawRail(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  y: number,
  lift: number,
  seed: number
): void {
  const n = rail.length / 2
  const span = right - left
  for (let i = 0; i < n; i++) {
    const x = left + (span * i) / (n - 1)
    // Sags between posts every 400 u, the same posts the tiles paint.
    const sag = Math.sin((Math.PI * (((x % 400) + 400) % 400)) / 400) * 22
    rail[i * 2] = x
    rail[i * 2 + 1] = y + sag - lift
  }
  RAIL.seed = seed
  sketchPath(ctx, rail, RAIL)
}

/**
 * The rope bridge from above in Pickup: river on both sides, the plank deck from
 * DECK_LEFT to DECK_RIGHT with its gaps, and rope rails along both edges.
 */
export function paintBridgeDeck(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = colors.river
  ctx.fillRect(-300, -200, 1200, 1200)
  for (let y = -180; y < 1000; y += 46)
    for (const x of RIVER_WAVES_X) {
      const jx = x + ((((y * 7) % 40) + 40) % 40)
      wave[0] = jx
      wave[1] = y
      wave[2] = jx + 14
      wave[3] = y - 5
      wave[4] = jx + 28
      wave[5] = y
      WAVE.seed = jx + y
      sketchPath(ctx, wave, WAVE)
    }
  // Dark water shows through the gaps between planks.
  ctx.fillStyle = colors.riverDeep
  ctx.fillRect(DECK_LEFT, -200, DECK_RIGHT - DECK_LEFT, 1200)
  for (let y = -180; y < 1000; y += DECK_PLANK) {
    PLANK.seed = y
    sketchRect(
      ctx,
      DECK_LEFT,
      y + DECK_GAP / 2,
      DECK_RIGHT - DECK_LEFT,
      DECK_PLANK - DECK_GAP,
      PLANK
    )
  }
  for (const x of [DECK_LEFT, DECK_RIGHT]) {
    for (let y = -160; y < 1000; y += 180) {
      POST.seed = x + y
      sketchCircle(ctx, x, y, 9, POST)
    }
    sketchRect(ctx, x - 3, -200, 6, 1200, { fill: colors.woodDark, width: 0 })
  }
}

/** An arrow across the top of bridge Pickup showing which way the deck tips the beans. */
export function drawDeckTip(
  ctx: CanvasRenderingContext2D,
  slide: number,
  timeMs: number
): void {
  if (Math.abs(slide) < 20) return
  const len = Math.min(140, Math.abs(slide) * 1.6)
  const dir = Math.sign(slide)
  TIP.seed = 90 + boilSeed(timeMs)
  sketchArrow(ctx, 300 - (dir * len) / 2, 70, 300 + (dir * len) / 2, 70, TIP)
}
