import {
  GOSSIP_BEAN_SPACING,
  GOSSIP_LETTER_HEIGHT,
  GOSSIP_MAX_WIDTH
} from './tuning'

/**
 * A hand-made stroke font for gossip spelled in beans. Each letter is a few polylines on a
 * 4 by 6 grid (x right, y down). Beans sit along the strokes one spacing apart, turned
 * along the stroke, so a line's bean count is exact and the letters read at phone size.
 */

type Stroke = readonly number[]

/** Letter strokes as flat [x0, y0, x1, y1, ...] polylines on the 4 by 6 grid. */
const LETTERS: Record<string, readonly Stroke[]> = {
  A: [
    [0, 6, 2, 0, 4, 6],
    [1, 4, 3, 4]
  ],
  B: [
    [0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3],
    [3, 3, 4, 4, 4, 5, 3, 6, 0, 6]
  ],
  C: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5]],
  D: [[0, 0, 0, 6, 2, 6, 4, 4, 4, 2, 2, 0, 0, 0]],
  E: [
    [4, 0, 0, 0, 0, 6, 4, 6],
    [0, 3, 3, 3]
  ],
  F: [
    [4, 0, 0, 0, 0, 6],
    [0, 3, 3, 3]
  ],
  G: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 3, 2, 3]],
  H: [
    [0, 0, 0, 6],
    [4, 0, 4, 6],
    [0, 3, 4, 3]
  ],
  I: [
    [2, 0, 2, 6],
    [0.5, 0, 3.5, 0],
    [0.5, 6, 3.5, 6]
  ],
  J: [[4, 0, 4, 5, 3, 6, 1, 6, 0, 5]],
  K: [
    [0, 0, 0, 6],
    [4, 0, 0, 3.5],
    [1.4, 2.6, 4, 6]
  ],
  L: [[0, 0, 0, 6, 4, 6]],
  M: [[0, 6, 0, 0, 2, 3, 4, 0, 4, 6]],
  N: [[0, 6, 0, 0, 4, 6, 4, 0]],
  O: [[1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0]],
  P: [[0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3]],
  Q: [
    [1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0],
    [2.6, 4.6, 4, 6]
  ],
  R: [
    [0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3],
    [2, 3, 4, 6]
  ],
  S: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 2, 1, 3, 3, 3, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5]],
  T: [
    [0, 0, 4, 0],
    [2, 0, 2, 6]
  ],
  U: [[0, 0, 0, 5, 1, 6, 3, 6, 4, 5, 4, 0]],
  V: [[0, 0, 2, 6, 4, 0]],
  W: [[0, 0, 1, 6, 2, 3, 3, 6, 4, 0]],
  X: [
    [0, 0, 4, 6],
    [4, 0, 0, 6]
  ],
  Y: [
    [0, 0, 2, 3, 4, 0],
    [2, 3, 2, 6]
  ],
  Z: [[0, 0, 4, 0, 0, 6, 4, 6]],
  "'": [[2, 0, 2, 1.6]],
  // A letter of Grandma's secret you haven't earned yet.
  _: [[0.6, 6, 3.4, 6]]
}

/** Gap between letters in grid units, wide enough that edge beans of neighbours don't touch. */
const LETTER_GAP = 1.8

/** Letter width in grid units, and how wide an apostrophe sits. */
const NARROW: Record<string, number> = { "'": 1.6 }

/** How a line of gossip is laid out in beans. */
export interface FontOptions {
  /** Letter height in u. */
  height: number
  /** Distance between beans along a stroke, in u. */
  spacing: number
  /** Widest row, in u. Words wrap to new rows. */
  maxWidth: number
  /** The middle of the block, in u. */
  centerX: number
  centerY: number
}

export const GOSSIP_FONT: FontOptions = {
  height: GOSSIP_LETTER_HEIGHT,
  spacing: GOSSIP_BEAN_SPACING,
  maxWidth: GOSSIP_MAX_WIDTH,
  centerX: 300,
  centerY: 220
}

/** Beans laid out for one line: x, y and angle per bean, and the rows it wrapped to. */
export interface LaidLine {
  /** x, y, angle per bean. */
  beans: Float32Array
  count: number
  rows: string[]
}

/** Width of one word in u, letters and gaps included. */
function wordWidth(word: string, unit: number): number {
  let width = 0
  for (const ch of word) width += ((NARROW[ch] ?? 4) + LETTER_GAP) * unit
  return Math.max(0, width - LETTER_GAP * unit)
}

/** Splits a line into rows no wider than `maxWidth`. */
export function wrapRows(text: string, options: FontOptions): string[] {
  const unit = options.height / 6
  // A word ends without its letter gap, so the gap between words is that gap plus a space.
  const space = (LETTER_GAP + 2.6) * unit
  const rows: string[] = []
  let row = ''
  let width = 0
  for (const word of text.split(' ')) {
    const w = wordWidth(word, unit)
    if (row && width + space + w > options.maxWidth) {
      rows.push(row)
      row = word
      width = w
    } else {
      width = row ? width + space + w : w
      row = row ? `${row} ${word}` : word
    }
  }
  if (row) rows.push(row)
  return rows
}

/** Places beans along one letter's strokes at (left, top), skipping beans that would sit on top of another. */
function placeLetter(
  ch: string,
  left: number,
  top: number,
  unit: number,
  spacing: number,
  out: number[]
): void {
  const strokes = LETTERS[ch]
  if (!strokes) return
  const start = out.length
  const tooClose = spacing * 0.55
  for (const stroke of strokes) {
    const points = stroke.length / 2
    let length = 0
    for (let i = 1; i < points; i++)
      length += Math.hypot(
        ((stroke[i * 2] as number) - (stroke[i * 2 - 2] as number)) * unit,
        ((stroke[i * 2 + 1] as number) - (stroke[i * 2 - 1] as number)) * unit
      )
    const steps = Math.max(1, Math.round(length / spacing))
    for (let k = 0; k <= steps; k++) {
      // Walk the polyline to arc length k * length / steps.
      let along = (k * length) / steps
      for (let i = 1; i < points; i++) {
        const x0 = (stroke[i * 2 - 2] as number) * unit
        const y0 = (stroke[i * 2 - 1] as number) * unit
        const x1 = (stroke[i * 2] as number) * unit
        const y1 = (stroke[i * 2 + 1] as number) * unit
        const seg = Math.hypot(x1 - x0, y1 - y0)
        if (along > seg + 1e-6 && i < points - 1) {
          along -= seg
          continue
        }
        const t = seg > 0 ? Math.min(1, along / seg) : 0
        const x = left + x0 + (x1 - x0) * t
        const y = top + y0 + (y1 - y0) * t
        let clash = false
        for (let j = start; j < out.length; j += 3)
          if (
            Math.hypot((out[j] as number) - x, (out[j + 1] as number) - y) <
            tooClose
          ) {
            clash = true
            break
          }
        if (!clash) out.push(x, y, Math.atan2(y1 - y0, x1 - x0))
        break
      }
    }
  }
}

/** Lays out a line of gossip in beans, centred on the options' centre. */
export function layoutLine(
  text: string,
  options: FontOptions = GOSSIP_FONT
): LaidLine {
  const unit = options.height / 6
  const rows = wrapRows(text, options)
  const rowGap = options.height * 0.5
  const blockHeight = rows.length * options.height + (rows.length - 1) * rowGap
  const out: number[] = []
  rows.forEach((row, r) => {
    const width =
      wordWidth(row.replaceAll(' ', ''), unit) +
      (row.split(' ').length - 1) * 2.6 * unit
    let left = options.centerX - width / 2
    const top =
      options.centerY - blockHeight / 2 + r * (options.height + rowGap)
    for (const ch of row) {
      if (ch === ' ') {
        left += 2.6 * unit
        continue
      }
      placeLetter(ch, left, top, unit, options.spacing, out)
      left += ((NARROW[ch] ?? 4) + LETTER_GAP) * unit
    }
  })
  return { beans: Float32Array.from(out), count: out.length / 3, rows }
}

/** How many beans a line needs. */
export function beansNeeded(text: string): number {
  return layoutLine(text).count
}
