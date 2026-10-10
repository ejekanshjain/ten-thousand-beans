import type { DrainVariant, Junk } from '../game/drainWorld'
import type { Game } from '../game/game'
import { GRATE_Y, GUNK_TOP, SHAFT_LEFT, SHAFT_RIGHT } from '../game/tuning'
import {
  blobPoints,
  boilSeed,
  CachedLayer,
  palette,
  sketchBlob,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import type { BeanStamps } from './art/bean'
import { colors } from './art/colors'
import { Camera } from './camera'
import { CAPTION_TOP, drawCaptions } from './captions'

const SIDE: SketchStyle = { fill: '#6b4f3a', width: 3, wobble: 1.5 }
const SIDE_LINES: SketchStyle = {
  fill: '#4a3628',
  fillStyle: 'hatch',
  hatchGap: 16,
  hatchAngle: 0,
  width: 0
}
const SHAFT: SketchStyle = { fill: '#3b4045', width: 0, wobble: 1 }
const SLIME: SketchStyle = {
  color: '#5c7a3a',
  width: 5,
  wobble: 3,
  passes: 1
}
const GUNK: SketchStyle = { fill: '#55603a', width: 3, wobble: 3 }
const DUST: SketchStyle = { fill: '#adb5bd', width: 3, wobble: 3 }
const BUBBLE: SketchStyle = {
  color: palette.paper,
  width: 2,
  wobble: 0.8,
  passes: 1
}
const BAR: SketchStyle = {
  color: palette.ink,
  width: 6,
  wobble: 0.8,
  passes: 1
}
const DAYLIGHT: SketchStyle = { fill: colors.paving, width: 0, wobble: 1 }
const FRIDGE: SketchStyle = { fill: palette.paper, width: 3, wobble: 1.5 }
const WIRE: SketchStyle & { smooth: boolean } = {
  color: '#868e96',
  width: 4,
  wobble: 0.6,
  passes: 1,
  smooth: true
}
const WIRE_EDGE: SketchStyle & { smooth: boolean } = {
  color: palette.ink,
  width: 1.2,
  wobble: 0.4,
  passes: 1,
  smooth: true
}
const LABEL: SketchTextStyle = {
  font: 'marker',
  size: 26,
  color: palette.paper,
  outline: palette.ink
}
const DEEPER: SketchTextStyle = { font: 'hand', size: 22, color: palette.paper }
const blob = new Float64Array(2 * 12)
const wire = new Float64Array(2 * 7)

/** Paints the shaft for one hole: walls, the grate or fridge edge at the top, gunk or dust below. */
function paintShaft(
  ctx: CanvasRenderingContext2D,
  variant: DrainVariant
): void {
  SIDE.seed = 200
  SIDE.fill = variant === 'fridge' ? colors.floorDark : '#6b4f3a'
  sketchRect(ctx, -300, -200, SHAFT_LEFT + 300, 1_200, SIDE)
  sketchRect(ctx, SHAFT_RIGHT, -200, 600, 1_200, SIDE)
  if (variant === 'drain') {
    SIDE_LINES.seed = 201
    sketchRect(ctx, -300, -200, SHAFT_LEFT + 296, 1_200, SIDE_LINES)
    sketchRect(ctx, SHAFT_RIGHT + 4, -200, 600, 1_200, SIDE_LINES)
  }
  SHAFT.seed = 202
  sketchRect(ctx, SHAFT_LEFT, -200, SHAFT_RIGHT - SHAFT_LEFT, 1_200, SHAFT)
  for (let i = 0; i < 6; i++) {
    SLIME.seed = 203 + i
    const x = i % 2 === 0 ? SHAFT_LEFT + 4 : SHAFT_RIGHT - 4
    sketchLine(ctx, x, 140 + i * 80, x, 190 + i * 80, SLIME)
  }
  if (variant === 'drain') {
    DAYLIGHT.seed = 210
    sketchRect(ctx, -300, -200, 1_200, GRATE_Y - 14 + 200, DAYLIGHT)
    for (let x = SHAFT_LEFT + 10; x < SHAFT_RIGHT; x += 26) {
      BAR.seed = x
      sketchLine(ctx, x, GRATE_Y - 16, x, GRATE_Y + 4, BAR)
    }
    sketchLine(
      ctx,
      SHAFT_LEFT - 10,
      GRATE_Y - 16,
      SHAFT_RIGHT + 10,
      GRATE_Y - 16,
      {
        ...BAR,
        seed: 211
      }
    )
    sketchText(ctx, 'DRAIN', 300, GRATE_Y - 50, { ...LABEL, seed: 212 })
  } else {
    FRIDGE.seed = 213
    sketchRect(ctx, -300, -200, 1_200, GRATE_Y - 6 + 200, FRIDGE)
    sketchText(ctx, 'UNDER THE FRIDGE', 300, GRATE_Y - 40, {
      ...LABEL,
      color: palette.inkSoft,
      outline: palette.paper,
      seed: 214
    })
  }
  // The gunk (or dust) fills the shaft floor, with a lumpy top and a few bubbles.
  const floor = variant === 'fridge' ? DUST : GUNK
  floor.seed = 216
  sketchRect(
    ctx,
    SHAFT_LEFT,
    GUNK_TOP - 4,
    SHAFT_RIGHT - SHAFT_LEFT,
    600,
    floor
  )
  for (let i = 0; i < 5; i++) {
    BUBBLE.seed = 217 + i
    sketchCircle(
      ctx,
      SHAFT_LEFT + 30 + i * 45,
      GUNK_TOP + 40 + (i % 2) * 30,
      6,
      BUBBLE
    )
  }
}

/** Junk styles, built once. Shapes boil by changing `seed` before each draw. */
const J = {
  yellow: { fill: palette.yellow, width: 2.5 } as SketchStyle,
  beak: { fill: palette.orange, width: 1.5 } as SketchStyle,
  eye: { fill: palette.ink, width: 0 } as SketchStyle,
  pink: { fill: palette.pink, width: 2.5 } as SketchStyle,
  stripe: { color: palette.red, width: 3, passes: 1 } as SketchStyle,
  bar: { width: 4, color: palette.yellow, passes: 1 } as SketchStyle,
  line: { width: 2.5, passes: 1 } as SketchStyle,
  fluff: { fill: '#dee2e6', width: 2 } as SketchStyle,
  red: { fill: palette.red, width: 2.5 } as SketchStyle,
  blue: { fill: palette.blue, width: 2 } as SketchStyle,
  label: {
    font: 'marker',
    size: 11,
    color: palette.paper,
    seed: 235
  } as SketchTextStyle
}

/** Draws one piece of junk at its spot. */
function drawJunk(
  ctx: CanvasRenderingContext2D,
  junk: Junk,
  timeMs: number
): void {
  const { x, y } = junk
  const boil = boilSeed(timeMs)
  switch (junk.id) {
    case 'duck':
      J.yellow.seed = 220 + boil
      sketchEllipse(ctx, x, y, 20, 14, J.yellow)
      sketchCircle(ctx, x + 14, y - 14, 10, J.yellow)
      J.beak.seed = 222
      sketchEllipse(ctx, x + 26, y - 12, 6, 3, J.beak)
      J.eye.seed = 223
      sketchCircle(ctx, x + 16, y - 16, 1.8, J.eye)
      break
    case 'sock':
      J.pink.seed = 224 + boil
      sketchRoundRect(ctx, x - 22, y - 10, 34, 16, 6, J.pink)
      sketchRoundRect(ctx, x + 4, y - 4, 18, 14, 6, J.pink)
      J.stripe.seed = 226
      sketchLine(ctx, x - 14, y - 10, x - 14, y + 6, J.stripe)
      break
    case 'key':
      J.yellow.seed = 227
      sketchCircle(ctx, x - 12, y, 8, J.yellow)
      J.bar.seed = 228
      sketchLine(ctx, x - 4, y, x + 18, y, J.bar)
      J.line.seed = 229
      sketchLine(ctx, x + 12, y, x + 12, y + 6, J.line)
      break
    case 'bunny':
      blobPoints(x, y, 14, 10, 230, 0.4, blob)
      J.fluff.seed = 231 + boil
      sketchBlob(ctx, blob, J.fluff, 10)
      J.eye.seed = 232
      sketchCircle(ctx, x - 4, y - 3, 1.6, J.eye)
      sketchCircle(ctx, x + 4, y - 3, 1.6, J.eye)
      break
    case 'magnet':
      J.red.seed = 234
      sketchRoundRect(ctx, x - 14, y - 10, 28, 20, 4, J.red)
      sketchText(ctx, 'NAN', x, y, J.label)
      break
    case 'crayon':
      J.blue.seed = 236
      sketchRect(ctx, x - 16, y - 5, 26, 10, J.blue)
      J.line.seed = 237
      sketchLine(ctx, x + 10, y - 5, x + 18, y, J.line)
      sketchLine(ctx, x + 18, y, x + 10, y + 5, J.line)
      break
  }
}

/**
 * The Drain scene, side-on: a shaft with a grate at the top (or the gap under the fridge),
 * beans and junk in the gunk at the bottom, and the bent coat hanger you steer.
 */
export class DrainScene {
  readonly camera: Camera
  private readonly layers = new Map<DrainVariant, CachedLayer>()

  constructor(
    private readonly viewport: Viewport,
    private readonly stamps: BeanStamps
  ) {
    this.camera = new Camera(viewport)
  }

  private layerFor(variant: DrainVariant): CachedLayer {
    let layer = this.layers.get(variant)
    if (!layer) {
      layer = new CachedLayer(this.viewport, ctx => paintShaft(ctx, variant), {
        x: -300,
        y: -200,
        width: 1_200,
        height: 1_200
      })
      this.layers.set(variant, layer)
    }
    return layer
  }

  render(ctx: CanvasRenderingContext2D, game: Game, timeMs: number): void {
    const drain = game.drain
    const camera = this.camera
    camera.shake(game.fx.shake)
    camera.apply(ctx)
    if (!drain) return
    const world = drain.world
    this.layerFor(drain.variant).draw(ctx)
    for (const junk of world.junk)
      if (junk !== world.heldJunk) drawJunk(ctx, junk, timeMs)
    for (const body of world.beans)
      camera.stamp(
        this.stamps.pickup[body.id % 3]!,
        ctx,
        body.position.x,
        body.position.y,
        body.angle
      )
    camera.apply(ctx)
    if (world.waiting > 0)
      sketchText(ctx, `+${world.waiting} deeper in`, 300, GUNK_TOP + 50, DEEPER)

    const hook = world.hook
    if (world.heldJunk) drawJunk(ctx, world.heldJunk, timeMs)
    if (world.held) {
      // The bean shakes and reddens as the hook's jolt nears its limit.
      const strain = world.jolt.fraction
      const strained = strain > 0.7
      const tremble = strained ? (strain - 0.7) * 10 : 0
      camera.stamp(
        strained ? this.stamps.strained : this.stamps.pickup[0]!,
        ctx,
        hook.x + (Math.random() - 0.5) * tremble,
        hook.y - 8,
        world.held.angle
      )
      camera.apply(ctx)
    }
    this.drawHanger(ctx, hook.x, hook.y, timeMs)
    drawCaptions(ctx, game.fx.captions, 0, this.viewport.width, CAPTION_TOP)
  }

  /** The bent wire coat hanger, reaching down from above with a sad little hook. */
  private drawHanger(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    timeMs: number
  ): void {
    wire[0] = x + 70
    wire[1] = -120
    wire[2] = x + 40
    wire[3] = (y - 120) * 0.5
    wire[4] = x + 16
    wire[5] = y - 50
    wire[6] = x + 10
    wire[7] = y - 10
    wire[8] = x + 2
    wire[9] = y + 8
    wire[10] = x - 10
    wire[11] = y + 4
    wire[12] = x - 12
    wire[13] = y - 8
    WIRE.seed = 240 + boilSeed(timeMs)
    sketchPath(ctx, wire, WIRE)
    WIRE_EDGE.seed = 241
    sketchPath(ctx, wire, WIRE_EDGE)
  }

  dispose(): void {
    for (const layer of this.layers.values()) layer.dispose()
    this.layers.clear()
  }
}
