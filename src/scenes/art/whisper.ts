import { layoutLine, type FontOptions } from '../../game/gossipFont'
import {
  palette,
  setSketchScale,
  sketchLine,
  sketchRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { paintBean } from './bean'

/** The front page's size in pixels, which is also its drawing units. */
export const WHISPER_W = 960
export const WHISPER_H = 720

const PAGE: SketchStyle = { fill: '#fffdf5', width: 4, wobble: 2 }
const RULE: SketchStyle = { width: 4, wobble: 1.5, passes: 1 }
const MASTHEAD: SketchTextStyle = {
  font: 'marker',
  size: 64,
  color: palette.ink,
  seed: 801,
  tilt: 0.02
}
const DATELINE: SketchTextStyle = {
  font: 'hand',
  size: 30,
  color: palette.inkSoft,
  seed: 802
}
const STAMP: SketchTextStyle = {
  font: 'marker',
  size: 26,
  color: palette.red,
  rotate: -0.2,
  seed: 803
}
const QUIP: SketchTextStyle = {
  font: 'hand',
  size: 40,
  color: palette.ink,
  seed: 804,
  maxWidth: 860
}
const STAMP_BOX: SketchStyle = {
  width: 4,
  wobble: 1.2,
  passes: 1,
  color: palette.red
}

/** The headline in beans: big letters across the middle of the page. */
const HEADLINE: FontOptions = {
  height: 80,
  spacing: 30,
  maxWidth: 860,
  centerX: WHISPER_W / 2,
  centerY: 375
}

/**
 * Draws a Weekly Whisper front page with a gossip line spelled out in beans and the
 * editor's verdict, for a share card. Returns a new canvas; free it after sharing.
 */
export function drawWhisperPage(
  line: string,
  quip: string,
  page: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = WHISPER_W
  canvas.height = WHISPER_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  setSketchScale(ctx, 1)
  ctx.fillStyle = '#f1ead8'
  ctx.fillRect(0, 0, WHISPER_W, WHISPER_H)
  PAGE.seed = 800 + page
  sketchRect(ctx, 24, 24, WHISPER_W - 48, WHISPER_H - 48, PAGE)
  sketchText(ctx, 'The Weekly Whisper', 450, 96, MASTHEAD)
  RULE.seed = 805
  sketchLine(ctx, 60, 150, WHISPER_W - 60, 150, RULE)
  sketchText(
    ctx,
    `Page ${page}. Spelled out in beans on the pavement.`,
    WHISPER_W / 2,
    180,
    DATELINE
  )
  STAMP_BOX.seed = 806
  ctx.save()
  ctx.translate(850, 74)
  ctx.rotate(-0.2)
  sketchRect(ctx, -72, -22, 144, 44, STAMP_BOX)
  ctx.restore()
  sketchText(ctx, 'EXCLUSIVE', 850, 74, STAMP)
  const laid = layoutLine(line, HEADLINE)
  for (let i = 0; i < laid.count; i++) {
    const o = i * 3
    ctx.save()
    ctx.translate(laid.beans[o] as number, laid.beans[o + 1] as number)
    ctx.rotate(laid.beans[o + 2] as number)
    paintBean(ctx, 13, 8, 820 + (i % 7))
    ctx.restore()
  }
  sketchLine(ctx, 60, 560, WHISPER_W - 60, 560, RULE)
  sketchText(ctx, `"${quip}" says our editor.`, WHISPER_W / 2, 620, QUIP)
  return canvas
}
