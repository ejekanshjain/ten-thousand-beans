import {
  pickupDrag,
  pickupPress,
  pickupRelease,
  pickupScoop,
  pickupTap,
  type Game
} from '../game/game'
import { netDrag, netPress, netRelease } from '../game/net'
import { shooPigeons } from '../game/pigeons'
import { pinchGrabs, pinchTipY } from '../game/pinch'
import { PINCH_GRAB_RADIUS, TOUCH_SCOOP_MOVE } from '../game/tuning'
import type { PointerTracker, TrackedPointer, Viewport } from '../shared'

/** Where to draw the tweezers this frame, in logical units. */
export interface TipView {
  x: number
  y: number
  visible: boolean
  /** True while two fingers hold the tweezers: the prongs run down to each finger. */
  fingers: boolean
  ax: number
  ay: number
  bx: number
  by: number
}

type Mode = 'none' | 'drag' | 'touch' | 'pinch' | 'scoop' | 'tap' | 'knot'

/**
 * Turns pointer input in Pickup into tweezer and hand actions:
 *
 * - Mouse, pen, or a finger in Assist Mode: press grabs, drag carries, release drops.
 * - Two fingers: tweezers appear above the pinch and grab when it closes; lifting a
 *   finger lets go. Gaps are measured in CSS px, so it works on any screen size.
 * - One finger dragged from the pile or a cluster: cupped hands.
 * - A click, or a one-finger tap that lifts without moving, can shoo a cat instead.
 * - A press on a knot of a tangled Pigeon Net circles it until the pointer lifts, or
 *   until a second finger turns it into a pinch.
 */
export class PickupControls {
  readonly tip: TipView = {
    x: 0,
    y: 0,
    visible: false,
    fingers: false,
    ax: 0,
    ay: 0,
    bx: 0,
    by: 0
  }
  private mode: Mode = 'none'
  private pressX = 0
  private pressY = 0

  constructor(
    private readonly game: Game,
    private readonly pointer: PointerTracker,
    private readonly viewport: Viewport,
    private readonly live: () => boolean
  ) {}

  /** Subscribes to the pointer. Returns an unsubscribe function. */
  attach(): () => void {
    const pointer = this.pointer
    const offs = [
      pointer.onPress((p, e) => this.press(p, e.timeStamp)),
      pointer.onDrag((p, e) => this.drag(p, e.timeStamp)),
      pointer.onRelease(() => this.release()),
      pointer.onUp(() => this.fingerUp())
    ]
    return () => {
      for (const off of offs) off()
    }
  }

  /** Runs every step: follows a pinch, grabs when it closes, and places the tip for drawing. */
  update(): void {
    const game = this.game
    const pointer = this.pointer
    const tip = this.tip
    tip.fingers = false
    if (game.scene !== 'pickup') {
      tip.visible = false
      this.mode = 'none'
      return
    }
    // Nothing touches the screen, so nothing can still be held.
    if (pointer.count === 0 && game.pickup.carry.count > 0) {
      this.letGo()
      this.mode = 'none'
    }
    const pinch = pointer.pinch
    if (
      pinch.active &&
      (this.mode === 'touch' || this.mode === 'pinch' || this.mode === 'knot')
    ) {
      if (this.mode === 'knot') netRelease(game)
      this.mode = 'pinch'
      const scale = this.viewport.scale
      tip.x = pinch.centerX
      tip.y = pinchTipY(pinch.centerY, scale)
      tip.visible = true
      tip.fingers = true
      tip.ax = pinch.ax
      tip.ay = pinch.ay
      tip.bx = pinch.bx
      tip.by = pinch.by
      const holding = game.pickup.carry.count > 0
      if (
        !holding &&
        this.live() &&
        pinchGrabs(pinch.distance * scale, pinch.startDistance * scale)
      )
        pickupPress(game, tip.x, tip.y, {
          radius: PINCH_GRAB_RADIUS,
          cup: false
        })
      if (game.pickup.carry.count > 0) pickupDrag(game, tip.x, tip.y)
      return
    }
    // Mice show the tweezers while hovering; fingers only while touching. Circling a
    // knot hides them, so you can see the knot.
    tip.x = pointer.x
    tip.y = pointer.y
    tip.visible =
      this.mode === 'drag' ||
      (pointer.lastType !== 'touch' &&
        pointer.lastType !== '' &&
        this.mode !== 'knot')
  }

  private oneFinger(p: TrackedPointer): boolean {
    return p.type !== 'touch' || this.game.options.assist
  }

  private press(p: TrackedPointer, timeMs: number): void {
    if (!this.live() || this.game.scene !== 'pickup') return
    // A finger taking over from a lifted one is not a new press.
    if (this.mode !== 'none') return
    // A pigeon perched over a knot still shoos, so the net can't hide it.
    if (shooPigeons(this.game, p.x, p.y)) {
      this.mode = 'tap'
      return
    }
    if (netPress(this.game, p.x, p.y, timeMs)) {
      this.mode = 'knot'
      return
    }
    if (this.oneFinger(p)) {
      if (pickupTap(this.game, p.x, p.y)) {
        this.mode = 'tap'
        return
      }
      this.mode = 'drag'
      pickupPress(this.game, p.x, p.y)
    } else {
      this.mode = 'touch'
      this.pressX = p.x
      this.pressY = p.y
    }
  }

  private drag(p: TrackedPointer, timeMs: number): void {
    const game = this.game
    if (this.mode === 'knot') {
      netDrag(game, p.x, p.y, timeMs)
      return
    }
    if (this.mode === 'drag' || this.mode === 'scoop') {
      pickupDrag(game, p.x, p.y)
      return
    }
    if (
      this.mode === 'touch' &&
      this.pointer.count === 1 &&
      Math.hypot(p.x - this.pressX, p.y - this.pressY) >= TOUCH_SCOOP_MOVE &&
      pickupScoop(game, this.pressX, this.pressY) > 0
    ) {
      this.mode = 'scoop'
      pickupDrag(game, p.x, p.y)
    }
  }

  private release(): void {
    if (this.mode === 'knot') netRelease(this.game)
    if (this.mode === 'drag' || this.mode === 'scoop') this.letGo()
    const pointer = this.pointer
    // A finger that lifts where it landed is a tap, which resolves on release.
    if (
      this.mode === 'touch' &&
      pointer.count === 0 &&
      this.live() &&
      Math.hypot(pointer.x - this.pressX, pointer.y - this.pressY) <
        TOUCH_SCOOP_MOVE
    )
      pickupTap(this.game, this.pressX, this.pressY)
    if (pointer.count === 0) this.mode = 'none'
  }

  /** Lifting either finger of a pinch opens the tweezers. The primary's release ends other modes. */
  private fingerUp(): void {
    if (this.mode === 'pinch' && !this.pointer.pinch.active) {
      this.letGo()
      this.mode = this.pointer.count > 0 ? 'touch' : 'none'
    }
  }

  private letGo(): void {
    const pointer = this.pointer
    const game = this.game
    if (game.pickup.carry.count === 0) {
      game.pickup.cup.armed = false
      return
    }
    const x = this.mode === 'pinch' ? this.tip.x : pointer.x
    const y = this.mode === 'pinch' ? this.tip.y : pointer.y
    pickupRelease(game, { x, y, vx: pointer.vx, vy: pointer.vy })
  }
}
