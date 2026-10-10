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

/** Where the kiosk stands in the design, and the ground in front of it. */
export const KIOSK_GROUND = 330
const BOOTH_LEFT = 262
const BOOTH_RIGHT = 478
const WINDOW_TOP = 162
const WINDOW_BOTTOM = 246
/** The editor leans out of the hatch here. */
export const EDITOR_X = 372
export const EDITOR_HEAD_Y = 196

const BRICK: SketchStyle = { fill: colors.brick, width: 0, wobble: 1 }
const MORTAR: SketchStyle = {
  fill: colors.brickDark,
  fillStyle: 'hatch',
  hatchGap: 14,
  hatchAngle: 0,
  width: 0,
  wobble: 1
}
const PAVING: SketchStyle = { fill: colors.paving, width: 2.5, wobble: 1.2 }
const ROAD: SketchStyle = { fill: colors.road, width: 3, wobble: 1.2 }
const BOOTH: SketchStyle = {
  fill: colors.wood,
  fillStyle: 'hatch',
  hatchGap: 9,
  width: 3
}
const BOOTH_BASE: SketchStyle = { fill: '#e9c99b', width: 3 }
const HATCH: SketchStyle = { fill: '#2b2b2b', width: 3, wobble: 1 }
const SIGN: SketchStyle = { fill: palette.paper, width: 3, wobble: 1.2 }
const AWNING: SketchStyle = { width: 2.5, wobble: 1.2 }
const PAPER: SketchStyle = { fill: '#f8f9fa', width: 2, wobble: 1 }
const PRINT: SketchStyle = {
  color: palette.inkSoft,
  width: 1.5,
  wobble: 0.6,
  passes: 1
}
const LEDGE: SketchStyle = { fill: colors.woodDark, width: 3 }
const SIGN_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 24,
  color: palette.red,
  seed: 401,
  // Permanent Marker draws the name wider than the 260 u sign, so squeeze it inside.
  maxWidth: BOOTH_RIGHT - BOOTH_LEFT + 24
}
const stripe = new Float64Array(8)

/**
 * Paints the static kiosk scene: a brick wall, the pavement and road, and the Weekly
 * Whisper's booth with its striped awning, sign, open hatch and stacks of papers.
 */
export function paintKiosk(ctx: CanvasRenderingContext2D): void {
  BRICK.seed = 400
  sketchRect(ctx, -320, -220, 1240, KIOSK_GROUND + 220, BRICK)
  MORTAR.seed = 400
  sketchRect(ctx, -316, -216, 1232, KIOSK_GROUND + 212, MORTAR)
  PAVING.seed = 402
  sketchRect(ctx, -320, KIOSK_GROUND - 24, 1240, 70, PAVING)
  for (let x = -300; x < 920; x += 75)
    sketchLine(ctx, x, KIOSK_GROUND - 20, x - 10, KIOSK_GROUND + 42, {
      ...PRINT,
      color: colors.roadDark,
      seed: x
    })
  ROAD.seed = 403
  sketchRect(ctx, -320, KIOSK_GROUND + 46, 1240, 600, ROAD)

  // The booth, its base and the hatch the editor leans out of.
  BOOTH.seed = 404
  sketchRect(ctx, BOOTH_LEFT, 130, BOOTH_RIGHT - BOOTH_LEFT, 200, BOOTH)
  BOOTH_BASE.seed = 405
  sketchRect(
    ctx,
    BOOTH_LEFT - 6,
    262,
    BOOTH_RIGHT - BOOTH_LEFT + 12,
    68,
    BOOTH_BASE
  )
  HATCH.seed = 406
  sketchRect(
    ctx,
    BOOTH_LEFT + 30,
    WINDOW_TOP,
    BOOTH_RIGHT - BOOTH_LEFT - 60,
    WINDOW_BOTTOM - WINDOW_TOP,
    HATCH
  )
  LEDGE.seed = 407
  sketchRect(
    ctx,
    BOOTH_LEFT + 18,
    WINDOW_BOTTOM,
    BOOTH_RIGHT - BOOTH_LEFT - 36,
    14,
    LEDGE
  )

  // Stacks of the Weekly Whisper on the base.
  for (let i = 0; i < 4; i++) {
    const x = BOOTH_LEFT + 12 + i * 52
    PAPER.seed = 408 + i
    sketchRect(ctx, x, 274, 44, 48, PAPER)
    PRINT.seed = 412 + i
    sketchLine(ctx, x + 6, 284, x + 38, 284, PRINT)
    sketchLine(ctx, x + 6, 294, x + 30, 294, PRINT)
    sketchLine(ctx, x + 6, 304, x + 36, 304, PRINT)
  }

  // The sign and a striped awning over it.
  SIGN.seed = 416
  sketchRoundRect(
    ctx,
    BOOTH_LEFT - 22,
    96,
    BOOTH_RIGHT - BOOTH_LEFT + 44,
    40,
    8,
    SIGN
  )
  sketchText(
    ctx,
    'THE WEEKLY WHISPER',
    (BOOTH_LEFT + BOOTH_RIGHT) / 2,
    117,
    SIGN_TEXT
  )
  const width = (BOOTH_RIGHT - BOOTH_LEFT + 60) / 6
  for (let k = 0; k < 6; k++) {
    const x = BOOTH_LEFT - 30 + k * width
    stripe[0] = x
    stripe[1] = 52
    stripe[2] = x + width
    stripe[3] = 52
    stripe[4] = x + width
    stripe[5] = 92
    stripe[6] = x
    stripe[7] = 100
    AWNING.fill = k % 2 === 0 ? palette.green : palette.paper
    AWNING.seed = 417 + k
    sketchPolygon(ctx, stripe, AWNING)
  }
}

const SHIRT: SketchStyle = { fill: '#f1f3f5', width: 3, wobble: 1.4 }
const HEAD: SketchStyle = { fill: colors.skin, width: 3, wobble: 1.4 }
const VISOR: SketchStyle = { fill: palette.green, width: 2.5, wobble: 1 }
const DOT: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.3 }
const LINE: SketchStyle = { width: 2.5, wobble: 0.8, passes: 1 }
const PENCIL: SketchStyle = {
  color: palette.yellow,
  width: 5,
  wobble: 0.4,
  passes: 1
}
const ARM: SketchStyle = { color: '#dee2e6', width: 9, wobble: 1, passes: 1 }
const visor = new Float64Array(6)

/**
 * Draws the editor leaning out of the hatch: a green visor, a pencil behind his ear and
 * rolled-up sleeves. He bobs while he talks, and rubs his hands after a sale.
 */
export function drawEditor(
  ctx: CanvasRenderingContext2D,
  talking: boolean,
  happy: boolean,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  const bob = talking ? Math.sin(timeMs / 90) * 2 : 0
  const x = EDITOR_X
  const y = EDITOR_HEAD_Y + bob
  SHIRT.seed = 430 + boil
  sketchRoundRect(ctx, x - 34, y + 18, 68, 40, 14, SHIRT)
  // Arms on the ledge, or rubbing together after a sale.
  ARM.seed = 431 + boil
  const rub = happy ? Math.sin(timeMs / 60) * 4 : 0
  sketchLine(ctx, x - 26, y + 30, x - 8 + rub, WINDOW_BOTTOM - 2, ARM)
  sketchLine(ctx, x + 26, y + 30, x + 8 - rub, WINDOW_BOTTOM - 2, ARM)
  HEAD.seed = 432 + boil
  sketchCircle(ctx, x - 4 + rub * 0.3, WINDOW_BOTTOM - 4, 6, HEAD)
  sketchCircle(ctx, x + 4 - rub * 0.3, WINDOW_BOTTOM - 4, 6, HEAD)
  sketchCircle(ctx, x, y, 22, HEAD)
  // The pencil behind his ear, then the visor over his eyes.
  PENCIL.seed = 433
  sketchLine(ctx, x + 14, y - 22, x + 30, y - 4, PENCIL)
  visor[0] = x - 26
  visor[1] = y - 6
  visor[2] = x + 22
  visor[3] = y - 14
  visor[4] = x - 4
  visor[5] = y - 24
  VISOR.seed = 434
  sketchPolygon(ctx, visor, VISOR)
  DOT.seed = 435
  sketchCircle(ctx, x - 12, y + 2, 2.6, DOT)
  sketchCircle(ctx, x - 2, y + 2, 2.6, DOT)
  LINE.seed = 436 + boil
  if (talking) sketchEllipse(ctx, x - 7, y + 12, 5, 3 + Math.abs(bob), LINE)
  else if (happy) sketchLine(ctx, x - 14, y + 10, x, y + 13, LINE)
  else sketchLine(ctx, x - 13, y + 12, x, y + 11, LINE)
}

const BOARD: SketchStyle = { fill: palette.paper, width: 3, wobble: 1.2 }
const LEGS: SketchStyle = { width: 4, wobble: 0.8, passes: 1 }
const CHALK: SketchTextStyle = {
  font: 'marker',
  size: 20,
  color: palette.ink,
  maxWidth: 104
}
const CHALK_SMALL: SketchTextStyle = {
  font: 'hand',
  size: 18,
  color: palette.red
}
const headline = new Map<string, string[]>()

/** Splits a gossip line into short rows for the sandwich board, once per line. */
function rows(text: string): string[] {
  let out = headline.get(text)
  if (out) return out
  out = []
  let row = ''
  for (const word of text.split(' ')) {
    if (row && row.length + word.length + 1 > 10) {
      out.push(row)
      row = word
    } else row = row ? `${row} ${word}` : word
  }
  out.push(row)
  headline.set(text, out)
  return out
}

/** The sandwich board in front of the kiosk, chalked with the latest headline you sold. */
export function drawSandwichBoard(
  ctx: CanvasRenderingContext2D,
  text: string | null
): void {
  const x = 540
  LEGS.seed = 440
  sketchLine(ctx, x - 50, KIOSK_GROUND, x - 40, 196, LEGS)
  sketchLine(ctx, x + 50, KIOSK_GROUND, x + 40, 196, LEGS)
  BOARD.seed = 441
  sketchRect(ctx, x - 58, 188, 116, 124, BOARD)
  CHALK_SMALL.seed = 442
  sketchText(ctx, text ? 'LATEST' : 'WANTED', x, 206, CHALK_SMALL)
  const lines = rows(text ?? 'YOUR GOSSIP')
  const top = 252 - ((lines.length - 1) * 22) / 2
  for (let i = 0; i < lines.length && i < 4; i++) {
    CHALK.seed = 443 + i
    sketchText(ctx, lines[i]!, x, top + i * 22, CHALK)
  }
}
