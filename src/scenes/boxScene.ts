import type { Caption } from '../game/fx'
import type { Game } from '../game/game'
import { packetLines, type Packet } from '../game/packets'
import {
  BOX_FLOOD_MS,
  DIG_STROKES,
  PLANT_HOLD_MS,
  WATER_FILL_MS
} from '../game/tuning'
import {
  cardRect,
  MAX_CARDS,
  podSpot,
  slotRect,
  SOIL,
  type Rect,
  type Slot,
  type WindowBoxState
} from '../game/windowBox'
import {
  boilSeed,
  CachedLayer,
  formatClock,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchRect,
  sketchRoundRect,
  sketchText,
  timeLeftMs,
  timerProgress,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import type { BeanStamps } from './art/bean'
import { colors } from './art/colors'
import { Camera } from './camera'
import { CAPTION_TOP, drawCaptions } from './captions'

const WASH = 'rgba(253, 246, 227, 0.6)'
const PLANK: SketchStyle = {
  fill: colors.wood,
  fillStyle: 'hatch',
  hatchGap: 10,
  hatchAngle: 0.1,
  width: 3,
  wobble: 1.5
}
const PLANK_BASE: SketchStyle = { fill: '#d9b48a', width: 0, wobble: 1 }
const SOIL_STYLE: SketchStyle = { fill: colors.mud, width: 2.5, wobble: 1.5 }
const WET: SketchStyle = { fill: '#4a2f1b', width: 0, wobble: 2 }
const DIVIDER: SketchStyle = {
  color: colors.woodDark,
  width: 5,
  wobble: 1,
  passes: 1
}
const CLOD: SketchStyle = { fill: '#8f6440', width: 1.5, wobble: 0.8 }
const HOLE: SketchStyle = { fill: '#2b1a0e', width: 2.5, wobble: 1.5 }
const MOUND: SketchStyle = { fill: '#9c6b42', width: 2.5, wobble: 1.5 }
const STICK: SketchStyle = {
  color: colors.woodDark,
  width: 3,
  wobble: 0.5,
  passes: 1
}
const FLAG: SketchStyle = { fill: palette.paper, width: 2, wobble: 0.8 }
const STEM: SketchStyle = {
  color: '#2b8a3e',
  width: 4,
  wobble: 0.8,
  passes: 1
}
const LEAF: SketchStyle = { fill: '#69db7c', width: 2, wobble: 0.8 }
const POD: SketchStyle = { fill: '#69db7c', width: 2.5, wobble: 1.2 }
const PEA: SketchStyle = { fill: '#a9e34b', width: 2.5, wobble: 1 }
const EYE: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.2 }
const SMILE: SketchStyle & { smooth: boolean } = {
  width: 2,
  wobble: 0.4,
  passes: 1,
  smooth: true
}
const GLASSES: SketchStyle = { width: 2, wobble: 0.3, passes: 1 }
const MOUSTACHE: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.6 }
const CARD: SketchStyle = { fill: '#fff8e1', width: 2.5, wobble: 1 }
const CARD_PICKED: SketchStyle = { fill: palette.yellow, width: 4, wobble: 1 }
const EMPTY: SketchStyle = {
  color: palette.inkSoft,
  width: 2,
  wobble: 1.5,
  passes: 1
}
const RING_BACK: SketchStyle = { fill: palette.paper, width: 3, wobble: 1 }
const BAR_BACK: SketchStyle = { fill: palette.paper, width: 3, wobble: 1 }
const BAR_FILL: SketchStyle = { fill: palette.water, width: 0, wobble: 1 }
const BAR_OVER: SketchStyle = { fill: palette.red, width: 0, wobble: 1 }
const CAN: SketchStyle = { fill: '#adb5bd', width: 3, wobble: 1 }
const SPOUT: SketchStyle = {
  color: palette.ink,
  width: 6,
  wobble: 0.6,
  passes: 1
}
const DROP: SketchStyle = { fill: palette.water, width: 0, wobble: 0.5 }
const FLOOD: SketchStyle = {
  fill: 'rgba(116, 192, 252, 0.6)',
  width: 0,
  wobble: 3
}
const TITLE: SketchTextStyle = {
  font: 'marker',
  size: 40,
  color: palette.ink,
  outline: palette.paper,
  tilt: 0.03,
  seed: 801
}
const LABEL: SketchTextStyle = {
  font: 'hand',
  size: 22,
  color: palette.ink,
  outline: palette.paper
}
const CARD_HEAD: SketchTextStyle = {
  font: 'marker',
  size: 22,
  color: palette.ink,
  align: 'left'
}
const CARD_SUB: SketchTextStyle = {
  font: 'hand',
  size: 24,
  color: palette.ink,
  align: 'left'
}
const CLOCK: SketchTextStyle = {
  font: 'marker',
  size: 26,
  color: palette.paper,
  seed: 802
}
const POD_COUNT: SketchTextStyle = {
  font: 'marker',
  size: 20,
  color: palette.paper,
  outline: palette.ink
}
const smile = new Float64Array(6)

/** The planter's frame and its front board, in design units. */
const FRAME = { x: 24, y: 412, w: 552, h: 228 } as const

/**
 * The window box over a blurred copy of the scene you left: seed packets up top, the
 * planter's slots below, and the hold meters for planting and watering.
 */
export class BoxScene {
  private readonly camera: Camera
  private backdrop: HTMLCanvasElement | null = null
  private planter: CachedLayer | null = null
  private readonly caption: Caption[] = []

  constructor(
    private readonly viewport: Viewport,
    private readonly stamps: BeanStamps
  ) {
    this.camera = new Camera(viewport)
  }

  /** True once the scene behind the box has been copied. */
  get captured(): boolean {
    return this.backdrop !== null
  }

  /**
   * Copies the last frame at an eighth of its size. Drawn back at full size it smears
   * into a cheap blur, and costs a sixty-fourth of the memory.
   */
  capture(source: HTMLCanvasElement): void {
    const copy = document.createElement('canvas')
    copy.width = Math.max(1, Math.round(source.width / 8))
    copy.height = Math.max(1, Math.round(source.height / 8))
    copy.getContext('2d')?.drawImage(source, 0, 0, copy.width, copy.height)
    this.backdrop = copy
  }

  render(ctx: CanvasRenderingContext2D, game: Game, timeMs: number): void {
    const box = game.box
    const canvas = ctx.canvas
    if (this.backdrop) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(this.backdrop, 0, 0, canvas.width, canvas.height)
      ctx.fillStyle = WASH
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
    this.viewport.apply(ctx)
    sketchText(ctx, 'Window Box', 300, 44, TITLE)

    this.drawPackets(ctx, game)
    this.planter ??= new CachedLayer(this.viewport, paintPlanter, {
      x: FRAME.x - 10,
      y: FRAME.y - 10,
      width: FRAME.w + 20,
      height: FRAME.h + 20
    })
    this.planter.draw(ctx)
    const count = box.slots.length
    for (let i = 0; i < count; i++)
      this.drawSlot(ctx, game, box.slots[i]!, slotRect(i, count), i, timeMs)
    for (let i = 1; i < count; i++) {
      const rect = slotRect(i, count)
      if (rect.x === SOIL.x) continue
      DIVIDER.seed = 810 + i
      sketchLine(ctx, rect.x, rect.y + 4, rect.x, rect.y + rect.h - 4, DIVIDER)
    }
    if (box.batch) {
      const left = formatClock(timeLeftMs(box.batch))
      sketchText(ctx, `Growing ${left}`, 300, FRAME.y + FRAME.h - 18, CLOCK)
    }
    this.drawFlash(ctx, box)
    this.drawHold(ctx, game, timeMs)
    // One caption at a time fits between the title and the packets.
    const newest = game.fx.captions[game.fx.captions.length - 1]
    this.caption.length = 0
    if (newest) this.caption.push(newest)
    drawCaptions(ctx, this.caption, 0, this.viewport.width, CAPTION_TOP)
  }

  /** The seed packets as cards, the chosen one lifted and glowing. */
  private drawPackets(ctx: CanvasRenderingContext2D, game: Game): void {
    const list = game.packets.list
    LABEL.align = 'center'
    if (list.length === 0) {
      EMPTY.seed = 820
      sketchRoundRect(ctx, 40, 150, 520, 180, 16, EMPTY)
      sketchText(ctx, 'No seed packets.', 300, 220, LABEL)
      sketchText(ctx, 'Beans lost for good end up here.', 300, 256, LABEL)
      return
    }
    const shown = Math.min(list.length, MAX_CARDS)
    for (let i = 0; i < shown; i++)
      this.drawCard(
        ctx,
        list[i]!,
        cardRect(i),
        list[i]!.id === game.box.selected
      )
    if (list.length > shown)
      sketchText(ctx, `+${list.length - shown} more packets`, 300, 366, LABEL)
  }

  private drawCard(
    ctx: CanvasRenderingContext2D,
    packet: Packet,
    rect: Rect,
    chosen: boolean
  ): void {
    const lift = chosen ? -8 : 0
    const style = chosen ? CARD_PICKED : CARD
    style.seed = 830 + packet.id
    sketchRoundRect(ctx, rect.x, rect.y + lift, rect.w, rect.h, 10, style)
    this.camera.stamp(
      this.stamps.pickup[packet.id % 3]!,
      ctx,
      rect.x + 26,
      rect.y + rect.h / 2 + lift,
      -0.6
    )
    this.viewport.apply(ctx)
    const [head, sub] = packetLines(packet)
    CARD_HEAD.seed = 840 + packet.id
    sketchText(ctx, head, rect.x + 46, rect.y + 30 + lift, CARD_HEAD)
    sketchText(ctx, sub, rect.x + 46, rect.y + 64 + lift, CARD_SUB)
  }

  /** One slot: bare soil, a dug hole, planted packets, sprouts, or pods with faces. */
  private drawSlot(
    ctx: CanvasRenderingContext2D,
    game: Game,
    slot: Slot,
    rect: Rect,
    index: number,
    timeMs: number
  ): void {
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h * 0.55
    const seed = 850 + index * 10
    if (slot.state === 'bare') {
      for (let k = 0; k < 4; k++) {
        CLOD.seed = seed + k
        sketchCircle(ctx, cx - 40 + k * 26, cy + (k % 2) * 14, 6, CLOD)
      }
      // Dents show how far the dig has got.
      for (let k = 0; k < DIG_STROKES; k++) {
        const done = k < slot.strokes
        sketchCircle(ctx, cx - 50 + k * 20, rect.y + rect.h - 26, 5, {
          fill: done ? palette.yellow : 'rgba(0, 0, 0, 0.25)',
          width: 0,
          wobble: 0.3,
          seed: seed + 5 + k
        })
      }
      LABEL.align = 'center'
      sketchText(ctx, 'Rub to dig', cx, rect.y + 24, LABEL)
      return
    }
    if (slot.state === 'watered') {
      WET.seed = seed
      sketchEllipse(ctx, cx, cy, rect.w * 0.4, rect.h * 0.32, WET)
    }
    if (
      slot.state === 'dug' ||
      slot.state === 'planted' ||
      slot.state === 'watered'
    ) {
      const style = slot.state === 'dug' ? HOLE : MOUND
      style.seed = seed + 1
      sketchEllipse(ctx, cx, cy, rect.w * 0.3, 22, style)
    }
    if (slot.state === 'planted') {
      for (const [j, packet] of slot.packets.entries()) {
        const x = cx + (j - (slot.packets.length - 1) / 2) * 44
        STICK.seed = seed + 2 + j
        sketchLine(ctx, x, cy, x, cy - 46, STICK)
        FLAG.seed = seed + 5 + j
        sketchRect(ctx, x - 16, cy - 72, 32, 26, FLAG)
        sketchText(ctx, String(packet.beans), x, cy - 59, {
          font: 'marker',
          size: 18,
          seed: seed + j
        })
      }
      return
    }
    if (slot.state === 'watered') {
      const grow = game.box.batch ? timerProgress(game.box.batch) : 0
      for (let j = 0; j < slot.packets.length; j++) {
        const x = cx + (j - (slot.packets.length - 1) / 2) * 44
        const h = 12 + grow * 40
        STEM.seed = seed + 2 + j
        sketchLine(ctx, x, cy, x, cy - h, STEM)
        LEAF.seed = seed + 6 + j
        const leaf = 5 + grow * 7
        sketchEllipse(ctx, x - leaf, cy - h + 4, leaf, leaf * 0.5, LEAF)
        sketchEllipse(ctx, x + leaf, cy - h + 8, leaf, leaf * 0.5, LEAF)
      }
      return
    }
    if (slot.state !== 'grown') return
    const n = slot.packets.length
    for (let j = 0; j < n; j++) {
      const spot = podSpot(rect, j, n)
      const packet = slot.packets[j]!
      drawPod(
        ctx,
        spot.x,
        spot.y,
        packet.id,
        packet.id === game.box.pea,
        timeMs
      )
      sketchText(ctx, String(packet.beans), spot.x, spot.y + 44, POD_COUNT)
    }
  }

  /** A short burst on a slot after it is dug, planted, watered, flooded or picked. */
  private drawFlash(ctx: CanvasRenderingContext2D, box: WindowBoxState): void {
    const flash = box.flash
    if (!flash) return
    const t = flash.ms / 700
    const rect = flash.slot >= 0 ? slotRect(flash.slot, box.slots.length) : SOIL
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    ctx.globalAlpha = 1 - t
    if (flash.kind === 'flood') {
      FLOOD.seed = 870
      sketchRoundRect(
        ctx,
        rect.x - 6,
        rect.y - 20 * (1 - t),
        rect.w + 12,
        rect.h,
        12,
        FLOOD
      )
    } else {
      const color =
        flash.kind === 'water'
          ? palette.water
          : flash.kind === 'pick'
            ? palette.green
            : palette.yellow
      sketchCircle(ctx, cx, cy, 30 + t * 50, {
        color,
        width: 5,
        wobble: 2,
        passes: 1,
        seed: 871
      })
    }
    ctx.globalAlpha = 1
  }

  /** The plant hold's ring with the packet in your fingers, or the watering can and its bar. */
  private drawHold(
    ctx: CanvasRenderingContext2D,
    game: Game,
    timeMs: number
  ): void {
    const box = game.box
    if (box.mode === 'plant') {
      const packet = game.packets.list.find(p => p.id === box.selected)
      RING_BACK.seed = 880
      sketchCircle(ctx, box.x, box.y, 30, RING_BACK)
      ctx.lineWidth = 7
      ctx.lineCap = 'round'
      ctx.strokeStyle = palette.green
      ctx.beginPath()
      ctx.arc(
        box.x,
        box.y,
        30,
        -Math.PI / 2,
        -Math.PI / 2 + Math.min(1, box.plantMs / PLANT_HOLD_MS) * Math.PI * 2
      )
      ctx.stroke()
      if (packet)
        sketchText(ctx, `${packet.beans}`, box.x, box.y, {
          font: 'marker',
          size: 22,
          seed: 881
        })
      return
    }
    if (box.mode === 'dig') {
      // Dirt flies off the fingers.
      const boil = boilSeed(timeMs, 12)
      for (let k = 0; k < 4; k++) {
        const a = (boil * 1.7 + k * 1.6) % (Math.PI * 2)
        sketchCircle(
          ctx,
          box.x + Math.cos(a) * 26,
          box.y + Math.sin(a) * 18,
          4,
          {
            ...CLOD,
            seed: 882 + k
          }
        )
      }
      return
    }
    if (box.mode !== 'water') return
    const all = !game.shop.owned('box')
    const rect = all ? SOIL : slotRect(box.slot, box.slots.length)
    const cx = rect.x + rect.w / 2
    const tilt = Math.min(1, box.water.heldMs / 200)
    ctx.save()
    ctx.translate(cx + 40, FRAME.y - 30)
    ctx.rotate(-0.6 * tilt)
    CAN.seed = 890
    sketchRoundRect(ctx, -10, -34, 64, 50, 10, CAN)
    SPOUT.seed = 891
    sketchLine(ctx, -6, 0, -46, -26, SPOUT)
    ctx.restore()
    for (let k = 0; k < 6; k++) {
      const fall = ((timeMs / 3 + k * 37) % 90) / 90
      DROP.seed = 892 + k
      sketchCircle(
        ctx,
        cx - 30 + (k % 3) * 12 + (all ? (k - 3) * 60 : 0),
        FRAME.y - 30 + fall * 80,
        4,
        DROP
      )
    }
    // The bar fills over WATER_FILL_MS, then turns red until it floods at BOX_FLOOD_MS.
    const x = 100
    const y = FRAME.y + FRAME.h + 34
    const w = 400
    BAR_BACK.seed = 893
    sketchRoundRect(ctx, x, y - 16, w, 32, 10, BAR_BACK)
    const full = WATER_FILL_MS / BOX_FLOOD_MS
    const held = Math.min(1, box.water.heldMs / BOX_FLOOD_MS)
    BAR_FILL.seed = 894
    sketchRoundRect(
      ctx,
      x + 4,
      y - 12,
      (w - 8) * Math.min(held, full),
      24,
      8,
      BAR_FILL
    )
    if (held > full) {
      BAR_OVER.seed = 895
      sketchRoundRect(
        ctx,
        x + 4 + (w - 8) * full,
        y - 12,
        (w - 8) * (held - full),
        24,
        8,
        BAR_OVER
      )
    }
    LABEL.align = 'center'
    sketchText(ctx, held >= full ? 'Let go!' : 'Watering…', 300, y + 36, LABEL)
  }

  /** Frees the copied frame and the planter while the box is shut. */
  release(): void {
    this.backdrop = null
    this.planter?.dispose()
    this.planter = null
  }
}

/** The planter: a hatched wooden frame around a bed of soil. */
function paintPlanter(ctx: CanvasRenderingContext2D): void {
  PLANK_BASE.seed = 860
  sketchRect(ctx, FRAME.x, FRAME.y, FRAME.w, FRAME.h, PLANK_BASE)
  PLANK.seed = 861
  sketchRect(ctx, FRAME.x, FRAME.y, FRAME.w, FRAME.h, PLANK)
  SOIL_STYLE.seed = 862
  sketchRect(ctx, SOIL.x, SOIL.y, SOIL.w, SOIL.h, SOIL_STYLE)
}

/** A bean pod with a face, swaying. The pea in disguise wears glasses and a moustache. */
function drawPod(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
  pea: boolean,
  timeMs: number
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.sin(timeMs / 420 + seed) * 0.08)
  STEM.seed = 900 + seed
  sketchLine(ctx, 0, 30, 0, 18, STEM)
  if (pea) {
    PEA.seed = 901 + seed
    sketchCircle(ctx, 0, 0, 20, PEA)
    GLASSES.seed = 902
    sketchCircle(ctx, -7, -4, 6, GLASSES)
    sketchCircle(ctx, 7, -4, 6, GLASSES)
    sketchLine(ctx, -1, -4, 1, -4, GLASSES)
    EYE.seed = 903
    sketchCircle(ctx, -7, -4, 1.8, EYE)
    sketchCircle(ctx, 7, -4, 1.8, EYE)
    MOUSTACHE.seed = 904
    sketchEllipse(ctx, -5, 7, 6, 3, MOUSTACHE)
    sketchEllipse(ctx, 5, 7, 6, 3, MOUSTACHE)
  } else {
    POD.seed = 905 + seed
    sketchEllipse(ctx, 0, 0, 15, 28, POD)
    EYE.seed = 906
    sketchCircle(ctx, -5, -8, 2.2, EYE)
    sketchCircle(ctx, 5, -8, 2.2, EYE)
    smile[0] = -6
    smile[1] = 2
    smile[2] = 0
    smile[3] = 7
    smile[4] = 6
    smile[5] = 2
    SMILE.seed = 907
    sketchPath(ctx, smile, SMILE)
  }
  ctx.restore()
}
