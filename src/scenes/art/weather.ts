import { GUST_WARN_MS, POUR_GOOD_FROM, POUR_GOOD_TO } from '../../game/tuning'
import type { Gust } from '../../game/weather'
import {
  hash01,
  palette,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'

/** Rain streaks drawn at once, across whatever the camera sees. */
const DROPS = 70
/** Leaves streaming past during a gust. */
const LEAVES = 16
const LEAF_COLORS = [palette.green, palette.orange, palette.yellow, '#8ce99a']

const LEAF: SketchStyle = { width: 1.5, wobble: 0.4 }
const STREAM: SketchStyle & { closed: boolean; smooth: boolean } = {
  color: 'rgba(77, 171, 247, 0.85)',
  width: 7,
  wobble: 1.5,
  passes: 1,
  closed: false,
  smooth: true
}
const DROPLET: SketchStyle = { fill: 'rgba(116, 192, 252, 0.8)', width: 0 }
const BAR: SketchStyle = { width: 3, wobble: 0.8 }
const ZONE: SketchStyle = { width: 0, wobble: 0.5 }
const NEEDLE: SketchStyle = {
  color: palette.ink,
  width: 4,
  wobble: 0.3,
  passes: 1
}
const LABEL: SketchTextStyle = {
  font: 'hand',
  size: 18,
  color: palette.ink,
  outline: palette.paper
}
const stream = new Float64Array(2 * 10)

/**
 * Rain streaks over the area from (left, top), `width` by `height` in world units,
 * falling and blown sideways by `wind` (-1 to 1). Plain canvas lines, one stroke.
 */
export function drawRain(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  wind: number,
  timeMs: number
): void {
  const t = timeMs / 1000
  const slant = 10 + wind * 26
  ctx.save()
  ctx.strokeStyle = 'rgba(66, 118, 196, 0.5)'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < DROPS; i++) {
    const fall = 640 + hash01(i, 3) * 220
    const y = top + ((hash01(i, 1) * height + t * fall) % height)
    const x =
      left +
      ((((hash01(i, 2) * width + y * (slant / 30)) % width) + width) % width)
    ctx.moveTo(x, y)
    ctx.lineTo(x + slant * 0.6, y + 22)
  }
  ctx.stroke()
  ctx.restore()
}

/**
 * Leaves blowing across the view from the windward edge while a gust warns and blows:
 * a few at first, then a stream, so you can see it coming.
 */
export function drawLeaves(
  ctx: CanvasRenderingContext2D,
  gust: Gust,
  left: number,
  right: number,
  top: number,
  ground: number
): void {
  const t = (gust.phase === 'warn' ? gust.ms : GUST_WARN_MS + gust.ms) / 1000
  const span = right - left + 120
  for (let i = 0; i < LEAVES; i++) {
    // Leaves join the stream one by one through the warning.
    const start = hash01(i, 11) * 1.1
    if (t < start) continue
    const speed = 480 + hash01(i, 12) * 260
    const travel = ((t - start) * speed) % span
    const x = gust.side > 0 ? left - 60 + travel : right + 60 - travel
    const band = top + 60 + hash01(i, 13) * Math.max(80, ground - top - 120)
    const y = band + Math.sin(t * 5 + i) * 22
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(t * (4 + i) * gust.side)
    LEAF.fill = LEAF_COLORS[i % LEAF_COLORS.length]
    LEAF.seed = i
    sketchEllipse(ctx, 0, 0, 8, 4, LEAF)
    ctx.restore()
  }
}

/**
 * Water pouring from the pot's front rim at (x, y) down to the ground, thicker as you
 * tip further. Past the green, beans tumble out with it.
 */
export function drawPourStream(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ground: number,
  level: number,
  timeMs: number,
  bean: (x: number, y: number, angle: number) => void
): void {
  if (level < 0.12) return
  const reach = 20 + level * 50
  const n = stream.length / 2
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1)
    stream[i * 2] = x + reach * Math.sqrt(k) + Math.sin(timeMs / 70 + i) * 1.5
    stream[i * 2 + 1] = y + (ground - y) * k
  }
  STREAM.width = 3 + level * 6
  STREAM.seed = Math.floor(timeMs / 120)
  sketchPath(ctx, stream, STREAM)
  for (let i = 0; i < 4; i++) {
    const a = (timeMs / 140 + i * 1.7) % 1
    DROPLET.seed = i
    sketchEllipse(
      ctx,
      x + reach + (i - 1.5) * 10 * a,
      ground - 10 * Math.sin(a * Math.PI),
      3,
      2,
      DROPLET
    )
  }
  if (level <= POUR_GOOD_TO) return
  for (let i = 0; i < 3; i++) {
    const k = (timeMs / 500 + i / 3) % 1
    bean(x + reach * Math.sqrt(k), y + (ground - y) * k, timeMs / 90 + i)
  }
}

/**
 * The Pour Off meter over the pot at (x, y): too little in blue, the green to let go in,
 * and red where beans go too, with a needle at `level`.
 */
export function drawPourMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  level: number
): void {
  const w = 150
  const h = 18
  const left = x - w / 2
  ZONE.fill = 'rgba(116, 192, 252, 0.8)'
  ZONE.seed = 1
  sketchRect(ctx, left, y, w * POUR_GOOD_FROM, h, ZONE)
  ZONE.fill = palette.green
  ZONE.seed = 2
  sketchRect(
    ctx,
    left + w * POUR_GOOD_FROM,
    y,
    w * (POUR_GOOD_TO - POUR_GOOD_FROM),
    h,
    ZONE
  )
  ZONE.fill = palette.red
  ZONE.seed = 3
  sketchRect(ctx, left + w * POUR_GOOD_TO, y, w * (1 - POUR_GOOD_TO), h, ZONE)
  BAR.seed = 4
  sketchRect(ctx, left, y, w, h, BAR)
  const nx = left + w * Math.min(1, level)
  NEEDLE.seed = 5
  sketchLine(ctx, nx, y - 8, nx, y + h + 8, NEEDLE)
  LABEL.seed = 6
  sketchText(ctx, 'Let go in the green', x, y - 18, LABEL)
}
