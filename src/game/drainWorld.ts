import Matter from 'matter-js'

import {
  clamp,
  createPhysics,
  damp,
  JoltMeter,
  stepPhysics,
  type Rng
} from '../shared'
import {
  BEAN_RADIUS,
  BEAN_RESTITUTION,
  DRAIN_MAX_BODIES,
  GRATE_Y,
  GUNK_TOP,
  HOOK_CATCH,
  HOOK_JOLT_REF,
  HOOK_LIFT_SPEED,
  HOOK_OUT_Y,
  HOOK_RATE,
  HOOK_SCRAPE_GAP,
  HOOK_SCRAPE_SPEED,
  RELEASE_SPEED_MAX,
  SHAFT_LEFT,
  SHAFT_RIGHT,
  SNAG_RADIUS,
  WALL_THICKNESS,
  WEDGE_MS
} from './tuning'
import { toMatterSpeed } from './units'

const { Bodies, Body, Composite, Sleeping } = Matter

/** Down a street drain, or in the gap under the kitchen fridge. */
export type DrainVariant = 'drain' | 'fridge'

/** Things in the gunk that the hook catches instead of beans. */
export interface Junk {
  id: string
  /** What the caption calls it, such as "A sock". */
  name: string
  homeX: number
  homeY: number
  x: number
  y: number
}

const JUNK: Record<DrainVariant, Omit<Junk, 'x' | 'y'>[]> = {
  drain: [
    { id: 'duck', name: 'A rubber duck', homeX: 236, homeY: 612 },
    { id: 'sock', name: 'A sock', homeX: 352, homeY: 624 },
    { id: 'key', name: 'A key', homeX: 300, homeY: 630 }
  ],
  fridge: [
    { id: 'bunny', name: 'A dust bunny', homeX: 238, homeY: 618 },
    { id: 'magnet', name: 'A fridge magnet', homeX: 340, homeY: 628 },
    { id: 'crayon', name: 'A crayon', homeX: 388, homeY: 630 }
  ]
}

/** What one Drain step did, for captions and sounds. */
export type DrainEvent =
  'none' | 'caught' | 'jerked' | 'scraped' | 'snagged' | 'out' | 'junkTop'

/** The pointer as the hook sees it. */
export interface HookInput {
  x: number
  y: number
  down: boolean
}

const BEAN_CATEGORY = 0x0001
const WALL_CATEGORY = 0x0004

/**
 * The shaft of the Drain scene, side-on: drain beans are Matter circles under gravity,
 * and the coat hanger's hook follows the pointer. It knows nothing of the ledger; the
 * drain flow moves a bean out of `drain` when `step` reports 'out'.
 */
export class DrainWorld {
  readonly engine: Matter.Engine
  /** Free bean bodies in the shaft. */
  readonly beans: Matter.Body[] = []
  readonly junk: Junk[]
  /** Drain beans not simulated yet, waiting under the gunk. */
  waiting: number
  /** The hook's cup, its velocity in u/s, and where it is heading. */
  readonly hook = { x: 300, y: 130, vx: 0, vy: 0, targetX: 300, targetY: 130 }
  /** The bean riding in the cup, or null. */
  held: Matter.Body | null = null
  /** Junk caught on the hook instead, or null. */
  heldJunk: Junk | null = null
  /** Reads hook jerks while a bean rides it. */
  readonly jolt = new JoltMeter({ pointerRef: HOOK_JOLT_REF })
  private readonly wedged = new Map<number, number>()

  constructor(
    readonly variant: DrainVariant,
    beans: number,
    private readonly random: Rng
  ) {
    this.engine = createPhysics({ gravity: 1 })
    const half = WALL_THICKNESS / 2
    const wall = (x: number, y: number, w: number, h: number) =>
      Bodies.rectangle(x, y, w, h, {
        isStatic: true,
        collisionFilter: { category: WALL_CATEGORY }
      })
    const midX = (SHAFT_LEFT + SHAFT_RIGHT) / 2
    const width = SHAFT_RIGHT - SHAFT_LEFT
    Composite.add(this.engine.world, [
      wall(SHAFT_LEFT - half, 400, WALL_THICKNESS, 1_000),
      wall(SHAFT_RIGHT + half, 400, WALL_THICKNESS, 1_000),
      wall(midX, GUNK_TOP + half, width * 2, WALL_THICKNESS),
      wall(midX, GRATE_Y - half, width * 2, WALL_THICKNESS)
    ])
    this.junk = JUNK[variant].map(j => ({ ...j, x: j.homeX, y: j.homeY }))
    const shown = Math.min(beans, DRAIN_MAX_BODIES)
    this.waiting = beans - shown
    for (let i = 0; i < shown; i++) this.addBean()
  }

  /** Beans in the shaft: free, on the hook, and waiting in the gunk. */
  get count(): number {
    return this.beans.length + (this.held ? 1 : 0) + this.waiting
  }

  /** Advances one step: the hook follows a pressed pointer, and catches, drops or pops beans. */
  step(dtMs: number, input: HookInput): DrainEvent {
    stepPhysics(this.engine, dtMs)
    const dtS = dtMs / 1000
    const hook = this.hook
    if (input.down) {
      hook.targetX = input.x
      hook.targetY = input.y
    }
    const x0 = hook.x
    const y0 = hook.y
    hook.x = clamp(
      damp(hook.x, hook.targetX, HOOK_RATE, dtS),
      SHAFT_LEFT + 6,
      SHAFT_RIGHT - 6
    )
    hook.y = clamp(damp(hook.y, hook.targetY, HOOK_RATE, dtS), 40, GUNK_TOP - 4)
    hook.vx = dtS > 0 ? (hook.x - x0) / dtS : 0
    hook.vy = dtS > 0 ? (hook.y - y0) / dtS : 0
    this.keepBeansInReach(dtMs)
    return this.hookStep(dtMs, input)
  }

  private hookStep(dtMs: number, input: HookInput): DrainEvent {
    const hook = this.hook
    const rising = hook.vy < -HOOK_LIFT_SPEED
    if (this.heldJunk) {
      const junk = this.heldJunk
      junk.x = hook.x
      junk.y = hook.y + 6
      if (hook.y < HOOK_OUT_Y) {
        this.dropJunk()
        return 'junkTop'
      }
      if (!input.down) this.dropJunk()
      return 'none'
    }
    const held = this.held
    if (held) {
      Body.setPosition(held, { x: hook.x, y: hook.y - 8 })
      this.jolt.feedPointer(hook.vx, hook.vy, dtMs)
      if (this.jolt.over) {
        this.dropBean()
        return 'jerked'
      }
      const nearWall =
        hook.x - SHAFT_LEFT < HOOK_SCRAPE_GAP ||
        SHAFT_RIGHT - hook.x < HOOK_SCRAPE_GAP
      if (nearWall && Math.hypot(hook.vx, hook.vy) > HOOK_SCRAPE_SPEED) {
        this.dropBean()
        return 'scraped'
      }
      if (hook.y < HOOK_OUT_Y) {
        this.held = null
        if (this.waiting > 0) {
          this.waiting--
          this.addBean()
        }
        return 'out'
      }
      return 'none'
    }
    this.jolt.feed(0, dtMs)
    if (!rising) return 'none'
    const bean = this.beanAtCup()
    if (bean) {
      this.hold(bean)
      return 'caught'
    }
    for (const junk of this.junk) {
      if (Math.hypot(junk.x - hook.x, junk.y - hook.y) <= SNAG_RADIUS) {
        this.heldJunk = junk
        return 'snagged'
      }
    }
    return 'none'
  }

  /** The free bean whose edge is within HOOK_CATCH of the cup, nearest first. */
  private beanAtCup(): Matter.Body | null {
    let best: Matter.Body | null = null
    let bestD = BEAN_RADIUS + HOOK_CATCH
    for (const body of this.beans) {
      const d = Math.hypot(
        body.position.x - this.hook.x,
        body.position.y - this.hook.y
      )
      if (d <= bestD) {
        best = body
        bestD = d
      }
    }
    return best
  }

  private hold(body: Matter.Body): void {
    const index = this.beans.indexOf(body)
    if (index >= 0) this.beans.splice(index, 1)
    Composite.remove(this.engine.world, body)
    this.held = body
    this.jolt.reset()
  }

  /** The bean falls back into the shaft with the hook's velocity, capped. */
  private dropBean(): void {
    const body = this.held
    if (!body) return
    this.held = null
    const { vx, vy } = this.hook
    const speed = Math.hypot(vx, vy)
    const k = speed > RELEASE_SPEED_MAX ? RELEASE_SPEED_MAX / speed : 1
    this.beans.push(body)
    Composite.add(this.engine.world, body)
    Body.setVelocity(body, {
      x: toMatterSpeed(vx * k),
      y: toMatterSpeed(vy * k)
    })
    Sleeping.set(body, false)
  }

  private dropJunk(): void {
    const junk = this.heldJunk
    if (!junk) return
    junk.x = junk.homeX
    junk.y = junk.homeY
    this.heldJunk = null
  }

  /** Lets go of whatever the hook holds, for leaving the scene. */
  letGo(): void {
    this.dropBean()
    this.dropJunk()
  }

  private addBean(): void {
    const r = this.random
    const body = Bodies.circle(
      SHAFT_LEFT + 24 + r() * (SHAFT_RIGHT - SHAFT_LEFT - 48),
      GUNK_TOP - 14 - r() * 50,
      BEAN_RADIUS,
      {
        frictionAir: 0.02,
        restitution: BEAN_RESTITUTION,
        angle: r() * Math.PI * 2,
        collisionFilter: {
          category: BEAN_CATEGORY,
          mask: BEAN_CATEGORY | WALL_CATEGORY
        }
      }
    )
    this.beans.push(body)
    Composite.add(this.engine.world, body)
  }

  /** A bean stuck outside the shaft for WEDGE_MS goes back on top of the gunk. */
  private keepBeansInReach(dtMs: number): void {
    for (const body of this.beans) {
      const { x, y } = body.position
      const outside =
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < SHAFT_LEFT ||
        x > SHAFT_RIGHT ||
        y > GUNK_TOP + 2 ||
        y < GRATE_Y
      if (!outside) {
        this.wedged.delete(body.id)
        continue
      }
      const ms = (this.wedged.get(body.id) ?? 0) + dtMs
      if (ms < WEDGE_MS) {
        this.wedged.set(body.id, ms)
        continue
      }
      this.wedged.delete(body.id)
      Body.setPosition(body, {
        x: 300 + (this.random() - 0.5) * 120,
        y: GUNK_TOP - 30
      })
      Body.setVelocity(body, { x: 0, y: 0 })
    }
  }

  /** Frees the engine. */
  dispose(): void {
    Composite.clear(this.engine.world, false)
    Matter.Engine.clear(this.engine)
    this.beans.length = 0
    this.held = null
  }
}
