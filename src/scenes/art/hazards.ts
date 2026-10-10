import { groundY, type StretchDef } from '../../game/route'
import { DRAIN_HALF, KERB_WIDTH, STAIR_TREAD } from '../../game/tuning'
import {
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchRect,
  sketchRoundRect,
  type SketchStyle
} from '../../shared'
import { colors } from './colors'
import { paintWet } from './park'

const HOLE: SketchStyle = { fill: colors.hole, width: 2.5, wobble: 2 }
const HOLE_RIM: SketchStyle = {
  color: colors.roadDark,
  width: 2,
  wobble: 1.5,
  passes: 1
}
const COBBLE: SketchStyle = {
  fill: colors.kerbStone,
  width: 1.8,
  wobble: 1.2,
  passes: 1,
  color: palette.inkSoft
}
const KERB: SketchStyle = { fill: colors.kerbStone, width: 2.5, wobble: 1 }
const NOSING: SketchStyle = { width: 3, wobble: 0.8, passes: 1 }
const RUG: SketchStyle = {
  fill: palette.red,
  fillStyle: 'hatch',
  hatchGap: 7,
  hatchAngle: Math.PI / 2,
  width: 2.5,
  wobble: 1.2
}
const FRINGE: SketchStyle = {
  width: 1.5,
  wobble: 0.5,
  passes: 1,
  color: palette.yellow
}
const CURL: SketchStyle & { smooth: boolean } = {
  width: 4,
  wobble: 0.8,
  passes: 1,
  color: palette.red,
  smooth: true
}
const curl = new Float64Array(8)
const PUDDLE: SketchStyle = {
  fill: 'rgba(116, 192, 252, 0.85)',
  color: colors.riverDeep,
  width: 2.5,
  wobble: 1.5
}
const PUDDLE_SHINE: SketchStyle = {
  color: palette.paper,
  width: 2.5,
  wobble: 0.6,
  passes: 1
}
const GRATE: SketchStyle = { fill: '#343a40', width: 2.5, wobble: 0.8 }
const GRATE_BAR: SketchStyle = {
  color: '#adb5bd',
  width: 2.5,
  wobble: 0.4,
  passes: 1
}

/** How far past a tile's edges hazards still paint, so shapes cut by the edge line up. */
const OVERLAP = 80
/** Distance between cobble columns, in u. */
const COBBLE_GAP = 22

/**
 * Paints the static ground hazards between route x `left` and `right`: potholes, cobbles,
 * kerb edges, stair nosings, the hall rug, drains, puddles and wet grass. Each has a fixed seed, so the halves painted
 * by neighbouring tiles match.
 */
export function paintHazards(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  left: number,
  right: number
): void {
  const lo = left - OVERLAP
  const hi = right + OVERLAP
  for (const span of def.cobbles) {
    // Cobbles sit on a fixed grid from the span start, so neighbouring tiles line up.
    const skip = Math.max(0, Math.ceil((lo - span.from) / COBBLE_GAP))
    paintCobbles(ctx, def, span.from + skip * COBBLE_GAP, Math.min(span.to, hi))
  }
  for (const bump of def.bumps) {
    if (bump.x < lo || bump.x > hi) continue
    const y = groundY(def, bump.x)
    if (bump.kind === 'pothole') paintPothole(ctx, bump.x, y)
    else if (bump.kind === 'kerb') paintKerbCrossing(ctx, def, bump.x)
    else if (bump.kind === 'stair') paintStairNosing(ctx, def, bump.x)
    else paintRug(ctx, bump.x, y)
  }
  for (const drain of def.drains)
    if (drain >= lo && drain <= hi) paintDrain(ctx, drain, groundY(def, drain))
  for (const puddle of def.puddles)
    if (puddle.to >= lo && puddle.from <= hi)
      paintPuddle(ctx, puddle.from, puddle.to, groundY(def, puddle.from))
  for (const wet of def.wet)
    if (wet.to >= lo && wet.from <= hi)
      paintWet(ctx, wet.from, wet.to, groundY(def, wet.from))
}

/** A puddle lying flat on the walking line from `from` to `to`, with two glints. */
function paintPuddle(
  ctx: CanvasRenderingContext2D,
  from: number,
  to: number,
  y: number
) {
  const x = (from + to) / 2
  const half = (to - from) / 2
  PUDDLE.seed = Math.round(from)
  sketchEllipse(ctx, x, y - 1, half, 10, PUDDLE)
  PUDDLE_SHINE.seed = Math.round(from) + 1
  sketchLine(ctx, x - half * 0.55, y - 5, x - half * 0.2, y - 7, PUDDLE_SHINE)
  sketchLine(ctx, x + half * 0.2, y + 3, x + half * 0.45, y + 2, PUDDLE_SHINE)
}

/** A drain grate in the pavement, flat on the walking line, with its bars. */
function paintDrain(ctx: CanvasRenderingContext2D, x: number, y: number) {
  GRATE.seed = Math.round(x)
  sketchRoundRect(ctx, x - DRAIN_HALF, y - 9, DRAIN_HALF * 2, 16, 4, GRATE)
  for (let bx = x - DRAIN_HALF + 7; bx < x + DRAIN_HALF - 2; bx += 8) {
    GRATE_BAR.seed = Math.round(bx)
    sketchLine(ctx, bx, y - 6, bx - 3, y + 4, GRATE_BAR)
  }
}

/** A dark hole in the walking line with a broken rim, so it reads from a distance. */
function paintPothole(ctx: CanvasRenderingContext2D, x: number, y: number) {
  HOLE.seed = Math.round(x)
  sketchEllipse(ctx, x, y + 3, 32, 9, HOLE)
  HOLE_RIM.seed = Math.round(x) + 1
  sketchLine(ctx, x - 40, y - 4, x - 30, y - 1, HOLE_RIM)
  sketchLine(ctx, x + 30, y + 8, x + 44, y + 12, HOLE_RIM)
  sketchLine(ctx, x - 6, y - 7, x + 10, y - 9, HOLE_RIM)
}

/** Rows of round cobbles across the walking band, from route x `from` to `to`. */
function paintCobbles(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  from: number,
  to: number
) {
  for (let x = from; x < to; x += COBBLE_GAP) {
    const ground = groundY(def, x)
    for (let row = 0; row < 4; row++) {
      const cx = x + (row % 2) * (COBBLE_GAP / 2)
      COBBLE.seed = Math.round(cx * 7 + row)
      sketchCircle(ctx, cx, ground - 26 + row * 15, 8.5, COBBLE)
    }
  }
}

/** The two kerb stones of a side-road crossing. `x` is the far kerb, the one that kicks. */
function paintKerbCrossing(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  x: number
) {
  const near = x - KERB_WIDTH
  const low = groundY(def, near + 20)
  KERB.seed = Math.round(x)
  sketchRect(ctx, near - 8, low - 40, 10, 66, KERB)
  sketchRect(ctx, x - 2, low - 40, 10, 66, KERB)
  // Give-way lines on the dipped road.
  sketchLine(ctx, near + 30, low + 14, near + 50, low + 14, {
    color: palette.paper,
    width: 4,
    passes: 1,
    seed: Math.round(x) + 1
  })
  sketchLine(ctx, near + 80, low + 14, near + 100, low + 14, {
    color: palette.paper,
    width: 4,
    passes: 1,
    seed: Math.round(x) + 2
  })
}

/** A dark edge on the stair the riser at `x` steps onto. */
function paintStairNosing(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  x: number
) {
  const y = groundY(def, x + 4) - 36
  NOSING.seed = Math.round(x)
  sketchLine(ctx, x, y, x + STAIR_TREAD - 6, y, NOSING)
  sketchLine(ctx, x, y, x, y + 30, NOSING)
}

/** The hall rug, lying behind its curled-up front edge at `x`. */
function paintRug(ctx: CanvasRenderingContext2D, x: number, y: number) {
  RUG.seed = Math.round(x)
  sketchRect(ctx, x - 150, y - 22, 150, 30, RUG)
  FRINGE.seed = Math.round(x) + 1
  for (let k = 0; k < 6; k++)
    sketchLine(ctx, x - 154, y - 18 + k * 5, x - 164, y - 18 + k * 5, FRINGE)
  // The curled edge sticks up where your toe catches it.
  curl[0] = x - 6
  curl[1] = y + 8
  curl[2] = x + 4
  curl[3] = y - 10
  curl[4] = x + 14
  curl[5] = y - 8
  curl[6] = x + 10
  curl[7] = y + 2
  CURL.seed = Math.round(x) + 2
  sketchPath(ctx, curl, CURL)
}
