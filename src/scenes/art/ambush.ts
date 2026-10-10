import {
  boilSeed,
  palette,
  sketchCircle,
  sketchLine,
  sketchPolygon,
  sketchRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { colors } from './colors'
import { shoutSize } from './shout'

const CURTAIN: SketchStyle = { fill: palette.pink, width: 1.5, wobble: 1 }
const EYE: SketchStyle = { fill: palette.paper, width: 2, wobble: 0.6 }
const PUPIL: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.3 }
const SIGN: SketchStyle = { fill: palette.red, width: 3, wobble: 1.2 }
const SIGN_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 30,
  color: palette.paper,
  rotate: -0.08
}
const LEAD: SketchStyle = {
  color: palette.red,
  width: 3,
  wobble: 1.2,
  passes: 1
}
const SNORE: SketchTextStyle = {
  font: 'marker',
  size: 20,
  color: palette.inkSoft
}
const flap = new Float64Array(6)

/**
 * Mrs Pryce's tell: her ground-floor curtain twitches open and two eyes watch you go by.
 * `rect` is the window as [x, y, w, h].
 */
export function drawCurtainTwitch(
  ctx: CanvasRenderingContext2D,
  rect: readonly [number, number, number, number],
  timeMs: number
): void {
  const [x, y, w, h] = rect
  const open = 0.5 + 0.5 * Math.sin(timeMs / 140)
  // The dark gap between the curtains, then her eyes in it.
  sketchRect(ctx, x + w * 0.42, y + 4, w * 0.16 + open * 8, h - 8, {
    fill: '#343a40',
    width: 0,
    wobble: 0.5,
    seed: 900
  })
  const eyeX = x + w * 0.5 + open * 4
  const look = Math.sin(timeMs / 400) * 1.5
  for (const dx of [-5, 5]) {
    EYE.seed = 901
    sketchCircle(ctx, eyeX + dx, y + h * 0.4, 4.5, EYE)
    PUPIL.seed = 902
    sketchCircle(ctx, eyeX + dx + 1.5 + look, y + h * 0.4, 2, PUPIL)
  }
  flap[0] = x + w * 0.42
  flap[1] = y + 2
  flap[2] = x + w * 0.42 - 10 - open * 6
  flap[3] = y + h * 0.5
  flap[4] = x + w * 0.42
  flap[5] = y + h - 2
  CURTAIN.seed = 903 + boilSeed(timeMs)
  sketchPolygon(ctx, flap, CURTAIN)
}

/**
 * The sale's placard over the stall at route x, its awning top at `top`. It goes up as
 * you come near and flashes while the stampede gathers.
 */
export function drawSaleSign(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  flashing: boolean,
  timeMs: number
): void {
  const lit = !flashing || Math.sin(timeMs / 90) > -0.3
  SIGN.fill = lit ? palette.red : colors.brickDark
  SIGN.seed = 910
  sketchRect(ctx, x + 40, top - 66, 140, 52, SIGN)
  sketchLine(ctx, x + 70, top - 14, x + 70, top, { width: 3, seed: 911 })
  sketchLine(ctx, x + 150, top - 14, x + 150, top, { width: 3, seed: 912 })
  sketchText(ctx, 'SALE!', x + 110, top - 40, {
    ...SIGN_TEXT,
    size: flashing ? shoutSize(30, timeMs) : 30,
    seed: 913
  })
}

/** Bruno's long red lead, from the bench leg at (x0, y0) to his collar at (x1, y1). */
export function drawLead(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  timeMs: number
): void {
  // It sags when slack, between the bench and the collar.
  const sag = Math.max(8, 40 - Math.abs(x1 - x0) * 0.25)
  const mx = (x0 + x1) / 2
  const my = Math.max(y0, y1) + sag
  LEAD.seed = 920 + boilSeed(timeMs)
  sketchLine(ctx, x0, y0, mx, my, LEAD)
  sketchLine(ctx, mx, my, x1, y1, LEAD)
}

/** "Zzz" rising over Bruno while he sleeps, the tell that he's there. */
export function drawSnore(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeMs: number
): void {
  const t = (timeMs % 1800) / 1800
  ctx.globalAlpha = 1 - t
  sketchText(ctx, 'Zzz', x + t * 20, y - t * 40, { ...SNORE, seed: 930 })
  ctx.globalAlpha = 1
}
