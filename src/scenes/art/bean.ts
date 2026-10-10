import {
  CachedLayer,
  palette,
  sketchEllipse,
  sketchLine,
  type SketchStyle,
  type Viewport
} from '../../shared'
import { colors } from './colors'

const BODY: SketchStyle = {
  wobble: 0.6,
  passes: 1,
  width: 1.4,
  color: colors.beanDark
}
const SHINE: SketchStyle = {
  wobble: 0.3,
  passes: 1,
  width: 1.2,
  color: colors.beanShine
}

/** Paints one kidney bean centred on (0, 0), `rx` by `ry`, lying along the x axis. */
export function paintBean(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  seed: number,
  fill: string = colors.bean
): void {
  BODY.seed = seed
  BODY.fill = fill
  sketchEllipse(ctx, 0, 0, rx, ry, BODY)
  // The kidney dent and a highlight make an ellipse read as a bean.
  sketchLine(ctx, -rx * 0.25, ry * 0.75, rx * 0.25, ry * 0.75, {
    ...BODY,
    fill: undefined,
    color: palette.ink,
    width: 1
  })
  SHINE.seed = seed + 5
  sketchLine(ctx, -rx * 0.45, -ry * 0.35, rx * 0.2, -ry * 0.5, SHINE)
}

const WET: SketchStyle = {
  wobble: 0.3,
  passes: 1,
  width: 1.4,
  color: palette.paper
}

/** A swollen bean: paler, fatter, with two wet glints. */
function paintSwollen(ctx: CanvasRenderingContext2D, rx: number, ry: number) {
  paintBean(ctx, rx, ry, 27, colors.beanSwollen)
  WET.seed = 28
  sketchLine(ctx, rx * 0.15, -ry * 0.55, rx * 0.5, -ry * 0.3, WET)
  sketchLine(ctx, -rx * 0.6, ry * 0.05, -rx * 0.45, ry * 0.3, WET)
}

/** Cached bean images for stamping: three variants per size, plus a strained one. */
export interface BeanStamps {
  /** 11 by 6.5 u, for the walk view. */
  walk: CachedLayer[]
  /** 20 by 12 u, for Pickup. */
  pickup: CachedLayer[]
  /** A red-tinted Pickup bean, for strained tweezers. */
  strained: CachedLayer
  /** A darker Pickup bean, for beans spelling gossip, so the words stand out. */
  letter: CachedLayer
  /** A swollen bean, 1.5 times the size, paler and shiny: walk view and Pickup. */
  swollenWalk: CachedLayer
  swollen: CachedLayer
  dispose(): void
}

export function createBeanStamps(viewport: Viewport): BeanStamps {
  const walkRect = { x: -9, y: -7, width: 18, height: 14 }
  const pickupRect = { x: -14, y: -10, width: 28, height: 20 }
  const walk = [11, 12, 13].map(
    seed =>
      new CachedLayer(viewport, ctx => paintBean(ctx, 5.5, 3.3, seed), walkRect)
  )
  const pickup = [21, 22, 23].map(
    seed =>
      new CachedLayer(viewport, ctx => paintBean(ctx, 10, 6, seed), pickupRect)
  )
  const strained = new CachedLayer(
    viewport,
    ctx => paintBean(ctx, 10, 6, 21, colors.beanStrain),
    pickupRect
  )
  const letter = new CachedLayer(
    viewport,
    ctx => paintBean(ctx, 10, 6, 24, colors.beanDark),
    pickupRect
  )
  const swollenWalk = new CachedLayer(
    viewport,
    ctx => paintSwollen(ctx, 8.3, 5),
    { x: -12, y: -9, width: 24, height: 18 }
  )
  const swollen = new CachedLayer(viewport, ctx => paintSwollen(ctx, 15, 9), {
    x: -19,
    y: -13,
    width: 38,
    height: 26
  })
  return {
    walk,
    pickup,
    strained,
    letter,
    swollenWalk,
    swollen,
    dispose() {
      for (const layer of [
        ...walk,
        ...pickup,
        strained,
        letter,
        swollenWalk,
        swollen
      ])
        layer.dispose()
    }
  }
}
