import { potDepth } from '../../game/fx'
import { spillSide } from '../../game/slosh'
import { POT_RADIUS, REPOSE, RIM_GLOW_FROM, RIM_HALF } from '../../game/tuning'
import {
  boilSeed,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchPolygon,
  sketchRoundRect,
  sketchText,
  type SketchStyle
} from '../../shared'
import type { Camera } from '../camera'
import type { BeanStamps } from './bean'
import { colors } from './colors'

const BODY: SketchStyle = { fill: colors.potRed, width: 3, wobble: 2 }
const HEAP: SketchStyle & { closed: boolean; smooth: boolean } = {
  fill: colors.bean,
  color: colors.beanDark,
  width: 2,
  wobble: 1.2,
  closed: true,
  smooth: true
}
const RIM: SketchStyle = { fill: colors.enamel, width: 2.5, wobble: 1 }
const WATER: SketchStyle & { closed: boolean; smooth: boolean } = {
  fill: 'rgba(116, 192, 252, 0.5)',
  width: 0,
  wobble: 1,
  closed: true,
  smooth: true
}
const SHINE: SketchStyle = {
  color: palette.paper,
  width: 2.5,
  wobble: 0.6,
  passes: 1
}
const LID: SketchStyle = { fill: '#ced4da', width: 3, wobble: 1 }
/** The pot's enamel inside, shaded by the rim, which shows as the beans run low. */
const BOTTOM: SketchStyle = { fill: '#ddd0b6', width: 2, wobble: 1 }
const BOTTOM_LIT: SketchStyle = {
  fill: '#f3ead8',
  width: 0,
  wobble: 1.5,
  passes: 1
}
const KNOB: SketchStyle = { fill: '#868e96', width: 2.5, wobble: 0.6 }
const HANDLE: SketchStyle = { width: 3, wobble: 1, passes: 1 }
const TOP_HANDLE: SketchStyle = { ...HANDLE, fill: colors.potShade }
const GLOW: SketchStyle = { fill: colors.glow, width: 0, wobble: 2 }
const GLOW_RING: SketchStyle = {
  color: palette.yellow,
  width: 6,
  wobble: 2,
  passes: 1
}

/** The pot's body below the rim, for the usual pot and the Taller Pot. */
function bodyShape(depth: number): Float64Array {
  return new Float64Array([
    -RIM_HALF - 4,
    0,
    RIM_HALF + 4,
    0,
    RIM_HALF - 2,
    depth,
    -RIM_HALF + 2,
    depth
  ])
}
const POT_SHAPE = bodyShape(potDepth(false))
const TALL_SHAPE = bodyShape(potDepth(true))
const HEAP_POINTS = 9
const heap = new Float64Array((HEAP_POINTS + 2) * 2)

/** What the side-view pot shows this frame. */
export interface SidePotView {
  /** Rim centre in world coordinates; the pot pivots here. */
  x: number
  y: number
  /** The pot's angle (psiEff) in radians. */
  angle: number
  /** The bean surface relative to the pot, in radians. */
  phi: number
  /** Spill margin in u. A bigger margin lowers the heap. */
  margin: number
  /** |phi| over the spill angle. The low rim glows from RIM_GLOW_FROM. */
  danger: number
  /** True while the Pot Lid sits on the pot. */
  lid: boolean
  /** True for the Taller Pot, which draws deeper below the same rim. */
  tall: boolean
  /** Rain water in the pot, in u. It glazes the heap blue. */
  water: number
  /** Ms of rattle left: the lid jitters on the rim. */
  rattle: number
  /** True when no bean is left in it, such as after Grandma's dog tipped it. */
  empty?: boolean
  timeMs: number
}

/**
 * Draws the enamel pot in the walk view with its heap of beans tilted by the slosh.
 * The rim the beans will leave over glows red as it nears the spill line.
 */
export function drawSidePot(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  stamps: BeanStamps,
  view: SidePotView
): void {
  const boil = boilSeed(view.timeMs)
  const cos = Math.cos(view.angle)
  const sin = Math.sin(view.angle)
  const tan = Math.tan(view.phi)
  // A full pot heaps 14 u above the rim; lost beans lower it.
  const lift = Math.max(2, 14 + REPOSE - view.margin)
  const heapY = (x: number) =>
    Math.min(2, -lift + x * tan - 8 * (1 - (x / RIM_HALF) ** 2))

  ctx.save()
  ctx.translate(view.x, view.y)
  ctx.rotate(view.angle)
  HANDLE.seed = 40 + boil
  sketchEllipse(ctx, RIM_HALF + 10, 14, 9, 6, HANDLE)
  sketchEllipse(ctx, -RIM_HALF - 10, 14, 9, 6, HANDLE)
  BODY.seed = 41 + boil
  sketchPolygon(ctx, view.tall ? TALL_SHAPE : POT_SHAPE, BODY)
  sketchText(ctx, 'STEW', 0, potDepth(view.tall) * 0.56, {
    font: 'marker',
    size: 19,
    color: colors.enamel,
    seed: 3,
    tilt: 0.05
  })

  for (let i = 0; i <= HEAP_POINTS; i++) {
    const x = -RIM_HALF + (2 * RIM_HALF * i) / HEAP_POINTS
    heap[i * 2] = x
    heap[i * 2 + 1] = heapY(x)
  }
  heap[(HEAP_POINTS + 1) * 2] = 0
  heap[(HEAP_POINTS + 1) * 2 + 1] = 6
  HEAP.seed = 42 + boil
  if (!view.empty) sketchPath(ctx, heap, HEAP)
  if (view.water > 0.05 && !view.lid && !view.empty) {
    // Rain water floods the heap: bluer and shinier as it rises.
    WATER.fill = `rgba(116, 192, 252, ${Math.min(0.8, 0.25 + view.water / 12)})`
    WATER.seed = 47 + boil
    sketchPath(ctx, heap, WATER)
    SHINE.seed = 48
    const sy = heapY(-20) - 3
    sketchLine(ctx, -26, sy, -6, heapY(0) - 3, SHINE)
  }
  RIM.seed = 43
  sketchRoundRect(ctx, -RIM_HALF - 6, -3, 2 * RIM_HALF + 12, 8, 4, RIM)
  if (view.lid) {
    // The lid rattles on the rim after a bump.
    const jitter = view.rattle > 0 ? Math.sin(view.timeMs / 18) * 3 : 0
    LID.seed = 45 + boil
    sketchEllipse(ctx, jitter, -8 - Math.abs(jitter), RIM_HALF + 8, 12, LID)
    KNOB.seed = 46
    sketchCircle(ctx, jitter, -21 - Math.abs(jitter), 6, KNOB)
  }

  if (view.danger > RIM_GLOW_FROM) {
    const side = spillSide(view.phi)
    const pulse =
      view.danger >= 1 ? 0.75 + 0.25 * Math.sin(view.timeMs / 60) : 1
    const strength = Math.min(
      1,
      (view.danger - RIM_GLOW_FROM) / (1 - RIM_GLOW_FROM)
    )
    ctx.globalAlpha = strength * pulse
    GLOW.seed = 44 + boil
    sketchCircle(ctx, side * RIM_HALF, -2, 22, GLOW)
    ctx.globalAlpha = 1
  }
  ctx.restore()

  // Beans on top of the heap, stamped in world coordinates. The lid hides them.
  for (let i = 1; i < 8 && !view.lid && !view.empty; i++) {
    const lx = -RIM_HALF + (2 * RIM_HALF * i) / 8 + ((i * 7) % 5) - 2
    const ly = heapY(lx) - 2
    if (ly > 0) continue
    const wx = view.x + cos * lx - sin * ly
    const wy = view.y + sin * lx + cos * ly
    camera.stamp(
      stamps.walk[i % 3]!,
      ctx,
      wx,
      wy,
      view.angle + view.phi + ((i * 1.7) % 1.2) - 0.6
    )
  }
  camera.apply(ctx)
}

/** Bean stamp spots inside the top-down pot, relative to its centre. */
const TOP_BEANS = [
  [-22, -14, 0.4],
  [8, -24, 2.1],
  [26, 2, 1.2],
  [-6, 8, 2.8],
  [-30, 14, 0.9],
  [14, 24, 0.2],
  [-12, -32, 1.6],
  [34, -18, 2.5]
] as const

/**
 * Draws the pot from above in Pickup. `fill` is the share of the 10,000 beans inside: the
 * heap shrinks into the dark bottom as it drops, and an empty pot shows only the bottom.
 * `glow` highlights the mouth while beans are held, and `squash` pops it after a bean
 * goes in.
 */
export function drawTopPot(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  stamps: BeanStamps,
  x: number,
  y: number,
  fill: number,
  glow: boolean,
  squash: number,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  const r = POT_RADIUS * squash
  TOP_HANDLE.seed = 50 + boil
  sketchRoundRect(ctx, x - r - 16, y - 8, 20, 16, 6, TOP_HANDLE)
  sketchRoundRect(ctx, x + r - 4, y - 8, 20, 16, 6, TOP_HANDLE)
  BODY.seed = 51 + boil
  sketchCircle(ctx, x, y, r, BODY)
  RIM.seed = 52
  sketchCircle(ctx, x, y, r - 7, RIM)
  BOTTOM.seed = 55 + boil
  sketchCircle(ctx, x, y, r - 13, BOTTOM)
  BOTTOM_LIT.seed = 56 + boil
  sketchCircle(ctx, x + 5, y + 6, r - 24, BOTTOM_LIT)
  // The heap's area follows the fill, so a nearly full pot still reads as full.
  const share = Math.min(1, Math.max(0, fill))
  if (share > 0) {
    const heap = (r - 13) * Math.max(0.3, Math.sqrt(share))
    HEAP.seed = 53 + boil
    sketchCircle(ctx, x, y, heap, HEAP)
    const shown = Math.max(1, Math.round(TOP_BEANS.length * share))
    for (let i = 0; i < shown; i++) {
      const [dx, dy, angle] = TOP_BEANS[i]!
      const k = (heap / (r - 13)) * squash
      camera.stamp(
        stamps.pickup[(dx + 40) % 3]!,
        ctx,
        x + dx * k,
        y + dy * k,
        angle
      )
    }
    camera.apply(ctx)
  }
  if (glow) {
    GLOW_RING.seed = 54 + boil
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(timeMs / 120)
    sketchCircle(ctx, x, y, r + 12, GLOW_RING)
    ctx.globalAlpha = 1
  }
}
