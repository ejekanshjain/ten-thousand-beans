// Dev only: the runtime calls this behind `import.meta.env.DEV && devFlags.debug`, so
// production builds drop the whole module.
import { drawPhysicsDebug, type Viewport } from '../shared'

import { currentStretch, type Game } from '../game/game'
import { groundY } from '../game/route'
import { effectiveAngle, marginFor, spillAngle, spillRate } from '../game/slosh'
import { PICKUP_REACH } from '../game/tuning'
import { DEG } from '../game/units'
import type { Camera } from './camera'

/** The cameras of the scenes the overlay draws over. */
export interface DebugCameras {
  walk: Camera
  pickup: Camera
  drain: Camera
}

/** Where Set Down looks for a zone, ahead of you, as `zoneInReach` measures it. */
const REACH_AHEAD = 60

/**
 * `?debug`: Matter bodies in Pickup and the Drain scene, and in the walk view the slosh
 * numbers (surface angle sigma, its angle to the pot phi, margin, overflow d and spill
 * rate Q) plus each zone's anchor with Set Down's reach.
 */
export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  game: Game,
  viewport: Viewport,
  cameras: DebugCameras
): void {
  ctx.save()
  if (game.scene === 'pickup' && game.pickup.world) {
    cameras.pickup.apply(ctx)
    drawPhysicsDebug(ctx, game.pickup.world.engine)
    lines(ctx, viewport, [
      `bodies ${game.pickup.world.engine.world.bodies.length}`
    ])
  } else if (game.scene === 'drain' && game.drain) {
    cameras.drain.apply(ctx)
    drawPhysicsDebug(ctx, game.drain.world.engine)
  } else if (game.scene === 'walk' || game.scene === 'grounded') {
    drawZones(ctx, game, cameras.walk)
    lines(ctx, viewport, sloshLines(game))
  }
  ctx.restore()
}

/** The slosh model's numbers this frame, as short text lines. */
function sloshLines(game: Game): string[] {
  const pot = game.pot
  const margin = marginFor(game.counts.pot, pot.water, game.options)
  const q = spillRate(Math.max(0, pot.overflow), game.options)
  const deg = (rad: number) => (rad / DEG).toFixed(1)
  return [
    `sigma ${deg(pot.sigma)}  phi ${deg(pot.phi)}  psi ${deg(effectiveAngle(pot))}`,
    `margin ${margin.toFixed(1)} u  line ${deg(spillAngle(margin))}`,
    `d ${pot.overflow.toFixed(2)} u  Q ${q.toFixed(1)}/s  danger ${pot.danger.toFixed(2)}`,
    `water ${pot.water.toFixed(2)} u  teeter ${Math.round(pot.teeterMs)} ms`,
    `x ${Math.round(game.walker.x)}  v ${Math.round(game.walker.v)} u/s`
  ]
}

/** Each zone of this stretch: its anchor, its beans, and the span Set Down reaches it from. */
function drawZones(
  ctx: CanvasRenderingContext2D,
  game: Game,
  camera: Camera
): void {
  const def = currentStretch(game)
  camera.apply(ctx)
  ctx.lineWidth = 2
  ctx.font = '14px monospace'
  ctx.textAlign = 'center'
  for (const zone of game.zones.list) {
    if (zone.stretch !== game.stretch) continue
    const x = zone.anchorX
    const y = groundY(def, x)
    ctx.strokeStyle = 'rgba(220, 0, 120, 0.9)'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y - 120)
    ctx.stroke()
    // Set Down opens this zone with you standing anywhere along this bar.
    ctx.strokeStyle = 'rgba(220, 0, 120, 0.35)'
    ctx.beginPath()
    ctx.moveTo(x - PICKUP_REACH - REACH_AHEAD, y - 8)
    ctx.lineTo(x + PICKUP_REACH - REACH_AHEAD, y - 8)
    ctx.stroke()
    ctx.fillStyle = 'rgba(220, 0, 120, 1)'
    ctx.fillText(
      `#${zone.id} ${zone.count}+${zone.pile}p ${zone.drain}d`,
      x,
      y - 126
    )
  }
}

/** Text lines in a box at the design's top left. */
function lines(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  text: string[]
): void {
  viewport.apply(ctx)
  ctx.font = '14px monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.fillRect(4, 4, 360, 8 + text.length * 18)
  ctx.fillStyle = 'rgb(0, 90, 40)'
  text.forEach((line, i) => ctx.fillText(line, 10, 9 + i * 18))
}
