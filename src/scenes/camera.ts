import { damp, settings, type CachedLayer, type Viewport } from '../shared'

/**
 * Scroll and screen shake for one scene. `CachedLayer.stamp` resets the canvas transform
 * to the viewport's, which drops any camera translate, so stamps go through `stamp` here:
 * it passes the camera offset into the stamp's coordinates. Call `apply` again after a
 * batch of stamps before drawing anything else in world coordinates.
 */
export class Camera {
  /** World x and y at the design's top-left corner. */
  x = 0
  y = 0
  /** This frame's shake offset in u. */
  shakeX = 0
  shakeY = 0

  constructor(private readonly viewport: Viewport) {}

  /** Eases the camera toward a target position. Snap with `rate` Infinity. */
  follow(targetX: number, dtS: number, rate = 6, targetY = this.y): void {
    const snap = !Number.isFinite(rate)
    this.x = snap ? targetX : damp(this.x, targetX, rate, dtS)
    this.y = snap ? targetY : damp(this.y, targetY, rate, dtS)
  }

  /** Picks this frame's shake offset from an amplitude in u. Reduced Motion turns it off. */
  shake(amplitude: number): void {
    if (amplitude <= 0.05 || settings.get().reducedMotion) {
      this.shakeX = this.shakeY = 0
      return
    }
    this.shakeX = (Math.random() - 0.5) * 2 * amplitude
    this.shakeY = (Math.random() - 0.5) * 2 * amplitude
  }

  /** Sets the viewport transform plus the camera offset, so drawing uses world coordinates. */
  apply(ctx: CanvasRenderingContext2D): void {
    this.viewport.apply(ctx)
    ctx.translate(this.shakeX - this.x, this.shakeY - this.y)
  }

  /** Stamps a cached layer at world (x, y). Leaves the plain viewport transform applied. */
  stamp(
    layer: CachedLayer,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle = 0
  ): void {
    layer.stamp(ctx, x - this.x + this.shakeX, y - this.y + this.shakeY, angle)
  }

  /** Converts a world x to the design's screen x. */
  screenX(worldX: number): number {
    return worldX - this.x + this.shakeX
  }
}
