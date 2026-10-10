import type { Game } from '../game/game'
import {
  MAT_H,
  MAT_W,
  MAT_X,
  MAT_Y,
  SECRET_FLY_MS,
  SECRET_STAGGER_MS,
  STEW_X,
  STEW_Y,
  TASTE_HMM_MS,
  TASTE_SALT_MS,
  TASTE_SNEEZE_MS,
  TOTAL_BEANS
} from '../game/tuning'
import { formatBeans } from '../game/units'
import {
  CachedLayer,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchRect,
  sketchRoundRect,
  sketchText,
  timerProgress,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import type { BeanStamps } from './art/bean'
import { colors } from './art/colors'
import {
  drawDoorDog,
  drawDoormat,
  drawGrandma,
  drawStew,
  type GrandmaPose
} from './art/grandma'
import { drawBubble } from './art/people'
import { Camera } from './camera'
import { CAPTION_TOP, drawCaptions } from './captions'

const WALL: SketchStyle = { fill: colors.brick, width: 0, wobble: 0 }
const MORTAR: SketchStyle = {
  width: 1.5,
  wobble: 0.6,
  passes: 1,
  color: colors.brickDark
}
const FRAME: SketchStyle = { fill: palette.paper, width: 3, wobble: 1.2 }
const DOOR: SketchStyle = { fill: palette.purple, width: 3, wobble: 1.2 }
const PANEL: SketchStyle = { width: 2.5, wobble: 1, color: '#5f3dc4' }
const KNOB: SketchStyle = { fill: palette.yellow, width: 2, wobble: 0.5 }
const WINDOW: SketchStyle = { fill: '#fff9db', width: 3, wobble: 1.2 }
const STEP: SketchStyle = { fill: '#ced4da', width: 3, wobble: 1.2 }
const PAVING: SketchStyle = { fill: colors.paving, width: 0, wobble: 0 }
const SLAB: SketchStyle = {
  width: 1.5,
  wobble: 1,
  passes: 1,
  color: colors.roadDark
}
const FLOWERPOT: SketchStyle = { fill: '#e8590c', width: 2.5, wobble: 1 }
const STALK: SketchStyle = {
  width: 3,
  wobble: 0.8,
  passes: 1,
  color: '#2b8a3e'
}
const PETAL: SketchStyle = { fill: palette.yellow, width: 2, wobble: 0.6 }
const COUNT: SketchTextStyle = {
  font: 'marker',
  size: 76,
  color: palette.ink,
  outline: palette.paper,
  seed: 690
}
const PANEL_BACK: SketchStyle = {
  fill: 'rgba(255, 249, 219, 0.88)',
  width: 3,
  wobble: 1.5
}
const SILL_BOX: SketchStyle = { fill: '#c4874f', width: 2.5, wobble: 1 }
const SPROUT: SketchStyle = {
  width: 3,
  wobble: 0.6,
  passes: 1,
  color: '#2b8a3e'
}
const SPROUT_LEAF: SketchStyle = { fill: '#69db7c', width: 1.5, wobble: 0.5 }
const SILL_LABEL: SketchTextStyle = {
  font: 'marker',
  size: 20,
  color: palette.paper,
  outline: palette.ink,
  seed: 699
}
const GLINT: SketchStyle = {
  width: 3,
  wobble: 0.6,
  passes: 1,
  color: palette.yellow
}

/** Paints Grandma's doorstep: brick wall, purple door, a window, the step and the path. */
function paintDoorstep(ctx: CanvasRenderingContext2D): void {
  WALL.seed = 680
  sketchRect(ctx, -300, -200, 1200, 690, WALL)
  for (let y = -190, row = 0; y < 480; y += 30, row++) {
    MORTAR.seed = 681 + row
    sketchLine(ctx, -300, y, 900, y, MORTAR)
    for (let x = -300 + (row % 2) * 30; x < 900; x += 60)
      sketchLine(ctx, x, y, x, y + 30, MORTAR)
  }
  FRAME.seed = 682
  sketchRect(ctx, 286, 96, 228, 384, FRAME)
  DOOR.seed = 683
  sketchRect(ctx, 300, 110, 200, 370, DOOR)
  PANEL.seed = 684
  sketchRect(ctx, 322, 136, 70, 120, PANEL)
  sketchRect(ctx, 408, 136, 70, 120, PANEL)
  sketchRect(ctx, 322, 290, 70, 150, PANEL)
  sketchRect(ctx, 408, 290, 70, 150, PANEL)
  KNOB.seed = 685
  sketchCircle(ctx, 476, 300, 8, KNOB)
  WINDOW.seed = 686
  sketchRect(ctx, 30, 150, 180, 130, WINDOW)
  sketchLine(ctx, 120, 150, 120, 280, MORTAR)
  sketchLine(ctx, 30, 215, 210, 215, MORTAR)
  PAVING.seed = 687
  sketchRect(ctx, -300, 480, 1200, 720, PAVING)
  for (let y = 520; y < 1100; y += 90) {
    SLAB.seed = 688 + y
    sketchLine(ctx, -300, y, 900, y, SLAB)
    for (let x = -300 + ((y / 90) % 2) * 60; x < 900; x += 120)
      sketchLine(ctx, x, y, x, y + 90, SLAB)
  }
  STEP.seed = 689
  sketchRect(ctx, 240, 470, 320, 26, STEP)
  // A flowerpot by the door.
  FLOWERPOT.seed = 691
  sketchRect(ctx, 530, 420, 44, 50, FLOWERPOT)
  STALK.seed = 692
  sketchLine(ctx, 552, 420, 548, 360, STALK)
  PETAL.seed = 693
  sketchCircle(ctx, 548, 352, 12, PETAL)
}

/**
 * The count view at Grandma's door: Grandma counting out loud over her stew, her dog,
 * the WELCOME doormat with its bump, the bean under it, and her secret spelled in beans.
 */
export class DoorScene {
  private readonly camera: Camera
  private backdrop: CachedLayer | null = null

  constructor(
    private readonly viewport: Viewport,
    private readonly stamps: BeanStamps
  ) {
    this.camera = new Camera(viewport)
  }

  render(ctx: CanvasRenderingContext2D, game: Game, timeMs: number): void {
    const camera = this.camera
    const door = game.door
    camera.shake(game.fx.shake)
    camera.apply(ctx)
    this.backdrop ??= new CachedLayer(this.viewport, paintDoorstep, {
      x: -300,
      y: -200,
      width: 1200,
      height: 1400
    })
    this.backdrop.draw(ctx)

    const ms = door.ms
    const tasting = door.phase === 'taste'
    let pose: GrandmaPose = 'wait'
    if (door.phase === 'count') pose = 'count'
    else if (tasting && ms >= TASTE_HMM_MS - 400 && ms < TASTE_SALT_MS)
      pose = 'taste'
    else if (tasting && ms >= TASTE_SALT_MS && ms < TASTE_SNEEZE_MS)
      pose = 'salt'
    else if (door.phase === 'secret' || door.phase === 'done') pose = 'shrug'
    drawGrandma(ctx, 400, 482, 1.55, pose, door.says !== '', timeMs)
    const sneezing =
      tasting && ms >= TASTE_SNEEZE_MS && ms < TASTE_SNEEZE_MS + 900
    drawDoorDog(ctx, 120, 486, 1, 1.7, sneezing ? 'sneeze' : 'sit', timeMs)
    drawStew(ctx, STEW_X, STEW_Y, timeMs)
    this.drawSill(ctx, game, timeMs)

    const hidden = game.counts.hidden > 0
    const bean = this.stamps.pickup[0]!
    if (hidden && !door.matUp) {
      camera.stamp(bean, ctx, door.bean.x, door.bean.y, 0.3)
      camera.apply(ctx)
    }
    drawDoormat(
      ctx,
      MAT_X,
      MAT_Y,
      MAT_W,
      MAT_H,
      door.mat,
      hidden && door.mat === 0
    )
    if (hidden && door.matUp) {
      // A glint, so the found bean can't be missed.
      GLINT.seed = 694 + (Math.floor(timeMs / 200) % 3)
      const r = 26 + Math.sin(timeMs / 150) * 4
      sketchCircle(ctx, door.bean.x, door.bean.y, r, GLINT)
      camera.stamp(bean, ctx, door.bean.x, door.bean.y, 0.3)
      camera.apply(ctx)
    }

    const counted =
      door.phase === 'count' || door.phase === 'doormat'
        ? door.counted
        : TOTAL_BEANS
    COUNT.color = counted === TOTAL_BEANS ? palette.green : palette.ink
    sketchText(ctx, formatBeans(counted), 300, 66, COUNT)
    const secret = door.phase === 'secret' || door.phase === 'done'
    if (secret) this.drawSecret(ctx, game)
    // Over the secret's panel Grandma talks from below it, so the letters stay clear.
    if (door.says && secret) drawBubble(ctx, door.says, 190, 470, 330, 440, 695)
    else if (door.says) drawBubble(ctx, door.says, 190, 190, 360, 196, 695)
    drawCaptions(ctx, game.fx.captions, 0, this.viewport.width, CAPTION_TOP)
  }

  /** Grandma's windowsill planter, sprouting your leftover packets with the box's batch. */
  private drawSill(
    ctx: CanvasRenderingContext2D,
    game: Game,
    timeMs: number
  ): void {
    const sill = game.box.sill
    if (sill.length === 0) return
    const grow = game.box.batch ? timerProgress(game.box.batch) : 1
    const n = Math.min(sill.length, 6)
    let beans = 0
    for (const packet of sill) beans += packet.beans
    for (let i = 0; i < n; i++) {
      const x = 44 + (152 / n) * (i + 0.5)
      const h = 8 + grow * 34
      const tip = x + Math.sin(timeMs / 480 + i) * 3
      SPROUT.seed = 700 + i
      sketchLine(ctx, x, 284, tip, 284 - h, SPROUT)
      SPROUT_LEAF.seed = 710 + i
      const leaf = 4 + grow * 5
      sketchEllipse(ctx, tip - leaf, 290 - h, leaf, leaf * 0.5, SPROUT_LEAF)
      sketchEllipse(ctx, tip + leaf, 294 - h, leaf, leaf * 0.5, SPROUT_LEAF)
    }
    SILL_BOX.seed = 698
    sketchRect(ctx, 36, 282, 168, 26, SILL_BOX)
    sketchText(ctx, `+${beans}`, 120, 296, SILL_LABEL)
  }

  /** The stew's beans fly up into Grandma's secret, one letter share per page found. */
  private drawSecret(ctx: CanvasRenderingContext2D, game: Game): void {
    const door = game.door
    const laid = door.secret
    if (!laid) return
    const ms = door.phase === 'done' ? Infinity : door.ms
    PANEL_BACK.seed = 696
    ctx.globalAlpha = Math.min(1, ms / 400)
    sketchRoundRect(ctx, 40, 160, 520, 272, 20, PANEL_BACK)
    ctx.globalAlpha = 1
    const camera = this.camera
    const beans = laid.beans
    for (let i = 0; i < laid.count; i++) {
      const p = Math.min(
        1,
        Math.max(0, (ms - i * SECRET_STAGGER_MS) / SECRET_FLY_MS)
      )
      if (p <= 0) continue
      const ease = 1 - (1 - p) ** 3
      const o = i * 3
      const tx = beans[o] as number
      const ty = beans[o + 1] as number
      const fromX = STEW_X + ((i * 37) % 120) - 60
      camera.stamp(
        this.stamps.letter,
        ctx,
        fromX + (tx - fromX) * ease,
        STEW_Y + (ty - STEW_Y) * ease - Math.sin(p * Math.PI) * 140,
        (beans[o + 2] as number) * ease + (1 - ease) * i
      )
    }
    camera.apply(ctx)
  }

  /** Frees the backdrop once the ending is over. */
  dispose(): void {
    this.backdrop?.dispose()
    this.backdrop = null
  }
}
