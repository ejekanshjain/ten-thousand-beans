import { potDepth } from '../game/fx'
import type { Game } from '../game/game'
import { LINES } from '../game/gossip'
import { marginFor } from '../game/slosh'
import { MUD_STROKES } from '../game/tuning'
import { MUD_BOOT, shoeLook } from '../game/upgrades'
import { CachedLayer, type Viewport } from '../shared'
import type { BeanStamps } from './art/bean'
import { colors } from './art/colors'
import {
  drawEditor,
  drawSandwichBoard,
  EDITOR_HEAD_Y,
  EDITOR_X,
  KIOSK_GROUND,
  paintKiosk
} from './art/kiosk'
import { drawMudBoot } from './art/mud'
import { drawBubble } from './art/people'
import { drawArm, drawPlayer, shoulderOf, type PlayerView } from './art/player'
import { drawSidePot, type SidePotView } from './art/pot'
import { Camera } from './camera'

/** How long the editor rubs his hands after a sale, in ms. */
const HAPPY_MS = 1600

/**
 * The newspaper kiosk between stretches: the booth and street cached once, then the
 * editor, you with the pot at your feet, the sandwich board and the editor's bubble. The
 * kiosk's React panel covers the lower part of the view, so everything sits up top.
 */
export class KioskScene {
  private readonly camera: Camera
  private backdrop: CachedLayer | null = null
  private readonly player: PlayerView = {
    x: 118,
    ground: KIOSK_GROUND,
    stepPhase: 0,
    speed: 0,
    squash: 1,
    danger: 0,
    gasp: false,
    timeMs: 0
  }
  private readonly pot: SidePotView = {
    x: 196,
    y: KIOSK_GROUND - 88,
    angle: 0,
    phi: 0,
    margin: 10,
    danger: 0,
    lid: false,
    tall: false,
    water: 0,
    rattle: 0,
    timeMs: 0
  }
  private readonly shoulder = { x: 0, y: 0 }
  /** Sales seen so far this visit, to start the hand rub. */
  private sales = 0
  private happyUntil = 0

  constructor(
    private readonly viewport: Viewport,
    private readonly stamps: BeanStamps
  ) {
    this.camera = new Camera(viewport)
  }

  render(ctx: CanvasRenderingContext2D, game: Game, timeMs: number): void {
    const kiosk = game.kiosk
    if (!kiosk) return
    const view = this.viewport.view
    ctx.fillStyle = colors.sky
    ctx.fillRect(view.x - 10, view.y - 10, view.width + 20, view.height + 20)
    this.backdrop ??= new CachedLayer(this.viewport, paintKiosk, {
      x: -110,
      y: -110,
      width: 820,
      height: 540
    })
    this.backdrop.draw(ctx)

    const last = kiosk.sold[kiosk.sold.length - 1]
    drawSandwichBoard(ctx, last === undefined ? null : LINES[last]!.text)

    if (kiosk.sold.length !== this.sales) {
      this.sales = kiosk.sold.length
      this.happyUntil = timeMs + HAPPY_MS
    }
    drawEditor(ctx, kiosk.says !== '', timeMs < this.happyUntil, timeMs)

    const player = this.player
    player.timeMs = timeMs
    player.shoes = shoeLook(game)
    drawPlayer(ctx, player)
    const pot = this.pot
    pot.margin = marginFor(game.counts.pot, game.pot.water, game.options)
    pot.lid = game.options.lid
    pot.tall = game.options.tall
    pot.water = game.pot.water
    pot.y = KIOSK_GROUND - potDepth(pot.tall) - 2
    pot.timeMs = timeMs
    drawSidePot(ctx, this.camera, this.stamps, pot)
    this.camera.apply(ctx)
    const shoulder = shoulderOf(player, this.shoulder)
    drawArm(
      ctx,
      shoulder.x,
      shoulder.y + 4,
      shoulder.x + 26,
      shoulder.y + 70,
      timeMs
    )

    const mud = game.mud
    if (mud.on)
      drawMudBoot(
        ctx,
        MUD_BOOT,
        mud.strokes / MUD_STROKES,
        `Rubbed ${mud.strokes} of ${MUD_STROKES}`,
        mud.rubbing,
        timeMs
      )
    if (kiosk.says)
      drawBubble(
        ctx,
        kiosk.says,
        176,
        52,
        EDITOR_X - 24,
        EDITOR_HEAD_Y + 4,
        kiosk.sold.length + 450
      )
  }

  /** Frees the cached booth while you are away from the kiosk. */
  release(): void {
    this.backdrop?.dispose()
    this.backdrop = null
    this.sales = 0
  }
}
