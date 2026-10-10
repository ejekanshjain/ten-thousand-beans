import {
  blobPoints,
  boilSeed,
  palette,
  sketchBlob,
  sketchCircle,
  sketchPath,
  sketchPolygon,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { colors } from './colors'

const CARD: SketchStyle = { fill: palette.paper, width: 3, wobble: 1.2 }
const BOOT: SketchStyle = { fill: '#495057', width: 3, wobble: 1.2 }
const SOLE: SketchStyle = {
  color: palette.yellow,
  width: 3,
  wobble: 0.4,
  passes: 1
}
const MUD: SketchStyle = { fill: colors.mud, width: 2, wobble: 1.5 }
const BAR_BACK: SketchStyle = { fill: palette.paperDark, width: 2, wobble: 1 }
const BAR_FILL: SketchStyle = { fill: palette.green, width: 0, wobble: 1 }
const TITLE: SketchTextStyle = {
  font: 'marker',
  size: 24,
  color: palette.ink,
  seed: 701
}
const NOTE: SketchTextStyle = { font: 'hand', size: 20, color: palette.ink }
/** The boot's outline inside the card: the ankle up the left, the toe out to the right. */
const BOOT_CORNERS = [
  40, 56, 110, 56, 112, 128, 210, 138, 214, 176, 40, 176, 40, 56
]
const boot = new Float64Array(BOOT_CORNERS.length)
const sole = new Float64Array(18)
const blob = new Float64Array(2 * 9)
const FLECK: SketchStyle = { fill: colors.mud, width: 0, wobble: 0.5 }
/** Directions mud flecks fly off a rubbed boot, as x and y pairs. */
const FLECK_DIRS = [-1, -0.6, 1, -0.8, -0.8, 0.3, 0.9, 0.2, 0.2, -1]

/** Mud spots on the boot, as offsets inside the card, cleaned off in reverse order. */
const SPOTS = [
  [70, 140, 20],
  [130, 152, 22],
  [180, 160, 16],
  [80, 100, 15],
  [150, 140, 18],
  [60, 168, 14],
  [110, 166, 14],
  [198, 165, 12],
  [90, 72, 11]
] as const

/**
 * The muddy Grippy Shoe in close-up at the kiosk: a boot on a card, mud spots that come
 * off as `clean` goes from 0 to 1, and how far you have got. It shakes while rubbed.
 */
export function drawMudBoot(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  clean: number,
  strokes: string,
  rubbing: boolean,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  CARD.seed = 700
  sketchRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14, CARD)
  sketchText(ctx, 'Muddy Shoes', rect.x + rect.w / 2, rect.y + 26, TITLE)
  const jiggle = rubbing ? Math.sin(timeMs / 25) * 3 : 0
  const x = rect.x + jiggle
  const y = rect.y
  for (let i = 0; i < BOOT_CORNERS.length; i++)
    boot[i] = (BOOT_CORNERS[i] ?? 0) + (i % 2 ? y : x)
  BOOT.seed = 702 + boil
  sketchPolygon(ctx, boot, BOOT)
  for (let k = 0; k < 9; k++) {
    sole[k * 2] = x + 44 + k * 21
    sole[k * 2 + 1] = y + 182 + (k % 2) * 8
  }
  SOLE.seed = 703
  sketchPath(ctx, sole, SOLE)
  const left = Math.ceil((1 - clean) * SPOTS.length)
  for (let i = 0; i < left; i++) {
    const [sx, sy, r] = SPOTS[i]!
    blobPoints(x + sx, y + sy, r, 9, 710 + i, 0.35, blob)
    MUD.seed = 710 + i + boil
    sketchBlob(ctx, blob, MUD)
  }
  if (rubbing && left > 0) drawFlecks(ctx, x + 125, y + 140, timeMs)
  BAR_BACK.seed = 704
  sketchRoundRect(
    ctx,
    rect.x + 20,
    rect.y + rect.h - 18,
    rect.w - 40,
    12,
    5,
    BAR_BACK
  )
  if (clean > 0) {
    BAR_FILL.seed = 705
    sketchRoundRect(
      ctx,
      rect.x + 22,
      rect.y + rect.h - 16,
      (rect.w - 44) * clean,
      8,
      4,
      BAR_FILL
    )
  }
  sketchText(ctx, strokes, rect.x + rect.w / 2, rect.y + rect.h - 34, NOTE)
}

/** Mud flecks flying off the boot while you rub, each on its own short loop. */
function drawFlecks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeMs: number
): void {
  for (let k = 0; k < FLECK_DIRS.length / 2; k++) {
    const t = (timeMs / 420 + k * 0.23) % 1
    FLECK.alpha = 1 - t
    FLECK.seed = 720 + k
    sketchCircle(
      ctx,
      x + (FLECK_DIRS[k * 2] as number) * 90 * t,
      y + (FLECK_DIRS[k * 2 + 1] as number) * 70 * t + 40 * t * t,
      4 - 2 * t,
      FLECK
    )
  }
  FLECK.alpha = 1
}
