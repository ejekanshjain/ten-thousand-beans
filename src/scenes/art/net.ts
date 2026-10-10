import { knotSpot, type Knot } from '../../game/net'
import type { Game } from '../../game/state'
import { POT_RADIUS, RIM_HALF } from '../../game/tuning'
import {
  boilSeed,
  palette,
  sketchArrow,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'

const NET_GREEN = '#2b8a3e'
const MESH: SketchStyle = {
  color: 'rgba(43, 138, 62, 0.8)',
  width: 1.6,
  wobble: 0.8,
  passes: 1
}
const HEM: SketchStyle = { color: NET_GREEN, width: 2.5, wobble: 1, passes: 1 }
const BALL: SketchStyle = {
  fill: NET_GREEN,
  fillStyle: 'hatch',
  hatchGap: 4,
  color: '#1b4d26',
  width: 2.5,
  wobble: 1.5
}
const LOOP: SketchStyle = { color: NET_GREEN, width: 2, wobble: 1, passes: 1 }
const ARROW: SketchStyle & { head: number; closed: boolean } = {
  color: palette.ink,
  width: 3.5,
  wobble: 0.5,
  passes: 1,
  head: 11,
  closed: false
}
const HALO: SketchStyle = {
  fill: 'rgba(255, 249, 235, 0.85)',
  width: 0,
  wobble: 1
}
const COUNT: SketchTextStyle = {
  font: 'marker',
  size: 17,
  color: palette.ink,
  outline: palette.paper
}
const RING: SketchStyle & { closed: boolean } = {
  width: 4,
  wobble: 0.4,
  passes: 1,
  closed: false
}
const FLASH: SketchStyle = { width: 4, wobble: 1, passes: 1 }

/** How far the curved arrow round a knot sits from its centre, in u. */
const ARROW_R = 21
/** Knots draw bigger on the side-on pot, which is smaller on screen than the Pickup pot. */
const SIDE_KNOT_SCALE = 1.2
/** Points along the arrow's arc, and along a progress arc. */
const ARC_POINTS = 14
const arc = new Float64Array(ARC_POINTS * 2)
const spot = { x: 0, y: 0 }

/** Fills `arc` with points on a circle round (x, y) from angle `from` turning by `sweep`. */
function arcPoints(
  x: number,
  y: number,
  r: number,
  from: number,
  sweep: number
): void {
  for (let i = 0; i < ARC_POINTS; i++) {
    const a = from + (sweep * i) / (ARC_POINTS - 1)
    arc[i * 2] = x + Math.cos(a) * r
    arc[i * 2 + 1] = y + Math.sin(a) * r
  }
}

/**
 * Diagonal mesh lines across a box, clipped to whatever path the caller set up. `crumple`
 * jitters the ends, for a tangled net.
 */
function mesh(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  gap: number,
  crumple: number,
  seed: number
): void {
  const span = width + height
  let k = 0
  for (let d = 0; d <= span; d += gap) {
    const j = crumple * Math.sin(seed + k * 2.3)
    MESH.seed = seed + k++
    sketchLine(ctx, left + d - height, top + height, left + d + j, top, MESH)
    sketchLine(
      ctx,
      left + width - d + height,
      top + height,
      left + width - d - j,
      top,
      MESH
    )
  }
}

/**
 * One knot, drawn `k` times life size: a hatched ball of netting with the circles it
 * still needs, and an arrow showing which way to circle it.
 */
function drawKnot(
  ctx: CanvasRenderingContext2D,
  game: Game,
  knot: Knot,
  i: number,
  k: number,
  timeMs: number
): void {
  const { x, y } = knotSpot(game, i, spot)
  const boil = boilSeed(timeMs)
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(k, k)
  if (knot.left === 0) {
    // Undone: a loose loop, with a burst for a moment.
    LOOP.seed = 90 + i
    sketchEllipse(ctx, 0, 0, 7, 4, LOOP)
    if (knot.flash === 'undone' && knot.flashMs < 400) {
      FLASH.color = palette.green
      ctx.globalAlpha = 1 - knot.flashMs / 400
      FLASH.seed = 91 + i
      sketchCircle(ctx, 0, 0, 14 + knot.flashMs * 0.06, FLASH)
    }
    ctx.restore()
    return
  }
  const tight = knot.flash === 'tight' && knot.flashMs < 500
  const shiver = tight ? Math.sin(timeMs / 25) * 2 : 0
  HALO.seed = 92 + i
  sketchCircle(ctx, 0, 0, ARROW_R + 5, HALO)
  // The arrow runs three quarters of the way round, its head pointing the right way.
  const sweep = knot.dir * Math.PI * 1.5
  arcPoints(0, 0, ARROW_R, -Math.PI / 2 - sweep / 2, sweep)
  ARROW.seed = 93 + i
  ARROW.color = tight ? palette.red : palette.ink
  sketchPath(ctx, arc, ARROW, ARC_POINTS - 1)
  const n = ARC_POINTS * 2
  sketchArrow(ctx, arc[n - 4]!, arc[n - 3]!, arc[n - 2]!, arc[n - 1]!, ARROW)
  // The ball grows with every circle it still needs.
  const size = 8 + knot.left * 1.5
  BALL.seed = 94 + i + boil
  sketchCircle(ctx, shiver, 0, size, BALL)
  LOOP.seed = 95 + i + boil
  sketchEllipse(ctx, shiver - 3, 2, size + 3, size * 0.5, LOOP)
  sketchEllipse(ctx, shiver + 2, -2, size * 0.5, size + 2, LOOP)
  COUNT.seed = 96 + i
  sketchText(ctx, String(knot.left), shiver, 0, COUNT)
  if (tight) {
    FLASH.color = palette.red
    ctx.globalAlpha = 1 - knot.flashMs / 500
    FLASH.seed = 97 + i
    sketchCircle(ctx, 0, 0, size + 6, FLASH)
  }
  ctx.restore()
}

/**
 * The arc you have drawn so far round the knot you are circling, `k` times life size:
 * green the right way, red the wrong way.
 */
function drawProgress(
  ctx: CanvasRenderingContext2D,
  game: Game,
  k: number
): void {
  const net = game.net
  const knot = net.knots[net.active]
  const turn = net.circle?.turn ?? 0
  if (!knot || Math.abs(turn) < 0.2) return
  const { x, y } = knotSpot(game, net.active, spot)
  arcPoints(x, y, (ARROW_R + 10) * k, -Math.PI / 2, turn)
  // A paper underlay keeps the arc readable over grass and netting.
  RING.seed = 98
  RING.color = palette.paper
  RING.width = 9
  sketchPath(ctx, arc, RING)
  RING.color = Math.sign(turn) === knot.dir ? palette.green : palette.red
  RING.width = 5
  sketchPath(ctx, arc, RING)
}

function drawKnots(
  ctx: CanvasRenderingContext2D,
  game: Game,
  k: number,
  timeMs: number
): void {
  if (game.net.phase !== 'tangled') return
  for (let i = 0; i < game.net.knots.length; i++)
    drawKnot(ctx, game, game.net.knots[i]!, i, k, timeMs)
  drawProgress(ctx, game, k)
}

/**
 * The Pigeon Net over the pot in the walk view, with its rim centre at (x, y) and the
 * pot `depth` deep: draped neatly, or bunched up with knots once a pigeon tangled it.
 */
export function drawSideNet(
  ctx: CanvasRenderingContext2D,
  game: Game,
  x: number,
  y: number,
  depth: number,
  timeMs: number
): void {
  const tangled = game.net.phase === 'tangled'
  // Laid neatly it stops above the STEW label; bunched up it hangs lower.
  const drape = depth * (tangled ? 0.8 : 0.42)
  const halfW = RIM_HALF + 7
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(x, y + 2, halfW + 2, 24, 0, Math.PI, 0)
  ctx.lineTo(x + halfW - 4, y + drape)
  ctx.lineTo(x - halfW + 4, y + drape)
  ctx.closePath()
  ctx.clip()
  mesh(
    ctx,
    x - halfW,
    y - 24,
    halfW * 2,
    drape + 26,
    tangled ? 11 : 14,
    tangled ? 6 : 0,
    tangled ? 60 + boilSeed(timeMs) : 60
  )
  ctx.restore()
  HEM.seed = 61
  sketchLine(ctx, x - halfW + 4, y + drape, x + halfW - 4, y + drape, HEM)
  drawKnots(ctx, game, SIDE_KNOT_SCALE, timeMs)
}

/** The Pigeon Net over the pot from above in Pickup, centred on (x, y). */
export function drawTopNet(
  ctx: CanvasRenderingContext2D,
  game: Game,
  x: number,
  y: number,
  timeMs: number
): void {
  const tangled = game.net.phase === 'tangled'
  const r = POT_RADIUS + 4
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.clip()
  mesh(
    ctx,
    x - r,
    y - r,
    r * 2,
    r * 2,
    tangled ? 12 : 15,
    tangled ? 7 : 0,
    tangled ? 70 + boilSeed(timeMs) : 70
  )
  ctx.restore()
  HEM.seed = 71
  sketchCircle(ctx, x, y, r, HEM)
  drawKnots(ctx, game, 1, timeMs)
}
