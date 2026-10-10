import { CachedLayer, type Viewport } from '../shared'

/** Width of one background tile in u. A desktop view (800 u) spans at most two. */
export const TILE_WIDTH = 800
/** Tiles cover the design from this y down on flat ground; the sky above is a plain fill. */
export const TILE_TOP = 160

/** The world y range one tile keeps, from its route x. */
export type TileBounds = (left: number) => { top: number; bottom: number }

/** Paints one tile. `left` is the tile's route x; draw in route coordinates. */
export type TilePainter = (
  ctx: CanvasRenderingContext2D,
  index: number,
  left: number
) => void

/**
 * A strip of cached background tiles along one stretch. It keeps the tiles the camera
 * can see plus one ahead in the walking direction, painted before it scrolls into view,
 * and disposes the rest. At 800 u views that is at most 3 tiles.
 */
export class TileStrip {
  private readonly tiles = new Map<number, CachedLayer>()

  /** `bounds` gives the world y range each tile keeps, so tiles on a slope stay short. */
  constructor(
    private readonly viewport: Viewport,
    private readonly paint: TilePainter,
    private readonly bounds: TileBounds
  ) {}

  /**
   * Draws the tiles covering world x from `left` to `right`. Call with the camera
   * applied. `dir` is the walking direction, which picks the tile to paint ahead.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    left: number,
    right: number,
    dir: number
  ): void {
    const first = Math.floor(left / TILE_WIDTH)
    const last = Math.floor(right / TILE_WIDTH)
    const ahead = dir < 0 ? first - 1 : last + 1
    const keepFrom = Math.min(first, ahead)
    const keepTo = Math.max(last, ahead)
    for (const [index, layer] of this.tiles) {
      if (index < keepFrom || index > keepTo) {
        layer.dispose()
        this.tiles.delete(index)
      }
    }
    for (let index = first; index <= last; index++) this.layer(index).draw(ctx)
    // Drawn off-screen, which paints it a few frames before it scrolls into view.
    this.layer(ahead).draw(ctx)
  }

  /** How many tiles are alive, for performance checks. */
  get size(): number {
    return this.tiles.size
  }

  dispose(): void {
    for (const layer of this.tiles.values()) layer.dispose()
    this.tiles.clear()
  }

  private layer(index: number): CachedLayer {
    let layer = this.tiles.get(index)
    if (!layer) {
      const left = index * TILE_WIDTH
      const { top, bottom } = this.bounds(left)
      layer = new CachedLayer(
        this.viewport,
        ctx => this.paint(ctx, index, left),
        { x: left, y: top, width: TILE_WIDTH, height: bottom - top }
      )
      this.tiles.set(index, layer)
    }
    return layer
  }
}
