import type { Caption } from '../game/fx'
import { clamp, palette, sketchText, type SketchTextStyle } from '../shared'

const TONE_COLOR = {
  bad: palette.red,
  good: palette.green,
  info: palette.ink
} as const

const HEAD: SketchTextStyle = {
  font: 'marker',
  size: 30,
  outline: palette.paper,
  maxWidth: 400
}
const SUB: SketchTextStyle = {
  font: 'hand',
  size: 24,
  outline: palette.paper,
  color: palette.ink,
  maxWidth: 400
}
const SCORE: SketchTextStyle = {
  font: 'marker',
  size: 22,
  outline: palette.paper,
  color: palette.ink,
  maxWidth: 400
}

/** The highest a stack of captions may reach: the oldest headline's centre, in u below the view's top. */
export const CAPTION_TOP = 30

/**
 * Draws captions with a pop-in, a slow rise and a fade: the headline, an optional smaller
 * line, and an optional running score. The newest sits at its spot and older ones stack
 * above it. Call with the transform the captions' coordinates use: the camera for world
 * captions, the plain viewport otherwise. `minX` and `maxX` keep them on screen, and the
 * whole stack moves down when the oldest headline would rise above `minY`.
 */
export function drawCaptions(
  ctx: CanvasRenderingContext2D,
  captions: readonly Caption[],
  minX: number,
  maxX: number,
  minY = -Infinity
): void {
  const newest = captions[captions.length - 1]
  if (!newest) return
  let above = 0
  for (let i = 0; i < captions.length - 1; i++)
    above += captionHeight(captions[i] as Caption)
  const shift = Math.max(0, minY - (newest.y - above))
  let stack = 0
  for (let i = captions.length - 1; i >= 0; i--) {
    const caption = captions[i] as Caption
    // An older caption sits above the newer one by its own height, so its smaller lines
    // and score end above the newer headline.
    if (i < captions.length - 1) stack += captionHeight(caption)
    const t = caption.ageMs
    const pop = t < 160 ? 0.7 + 0.3 * (t / 160) : 1
    const fade = Math.min(1, (caption.lifeMs - t) / 400)
    const rise = (t / caption.lifeMs) * 14
    const x = clamp(caption.x, minX + 200, maxX - 200)
    const y = caption.y - stack - rise + shift
    HEAD.color = TONE_COLOR[caption.tone]
    HEAD.size = 30 * pop
    HEAD.alpha = fade
    HEAD.seed = Math.floor(caption.x + caption.lifeMs)
    HEAD.tilt = 0.05
    sketchText(ctx, caption.text, x, y, HEAD)
    let below = y + 30
    if (caption.sub) {
      SUB.alpha = fade
      SUB.size = 24 * pop
      sketchText(ctx, caption.sub, x, below, SUB)
      below += 28
    }
    // The running score, such as "Ladder: 2. You: 0.", sits under everything else.
    if (caption.score) {
      SCORE.alpha = fade
      SCORE.size = 22 * pop
      SCORE.seed = HEAD.seed + 1
      sketchText(ctx, caption.score, x, below, SCORE)
    }
  }
}

/** Room one caption takes: the headline, then its smaller line and score if it has them. */
function captionHeight(caption: Caption): number {
  return 44 + (caption.sub ? 30 : 0) + (caption.score ? 28 : 0)
}
