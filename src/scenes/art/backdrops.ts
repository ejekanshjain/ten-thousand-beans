import { GROUND_Y } from '../../game/fx'
import { groundY, type StretchDef, type StretchId } from '../../game/route'
import { GRANDMA_X } from '../../game/tuning'
import {
  hash01,
  palette,
  type SketchTextStyle,
  sketchBlob,
  blobPoints,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPolygon,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SketchStyle
} from '../../shared'
import { colors } from './colors'
import { paintHazards } from './hazards'
import { paintBench, paintPond } from './park'

/** How one stretch looks behind the walk view. */
export interface Backdrop {
  /** Fill above the tiles: sky outdoors, the ceiling indoors. */
  sky: string
  /** Fill under the tiles, which tall phone cells show. */
  below: string
  /** Paints scenery and ground from route x `left` to `right`, in route coordinates. */
  paint(
    ctx: CanvasRenderingContext2D,
    def: StretchDef,
    left: number,
    right: number
  ): void
}

/** Depth of the walking band above your feet; the band's top edge is the back of the path. */
const BAND_BACK = 36
/** Lowest y any band reaches. Tiles stop at 800 plus the stretch's largest drop. */
const BAND_BOTTOM = 1_200

const band = new Float64Array(2 * 160)

/**
 * Builds a ground band from `x0` to `x1` whose top edge follows the ground profile at
 * `offset` u from your feet, down to `bottom`. Returns the point count in `band`.
 */
function groundBand(
  def: StretchDef,
  x0: number,
  x1: number,
  offset: number,
  bottom = BAND_BOTTOM
): number {
  let n = 0
  const push = (x: number) => {
    band[n * 2] = x
    band[n * 2 + 1] = groundY(def, x) + offset
    n++
  }
  // Sample every 24 u, plus every profile corner, so stair risers stay sharp.
  const p = def.profile
  let corner = 0
  for (let x = x0; x <= x1 && n < 150; x += 24) {
    while (corner < p.length && (p[corner] as number) < x) {
      const cx = p[corner] as number
      if (cx > x0) push(cx)
      corner += 2
    }
    push(x)
  }
  band[n * 2] = x1
  band[n * 2 + 1] = bottom
  band[n * 2 + 2] = x0
  band[n * 2 + 3] = bottom
  return n + 2
}

/**
 * Fills the walking band in one style, with optional hatching on top. Tiles paint once,
 * so fresh style objects here are fine.
 */
function paintBand(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  left: number,
  right: number,
  style: SketchStyle,
  offset = -BAND_BACK,
  hatch?: string
): void {
  const count = groundBand(def, left - 8, right + 8, offset)
  const seed = Math.round(left) + offset
  sketchPolygon(ctx, band, { width: 2.5, wobble: 1.2, ...style, seed }, count)
  if (hatch) routeHatch(ctx, count, hatch)
}

/** Hatching on a band: gap between lines, their angle, and the length of each bowed piece, in u. */
const HATCH_GAP = 9
const HATCH_ANGLE = -0.8
const HATCH_PIECE = 100

/**
 * Hatches the first `count` points of `band`. The lines sit on a grid fixed to route
 * coordinates, not to the band's own box, so neighbouring tiles draw the same lines and
 * the hatching runs on across the seam between them. Each line is a chain of slightly
 * bowed pieces, which keeps the felt-tip look.
 */
function routeHatch(
  ctx: CanvasRenderingContext2D,
  count: number,
  color: string
): void {
  const dx = Math.cos(HATCH_ANGLE)
  const dy = Math.sin(HATCH_ANGLE)
  // k measures across the lines, along the normal (-dy, dx); t measures along them.
  let kMin = Infinity
  let kMax = -Infinity
  let tMin = Infinity
  let tMax = -Infinity
  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < count; i++) {
    const x = band[i * 2] as number
    const y = band[i * 2 + 1] as number
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
    const k = -dy * x + dx * y
    const t = dx * x + dy * y
    kMin = Math.min(kMin, k)
    kMax = Math.max(kMax, k)
    tMin = Math.min(tMin, t)
    tMax = Math.max(tMax, t)
  }
  ctx.closePath()
  ctx.clip()
  ctx.beginPath()
  const first = Math.floor(tMin / HATCH_PIECE)
  const last = Math.ceil(tMax / HATCH_PIECE)
  for (let n = Math.floor(kMin / HATCH_GAP); n <= kMax / HATCH_GAP; n++) {
    const ox = -dy * n * HATCH_GAP
    const oy = dx * n * HATCH_GAP
    ctx.moveTo(ox + dx * first * HATCH_PIECE, oy + dy * first * HATCH_PIECE)
    for (let j = first; j < last; j++) {
      const bow = (hash01(n, j) - 0.5) * HATCH_GAP * 0.5
      const mid = (j + 0.5) * HATCH_PIECE
      const end = (j + 1) * HATCH_PIECE
      ctx.quadraticCurveTo(
        ox + dx * mid - dy * bow,
        oy + dy * mid + dx * bow,
        ox + dx * end,
        oy + dy * end
      )
    }
  }
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()
}

// ---------------------------------------------------------------- Kitchen

const WALL: SketchStyle = { width: 0, wobble: 0 }
const STRIPE: SketchStyle = {
  color: '#ffe8a3',
  width: 6,
  wobble: 1,
  passes: 1
}
const COUNTER: SketchStyle = {
  fill: colors.wood,
  fillStyle: 'hatch',
  hatchGap: 10,
  width: 3
}
const TOP: SketchStyle = { fill: colors.woodDark, width: 3 }
const FRIDGE: SketchStyle = { fill: palette.paper, width: 3, wobble: 1.5 }
const MAGNET: SketchStyle = { width: 1.5, wobble: 0.5 }
const FRAME: SketchStyle = { fill: '#fff9db', width: 3, wobble: 1.5 }
const DOOR_FRAME: SketchStyle = { color: colors.woodDark, width: 8, wobble: 1 }
/** The hall's paint starts past the kitchen doorway. */
const HALL_FROM = 530
const TILE_LINE: SketchStyle = {
  color: colors.floorDark,
  width: 1.5,
  wobble: 1,
  passes: 1
}

function paintKitchen(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  left: number,
  right: number
): void {
  // Kitchen wall up to the doorway, then the hall.
  WALL.fill = colors.wall
  sketchRect(ctx, left, 160, right - left, 460, WALL)
  if (right > HALL_FROM) {
    WALL.fill = colors.hallWall
    sketchRect(
      ctx,
      Math.max(left, HALL_FROM),
      160,
      right - HALL_FROM,
      460,
      WALL
    )
  }
  for (let x = Math.ceil(left / 48) * 48; x < Math.min(right, 440); x += 48) {
    STRIPE.seed = x
    sketchLine(ctx, x, 170, x, 590, STRIPE)
  }
  if (left < 560 && right > 420) {
    // The kitchen doorway, where the cat sits and watches the pot go by.
    WALL.fill = '#d6c7aa'
    sketchRect(ctx, 446, 300, 76, 304, WALL)
    DOOR_FRAME.seed = 20
    sketchRect(ctx, 438, 292, 92, 312, DOOR_FRAME)
  }
  if (left < 350) {
    // Counter with cupboards, and the window above it.
    COUNTER.seed = 1
    sketchRect(ctx, -120, 470, 410, 134, COUNTER)
    TOP.seed = 2
    sketchRect(ctx, -130, 456, 430, 18, TOP)
    for (let x = -100; x < 260; x += 90) {
      sketchRect(ctx, x, 490, 76, 96, { width: 2.5, seed: x, wobble: 1.5 })
      sketchCircle(ctx, x + 64, 536, 4, { fill: palette.ink, width: 0 })
    }
    sketchRect(ctx, 20, 230, 180, 150, {
      fill: colors.sky,
      width: 4,
      seed: 3
    })
    sketchLine(ctx, 110, 232, 110, 378, { width: 3, seed: 4 })
    sketchLine(ctx, 22, 305, 198, 305, { width: 3, seed: 5 })
  }
  if (left < 440 && right > 290) {
    FRIDGE.seed = 6
    sketchRoundRect(ctx, 306, 300, 116, 304, 12, FRIDGE)
    sketchLine(ctx, 310, 400, 418, 400, { width: 3, seed: 7 })
    sketchLine(ctx, 406, 330, 406, 380, { width: 4, seed: 8 })
    MAGNET.seed = 9
    MAGNET.fill = palette.yellow
    sketchCircle(ctx, 336, 340, 9, MAGNET)
    MAGNET.fill = palette.pink
    sketchRect(ctx, 352, 450, 30, 22, MAGNET)
    MAGNET.fill = palette.green
    sketchCircle(ctx, 376, 352, 7, MAGNET)
    // The cat's bowl, licked clean.
    sketchEllipse(ctx, 446, 610, 20, 7, {
      fill: palette.blue,
      width: 2.5,
      seed: 13
    })
    sketchText(ctx, 'CAT', 446, 610, {
      font: 'marker',
      size: 11,
      color: palette.paper,
      seed: 14
    })
  }
  if (left < 960 && right > 860) {
    // Coat hooks with Grandma's spare cardigan, just in case.
    sketchLine(ctx, 870, 360, 950, 360, {
      width: 6,
      color: colors.woodDark,
      seed: 15
    })
    sketchPolygon(ctx, [884, 366, 930, 366, 944, 470, 872, 470], {
      fill: palette.purple,
      fillStyle: 'hatch',
      hatchGap: 6,
      width: 2.5,
      seed: 16
    })
  }
  if (left < 720 && right > 600) {
    FRAME.seed = 10
    sketchRect(ctx, 610, 300, 90, 110, FRAME)
    sketchText(ctx, 'NAN', 655, 355, {
      font: 'marker',
      size: 22,
      color: palette.purple,
      seed: 11,
      tilt: 0.1
    })
  }
  // Skirting board and floor tiles.
  sketchLine(ctx, left - 8, GROUND_Y - BAND_BACK, right + 8, GROUND_Y - 36, {
    width: 6,
    color: colors.woodDark,
    seed: Math.round(left) + 12,
    passes: 1
  })
  paintBand(ctx, def, left, right, {
    fill: colors.floor,
    color: colors.floorDark
  })
  for (let x = Math.ceil(left / 60) * 60; x <= right; x += 60) {
    TILE_LINE.seed = x
    sketchLine(ctx, x, GROUND_Y - BAND_BACK, x - 30, 800, TILE_LINE)
  }
  for (let y = GROUND_Y - 6; y < 800; y += 34) {
    TILE_LINE.seed = y
    sketchLine(ctx, left - 8, y, right + 8, y, TILE_LINE)
  }
}

// ---------------------------------------------------------------- Street

const DOORS = [
  palette.blue,
  palette.green,
  palette.yellow,
  palette.purple,
  palette.red
]
const BRICK: SketchStyle = { fill: colors.brick, width: 3 }
const MORTAR: SketchStyle = {
  fill: colors.brickDark,
  fillStyle: 'hatch',
  hatchGap: 14,
  hatchAngle: 0,
  width: 0,
  wobble: 1
}
const ROOF: SketchStyle = { fill: palette.inkSoft, width: 3 }
const WINDOW: SketchStyle = { fill: '#fff9db', width: 2.5 }
const CURTAIN: SketchStyle = { width: 1.5, wobble: 1 }
const CURTAINS = [palette.red, palette.green, palette.blue, palette.pink]
const DOOR: SketchStyle = { width: 2.5 }
const SLAB: SketchStyle = { color: colors.roadDark, width: 1.5, passes: 1 }
const LAMP: SketchStyle = { color: palette.inkSoft, width: 6, wobble: 0.8 }
const LAMP_HEAD: SketchStyle = { fill: '#ffe066', width: 2.5, wobble: 0.8 }
const NUMBER: SketchTextStyle = {
  font: 'marker',
  size: 16,
  color: palette.paper
}
const curtain = new Float64Array(6)

/** Two curtains drawn into a window at (x, y), size w by h, tied back at the sides. */
function paintCurtains(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number
): void {
  CURTAIN.fill = CURTAINS[seed % CURTAINS.length]
  for (const side of [0, 1]) {
    const edge = side ? x + w : x
    const dir = side ? -1 : 1
    curtain[0] = edge
    curtain[1] = y + 2
    curtain[2] = edge + dir * w * 0.42
    curtain[3] = y + 2
    curtain[4] = edge
    curtain[5] = y + h - 2
    CURTAIN.seed = seed + side
    sketchPolygon(ctx, curtain, CURTAIN)
  }
}

/** The top of the brick front of the house starting at route x, under its roof. */
function roofTop(def: StretchDef, x: number, seed: number): number {
  return groundY(def, x + 100) - BAND_BACK - 354 + hash01(seed, 1) * 30
}

/**
 * The ground-floor window of the house whose front door is at route x `door` (200 k +
 * 149), as [x, y, w, h], where Mrs Pryce's curtain twitches.
 */
export function houseWindow(
  def: StretchDef,
  door: number
): [number, number, number, number] {
  const house = door - 149
  return [house + 22, roofTop(def, house, house / 200 + 1_000) + 140, 54, 60]
}

/** One terraced house 200 u wide, standing on the pavement at its middle. */
function paintHouse(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  x: number,
  seed: number
): void {
  const base = groundY(def, x + 100) - BAND_BACK
  const roofY = roofTop(def, x, seed)
  BRICK.seed = seed
  sketchRect(ctx, x + 4, roofY, 192, base - roofY + 4, BRICK)
  MORTAR.seed = seed
  sketchRect(ctx, x + 8, roofY + 4, 184, base - roofY - 4, MORTAR)
  ROOF.seed = seed + 100
  sketchPolygon(
    ctx,
    [x - 4, roofY + 4, x + 100, roofY - 60, x + 204, roofY + 4],
    ROOF
  )
  WINDOW.seed = seed + 200
  sketchRect(ctx, x + 22, roofY + 36, 54, 60, WINDOW)
  sketchRect(ctx, x + 124, roofY + 36, 54, 60, WINDOW)
  sketchRect(ctx, x + 22, roofY + 140, 54, 60, WINDOW)
  paintCurtains(ctx, x + 22, roofY + 36, 54, 60, seed)
  paintCurtains(ctx, x + 124, roofY + 36, 54, 60, seed + 7)
  paintCurtains(ctx, x + 22, roofY + 140, 54, 60, seed + 3)
  DOOR.seed = seed + 300
  DOOR.fill = DOORS[seed % DOORS.length]
  sketchRect(ctx, x + 124, base - 112, 50, 112, DOOR)
  sketchCircle(ctx, x + 164, base - 56, 3.5, { fill: palette.yellow, width: 1 })
  NUMBER.seed = seed
  sketchText(ctx, String(seed - 990), x + 149, base - 92, NUMBER)
}

const DOORWAY: SketchStyle = { fill: '#2b2b2b', width: 2.5, wobble: 1 }
const DOOR_LEAF: SketchStyle = { width: 2.5, wobble: 1 }
const leaf = new Float64Array(8)

/**
 * A street house's front door standing open at route x `door` (a door centre at 200 k +
 * 149), drawn over the cached tile while a neighbour is out.
 */
export function paintOpenDoor(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  door: number
): void {
  const house = door - 149
  if (house % 200 !== 0) return
  const base = groundY(def, house + 100) - BAND_BACK
  DOORWAY.seed = door
  sketchRect(ctx, door - 25, base - 112, 50, 112, DOORWAY)
  leaf[0] = door - 25
  leaf[1] = base - 112
  leaf[2] = door - 46
  leaf[3] = base - 104
  leaf[4] = door - 46
  leaf[5] = base + 6
  leaf[6] = door - 25
  leaf[7] = base
  DOOR_LEAF.fill = DOORS[(house / 200 + 1_000) % DOORS.length]
  DOOR_LEAF.seed = door + 1
  sketchPolygon(ctx, leaf, DOOR_LEAF)
}

/** Where a neighbour stands in their doorway, before stepping out onto the pavement. */
export function doorstepY(def: StretchDef, door: number): number {
  return groundY(def, door - 49) - BAND_BACK + 2
}

/** A street lamp standing at the back of the pavement at route x. */
function paintLamp(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  x: number
): void {
  const base = groundY(def, x) - BAND_BACK + 2
  LAMP.seed = Math.round(x)
  sketchLine(ctx, x, base, x, base - 250, LAMP)
  sketchLine(ctx, x, base - 250, x + 26, base - 262, LAMP)
  LAMP_HEAD.seed = Math.round(x) + 1
  sketchPolygon(
    ctx,
    [
      x + 14,
      base - 262,
      x + 40,
      base - 266,
      x + 34,
      base - 248,
      x + 18,
      base - 246
    ],
    LAMP_HEAD
  )
}

function paintStreet(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  left: number,
  right: number
): void {
  for (let x = Math.floor(left / 200) * 200; x < right; x += 200)
    paintHouse(ctx, def, x, x / 200 + 1_000)
  // Lamps stand between houses, painted from a little outside the tile so halves match.
  for (let x = Math.floor((left - 40) / 600) * 600; x < right + 40; x += 600)
    paintLamp(ctx, def, x)
  paintBand(ctx, def, left, right, {
    fill: colors.paving,
    color: palette.ink,
    width: 2
  })
  for (let x = Math.ceil(left / 75) * 75; x <= right; x += 75) {
    const top = groundY(def, x) - BAND_BACK
    SLAB.seed = x
    sketchLine(ctx, x, top + 4, x - 10, top + 62, SLAB)
  }
  paintBand(ctx, def, left, right, { fill: colors.road, width: 3 }, 30)
  for (let x = Math.ceil(left / 200) * 200 + 30; x < right; x += 200) {
    const y = groundY(def, x) + 104
    sketchLine(ctx, x, y, x + 70, y, {
      color: palette.paper,
      width: 5,
      passes: 1,
      seed: x
    })
  }
}

// ---------------------------------------------------------------- Market

const AWNING: SketchStyle = { width: 2.5, wobble: 1.2 }
const STALL: SketchStyle = {
  fill: colors.wood,
  fillStyle: 'hatch',
  hatchGap: 9,
  width: 3
}
const VEG = [palette.orange, palette.green, palette.red, palette.yellow]
const BUNTING: SketchStyle = { width: 1.5, wobble: 0.5 }

function paintMarket(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  left: number,
  right: number
): void {
  // Brick backs of the shops, then a stall every 260 u. The wall goes in stall-wide
  // segments with their own seeds, so neighbouring tiles paint the same lines.
  for (let x = Math.floor(left / 260) * 260; x < right; x += 260) {
    sketchRect(ctx, x, 260, 262, 360, {
      ...BRICK,
      fill: '#d9a07f',
      width: 0,
      seed: x
    })
    sketchRect(ctx, x + 2, 264, 258, 352, { ...MORTAR, seed: x })
  }
  sketchLine(ctx, left - 8, 260, right + 8, 260, { width: 3, seed: left })
  for (let x = Math.floor(left / 260) * 260; x < right; x += 260) {
    const seed = x / 260 + 2_000
    const base = groundY(def, x + 110) - BAND_BACK
    STALL.seed = seed
    sketchRect(ctx, x + 20, base - 110, 180, 110, STALL)
    const stripe = hash01(seed, 1) < 0.5 ? colors.awningRed : colors.awningGreen
    for (let k = 0; k < 6; k++) {
      AWNING.seed = seed * 10 + k
      AWNING.fill = k % 2 === 0 ? stripe : palette.paper
      sketchPolygon(
        ctx,
        [
          x + 10 + k * 33,
          base - 250,
          x + 43 + k * 33,
          base - 250,
          x + 43 + k * 33,
          base - 200,
          x + 10 + k * 33,
          base - 190
        ],
        AWNING
      )
    }
    sketchLine(ctx, x + 24, base - 200, x + 24, base - 110, { width: 3 })
    sketchLine(ctx, x + 196, base - 200, x + 196, base - 110, { width: 3 })
    for (let k = 0; k < 7; k++) {
      sketchCircle(ctx, x + 40 + k * 22, base - 122 - (k % 2) * 8, 11, {
        fill: VEG[Math.floor(hash01(seed, k + 3) * VEG.length)],
        width: 2,
        wobble: 1,
        seed: seed + k
      })
    }
  }
  for (let x = Math.floor(left / 60) * 60; x < right; x += 60) {
    BUNTING.seed = x
    BUNTING.fill = VEG[(x / 60) % VEG.length]
    sketchPolygon(ctx, [x, 200, x + 40, 200, x + 20, 236], BUNTING)
  }
  sketchLine(ctx, left - 8, 198, right + 8, 202, { width: 2, seed: left })
  paintBand(ctx, def, left, right, {
    fill: colors.gravel,
    color: palette.ink,
    width: 2
  })
}

// ---------------------------------------------------------------- Park, hill, door

const TRUNK: SketchStyle = { fill: colors.woodDark, width: 3 }
const CROWN: SketchStyle = { fill: colors.leaf, width: 3 }
const CROWN_HATCH: SketchStyle = {
  fill: colors.grassDark,
  fillStyle: 'hatch',
  hatchGap: 10,
  width: 0
}
const crown = new Float64Array(2 * 14)
const HEDGE: SketchStyle = { fill: colors.grassDark, width: 3, wobble: 2.5 }

/** A blob tree standing on the ground behind the path. */
function paintTree(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  x: number,
  seed: number
) {
  const base = groundY(def, x) - BAND_BACK
  const h = 170 + hash01(seed, 1) * 90
  TRUNK.seed = seed
  sketchRect(ctx, x - 12, base - h * 0.5, 24, h * 0.5 + 4, TRUNK)
  blobPoints(
    x,
    base - h * 0.62,
    70 + hash01(seed, 2) * 30,
    14,
    seed,
    0.3,
    crown
  )
  CROWN.seed = seed + 1
  sketchBlob(ctx, crown, CROWN)
  CROWN_HATCH.seed = seed + 1
  sketchBlob(ctx, crown, CROWN_HATCH)
}

/** Route x of the park's benches and its pond, behind the path. */
const PARK_BENCHES = [880, 3_150, 5_800]
const PARK_POND = 3_650

function paintPark(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  left: number,
  right: number
): void {
  HEDGE.seed = Math.round(left)
  sketchRect(ctx, left - 8, 480, right - left + 16, 140, HEDGE)
  for (let x = Math.floor(left / 320) * 320 + 120; x < right + 100; x += 320)
    paintTree(ctx, def, x + hash01(x, 3) * 80, x)
  // Props sit on fixed route spots, so neighbouring tiles paint the same ones.
  for (const x of PARK_BENCHES)
    if (x > left - 100 && x < right + 100)
      paintBench(ctx, x, groundY(def, x) - BAND_BACK + 6)
  if (PARK_POND > left - 200 && PARK_POND < right + 200)
    paintPond(ctx, PARK_POND, groundY(def, PARK_POND) - BAND_BACK + 4)
  if (left <= 300 && right > 300) {
    sketchRect(ctx, 260, 470, 10, 134, { fill: colors.woodDark, width: 2 })
    sketchRect(ctx, 200, 420, 130, 60, { fill: palette.paper, width: 3 })
    sketchText(ctx, 'Dogs on leads please', 265, 450, {
      font: 'hand',
      size: 16,
      maxWidth: 120
    })
  }
  const grass = { fill: colors.grass, color: colors.grassDark }
  paintBand(ctx, def, left, right, grass, -BAND_BACK, colors.grassDark)
  paintBand(
    ctx,
    def,
    left,
    right,
    { fill: colors.gravel, width: 2, color: colors.woodDark },
    -14
  )
  paintBand(ctx, def, left, right, grass, 22, colors.grassDark)
}

const ridge = new Float64Array(2 * 40)

/**
 * Distant rolling hills from `left` to `right`, with heights from one function of route x,
 * so the ridge carries on across tile edges.
 */
function paintRidge(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  base: number,
  height: number
): void {
  let n = 0
  const from = Math.floor(left / 40) * 40 - 40
  for (let x = from; x <= right + 40 && n < 38; x += 40) {
    ridge[n * 2] = x
    ridge[n * 2 + 1] =
      base - height * (0.6 + 0.4 * Math.sin(x / 310) * Math.cos(x / 170 + 1))
    n++
  }
  ridge[n * 2] = right + 40
  ridge[n * 2 + 1] = 620
  ridge[n * 2 + 2] = from
  ridge[n * 2 + 3] = 620
  sketchPolygon(
    ctx,
    ridge,
    { fill: colors.grassDark, width: 3, wobble: 0.8, seed: 4_000 },
    n + 2
  )
}

const CLOUD: SketchStyle = {
  fill: '#dee2e6',
  color: '#868e96',
  width: 3,
  wobble: 2
}
const CLOUD_DARK: SketchStyle = {
  fill: '#adb5bd',
  fillStyle: 'hatch',
  hatchGap: 12,
  width: 0
}
const cloud = new Float64Array(2 * 12)
const SIGN_POST: SketchStyle = { fill: colors.woodDark, width: 2 }

/**
 * The hill: distant ridges and rain clouds that follow the ground as it climbs, a fence,
 * a warning sign at the foot, a bench and a sign at the top, and the grassy path.
 */
function paintHill(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  left: number,
  right: number
): void {
  // The far ridge rides up with the hill, so it stays behind you all the way up.
  let n = 0
  const from = Math.floor(left / 40) * 40 - 40
  for (let x = from; x <= right + 40 && n < 38; x += 40) {
    ridge[n * 2] = x
    ridge[n * 2 + 1] =
      groundY(def, x) -
      90 -
      120 * (0.6 + 0.4 * Math.sin(x / 310) * Math.cos(x / 170 + 1))
    n++
  }
  ridge[n * 2] = right + 40
  ridge[n * 2 + 1] = 820
  ridge[n * 2 + 2] = from
  ridge[n * 2 + 3] = 820
  sketchPolygon(
    ctx,
    ridge,
    { fill: colors.grassDark, width: 3, wobble: 0.8, seed: 4_100 },
    n + 2
  )
  for (let x = Math.floor(left / 420) * 420; x < right + 200; x += 420) {
    const cx = x + hash01(x, 21) * 160
    blobPoints(cx, groundY(def, cx) - 440, 80, 12, x, 0.18, cloud)
    CLOUD.seed = x
    sketchBlob(ctx, cloud, CLOUD)
    CLOUD_DARK.seed = x
    sketchBlob(ctx, cloud, CLOUD_DARK)
  }
  for (let x = Math.ceil(left / 140) * 140; x < right; x += 140) {
    const base = groundY(def, x) - BAND_BACK
    sketchLine(ctx, x, base, x, base - 60, { width: 4, seed: x })
    sketchLine(ctx, x - 70, base - 46, x + 70, base - 46, {
      width: 3,
      seed: x + 1
    })
  }
  if (left <= 900 && right > 900) {
    sketchRect(ctx, 896, 470, 10, 134, SIGN_POST)
    sketchRect(ctx, 840, 420, 130, 60, { fill: palette.yellow, width: 3 })
    sketchText(ctx, 'Steep. Sorry.', 905, 450, { font: 'marker', size: 18 })
  }
  const top = def.slope?.to ?? 2_800
  if (left <= top + 260 && right > top + 100) {
    const sx = top + 180
    const base = groundY(def, sx) - BAND_BACK
    sketchRect(ctx, sx - 4, base - 130, 10, 134, SIGN_POST)
    sketchRect(ctx, sx - 70, base - 180, 150, 60, {
      fill: palette.paper,
      width: 3
    })
    sketchText(ctx, 'Top. Well done. Mostly.', sx + 5, base - 150, {
      font: 'hand',
      size: 17,
      maxWidth: 140
    })
  }
  if (left <= top + 520 && right > top + 380)
    paintBench(ctx, top + 450, groundY(def, top + 450) - BAND_BACK + 6)
  paintBand(
    ctx,
    def,
    left,
    right,
    { fill: colors.grass, color: colors.grassDark },
    -BAND_BACK,
    colors.grassDark
  )
}

const POST: SketchStyle = { fill: colors.woodDark, width: 3 }
const PLANK: SketchStyle = { fill: colors.wood, width: 2, wobble: 1 }
const WAVE: SketchStyle = {
  color: palette.paper,
  width: 2.5,
  wobble: 2,
  passes: 1
}

function paintBridge(
  ctx: CanvasRenderingContext2D,
  _def: StretchDef,
  left: number,
  right: number
): void {
  paintRidge(ctx, left, right, 590, 110)
  ctx.fillStyle = colors.river
  ctx.fillRect(left, 620, right - left, 600)
  for (let y = 680; y < 1_100; y += 50)
    for (let x = Math.floor(left / 160) * 160; x < right; x += 160) {
      WAVE.seed = x + y
      sketchLine(ctx, x + (y % 100), y, x + (y % 100) + 50, y + 4, WAVE)
    }
  const deck = GROUND_Y - BAND_BACK
  // Posts only: the walk view draws the handrails live, so they can roll with the deck.
  for (let x = Math.floor(left / 400) * 400; x < right + 50; x += 400) {
    POST.seed = x
    sketchRect(ctx, x - 8, deck - 110, 16, 150, POST)
  }
  for (let x = Math.floor(left / 30) * 30; x < right; x += 30) {
    PLANK.seed = x
    sketchRect(ctx, x + 2, deck, 26, 54, PLANK)
  }
}

function paintDoor(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  left: number,
  right: number
): void {
  HEDGE.seed = Math.round(left) + 1
  sketchRect(ctx, left - 8, 500, Math.min(right, 600) - left + 8, 120, HEDGE)
  for (let x = Math.ceil(left / 70) * 70; x < Math.min(right, 520); x += 70)
    sketchCircle(ctx, x + 20, 600, 9, {
      fill: VEG[(x / 70) % VEG.length],
      width: 2,
      seed: x
    })
  if (right > 600) {
    // Grandma's house: the door sits at the top of the steps.
    const step = groundY(def, def.length) - BAND_BACK
    // The wall runs down to the garden; the steps climb to the door in front of it.
    const garden = GROUND_Y - BAND_BACK + 4
    BRICK.seed = 3_000
    sketchRect(ctx, 600, 180, 500, garden - 180, BRICK)
    MORTAR.seed = 3_000
    sketchRect(ctx, 604, 184, 492, garden - 188, MORTAR)
    // Grandma stands in this doorway, past the top step.
    sketchRect(ctx, GRANDMA_X - 40, step - 150, 80, 150, {
      fill: palette.purple,
      width: 3,
      seed: 3_001
    })
    sketchCircle(ctx, GRANDMA_X + 26, step - 76, 4, {
      fill: palette.yellow,
      width: 1
    })
    sketchRect(ctx, GRANDMA_X + 80, 260, 90, 80, { ...WINDOW, seed: 3_002 })
    sketchRect(ctx, GRANDMA_X - 200, 260, 90, 80, { ...WINDOW, seed: 3_006 })
  }
  if (left <= 300 && right > 300) {
    // The gnome.
    const base = groundY(def, 300) - BAND_BACK
    sketchPolygon(ctx, [286, base - 40, 300, base - 74, 314, base - 40], {
      fill: palette.red,
      width: 2,
      seed: 3_003
    })
    sketchCircle(ctx, 300, base - 30, 13, {
      fill: colors.skin,
      width: 2,
      seed: 3_004
    })
    sketchEllipse(ctx, 300, base - 14, 14, 12, {
      fill: palette.blue,
      width: 2,
      seed: 3_005
    })
  }
  paintBand(ctx, def, left, right, {
    fill: colors.paving,
    color: palette.ink,
    width: 2
  })
}

/** The backdrop for each stretch. */
export const BACKDROPS: Record<StretchId, Backdrop> = {
  kitchen: { sky: colors.ceiling, below: colors.floor, paint: paintKitchen },
  street: { sky: colors.sky, below: colors.road, paint: paintStreet },
  market: { sky: colors.sky, below: colors.gravel, paint: paintMarket },
  park: { sky: colors.sky, below: colors.grass, paint: paintPark },
  hill: { sky: colors.rainSky, below: colors.grass, paint: paintHill },
  bridge: { sky: colors.sky, below: colors.river, paint: paintBridge },
  door: { sky: colors.sky, below: colors.paving, paint: paintDoor },
  test: { sky: colors.sky, below: colors.road, paint: paintStreet }
}

/** Paints one tile of a stretch: its scenery and ground, then the ground hazards on top. */
export function paintTile(
  ctx: CanvasRenderingContext2D,
  def: StretchDef,
  left: number,
  right: number
): void {
  BACKDROPS[def.id].paint(ctx, def, left, right)
  paintHazards(ctx, def, left, right)
}
