import { currentStretch, type Game } from '../game/game'
import { pickupCatPosition } from '../game/kitchen'
import type { Feet } from '../game/market'
import { pileRadius, usingDustpan } from '../game/pickupFlow'
import type { Ellipse } from '../game/drying'
import { SINK_MS, type Point } from '../game/pickupWorld'
import type { StretchId } from '../game/route'
import {
  BAT_SLIDE_MS,
  CUP_MS,
  FRIDGE_GAP_X,
  FRIDGE_GAP_Y,
  GRATE_HALF_H,
  GRATE_HALF_W,
  PILE_X,
  PILE_Y,
  POT_X,
  POT_Y,
  RACK_H,
  RACK_W,
  RACK_X,
  RACK_Y,
  STRAIN_WARN,
  TOTAL_BEANS
} from '../game/tuning'
import { formatBeans } from '../game/units'
import { owns } from '../game/upgrades'
import {
  boilSeed,
  CachedLayer,
  hash01,
  palette,
  settings,
  sketchArrow,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPolygon,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import type { BeanStamps } from './art/bean'
import { drawTopCat } from './art/cat'
import { drawTopDog } from './art/park'
import { drawDeckTip, drawDuck, paintBridgeDeck } from './art/bridge'
import { drawTopNet } from './art/net'
import { drawFeathers, drawTopPigeon } from './art/pigeon'
import { colors } from './art/colors'
import { drawTopPot } from './art/pot'
import { Camera } from './camera'
import type { TipView } from './pickupControls'
import { CAPTION_TOP, drawCaptions } from './captions'

const SLAB: SketchStyle = {
  fill: colors.paving,
  width: 2,
  wobble: 2,
  color: colors.roadDark
}
const CRACK: SketchStyle = { width: 1.5, passes: 1, color: colors.roadDark }
/** The chalk glow under gossip letters: its radius around each bean, in u, and its colour. */
const LETTER_GLOW = 15
const LETTER_GLOW_FILL = 'rgba(255, 249, 219, 0.75)'
const PILE: SketchStyle = {
  fill: colors.bean,
  fillStyle: 'hatch',
  hatchGap: 4,
  color: colors.beanDark,
  width: 3
}
const PRONG: SketchStyle = {
  width: 5,
  wobble: 0.8,
  passes: 1,
  color: '#868e96'
}
const PRONG_EDGE: SketchStyle = { width: 1.5, wobble: 0.5, passes: 1 }
const SHADOW: SketchStyle = { fill: 'rgba(0, 0, 0, 0.12)', width: 0, wobble: 1 }
const HAND: SketchStyle = { fill: colors.skin, width: 3, wobble: 1.5 }
const SHOE_TOP: SketchStyle = { fill: '#495057', width: 3, wobble: 1.2 }
const FINGER: SketchStyle = {
  fill: 'rgba(255, 227, 196, 0.55)',
  width: 2,
  wobble: 1
}
const PAN: SketchStyle = { fill: '#ced4da', width: 3, wobble: 1.2 }
const PAN_HANDLE: SketchStyle = {
  width: 9,
  wobble: 0.8,
  passes: 1,
  color: palette.red
}
const pan = new Float64Array(8)
const HEAP: SketchStyle = {
  fill: colors.bean,
  fillStyle: 'hatch',
  hatchGap: 4,
  color: colors.beanDark,
  width: 2
}

/** Paints the top-down paving: slabs with a few cracks. */
function paintPaving(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = colors.roadDark
  ctx.fillRect(-300, -200, 1200, 1200)
  let seed = 1
  for (let y = -100; y < 900; y += 100) {
    for (let x = -300; x < 900; x += 100) {
      const offset = (Math.floor(y / 100) % 2) * 50
      SLAB.seed = seed++
      sketchRect(ctx, x + offset + 3, y + 3, 94, 94, SLAB)
      if (hash01(seed, 7) < 0.2) {
        CRACK.seed = seed
        sketchLine(ctx, x + offset + 20, y + 30, x + offset + 60, y + 60, CRACK)
      }
    }
  }
}

const FLOOR_LIGHT: SketchStyle = { fill: colors.floor, width: 0, wobble: 0 }
const FLOOR_DARK: SketchStyle = { fill: colors.floorDark, width: 0, wobble: 0 }
const FRIDGE_TOP: SketchStyle = { fill: palette.paper, width: 3, wobble: 1.5 }
const GAP: SketchStyle = { fill: palette.ink, width: 0, wobble: 1 }
const GRATE: SketchStyle = { fill: '#343a40', width: 3, wobble: 1 }
const JOT_BACK: SketchStyle = { fill: palette.paper, width: 3, wobble: 1 }
const JOT_FILL: SketchStyle = { fill: palette.yellow, width: 0, wobble: 1 }
const JOT_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 24,
  color: palette.ink,
  outline: palette.paper
}
const GRATE_BAR: SketchStyle = {
  color: '#adb5bd',
  width: 4,
  wobble: 0.6,
  passes: 1
}
const DRAIN_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 22,
  color: palette.red,
  outline: palette.paper
}
const PUDDLE: SketchStyle = {
  fill: 'rgba(116, 192, 252, 0.8)',
  color: colors.riverDeep,
  width: 2.5,
  wobble: 2
}
const PUDDLE_SHINE: SketchStyle = {
  color: palette.paper,
  width: 3,
  wobble: 1,
  passes: 1
}
const RACK_FRAME: SketchStyle = { fill: colors.wood, width: 3, wobble: 1.2 }
const RACK_GLOW: SketchStyle = {
  fill: 'rgba(252, 196, 25, 0.35)',
  width: 0,
  wobble: 2
}
const DOWEL: SketchStyle = {
  color: colors.woodDark,
  width: 4,
  wobble: 0.6,
  passes: 1
}
const RACK_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 20,
  color: palette.ink,
  outline: palette.paper
}

/** Paints the kitchen floor from above: big tiles, and the fridge along the top edge. */
function paintKitchenFloor(ctx: CanvasRenderingContext2D): void {
  for (let y = -200; y < 1000; y += 100)
    for (let x = -300; x < 900; x += 100) {
      const dark = (Math.floor(x / 100) + Math.floor(y / 100)) % 2 === 0
      sketchRect(ctx, x, y, 100, 100, dark ? FLOOR_DARK : FLOOR_LIGHT)
    }
  FRIDGE_TOP.seed = 30
  sketchRect(ctx, FRIDGE_GAP_X - 110, -200, 220, 292, FRIDGE_TOP)
  sketchText(ctx, 'FRIDGE', FRIDGE_GAP_X, 50, {
    font: 'marker',
    size: 22,
    color: palette.inkSoft,
    seed: 31
  })
  GAP.seed = 32
  sketchRect(ctx, FRIDGE_GAP_X - 100, FRIDGE_GAP_Y - 8, 200, 14, GAP)
}

const STONE: SketchStyle = {
  fill: colors.kerbStone,
  color: palette.inkSoft,
  width: 1.8,
  wobble: 1.2,
  passes: 1
}

/** Paints the market's cobbles from above: rows of rounded stones in grout. */
function paintMarketCobbles(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = colors.gravel
  ctx.fillRect(-300, -200, 1200, 1200)
  let row = 0
  for (let y = -110; y < 920; y += 24) {
    const offset = (row++ % 2) * 15
    for (let x = -130 + offset; x < 740; x += 30) {
      STONE.seed = x * 7 + y
      sketchEllipse(ctx, x, y, 12 + hash01(x, y) * 2, 9, STONE)
    }
  }
}

const BLADE: SketchStyle = {
  color: colors.grassDark,
  width: 2,
  wobble: 0.6,
  passes: 1
}
const PETAL: SketchStyle = { fill: palette.paper, width: 1.2, wobble: 0.4 }
const DAISY_HEART: SketchStyle = { fill: palette.yellow, width: 0, wobble: 0.3 }

/** Paints the park's grass from above: tufts of blades and the odd daisy. */
function paintParkGrass(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = colors.grass
  ctx.fillRect(-300, -200, 1200, 1200)
  for (let y = -180; y < 980; y += 36)
    for (let x = -280; x < 880; x += 40) {
      const jx = x + (hash01(x, y) - 0.5) * 30
      const jy = y + (hash01(y, x) - 0.5) * 24
      BLADE.seed = x * 13 + y
      sketchLine(ctx, jx, jy, jx - 4, jy - 10, BLADE)
      sketchLine(ctx, jx + 4, jy, jx + 6, jy - 9, BLADE)
      if (hash01(x + 7, y) < 0.04) {
        for (let k = 0; k < 5; k++) {
          const a = (k * Math.PI * 2) / 5
          PETAL.seed = x + y + k
          sketchCircle(
            ctx,
            jx + Math.cos(a) * 5,
            jy + Math.sin(a) * 5,
            3,
            PETAL
          )
        }
        DAISY_HEART.seed = x + y
        sketchCircle(ctx, jx, jy, 2.5, DAISY_HEART)
      }
    }
}

const CONTOUR: SketchStyle = {
  color: colors.grassDark,
  width: 3,
  wobble: 2,
  passes: 1
}
const DOWNHILL: SketchStyle & { head: number } = {
  color: 'rgba(43, 138, 62, 0.55)',
  width: 6,
  wobble: 1,
  passes: 1,
  head: 22
}

/**
 * Paints the hillside from above: grass, contour lines running across the slope, and
 * worn arrows showing which way is down (left), where loose beans creep.
 */
function paintHillside(ctx: CanvasRenderingContext2D): void {
  paintParkGrass(ctx)
  for (let x = -260; x < 880; x += 110) {
    CONTOUR.seed = x
    sketchLine(ctx, x, -200, x + 30, 1000, CONTOUR)
  }
  for (let y = 180; y < 760; y += 190)
    for (let x = 140; x < 560; x += 260) {
      DOWNHILL.seed = x + y
      sketchArrow(ctx, x + 60, y, x - 30, y + 6, DOWNHILL)
    }
}

/** Each stretch's ground from above. Stretches without their own yet use paving. */
const GROUNDS: Partial<
  Record<StretchId, (ctx: CanvasRenderingContext2D) => void>
> = {
  kitchen: paintKitchenFloor,
  market: paintMarketCobbles,
  park: paintParkGrass,
  hill: paintHillside,
  bridge: paintBridgeDeck
}

/** The top-down Pickup view: the ground, the pile, every bean body, the pot and the tweezers. */
export class PickupScene {
  readonly camera: Camera
  private readonly grounds = new Map<StretchId, CachedLayer>()
  private potSquash = 1
  private readonly catAt = { x: 0, y: 0 }

  constructor(
    private readonly viewport: Viewport,
    private readonly stamps: BeanStamps
  ) {
    this.camera = new Camera(viewport)
  }

  /** The cached ground for a stretch, painted the first time it is needed. */
  private groundFor(id: StretchId): CachedLayer {
    let layer = this.grounds.get(id)
    if (!layer) {
      layer = new CachedLayer(this.viewport, GROUNDS[id] ?? paintPaving, {
        x: -300,
        y: -200,
        width: 1200,
        height: 1200
      })
      this.grounds.set(id, layer)
    }
    return layer
  }

  /** Squashes the pot when beans go in. */
  bump(): void {
    this.potSquash = 1.12
  }

  render(
    ctx: CanvasRenderingContext2D,
    game: Game,
    timeMs: number,
    dtS: number,
    tip: TipView
  ): void {
    const camera = this.camera
    const world = game.pickup.world
    camera.shake(game.fx.shake)
    camera.apply(ctx)
    const stretchId = currentStretch(game).id
    this.groundFor(stretchId).draw(ctx)
    if (!world) return
    if (stretchId === 'kitchen') this.drawFridgeBeans(ctx, game, timeMs)
    else if (world.grate) this.drawGrate(ctx, world.grate, world.zone.drain)
    if (world.sinking.length > 0) this.drawSinking(ctx, game)
    if (world.deck) drawDeckTip(ctx, world.slide.x, timeMs)
    for (const puddle of world.puddles) this.drawPuddle(ctx, puddle)
    const carry = game.pickup.carry
    if (world.rack) this.drawRack(ctx, game)

    const stamps = this.stamps
    for (const body of world.beans)
      camera.stamp(
        world.swollen.has(body) ? stamps.swollen : stamps.pickup[body.id % 3]!,
        ctx,
        body.position.x,
        body.position.y,
        body.angle
      )
    if (world.letters.length > 0) this.drawLetters(ctx, game, timeMs)
    camera.apply(ctx)
    // Flung beans ride ducks in the river beside the deck until they bring them back.
    for (const duck of world.ducks)
      drawDuck(
        ctx,
        duck.side < 0 ? 24 : 576,
        duck.y,
        -duck.side,
        1,
        timeMs + duck.y,
        (x, y, angle) => camera.stamp(stamps.pickup[0]!, ctx, x, y, angle)
      )
    camera.apply(ctx)
    this.drawJot(ctx, game)

    const zone = world.zone
    const pile = zone.pile - world.pileHeld
    if (pile > 0) {
      const r = pileRadius(pile)
      PILE.seed = zone.id
      sketchEllipse(ctx, PILE_X, PILE_Y, r, r * 0.8, PILE)
      sketchText(ctx, `Pile: ${formatBeans(pile)}`, PILE_X, PILE_Y + r + 18, {
        font: 'marker',
        size: 22,
        outline: palette.paper
      })
    }

    this.potSquash += (1 - this.potSquash) * Math.min(1, dtS * 10)
    const holding = carry.count > 0
    drawTopPot(
      ctx,
      camera,
      stamps,
      POT_X,
      POT_Y,
      game.counts.pot / TOTAL_BEANS,
      holding,
      settings.get().reducedMotion ? 1 : this.potSquash,
      timeMs
    )
    if (game.flock.view === 'pickup' && game.net.phase !== 'off')
      drawTopNet(ctx, game, POT_X, POT_Y, timeMs)

    if (stretchId === 'kitchen') this.drawCat(ctx, game, timeMs)
    if (stretchId === 'market' && game.market.feet.active)
      this.drawFeet(ctx, game.market.feet, timeMs)
    if (stretchId === 'park') this.drawParkDog(ctx, game, timeMs)
    const flock = game.flock
    if (flock.view === 'pickup') {
      for (const pigeon of flock.pigeons)
        drawTopPigeon(ctx, pigeon, timeMs, currentStretch(game).bird)
      drawFeathers(ctx, flock.feathers)
    }

    const cup = game.pickup.cup
    if (cup.armed) this.drawCupTimer(ctx, cup.x, cup.y, cup.ms / CUP_MS)

    if (holding && carry.mode === 'hands') {
      if (world.pileHeld > 0 && usingDustpan(game))
        this.drawDustpan(ctx, world.tip.x, world.tip.y, carry.count, timeMs)
      else
        this.drawHands(
          ctx,
          world.tip.x,
          world.tip.y,
          carry.count,
          timeMs,
          world.pileHeld > 0
        )
      for (const bean of world.held)
        camera.stamp(
          world.swollen.has(bean.body)
            ? stamps.swollen
            : stamps.pickup[bean.body.id % 3]!,
          ctx,
          bean.body.position.x,
          bean.body.position.y - 6,
          bean.body.angle
        )
      camera.apply(ctx)
      drawCaptions(ctx, game.fx.captions, 0, this.viewport.width, CAPTION_TOP)
      return
    }

    if (holding) {
      const strained = carry.strain > STRAIN_WARN
      const tremble = strained ? (carry.strain - STRAIN_WARN) * 8 : 0
      const wiggle = carry.slipperyMs > 0 ? Math.sin(timeMs / 25) * 0.6 : 0
      for (const bean of world.held) {
        const layer = world.swollen.has(bean.body)
          ? stamps.swollen
          : strained
            ? stamps.strained
            : stamps.pickup[bean.body.id % 3]!
        camera.stamp(
          layer,
          ctx,
          bean.body.position.x + (Math.random() - 0.5) * tremble,
          bean.body.position.y + (Math.random() - 0.5) * tremble,
          bean.body.angle + wiggle
        )
      }
      camera.apply(ctx)
    }

    if (tip.visible)
      this.drawTweezers(
        ctx,
        tip,
        holding,
        carry.strain,
        owns(game, 'tweezers'),
        timeMs
      )
    drawCaptions(ctx, game.fx.captions, 0, this.viewport.width, CAPTION_TOP)
  }

  /** A bean the cat batted, sliding into the gap, and how many beans are under the fridge. */
  private drawFridgeBeans(
    ctx: CanvasRenderingContext2D,
    game: Game,
    timeMs: number
  ): void {
    const slide = game.kitchen.slide
    const zone = game.pickup.world?.zone
    if (slide) {
      const t = Math.min(1, slide.ms / BAT_SLIDE_MS)
      this.camera.stamp(
        this.stamps.pickup[0]!,
        ctx,
        slide.fromX + (FRIDGE_GAP_X - slide.fromX) * t,
        slide.fromY + (FRIDGE_GAP_Y - slide.fromY) * t,
        timeMs / 40
      )
      this.camera.apply(ctx)
    }
    if (zone && zone.drain > 0)
      sketchText(
        ctx,
        `${zone.drain} under the fridge`,
        FRIDGE_GAP_X + 200,
        FRIDGE_GAP_Y - 2,
        DRAIN_TEXT
      )
  }

  /**
   * Beans spelling gossip, turned along their strokes, over a pale chalk glow that joins
   * them into letters you can read on a small phone. They shiver when a touch warns you
   * that the next grab scrambles them.
   */
  private drawLetters(
    ctx: CanvasRenderingContext2D,
    game: Game,
    timeMs: number
  ): void {
    const world = game.pickup.world
    if (!world) return
    const wiggle = game.gossip.spelling?.wiggleMs ?? 0
    const shake = wiggle > 0 ? Math.min(1, wiggle / 300) * 3 : 0
    this.camera.apply(ctx)
    ctx.beginPath()
    for (const letter of world.letters) {
      const { x, y } = letter.body.position
      ctx.moveTo(x + LETTER_GLOW, y)
      ctx.arc(x, y, LETTER_GLOW, 0, Math.PI * 2)
    }
    ctx.fillStyle = LETTER_GLOW_FILL
    ctx.fill()
    let i = 0
    for (const letter of world.letters) {
      const jitter = shake ? Math.sin(timeMs / 30 + i * 1.7) * shake : 0
      this.camera.stamp(
        this.stamps.letter,
        ctx,
        letter.body.position.x + jitter,
        letter.body.position.y - jitter * 0.5,
        letter.angle
      )
      i++
    }
  }

  /** While Jot It Down is held, a pencil scribbles and a bar fills under the letters. */
  private drawJot(ctx: CanvasRenderingContext2D, game: Game): void {
    const jot = game.gossip.jot
    const world = game.pickup.world
    if (!jot.holding || !world || world.letters.length === 0) return
    let bottom = 0
    for (const letter of world.letters) bottom = Math.max(bottom, letter.toY)
    const y = bottom + 40
    JOT_BACK.seed = 34
    sketchRoundRect(ctx, 160, y - 14, 280, 28, 8, JOT_BACK)
    JOT_FILL.seed = 35
    if (jot.level > 0.02)
      sketchRoundRect(ctx, 164, y - 10, 272 * jot.level, 20, 6, JOT_FILL)
    sketchText(ctx, 'Jotting…', 300, y - 34, JOT_TEXT)
  }

  /** A drain grate, and a label saying how many beans are down it. */
  private drawGrate(
    ctx: CanvasRenderingContext2D,
    grate: Point,
    drain: number
  ): void {
    const { x: gx, y: gy } = grate
    GRATE.seed = 33
    sketchRoundRect(
      ctx,
      gx - GRATE_HALF_W,
      gy - GRATE_HALF_H,
      GRATE_HALF_W * 2,
      GRATE_HALF_H * 2,
      8,
      GRATE
    )
    for (let x = gx - 32; x <= gx + 32; x += 16) {
      GRATE_BAR.seed = x
      sketchLine(ctx, x, gy - 24, x, gy + 24, GRATE_BAR)
    }
    if (drain > 0)
      sketchText(
        ctx,
        `${drain} down the drain`,
        Math.min(430, Math.max(170, gx)),
        gy - 50,
        DRAIN_TEXT
      )
  }

  /** A puddle on the ground, with a couple of glints. */
  private drawPuddle(ctx: CanvasRenderingContext2D, puddle: Ellipse): void {
    PUDDLE.seed = Math.round(puddle.x)
    sketchEllipse(ctx, puddle.x, puddle.y, puddle.rx, puddle.ry, PUDDLE)
    PUDDLE_SHINE.seed = PUDDLE.seed + 1
    sketchLine(
      ctx,
      puddle.x - puddle.rx * 0.5,
      puddle.y - puddle.ry * 0.35,
      puddle.x - puddle.rx * 0.15,
      puddle.y - puddle.ry * 0.5,
      PUDDLE_SHINE
    )
    sketchLine(
      ctx,
      puddle.x + puddle.rx * 0.25,
      puddle.y + puddle.ry * 0.3,
      puddle.x + puddle.rx * 0.45,
      puddle.y + puddle.ry * 0.2,
      PUDDLE_SHINE
    )
  }

  /**
   * The drying rack at the bottom left: a wooden frame with dowels, the beans drying on
   * it, and how many. It glows while you carry a swollen bean.
   */
  private drawRack(ctx: CanvasRenderingContext2D, game: Game): void {
    const world = game.pickup.world
    if (!world) return
    let carryingSwollen = false
    for (const bean of world.held)
      if (world.swollen.has(bean.body)) carryingSwollen = true
    if (carryingSwollen) {
      RACK_GLOW.seed = 60
      sketchRoundRect(
        ctx,
        RACK_X - 10,
        RACK_Y - 10,
        RACK_W + 20,
        RACK_H + 20,
        14,
        RACK_GLOW
      )
    }
    RACK_FRAME.seed = 61
    sketchRect(ctx, RACK_X, RACK_Y, RACK_W, RACK_H, RACK_FRAME)
    for (let i = 1; i <= 3; i++) {
      DOWEL.seed = 61 + i
      const y = RACK_Y + (RACK_H * i) / 4
      sketchLine(ctx, RACK_X + 8, y, RACK_X + RACK_W - 8, y, DOWEL)
    }
    const drying = game.drying.length
    for (let i = 0; i < Math.min(drying, 9); i++)
      this.camera.stamp(
        this.stamps.swollen,
        ctx,
        RACK_X + 26 + (i % 3) * 48,
        RACK_Y + (RACK_H * (1 + Math.floor(i / 3))) / 4 - 8,
        0.2 * (i % 2 ? 1 : -1)
      )
    this.camera.apply(ctx)
    RACK_TEXT.seed = 66
    sketchText(
      ctx,
      drying > 0 ? `Drying ${drying}` : 'Drying rack',
      RACK_X + RACK_W / 2,
      RACK_Y - 18,
      RACK_TEXT
    )
  }

  /** Beans dropping through the grate: they darken and shrink into the bars. */
  private drawSinking(ctx: CanvasRenderingContext2D, game: Game): void {
    const world = game.pickup.world
    if (!world) return
    for (const bean of world.sinking) {
      const t = bean.ms / SINK_MS
      ctx.globalAlpha = 1 - t
      this.camera.stamp(
        this.stamps.pickup[0]!,
        ctx,
        bean.x,
        bean.y + t * 10,
        bean.angle + t * 3
      )
    }
    ctx.globalAlpha = 1
    this.camera.apply(ctx)
  }

  /** The cat, walking in, wiggling before a bat, or stalking off. */
  private drawCat(
    ctx: CanvasRenderingContext2D,
    game: Game,
    timeMs: number
  ): void {
    const pc = game.kitchen.pickupCat
    if (pc.phase === 'off') return
    const at = pickupCatPosition(pc, this.catAt)
    const leaving = pc.phase === 'leave'
    const angle = leaving
      ? Math.atan2(pc.fromY - at.y, pc.fromX - at.x)
      : Math.atan2(FRIDGE_GAP_Y - at.y, FRIDGE_GAP_X - at.x)
    drawTopCat(ctx, at.x, at.y, angle, pc.phase === 'wiggle', timeMs)
  }

  /** The park dog at the edge barking, dashing through the beans, or running off. */
  private drawParkDog(
    ctx: CanvasRenderingContext2D,
    game: Game,
    timeMs: number
  ): void {
    const dog = game.park.pickupDog
    if (dog.phase === 'off') return
    drawTopDog(
      ctx,
      dog.x,
      dog.y,
      Math.atan2(dog.dy, dog.dx),
      dog.phase !== 'bark',
      dog.phase === 'bark',
      timeMs
    )
  }

  /** A shopper's shoes stomping across the view, with their shadow. */
  private drawFeet(
    ctx: CanvasRenderingContext2D,
    feet: Feet,
    timeMs: number
  ): void {
    const stride = Math.sin(timeMs / 90) * 22
    SHADOW.seed = 80
    sketchEllipse(ctx, feet.x, feet.y + 6, 60, 34, SHADOW)
    for (const side of [-1, 1]) {
      const along = side * stride
      SHOE_TOP.seed = 81 + side
      sketchEllipse(
        ctx,
        feet.x + feet.dir * along,
        feet.y + side * 14,
        26,
        12,
        SHOE_TOP
      )
    }
  }

  /** A ring that fills while a still press turns into cupped hands. */
  private drawCupTimer(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number
  ): void {
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.strokeStyle = palette.yellow
    ctx.beginPath()
    ctx.arc(
      x,
      y,
      34,
      -Math.PI / 2,
      -Math.PI / 2 + Math.min(1, progress) * Math.PI * 2
    )
    ctx.stroke()
  }

  /** Two cupped hands with a heap of beans and the count they carry. */
  private drawHands(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    count: number,
    timeMs: number,
    heap: boolean
  ): void {
    const boil = boilSeed(timeMs)
    HAND.seed = 70 + boil
    sketchEllipse(ctx, x - 20, y + 8, 30, 22, HAND)
    sketchEllipse(ctx, x + 20, y + 8, 30, 22, HAND)
    if (heap) {
      HEAP.seed = 71 + boil
      sketchEllipse(ctx, x, y, 26, 16, HEAP)
    }
    sketchText(ctx, `x${count}`, x + 46, y - 26, {
      font: 'marker',
      size: 24,
      outline: palette.paper,
      seed: 72
    })
  }

  /** Grandma's dustpan, heaped with beans, and the count it carries. */
  private drawDustpan(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    count: number,
    timeMs: number
  ): void {
    const boil = boilSeed(timeMs)
    PAN_HANDLE.seed = 73
    sketchLine(ctx, x + 4, y + 20, x + 14, y + 78, PAN_HANDLE)
    pan.set([x - 50, y - 30, x + 50, y - 30, x + 42, y + 22, x - 42, y + 22])
    PAN.seed = 74 + boil
    sketchPolygon(ctx, pan, PAN)
    HEAP.seed = 75 + boil
    sketchEllipse(ctx, x, y - 8, 40, 20, HEAP)
    sketchText(ctx, `x${formatBeans(count)}`, x + 58, y - 40, {
      font: 'marker',
      size: 26,
      outline: palette.paper,
      seed: 76
    })
  }

  private drawTweezers(
    ctx: CanvasRenderingContext2D,
    tip: TipView,
    closed: boolean,
    strain: number,
    wide: boolean,
    timeMs: number
  ): void {
    const shake =
      strain > STRAIN_WARN
        ? Math.sin(timeMs / 18) * (strain - STRAIN_WARN) * 10
        : 0
    const x = tip.x + shake
    const y = tip.y
    PRONG.seed = 1
    PRONG_EDGE.seed = 2
    if (tip.fingers) {
      // Held by two fingers: each prong runs down to its fingertip, so closing the
      // pinch visibly closes the tweezers above your fingers.
      const spread = closed ? 2 : 6
      sketchLine(ctx, x - spread, y, tip.ax, tip.ay, PRONG)
      sketchLine(ctx, x + spread, y, tip.bx, tip.by, PRONG)
      FINGER.seed = 4
      sketchCircle(ctx, tip.ax, tip.ay, 16, FINGER)
      sketchCircle(ctx, tip.bx, tip.by, 16, FINGER)
      return
    }
    // Wider Tweezers open wider.
    const spread = closed ? (wide ? 6 : 2) : wide ? 16 : 9
    SHADOW.seed = 3
    sketchCircle(ctx, x + 6, y + 6, 6, SHADOW)
    const topX = x + 36
    const topY = y - 84
    sketchLine(ctx, topX - 4, topY, x - spread, y, PRONG)
    sketchLine(ctx, topX + 4, topY + 4, x + spread, y + 2, PRONG)
    sketchLine(ctx, topX - 6, topY, x - spread - 2, y, PRONG_EDGE)
    sketchLine(ctx, topX + 6, topY + 4, x + spread + 2, y + 2, PRONG_EDGE)
  }

  dispose(): void {
    for (const layer of this.grounds.values()) layer.dispose()
    this.grounds.clear()
  }
}
