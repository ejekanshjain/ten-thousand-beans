import type { Game, GameInput } from '../game/game'
import { MAX_TILT } from '../game/tuning'
import { thumbWalk } from '../game/walk'
import {
  Keyboard,
  PointerTracker,
  prefersMotion,
  TiltAxis,
  type Motion,
  type MotionInput,
  type Viewport
} from '../shared'

const FORWARD = ['KeyW', 'ArrowUp']
const BACK = ['KeyS', 'ArrowDown']
const HURRY = ['ShiftLeft', 'ShiftRight']
const LEFT = ['KeyA', 'ArrowLeft']
const RIGHT = ['KeyD', 'ArrowRight']

/** Dev overrides for automation. Each field replaces that input until cleared. */
export interface InputOverride {
  /** 1 forward, -1 back, 0 stand. */
  walk?: number
  /** true or 1 hurries; a number from 0 to 1 blends. */
  hurry?: boolean | number
  /** Absolute tilt from -1 to 1 of the largest tilt. */
  tilt?: number
  /** Like held tilt keys, from -1 to 1. */
  tiltRate?: number
}

/**
 * The device motion source the tilt control reads: real sensors once allowed, or a dev
 * stub so automation can drive the real `TiltAxis` path.
 */
class MotionSource implements MotionInput {
  real: Motion | null = null
  stub: { tiltX: number } | null = null

  get available(): boolean {
    return this.stub !== null || (this.real?.available ?? false)
  }

  get tiltX(): number {
    return this.stub?.tiltX ?? this.real?.tiltX ?? 0
  }

  calibrate(): void {
    this.real?.calibrate()
  }
}

/**
 * Every input device for one game: pointer on the canvas, keyboard, motion with
 * `TiltAxis`, and the on-screen tilt buttons. `read` turns them into one `GameInput`.
 */
export class InputRig {
  readonly keys = new Keyboard()
  readonly pointer: PointerTracker
  readonly motion = new MotionSource()
  /** Device tilt only: keys and buttons use the game's own rate control. */
  readonly tiltAxis: TiltAxis
  /** Held on-screen tilt buttons. */
  readonly buttons = { left: false, right: false }
  override: InputOverride | null = null
  /** Where the primary pointer pressed, for the walking thumb's slide. */
  pressX = 0

  constructor(canvas: HTMLCanvasElement, viewport: Viewport) {
    this.pointer = new PointerTracker(canvas, {
      toLogical: (x, y, out) => viewport.toLogical(x, y, out)
    })
    this.pointer.onPress(p => {
      this.pressX = p.x
    })
    this.tiltAxis = new TiltAxis({
      motion: this.motion,
      pointer: this.pointer,
      maxDegrees: MAX_TILT
    })
  }

  /** True when the latest input was a finger, so copy and controls switch to touch. */
  get touch(): boolean {
    return this.pointer.lastType === 'touch'
  }

  /** True when device tilt steers the pot, so the on-screen tilt buttons can hide. */
  get motionActive(): boolean {
    return prefersMotion(this.motion, this.pointer)
  }

  /** Reads every device into `out` for one step. */
  read(game: Game, out: GameInput, dtMs: number): void {
    const keys = this.keys
    const pointer = this.pointer
    const override = this.override

    const walk = out.walk
    if (override?.walk !== undefined) {
      walk.walk = override.walk
      const hurry = override.hurry
      walk.hurry = typeof hurry === 'number' ? hurry : hurry ? 1 : 0
    } else if (keys.anyDown(FORWARD)) {
      walk.walk = 1
      walk.hurry = keys.anyDown(HURRY) ? 1 : 0
    } else if (keys.anyDown(BACK)) {
      walk.walk = -1
      walk.hurry = 0
    } else if (pointer.isDown && game.scene === 'walk') {
      const thumb = thumbWalk(pointer.x - this.pressX)
      walk.walk = thumb.walk
      walk.hurry = thumb.hurry
    } else {
      walk.walk = 0
      walk.hurry = 0
    }

    const tilt = out.tilt
    const motionValue = this.tiltAxis.update(dtMs)
    tilt.rate =
      override?.tiltRate ??
      (keys.anyDown(RIGHT) || this.buttons.right ? 1 : 0) -
        (keys.anyDown(LEFT) || this.buttons.left ? 1 : 0)
    tilt.absolute =
      override?.tilt ??
      (tilt.rate === 0 && this.tiltAxis.source === 'motion'
        ? motionValue
        : null)

    out.pointer.x = pointer.x
    out.pointer.y = pointer.y
    out.pointer.vx = pointer.vx
    out.pointer.vy = pointer.vy
    out.pointer.down = pointer.isDown
  }

  dispose(): void {
    this.keys.dispose()
    this.pointer.dispose()
    this.motion.real?.dispose()
  }
}
