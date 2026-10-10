import {
  palette,
  sketchArrow,
  sketchLine,
  sketchPolygon,
  sketchRect,
  sketchText,
  type SketchStyle
} from '../../shared'
import { colors } from './colors'

const POST: SketchStyle = { fill: colors.brick, width: 3 }
const PANEL: SketchStyle = {
  fill: palette.green,
  fillStyle: 'hatch',
  hatchGap: 9,
  width: 3
}
const BAR: SketchStyle = { width: 4, passes: 1 }
const ARROW: SketchStyle & { head: number } = {
  color: palette.red,
  width: 6,
  head: 24
}
const FRAME: SketchStyle = { color: colors.woodDark, width: 9, wobble: 1 }
const DOOR: SketchStyle = { fill: colors.wood, width: 3, wobble: 1.2 }
const DAYLIGHT: SketchStyle = { fill: '#fff3bf', width: 0, wobble: 1 }
const swung = new Float64Array(8)

/** How the gate looks: a garden gate, or your front door scrawled "OUT". */
export type GateKind = 'gate' | 'door'

/**
 * Draws the stretch-end gate at route x, standing on the ground at y `ground`. Shut, it
 * wobbles when you push on it and an arrow points back at the beans; open, it swings
 * aside.
 */
export function drawGate(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  open: boolean,
  wobbleMs: number,
  arrowMs: number,
  timeMs: number,
  kind: GateKind = 'gate'
): void {
  const top = ground - 130
  const wobble = wobbleMs > 0 ? Math.sin(timeMs / 24) * (wobbleMs / 500) * 6 : 0
  if (kind === 'door') drawDoor(ctx, x, ground, open, wobble)
  else {
    POST.seed = 80
    sketchRect(ctx, x - 64, top - 16, 20, 146, POST)
    sketchRect(ctx, x + 44, top - 16, 20, 146, POST)
    PANEL.seed = 81
    BAR.seed = 82
    if (open) {
      // Swung open: the panel seen edge-on beside the right post.
      sketchRect(ctx, x + 64, top, 18, 120, PANEL)
    } else {
      sketchRect(ctx, x - 44 + wobble, top, 88, 120, PANEL)
      sketchLine(ctx, x - 44 + wobble, top + 30, x + 44 + wobble, top + 30, BAR)
      sketchLine(ctx, x - 44 + wobble, top + 90, x + 44 + wobble, top + 90, BAR)
    }
    sketchText(ctx, open ? 'OPEN' : 'SHUT', x, top - 34, {
      font: 'marker',
      size: 22,
      color: open ? palette.green : palette.red,
      outline: palette.paper,
      seed: 83
    })
  }
  if (arrowMs > 0 && !open) {
    const nudge = Math.sin(timeMs / 90) * 8
    const arrowY = kind === 'door' ? ground - 290 : top - 110
    ARROW.seed = 84
    sketchArrow(ctx, x - 70 + nudge, arrowY, x - 230 + nudge, arrowY, ARROW)
  }
}

/** Your front door: shut with "OUT" scrawled on it, or swung open onto daylight. */
function drawDoor(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  open: boolean,
  wobble: number
): void {
  const top = ground - 250
  const left = x - 50
  if (open) {
    DAYLIGHT.seed = 85
    sketchRect(ctx, left, top, 100, 250, DAYLIGHT)
    // The door swung into the hall, seen almost edge-on.
    swung[0] = left
    swung[1] = top
    swung[2] = left - 34
    swung[3] = top + 18
    swung[4] = left - 34
    swung[5] = ground + 10
    swung[6] = left
    swung[7] = ground
    DOOR.seed = 86
    sketchPolygon(ctx, swung, DOOR)
  } else {
    DOOR.seed = 86
    sketchRect(ctx, left + wobble, top, 100, 250, DOOR)
    sketchText(ctx, 'OUT', x + wobble, top + 90, {
      font: 'marker',
      size: 34,
      color: palette.red,
      rotate: -0.15,
      seed: 87
    })
    sketchLine(ctx, x + 32 + wobble, top + 132, x + 40 + wobble, top + 132, {
      width: 6,
      color: palette.yellow,
      seed: 88
    })
  }
  FRAME.seed = 89
  sketchRect(ctx, left - 6, top - 6, 112, 256, FRAME)
}
