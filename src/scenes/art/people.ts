import type { NeighbourLook } from '../../game/street'
import {
  boilSeed,
  FONT_HAND,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchPolygon,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { colors } from './colors'
import { shoutSize } from './shout'

// ---------------------------------------------------------------- Shared styles

const SKIN: SketchStyle = { fill: colors.skin, width: 3, wobble: 1.4 }
const DOT: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.3 }
const LINE: SketchStyle = { width: 2.5, wobble: 0.8, passes: 1 }
const LIMB: SketchStyle = { width: 6, wobble: 1.2, passes: 1 }
const CLOTH: SketchStyle = { width: 3, wobble: 1.6 }
const CLOTH_HATCH: SketchStyle = {
  fillStyle: 'hatch',
  hatchGap: 7,
  width: 0,
  wobble: 1
}
const SHOE: SketchStyle = { width: 2, wobble: 1 }
const PROP: SketchStyle = { width: 2.5, wobble: 0.8 }
const STEAM: SketchStyle & { smooth: boolean } = {
  width: 2,
  wobble: 1.5,
  passes: 1,
  color: palette.inkSoft,
  smooth: true
}
const HOOD: SketchStyle & { closed: boolean } = {
  width: 3,
  wobble: 1.6,
  closed: true
}
const BAND: SketchStyle & { smooth: boolean } = {
  width: 4,
  wobble: 0.8,
  passes: 1,
  smooth: true
}
const steam = new Float64Array(8)
const hood = new Float64Array(8)
const vee = new Float64Array(6)
const band = new Float64Array(8)

/** The street's neighbours, plus Mrs Pryce, the street's ambush. */
export type PersonLook = NeighbourLook | 'pryce'

/** Colours for each neighbour's clothes. */
const OUTFIT: Record<
  PersonLook,
  { body: string; hatch: string; legs: string; shoe: string }
> = {
  gown: {
    body: palette.pink,
    hatch: '#f06595',
    legs: colors.skin,
    shoe: '#ffdeeb'
  },
  cardigan: {
    body: '#c08552',
    hatch: '#8f5a2e',
    legs: '#868e96',
    shoe: colors.woodDark
  },
  hoodie: {
    body: palette.purple,
    hatch: '#5f3dc4',
    legs: palette.blue,
    shoe: palette.paper
  },
  pryce: {
    body: '#f59f00',
    hatch: '#e8590c',
    legs: '#495057',
    shoe: palette.red
  }
}

/** How a neighbour looks this frame, in world coordinates. */
export interface NeighbourView {
  look: PersonLook
  /** Feet x and the ground under them. */
  x: number
  ground: number
  /** -1 faces left, toward you. */
  facing: number
  stepPhase: number
  moving: boolean
  /** 0 to 1: how far they lean in to peek. */
  peek: number
  /** True while a hand grips the pot's rim at (handX, handY). */
  reaching: boolean
  handX: number
  handY: number
  /** 0 to 1: stepping out of the doorway. Small and pale at 0. */
  emerge: number
  /** True just after an elbow, for the sharp pose. */
  elbow: boolean
  timeMs: number
}

const shoulder = { x: 0, y: 0 }

/**
 * Draws a neighbour side-on: Mrs Pink in a dressing gown and curlers, the man in a
 * cardigan with his tea, or the teen in a hoodie and headphones. They lean in to peek,
 * one hand on the pot's rim.
 */
export function drawNeighbour(
  ctx: CanvasRenderingContext2D,
  v: NeighbourView
): void {
  const boil = boilSeed(v.timeMs)
  const outfit = OUTFIT[v.look]
  const scale = 0.84 + 0.16 * v.emerge
  const f = v.facing
  const hipY = -72
  const lean = f * (0.2 * v.peek + (v.elbow ? 0.25 : 0))
  ctx.save()
  ctx.globalAlpha *= 0.45 + 0.55 * v.emerge
  ctx.translate(v.x, v.ground)
  ctx.scale(scale, scale)

  // Legs and shoes. The gown and Mrs Pryce's coat cover all but the ankles.
  const swing = v.moving ? Math.sin(Math.PI * v.stepPhase) * 18 : 0
  const long = v.look === 'gown' || v.look === 'pryce'
  LIMB.color = outfit.legs
  LIMB.width = long ? 5 : 7
  LIMB.seed = 300 + boil
  const legTop = long ? -26 : hipY
  sketchLine(ctx, -5, legTop, swing - 3, -5, LIMB)
  sketchLine(ctx, 5, legTop, -swing + 3, -5, LIMB)
  SHOE.fill = outfit.shoe
  SHOE.seed = 301
  const shoeR = v.look === 'gown' ? 13 : 11
  sketchEllipse(ctx, swing - 3 + f * 5, -4, shoeR, 6, SHOE)
  sketchEllipse(ctx, -swing + 3 + f * 5, -4, shoeR, 6, SHOE)

  // The upper body pivots at the hips to lean in.
  ctx.save()
  ctx.translate(0, hipY)
  ctx.rotate(lean)
  drawBody(ctx, v, boil)
  ctx.restore()
  ctx.restore()

  // The reaching arm goes in world space, from the turned shoulder to the rim.
  if (v.reaching) {
    const sx = f * 4
    const sy = -84
    shoulder.x = v.x + (sx * Math.cos(lean) - sy * Math.sin(lean)) * scale
    shoulder.y =
      v.ground + (hipY + sx * Math.sin(lean) + sy * Math.cos(lean)) * scale
    LIMB.color = outfit.body
    LIMB.width = 8
    LIMB.seed = 302 + boil
    const midX = (shoulder.x + v.handX) / 2
    const midY = Math.max(shoulder.y, v.handY) + 16
    sketchLine(ctx, shoulder.x, shoulder.y, midX, midY, LIMB)
    sketchLine(ctx, midX, midY, v.handX, v.handY, LIMB)
    SKIN.seed = 303
    sketchCircle(ctx, v.handX, v.handY, 7, SKIN)
  }
}

/** Torso, head and props, drawn with (0, 0) at the hips. */
function drawBody(
  ctx: CanvasRenderingContext2D,
  v: NeighbourView,
  boil: number
): void {
  const outfit = OUTFIT[v.look]
  const f = v.facing
  CLOTH.fill = outfit.body
  CLOTH.seed = 310 + boil
  CLOTH_HATCH.fill = outfit.hatch
  CLOTH_HATCH.seed = 311
  if (v.look === 'gown') {
    // A long dressing gown with a belt and a bow.
    sketchRoundRect(ctx, -27, -90, 54, 140, 18, CLOTH)
    sketchRoundRect(ctx, -23, -86, 46, 132, 16, CLOTH_HATCH)
    LINE.seed = 312
    sketchLine(ctx, -26, -24, 26, -22, LINE)
    PROP.fill = outfit.hatch
    PROP.seed = 313
    sketchCircle(ctx, -f * 8, -22, 5, PROP)
  } else if (v.look === 'cardigan') {
    sketchRoundRect(ctx, -28, -94, 56, 100, 14, CLOTH)
    sketchRoundRect(ctx, -24, -90, 48, 92, 12, CLOTH_HATCH)
    // The shirt's V and three buttons.
    PROP.fill = palette.paper
    PROP.seed = 314
    vee[0] = f * 2 - 9
    vee[1] = -94
    vee[2] = f * 2 + 9
    vee[3] = -94
    vee[4] = f * 2
    vee[5] = -70
    sketchPolygon(ctx, vee, PROP)
    for (let i = 0; i < 3; i++) sketchCircle(ctx, f * 3, -60 + i * 18, 2.5, DOT)
  } else if (v.look === 'pryce') {
    // A long leopard-print coat, buttoned to the chin.
    sketchRoundRect(ctx, -29, -94, 58, 136, 16, CLOTH)
    sketchRoundRect(ctx, -25, -90, 50, 128, 14, CLOTH_HATCH)
    for (let i = 0; i < 9; i++) {
      DOT.seed = 340 + i
      sketchEllipse(ctx, ((i * 37) % 40) - 18, -84 + i * 14, 4, 3, DOT)
    }
  } else {
    // A hoodie: the hood sits behind the head, with a pouch pocket.
    hood[0] = -f * 18
    hood[1] = -92
    hood[2] = -f * 30
    hood[3] = -116
    hood[4] = -f * 14
    hood[5] = -128
    hood[6] = f * 6
    hood[7] = -96
    HOOD.fill = outfit.body
    HOOD.seed = 315
    sketchPath(ctx, hood, HOOD)
    sketchRoundRect(ctx, -28, -96, 56, 102, 16, CLOTH)
    sketchRoundRect(ctx, -24, -92, 48, 94, 14, CLOTH_HATCH)
    LINE.seed = 316
    sketchLine(ctx, -14, -34, 14, -34, LINE)
  }

  // Head, facing you.
  const hx = f * 3
  const hy = v.look === 'gown' ? -116 : -120
  SKIN.seed = 320 + boil
  sketchCircle(ctx, hx, hy, 22, SKIN)
  DOT.seed = 321
  sketchCircle(ctx, hx + f * 8, hy - 3, 2.6, DOT)
  sketchCircle(ctx, hx + f * 16, hy - 3, 2.6, DOT)
  LINE.seed = 322 + boil
  if (v.peek > 0.5) sketchCircle(ctx, hx + f * 13, hy + 10, 4, LINE)
  else sketchLine(ctx, hx + f * 7, hy + 10, hx + f * 17, hy + 8, LINE)

  if (v.look === 'gown') {
    // Curlers in a row over the top of the head.
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (1.15 + i * 0.24)
      PROP.fill = i % 2 ? palette.blue : palette.yellow
      PROP.seed = 323 + i
      sketchCircle(ctx, hx + Math.cos(a) * 22, hy + Math.sin(a) * 22, 6, PROP)
    }
  } else if (v.look === 'cardigan') {
    // Bald, with grey tufts and a moustache.
    LINE.seed = 327
    LINE.color = '#adb5bd'
    LINE.width = 4
    sketchLine(ctx, hx - f * 20, hy - 6, hx - f * 22, hy + 4, LINE)
    sketchLine(ctx, hx + f * 6, hy + 5, hx + f * 18, hy + 5, LINE)
    LINE.color = palette.ink
    LINE.width = 2.5
  } else if (v.look === 'pryce') {
    // A headscarf tied under the chin, and enormous round glasses.
    PROP.fill = palette.purple
    PROP.seed = 345
    sketchPolygon(
      ctx,
      [hx - 25, hy + 2, hx - 18, hy - 22, hx + 18, hy - 22, hx + 25, hy + 2],
      PROP
    )
    LINE.seed = 346
    sketchCircle(ctx, hx + f * 8, hy - 3, 8, LINE)
    sketchCircle(ctx, hx + f * 18, hy - 3, 7, LINE)
  } else {
    // A fringe and big headphones.
    LINE.seed = 328
    LINE.width = 5
    sketchLine(ctx, hx - f * 14, hy - 16, hx + f * 18, hy - 12, LINE)
    LINE.width = 2.5
    band[0] = hx - 20
    band[1] = hy - 2
    band[2] = hx - 14
    band[3] = hy - 26
    band[4] = hx + 14
    band[5] = hy - 26
    band[6] = hx + 20
    band[7] = hy - 2
    BAND.seed = 329
    sketchPath(ctx, band, BAND)
    PROP.fill = palette.red
    PROP.seed = 330
    sketchEllipse(ctx, hx - f * 9, hy - 2, 6, 9, PROP)
  }

  // The free arm hangs down, holding tea or a phone.
  const handX = -f * 18
  const handY = -10
  LIMB.color = outfit.body
  LIMB.width = 8
  LIMB.seed = 331 + boil
  sketchLine(ctx, -f * 10, -86, handX, handY, LIMB)
  if (v.reaching) return
  if (v.look === 'cardigan') {
    PROP.fill = palette.paper
    PROP.seed = 332
    sketchRect(ctx, handX - 9, handY - 18, 18, 20, PROP)
    LINE.seed = 333
    sketchCircle(ctx, handX - f * 12, handY - 9, 5, LINE)
    for (let i = 0; i < 4; i++) {
      steam[i * 2] = handX + Math.sin(v.timeMs / 300 + i) * 4
      steam[i * 2 + 1] = handY - 24 - i * 9
    }
    STEAM.seed = 334 + boil
    sketchPath(ctx, steam, STEAM)
  } else if (v.look === 'hoodie') {
    PROP.fill = palette.ink
    PROP.seed = 335
    sketchRoundRect(ctx, handX - 6, handY - 18, 12, 20, 3, PROP)
  } else if (v.look === 'pryce') {
    // Opera glasses, for a proper look.
    PROP.fill = palette.ink
    PROP.seed = 337
    sketchRect(ctx, handX - 10, handY - 14, 20, 10, PROP)
  } else {
    SKIN.seed = 336
    sketchCircle(ctx, handX, handY, 6, SKIN)
  }
}

// ---------------------------------------------------------------- Cyclist

const WHEEL: SketchStyle = { width: 3, wobble: 1.2, passes: 1 }
const FRAME: SketchStyle = {
  width: 4,
  wobble: 0.8,
  passes: 1,
  color: palette.red
}
const RIDER: SketchStyle = { fill: palette.green, width: 3, wobble: 1.2 }
const HELMET: SketchStyle = { fill: palette.yellow, width: 2.5, wobble: 1 }
const SPEED: SketchStyle = {
  width: 3,
  wobble: 1.5,
  passes: 1,
  color: palette.inkSoft
}
const DING: SketchTextStyle = {
  font: 'marker',
  size: 26,
  color: palette.red,
  outline: palette.paper,
  rotate: -0.15
}
const BELL: SketchStyle = { fill: palette.yellow, width: 2.5, wobble: 0.8 }
const rider = new Float64Array(8)
const bell = new Float64Array(6)

/**
 * Draws a cyclist riding right with `x` at the bike's middle: two wheels, a red frame, a
 * rider in a green jersey bent over the bars, speed lines, and "DING" while ringing.
 */
export function drawCyclist(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  ringing: boolean,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  const wheelY = ground - 26
  for (let i = 0; i < 3; i++) {
    SPEED.seed = 340 + i + boil
    const y = ground - 70 + i * 24
    sketchLine(ctx, x - 80 - i * 14, y, x - 140 - i * 20, y, SPEED)
  }
  WHEEL.seed = 341 + boil
  sketchCircle(ctx, x - 36, wheelY, 24, WHEEL)
  sketchCircle(ctx, x + 36, wheelY, 24, WHEEL)
  FRAME.seed = 342
  const seatX = x - 12
  const seatY = ground - 74
  sketchLine(ctx, x - 36, wheelY, seatX, seatY, FRAME)
  sketchLine(ctx, seatX, seatY, x + 26, ground - 76, FRAME)
  sketchLine(ctx, x + 26, ground - 76, x + 36, wheelY, FRAME)
  sketchLine(ctx, x - 36, wheelY, x, wheelY, FRAME)
  sketchLine(ctx, x, wheelY, seatX, seatY, FRAME)
  // Pedalling legs round the crank.
  const a = timeMs / 90
  LIMB.color = palette.ink
  LIMB.width = 6
  LIMB.seed = 343 + boil
  const cx = Math.cos(a) * 12
  const cy = Math.sin(a) * 12
  sketchLine(ctx, seatX, seatY - 6, x + cx, wheelY + cy, LIMB)
  sketchLine(ctx, seatX, seatY - 6, x - cx, wheelY - cy, LIMB)
  RIDER.seed = 344 + boil
  rider[0] = seatX - 10
  rider[1] = seatY - 4
  rider[2] = seatX + 8
  rider[3] = seatY - 8
  rider[4] = x + 30
  rider[5] = ground - 112
  rider[6] = x + 14
  rider[7] = ground - 120
  sketchPolygon(ctx, rider, RIDER)
  LIMB.color = palette.green
  sketchLine(ctx, x + 20, ground - 112, x + 30, ground - 80, LIMB)
  SKIN.seed = 345
  sketchCircle(ctx, x + 30, ground - 126, 14, SKIN)
  HELMET.seed = 346
  sketchEllipse(ctx, x + 26, ground - 136, 17, 9, HELMET)
  if (ringing) {
    DING.size = shoutSize(26, timeMs)
    DING.seed = 347 + boil
    sketchText(ctx, 'DING!', x + 40, ground - 170, DING)
  }
}

/**
 * The bell's warning at the left edge of the view while a bike comes up behind you:
 * "DING DING!", a bell and an arrow pointing the way it rides.
 */
export function drawBellWarning(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeMs: number
): void {
  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(timeMs / 120))
  ctx.globalAlpha = pulse
  DING.size = shoutSize(30, timeMs)
  DING.seed = 348 + boilSeed(timeMs)
  sketchText(ctx, 'DING DING!', x + 70, y, DING)
  bell[0] = x + 6
  bell[1] = y + 50
  bell[2] = x + 18
  bell[3] = y + 22
  bell[4] = x + 30
  bell[5] = y + 50
  BELL.seed = 349
  sketchPolygon(ctx, bell, BELL)
  FRAME.seed = 350
  FRAME.width = 5
  sketchLine(ctx, x + 40, y + 40, x + 120, y + 40, FRAME)
  sketchLine(ctx, x + 120, y + 40, x + 104, y + 30, FRAME)
  sketchLine(ctx, x + 120, y + 40, x + 104, y + 50, FRAME)
  FRAME.width = 4
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- Speech bubbles

const BUBBLE: SketchStyle = { fill: palette.paper, width: 2.5, wobble: 1.2 }
const BUBBLE_TEXT: SketchTextStyle = {
  font: 'hand',
  size: 22,
  color: palette.ink
}
const BUBBLE_LINE = 24
const BUBBLE_MAX = 230
const tail = new Float64Array(6)

interface Wrapped {
  lines: string[]
  width: number
}

/** Wrapped lines per bubble text. Neighbours say a handful of lines, so this stays small. */
const wrapped = new Map<string, Wrapped>()

function wrap(ctx: CanvasRenderingContext2D, text: string): Wrapped {
  const cached = wrapped.get(text)
  if (cached) return cached
  ctx.font = `${BUBBLE_TEXT.size}px ${FONT_HAND}`
  const lines: string[] = []
  let width = 0
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > BUBBLE_MAX) {
      lines.push(line)
      width = Math.max(width, ctx.measureText(line).width)
      line = word
    } else line = next
  }
  lines.push(line)
  width = Math.max(width, ctx.measureText(line).width)
  const out = { lines, width }
  wrapped.set(text, out)
  return out
}

/**
 * A wobbly speech bubble centred on (x, y) with a tail pointing at (tailX, tailY), the
 * speaker's mouth. Long lines wrap.
 */
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tailX: number,
  tailY: number,
  seed: number
): void {
  const { lines, width } = wrap(ctx, text)
  const w = width + 28
  const h = lines.length * BUBBLE_LINE + 16
  const bottom = y + h / 2
  tail[0] = x - 14
  tail[1] = bottom - 3
  tail[2] = tailX
  tail[3] = tailY
  tail[4] = x + 6
  tail[5] = bottom - 3
  BUBBLE.seed = seed
  sketchPolygon(ctx, tail, BUBBLE)
  sketchRoundRect(ctx, x - w / 2, y - h / 2, w, h, 14, BUBBLE)
  for (let i = 0; i < lines.length; i++)
    sketchText(
      ctx,
      lines[i]!,
      x,
      y - ((lines.length - 1) * BUBBLE_LINE) / 2 + i * BUBBLE_LINE,
      BUBBLE_TEXT
    )
}
