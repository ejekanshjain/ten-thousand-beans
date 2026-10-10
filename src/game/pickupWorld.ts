import Matter from 'matter-js'

import { createPhysics, stepPhysics } from '../shared'
import { inEllipse, onRack, type Ellipse } from './drying'
import { move, type Counts } from './ledger'
import {
  BEAN_DENSITY,
  BEAN_FRICTION_AIR,
  BEAN_RADIUS,
  BEAN_RESTITUTION,
  CLUMP_RADIUS,
  DECK_GAP,
  DECK_LEFT,
  DECK_PLANK,
  DECK_RIGHT,
  DUCK_MS,
  FLING_MS,
  GRATE_HALF_H,
  GRATE_HALF_W,
  LETTER_SLIDE_MS,
  PLAY_BOTTOM,
  PLAY_LEFT,
  PLAY_RIGHT,
  PLAY_TOP,
  POT_ACCEPT,
  POT_RADIUS,
  POT_X,
  POT_Y,
  RELEASE_SPEED_MAX,
  RELEASE_SPIN,
  SWOLLEN_BOUNCE,
  SWOLLEN_RADIUS,
  WALL_THICKNESS,
  ZONE_MAX_LOOSE
} from './tuning'
import { fromMatterSpeed, toMatterSpeed } from './units'
import {
  BEAN_FIELDS,
  KIND_GOSSIP,
  KIND_LOOSE,
  KIND_PUDDLE,
  writeBean,
  type Zone
} from './zones'

const { Bodies, Body, Composite, Sleeping } = Matter

/** A held bean: its body sits outside the world, offset from the tip or the hands. */
export interface HeldBean {
  body: Matter.Body
  dx: number
  dy: number
}

/** A bean spelling gossip: out of the simulation, sliding from where it lay to its spot. */
export interface LetterBean {
  body: Matter.Body
  fromX: number
  fromY: number
  toX: number
  toY: number
  angle: number
}

/** What a release did. */
export interface ReleaseResult {
  potted: number
  returned: number
  /** Swollen beans the pot bounced back out. */
  refused: number
  /** Swollen beans that went onto the drying rack. */
  racked: number
}

export interface PickupWorldOptions {
  /** Lets resting beans sleep. Off on the bridge, where the deck keeps them sliding. */
  sleeping?: boolean
  /** Top edge of the play rect, in u. The kitchen lowers it to make room for the fridge. */
  top?: number
  /** Centre of a drain grate in this view, where slow beans fall through. */
  grate?: Point | null
  /** Puddles in this view, where resting beans swell. */
  puddles?: readonly Ellipse[]
  /** True when the drying rack shows at the bottom left, taking swollen beans. */
  rack?: boolean
  /** True on the rope bridge: a plank deck from DECK_LEFT to DECK_RIGHT over the river. */
  deck?: boolean
}

export interface Point {
  x: number
  y: number
}

/** A bean dropping through the grate, drawn only: the ledger already moved it. */
export interface SinkingBean {
  x: number
  y: number
  angle: number
  /** Simulated ms since it fell. */
  ms: number
}

/** A bean you flung in the river, riding a duck's head until it brings it back. */
export interface DuckBean {
  body: Matter.Body
  /** -1 for the river left of the deck, 1 for the right. */
  side: number
  /** Where along the deck it went in, in u. */
  y: number
  /** Simulated ms since it went in. */
  ms: number
}

/** What the river and the plank gaps did this step. */
export interface RiverResult {
  /** Beans lost for good into the river; the ledger already moved them to `packets`. */
  lost: number
  /** Flung beans a duck has now. */
  ducked: number
  /** Beans ducks brought back to the deck. */
  returned: number
}

/** How long a bean takes to sink through the grate, in ms. */
export const SINK_MS = 350

/** Free beans stay this far clear of a gossip block, in u. */
const BLOCK_PAD = 56

const BEAN_CATEGORY = 0x0001
const POT_CATEGORY = 0x0002
const WALL_CATEGORY = 0x0004

/**
 * The Matter world for one zone in Pickup. It owns the zone's positions while open:
 * every bean is a body, except held beans, which move kinematically outside the world.
 * Pile beans in cupped hands stay counted in the zone's pile until they land somewhere.
 * Ledger moves happen here too, so bodies, the zone record and the ledger never
 * disagree. Call `writeBack` before closing.
 */
export class PickupWorld {
  readonly engine: Matter.Engine
  /** Free bean bodies, in no particular order. */
  readonly beans: Matter.Body[] = []
  /** Bodies in the tweezers or in cupped hands. */
  readonly held: HeldBean[] = []
  /** Pile beans in cupped hands. */
  pileHeld = 0
  /** Where the tweezers or hands are, in u. */
  readonly tip = { x: 0, y: 0 }
  /** Beans spelling gossip, outside the simulation. */
  readonly letters: LetterBean[] = []
  /** Simulated ms since the letters started sliding into place. */
  slideMs = 0
  /** Deck slide in u/s that every free bean drifts toward. Zero off the bridge. */
  readonly slide = { x: 0, y: 0 }
  /** Top edge of the play rect, in u. */
  readonly top: number
  /** The drain grate in this view, or null. */
  readonly grate: Point | null
  /** Beans dropping through the grate right now. */
  readonly sinking: SinkingBean[] = []
  /** Puddles in this view. */
  readonly puddles: readonly Ellipse[]
  /** True when the drying rack shows. */
  readonly rack: boolean
  /** Swollen bodies, free or held. They draw bigger, and the pot refuses them. */
  readonly swollen = new Set<Matter.Body>()
  /** True on the rope bridge, where the river waits past the deck's edges. */
  readonly deck: boolean
  /** Flung beans riding ducks, out of the simulation but still counted in the zone. */
  readonly ducks: DuckBean[] = []
  /** Simulated ms since the world opened. */
  private ms = 0
  /** When each bean you let go of was released, so a fling into the river gets a duck. */
  private readonly releasedAt = new WeakMap<Matter.Body, number>()

  constructor(
    readonly zone: Zone,
    private readonly counts: Counts,
    {
      sleeping = true,
      top = PLAY_TOP,
      grate = null,
      puddles = [],
      rack = false,
      deck = false
    }: PickupWorldOptions = {}
  ) {
    this.top = top
    this.grate = grate
    this.puddles = puddles
    this.rack = rack
    this.deck = deck
    this.engine = createPhysics({ gravity: 0, enableSleeping: sleeping })
    const half = WALL_THICKNESS / 2
    const width = PLAY_RIGHT - PLAY_LEFT
    const height = PLAY_BOTTOM - top
    const midX = PLAY_LEFT + width / 2
    const midY = top + height / 2
    const wall = (x: number, y: number, w: number, h: number) =>
      Bodies.rectangle(x, y, w, h, {
        isStatic: true,
        collisionFilter: { category: WALL_CATEGORY }
      })
    Composite.add(this.engine.world, [
      wall(PLAY_LEFT - half, midY, WALL_THICKNESS, height * 2),
      wall(PLAY_RIGHT + half, midY, WALL_THICKNESS, height * 2),
      wall(midX, top - half, width * 2, WALL_THICKNESS),
      wall(midX, PLAY_BOTTOM + half, width * 2, WALL_THICKNESS),
      Bodies.circle(POT_X, POT_Y, POT_RADIUS, {
        isStatic: true,
        collisionFilter: { category: POT_CATEGORY }
      })
    ])
    for (let i = 0; i < zone.count; i++) {
      const o = i * BEAN_FIELDS
      const x = zone.beans[o] as number
      const y = zone.beans[o + 1] as number
      const angle = zone.beans[o + 2] as number
      if (zone.beans[o + 3] === KIND_GOSSIP) {
        const body = this.makeBean(x, y, angle)
        this.letters.push({ body, fromX: x, fromY: y, toX: x, toY: y, angle })
        this.settleLetter(body)
      } else {
        const body = this.addBean(x, y, angle)
        if (zone.beans[o + 3] === KIND_PUDDLE) this.makeSwollen(body)
      }
    }
    this.slideMs = LETTER_SLIDE_MS
    this.clearGrate()
    this.clearPuddles()
    this.clearDeck()
  }

  /**
   * On the bridge every bean starts on the planks, not over the river or a gap, since the
   * walk view already sent the river's share in. Only beans you move can fall.
   */
  private clearDeck(): void {
    if (!this.deck) return
    const pad = BEAN_RADIUS + 6
    for (const body of this.beans) {
      const x = Math.min(
        DECK_RIGHT - pad,
        Math.max(DECK_LEFT + pad, body.position.x)
      )
      let y = body.position.y
      if (this.overGap(y, BEAN_RADIUS)) y += DECK_GAP + BEAN_RADIUS
      Body.setPosition(body, { x, y })
    }
  }

  /** Where a duck leaves its bean: on the planks at the near edge, clear of any gap. */
  private duckDrop(duck: DuckBean): Point {
    const x = duck.side < 0 ? DECK_LEFT + 24 : DECK_RIGHT - 24
    const y = this.overGap(duck.y, BEAN_RADIUS)
      ? duck.y + DECK_GAP + BEAN_RADIUS
      : duck.y
    return { x, y }
  }

  /** True when a bean centred at y lies over a plank gap, grown by `pad` u either side. */
  overGap(y: number, pad = 0): boolean {
    const off = Math.abs(y - Math.round(y / DECK_PLANK) * DECK_PLANK)
    return off <= DECK_GAP / 2 + pad
  }

  /** True when x lies past either edge of the deck, over the river. */
  offDeck(x: number): boolean {
    return x < DECK_LEFT || x > DECK_RIGHT
  }

  /**
   * The river and the plank gaps take free beans: one past a deck edge, or slower than
   * `slowSpeed` u/s over a gap, is lost for good, unless you flung it there in the last
   * FLING_MS, when a duck catches it and brings it back after DUCK_MS.
   */
  river(slowSpeed: number, dtMs: number): RiverResult {
    const result: RiverResult = { lost: 0, ducked: 0, returned: 0 }
    if (!this.deck) return result
    for (let i = this.ducks.length - 1; i >= 0; i--) {
      const duck = this.ducks[i]!
      duck.ms += dtMs
      if (duck.ms < DUCK_MS) continue
      this.ducks.splice(i, 1)
      Body.setPosition(duck.body, this.duckDrop(duck))
      Body.setVelocity(duck.body, { x: 0, y: 0 })
      this.addBody(duck.body)
      result.returned++
    }
    for (let i = this.beans.length - 1; i >= 0; i--) {
      const body = this.beans[i]!
      const { x, y } = body.position
      const off = this.offDeck(x)
      if (!off && !(this.overGap(y) && this.speedOf(body) < slowSpeed)) continue
      const at = this.releasedAt.get(body)
      if (off && at !== undefined && this.ms - at <= FLING_MS) {
        this.beans.splice(i, 1)
        Composite.remove(this.engine.world, body)
        this.ducks.push({ body, side: x < DECK_LEFT ? -1 : 1, y, ms: 0 })
        result.ducked++
        continue
      }
      this.sinking.push({ x, y, angle: body.angle, ms: 0 })
      if (this.takeFree(body, 'packets')) result.lost++
    }
    return result
  }

  /** Grows a body to a swollen bean's size and marks it swollen. Ledger moves are the caller's. */
  private makeSwollen(body: Matter.Body): void {
    const k = SWOLLEN_RADIUS / BEAN_RADIUS
    Body.scale(body, k, k)
    this.swollen.add(body)
  }

  /** True when (x, y) lies in any puddle, grown by `pad` u. */
  inPuddle(x: number, y: number, pad = 0): boolean {
    for (const puddle of this.puddles)
      if (inEllipse(puddle, x, y, pad)) return true
    return false
  }

  /**
   * Dry beans that landed in a puddle's shape wait just below it, so only beans you move
   * into a puddle can swell. The walk view already capped what landed in it.
   */
  private clearPuddles(): void {
    let i = 0
    for (const puddle of this.puddles)
      for (const body of this.beans) {
        const { x, y } = body.position
        if (this.swollen.has(body) || !inEllipse(puddle, x, y, BEAN_RADIUS))
          continue
        Body.setPosition(body, {
          x: x + ((i % 5) - 2) * 6,
          y: puddle.y + puddle.ry + BEAN_RADIUS + 6 + Math.floor(i / 5) * 14
        })
        i++
      }
  }

  /**
   * Swells every dry free bean resting or crawling in a puddle (slower than `maxSpeed`
   * u/s): it grows, and the ledger moves it from `loose` to `puddle`. Returns how many.
   */
  swellSlow(maxSpeed: number): number {
    if (this.puddles.length === 0) return 0
    let n = 0
    for (const body of this.beans) {
      if (this.swollen.has(body)) continue
      const { x, y } = body.position
      if (!this.inPuddle(x, y) || this.speedOf(body) >= maxSpeed) continue
      this.makeSwollen(body)
      move(this.counts, 'loose', 'puddle', 1)
      this.zone.puddle++
      n++
    }
    return n
  }

  /** Free beans that aren't swollen, which gossip can spell with. */
  get dryFree(): number {
    let n = 0
    for (const body of this.beans) if (!this.swollen.has(body)) n++
    return n
  }

  /** True when (x, y) lies over the grate, grown by `pad` u on every side. */
  onGrate(x: number, y: number, pad = 0): boolean {
    const g = this.grate
    return (
      g !== null &&
      Math.abs(x - g.x) <= GRATE_HALF_W + pad &&
      Math.abs(y - g.y) <= GRATE_HALF_H + pad
    )
  }

  /**
   * Beans that landed on the grate in the walk view wait just below it, so only beans
   * you move onto it can fall through. The walk view already capped what went down.
   */
  private clearGrate(): void {
    const g = this.grate
    if (!g) return
    let i = 0
    for (const body of this.beans) {
      const { x, y } = body.position
      if (!this.onGrate(x, y, BEAN_RADIUS)) continue
      Body.setPosition(body, {
        x: x + ((i % 5) - 2) * 6,
        y: g.y + GRATE_HALF_H + BEAN_RADIUS + 6 + Math.floor(i / 5) * 14
      })
      i++
    }
  }

  /**
   * Sends every free bean resting or crawling over the grate (slower than `maxSpeed`
   * u/s) down the drain. Returns how many fell.
   */
  swallowSlow(maxSpeed: number): number {
    if (!this.grate) return 0
    let fell = 0
    for (let i = this.beans.length - 1; i >= 0; i--) {
      const body = this.beans[i]!
      const { x, y } = body.position
      if (!this.onGrate(x, y) || this.speedOf(body) >= maxSpeed) continue
      this.sinking.push({ x, y, angle: body.angle, ms: 0 })
      this.sendToDrain(body)
      fell++
    }
    return fell
  }

  /**
   * A letter in place turns into a still obstacle, so loose beans can't lie on top of the
   * gossip. Grabs never pick letters: they aren't in `beans`.
   */
  private settleLetter(body: Matter.Body): void {
    Body.setStatic(body, true)
    Composite.add(this.engine.world, body)
  }

  /** Beans in this zone with positions, free, held or riding a duck. */
  get count(): number {
    return (
      this.beans.length +
      this.held.length +
      this.letters.length +
      this.ducks.length
    )
  }

  /**
   * Turns free beans into gossip letters: each leaves the simulation and slides to its
   * spot in `targets` (x, y, angle per bean) on a critically damped spring. Beans are
   * matched to the nearest spot, so the slide looks like the spill gathering itself.
   */
  spell(targets: Float32Array, random: () => number = Math.random): number {
    const need = targets.length / 3
    const free = this.beans.filter(body => !this.swollen.has(body))
    if (free.length < need) return 0
    for (let i = 0; i < need; i++) {
      const toX = targets[i * 3] as number
      const toY = targets[i * 3 + 1] as number
      let best = 0
      let bestD = Infinity
      for (let j = 0; j < free.length; j++) {
        const d = distance2(free[j]!, toX, toY)
        if (d < bestD) {
          best = j
          bestD = d
        }
      }
      const body = free.splice(best, 1)[0]!
      this.beans.splice(this.beans.indexOf(body), 1)
      Composite.remove(this.engine.world, body)
      this.letters.push({
        body,
        fromX: body.position.x,
        fromY: body.position.y,
        toX,
        toY,
        angle: targets[i * 3 + 2] as number
      })
    }
    this.clearBlock(targets, random)
    this.slideMs = 0
    return need
  }

  /**
   * Moves free beans off the letters' block to open floor, away from the pot too, so
   * nothing crowds the gossip. They scatter with a little roll, as if shooed.
   */
  private clearBlock(targets: Float32Array, random: () => number): void {
    let top = Infinity
    let bottom = -Infinity
    let left = Infinity
    let right = -Infinity
    for (let i = 0; i < targets.length; i += 3) {
      left = Math.min(left, targets[i] as number)
      right = Math.max(right, targets[i] as number)
      top = Math.min(top, targets[i + 1] as number)
      bottom = Math.max(bottom, targets[i + 1] as number)
    }
    const pad = BLOCK_PAD
    const blocked = (x: number, y: number) =>
      (x > left - pad &&
        x < right + pad &&
        y > top - pad &&
        y < bottom + pad) ||
      Math.hypot(x - POT_X, y - POT_Y) < POT_RADIUS + 40 ||
      this.onGrate(x, y, 30) ||
      (this.deck && (x < DECK_LEFT + 40 || x > DECK_RIGHT - 40))
    for (const body of this.beans) {
      const { x, y } = body.position
      if (!blocked(x, y)) continue
      // Try a few random spots on open floor; keep the last one if none is clear.
      let nx = x
      let ny = y
      for (let tries = 0; tries < 24; tries++) {
        nx = PLAY_LEFT + 30 + random() * (PLAY_RIGHT - PLAY_LEFT - 60)
        ny = this.top + 30 + random() * (PLAY_BOTTOM - this.top - 60)
        if (!blocked(nx, ny)) break
      }
      Body.setPosition(body, { x: nx, y: ny })
      Sleeping.set(body, false)
      const a = random() * Math.PI * 2
      Body.setVelocity(body, {
        x: toMatterSpeed(Math.cos(a) * 60),
        y: toMatterSpeed(Math.sin(a) * 60)
      })
    }
  }

  /** Moves sliding letters toward their spots. */
  stepLetters(dtMs: number): void {
    if (this.slideMs >= LETTER_SLIDE_MS || this.letters.length === 0) return
    this.slideMs = Math.min(LETTER_SLIDE_MS, this.slideMs + dtMs)
    // Critically damped: the gap shrinks by (1 + w t) e^(-w t), settled by the end.
    const w = 10 / (LETTER_SLIDE_MS / 1000)
    const t = this.slideMs / 1000
    const left =
      this.slideMs >= LETTER_SLIDE_MS ? 0 : (1 + w * t) * Math.exp(-w * t)
    for (const letter of this.letters)
      Body.setPosition(letter.body, {
        x: letter.toX + (letter.fromX - letter.toX) * left,
        y: letter.toY + (letter.fromY - letter.toY) * left
      })
    if (this.slideMs >= LETTER_SLIDE_MS)
      for (const letter of this.letters) this.settleLetter(letter.body)
  }

  /** True while letters are still sliding into place. */
  get sliding(): boolean {
    return this.letters.length > 0 && this.slideMs < LETTER_SLIDE_MS
  }

  /** The letter bean within `radius` of (x, y), or null. */
  letterNear(x: number, y: number, radius: number): LetterBean | null {
    let best: LetterBean | null = null
    let bestD2 = radius * radius
    for (const letter of this.letters) {
      const d2 = distance2(letter.body, x, y)
      if (d2 <= bestD2) {
        best = letter
        bestD2 = d2
      }
    }
    return best
  }

  /**
   * Letters become ordinary beans again where they lie: still, after a jot, or flung
   * apart by `fling` u/s after a scramble.
   */
  releaseLetters(fling = 0, random: () => number = Math.random): void {
    for (const letter of this.letters) {
      const body = letter.body
      // Settled letters are still obstacles in the world; sliding ones are out of it.
      if (body.isStatic) {
        Body.setStatic(body, false)
        Composite.remove(this.engine.world, body)
      }
      Body.setPosition(body, { x: letter.toX, y: letter.toY })
      Body.setAngle(body, letter.angle)
      this.addBody(body)
      if (fling > 0) {
        const a = random() * Math.PI * 2
        const speed = fling * (0.5 + random() * 0.5)
        Body.setVelocity(body, {
          x: toMatterSpeed(Math.cos(a) * speed),
          y: toMatterSpeed(Math.sin(a) * speed)
        })
      }
    }
    this.letters.length = 0
  }

  /** Beans in the tweezers or hands, pile beans included. */
  get holding(): number {
    return this.held.length + this.pileHeld
  }

  /** True once nothing is left on the ground here. */
  get clear(): boolean {
    return this.count === 0 && this.zone.pile === 0
  }

  /** Advances physics, applies any deck slide, and keeps every bean inside the play rect. */
  step(dtMs: number): void {
    this.ms += dtMs
    stepPhysics(this.engine, dtMs)
    for (let i = this.sinking.length - 1; i >= 0; i--) {
      const bean = this.sinking[i]!
      bean.ms += dtMs
      if (bean.ms >= SINK_MS) this.sinking.splice(i, 1)
    }
    const slideX = toMatterSpeed(this.slide.x) * BEAN_FRICTION_AIR
    const slideY = toMatterSpeed(this.slide.y) * BEAN_FRICTION_AIR
    const sliding = slideX !== 0 || slideY !== 0
    for (const body of this.beans) {
      // Air friction takes this share of velocity each step, so adding the same share of
      // the slide speed settles each bean at that speed.
      if (sliding)
        Body.setVelocity(body, {
          x: body.velocity.x + slideX,
          y: body.velocity.y + slideY
        })
      this.keepInside(body)
    }
  }

  /** Sends a free bean off at (vx, vy) u/s, waking it, such as a shopper's foot scuffing it. */
  push(body: Matter.Body, vx: number, vy: number): void {
    Sleeping.set(body, false)
    Body.setVelocity(body, { x: toMatterSpeed(vx), y: toMatterSpeed(vy) })
  }

  /** The free bean nearest (x, y) within `radius`, or null. */
  nearest(x: number, y: number, radius: number): Matter.Body | null {
    let best: Matter.Body | null = null
    let bestD2 = radius * radius
    for (const body of this.beans) {
      const d2 = distance2(body, x, y)
      if (d2 <= bestD2) {
        best = body
        bestD2 = d2
      }
    }
    return best
  }

  /** How many free beans sit within `radius` of (x, y). */
  countNear(x: number, y: number, radius: number): number {
    let n = 0
    const r2 = radius * radius
    for (const body of this.beans) if (distance2(body, x, y) <= r2) n++
    return n
  }

  /**
   * Tweezers: lifts the bean nearest (x, y) within `radius`, plus touching beans within
   * CLUMP_RADIUS of it, up to `max` beans in all. Returns how many it lifted.
   */
  grab(x: number, y: number, radius: number, max: number): number {
    if (this.holding > 0) return 0
    const first = this.nearest(x, y, radius)
    if (!first) return 0
    const picked = [first]
    if (max > 1) {
      const cx = first.position.x
      const cy = first.position.y
      const r2 = CLUMP_RADIUS * CLUMP_RADIUS
      const touching = this.beans
        .filter(body => body !== first && distance2(body, cx, cy) <= r2)
        .sort((a, b) => distance2(a, cx, cy) - distance2(b, cx, cy))
      for (const body of touching) {
        if (picked.length >= max) break
        picked.push(body)
      }
    }
    for (const [index, body] of picked.entries()) {
      // Clumps fan out at the tip, so every bean stays visible.
      const offset =
        index === 0 ? 0 : (index % 2 === 1 ? 1 : -1) * Math.ceil(index / 2)
      this.hold(body, offset * 9, Math.abs(offset) * 5)
    }
    this.moveHeld(x, y)
    return picked.length
  }

  /** Hands: lifts up to `max` free beans within `radius` of (x, y). Returns how many. */
  scoopCluster(x: number, y: number, radius: number, max: number): number {
    if (this.holding > 0) return 0
    const r2 = radius * radius
    const near = this.beans
      .filter(body => distance2(body, x, y) <= r2)
      .sort((a, b) => distance2(a, x, y) - distance2(b, x, y))
      .slice(0, max)
    for (const [index, body] of near.entries()) {
      // A small heap in the palms: rings of beans around the middle.
      const ring = Math.floor(Math.sqrt(index))
      const angle = index * 2.4
      this.hold(body, Math.cos(angle) * ring * 5, Math.sin(angle) * ring * 4)
    }
    this.moveHeld(x, y)
    return near.length
  }

  /** Hands: lifts `n` beans off the pile. They stay counted in the pile until they land. */
  scoopPile(n: number, x: number, y: number): number {
    if (this.holding > 0) return 0
    this.pileHeld = Math.max(0, Math.min(n, this.zone.pile))
    this.moveHeld(x, y)
    return this.pileHeld
  }

  /** Moves held beans with the tweezers or hands. */
  moveHeld(x: number, y: number): void {
    this.tip.x = x
    this.tip.y = y
    for (const bean of this.held)
      Body.setPosition(bean.body, { x: x + bean.dx, y: y + bean.dy })
  }

  /**
   * Lets go of everything held. Beans overlapping the pot go in, except swollen ones,
   * which bounce off the rim; swollen beans over the drying rack go onto it. The rest
   * return to the world with the tip's velocity, capped at RELEASE_SPEED_MAX. Pile beans
   * in hands go in when the hands are over the pot, and otherwise drop back on the pile.
   */
  release(vx: number, vy: number): ReleaseResult {
    let potted = 0
    let returned = 0
    let refused = 0
    let racked = 0
    const speed = Math.hypot(vx, vy)
    const k = speed > RELEASE_SPEED_MAX ? RELEASE_SPEED_MAX / speed : 1
    for (const bean of this.held) {
      const body = bean.body
      const { x, y } = body.position
      const swollen = this.swollen.has(body)
      if (overPot(x, y) && swollen) {
        this.bounceOffPot(body)
        refused++
      } else if (overPot(x, y)) {
        potted++
      } else if (swollen && this.rack && onRack(x, y)) {
        this.swollen.delete(body)
        racked++
      } else {
        this.addBody(body)
        Body.setVelocity(body, {
          x: toMatterSpeed(vx * k),
          y: toMatterSpeed(vy * k)
        })
        Body.setAngularVelocity(body, toMatterSpeed(vx * k) * RELEASE_SPIN)
        this.releasedAt.set(body, this.ms)
        returned++
      }
    }
    this.held.length = 0
    if (potted > 0) {
      move(this.counts, 'loose', 'pot', potted)
      this.zone.count -= potted
      this.zone.shown = Math.max(0, this.zone.shown - potted)
    }
    if (racked > 0) {
      move(this.counts, 'puddle', 'drying', racked)
      this.zone.count -= racked
      this.zone.puddle -= racked
      this.zone.shown = Math.max(0, this.zone.shown - racked)
    }
    const pile = this.pileHeld
    this.pileHeld = 0
    if (pile > 0) {
      if (overPot(this.tip.x, this.tip.y)) {
        move(this.counts, 'pile', 'pot', pile)
        this.zone.pile -= pile
        this.zone.shown = Math.max(0, this.zone.shown - pile)
        potted += pile
      } else {
        returned += pile
      }
    }
    return { potted, returned, refused, racked }
  }

  /** A swollen bean won't fit: it lands just outside the rim and bounces away from the pot. */
  private bounceOffPot(body: Matter.Body): void {
    const dx = body.position.x - POT_X
    const dy = body.position.y - POT_Y
    const d = Math.hypot(dx, dy) || 1
    const ux = d > 1 ? dx / d : 0
    const uy = d > 1 ? dy / d : -1
    const out = POT_RADIUS + SWOLLEN_RADIUS + 4
    Body.setPosition(body, { x: POT_X + ux * out, y: POT_Y + uy * out })
    this.addBody(body)
    Body.setVelocity(body, {
      x: toMatterSpeed(ux * SWOLLEN_BOUNCE),
      y: toMatterSpeed(uy * SWOLLEN_BOUNCE)
    })
  }

  /**
   * Fast hands lose one bean: a held body drops where it is, or a pile bean lands on the
   * ground as a new body (back on the pile when 200 bodies already exist). Returns true
   * when the hands held one less bean afterwards.
   */
  dribble(): boolean {
    const bean = this.held.pop()
    if (bean) {
      this.addBody(bean.body)
      return true
    }
    if (this.pileHeld === 0) return false
    this.pileHeld--
    if (this.count < ZONE_MAX_LOOSE) {
      move(this.counts, 'pile', 'loose', 1)
      this.zone.pile--
      this.zone.count++
      this.addBean(this.tip.x, this.tip.y + 12, this.tip.x * 0.1)
    }
    return true
  }

  /**
   * A cat bats a free bean under the fridge (or a slow bean falls down a drain): its body
   * leaves the world and the bean moves from `loose` to the zone's `drain`.
   */
  sendToDrain(body: Matter.Body): void {
    if (this.takeFree(body, 'drain')) this.zone.drain++
  }

  /**
   * A pigeon eats a free bean: its body leaves the world and the bean moves to `packets`
   * in the ledger. The caller labels its packet. Returns false when `body` isn't free.
   */
  loseBean(body: Matter.Body): boolean {
    return this.takeFree(body, 'packets')
  }

  /**
   * Takes a free bean's body out of the world and moves the bean from `loose` (or
   * `puddle` when swollen) to `to` in the ledger. Returns false when `body` isn't free.
   */
  private takeFree(body: Matter.Body, to: 'drain' | 'packets'): boolean {
    const index = this.beans.indexOf(body)
    if (index < 0) return false
    this.beans.splice(index, 1)
    Composite.remove(this.engine.world, body)
    if (this.swollen.delete(body)) {
      move(this.counts, 'puddle', to, 1)
      this.zone.puddle--
    } else move(this.counts, 'loose', to, 1)
    this.zone.count--
    this.zone.shown = Math.min(
      this.zone.shown,
      this.zone.count + this.zone.pile
    )
    return true
  }

  /**
   * A bean fished out of the drain lands at (x, y) as a loose bean, or on the pile when
   * the zone already holds its 200 bodies. Moves it out of `drain` in the ledger.
   */
  fishOut(x: number, y: number): void {
    const zone = this.zone
    if (zone.drain === 0) return
    zone.drain--
    if (this.count < ZONE_MAX_LOOSE) {
      move(this.counts, 'drain', 'loose', 1)
      zone.count++
      this.addBean(x, y, x * 0.1)
    } else {
      move(this.counts, 'drain', 'pile', 1)
      zone.pile++
    }
  }

  /** Writes every bean's position into the zone record, held beans included. */
  writeBack(): void {
    const zone = this.zone
    let i = 0
    for (const body of this.beans)
      writeBean(
        zone,
        i++,
        body.position.x,
        body.position.y,
        body.angle,
        this.swollen.has(body) ? KIND_PUDDLE : KIND_LOOSE
      )
    for (const bean of this.held)
      writeBean(
        zone,
        i++,
        bean.body.position.x,
        bean.body.position.y,
        bean.body.angle,
        this.swollen.has(bean.body) ? KIND_PUDDLE : KIND_LOOSE
      )
    for (const letter of this.letters)
      writeBean(zone, i++, letter.toX, letter.toY, letter.angle, KIND_GOSSIP)
    // A duck that hasn't swum back yet drops its bean at the deck's edge.
    for (const duck of this.ducks) {
      const drop = this.duckDrop(duck)
      writeBean(
        zone,
        i++,
        drop.x,
        drop.y,
        duck.body.angle,
        this.swollen.has(duck.body) ? KIND_PUDDLE : KIND_LOOSE
      )
    }
    zone.count = i
    zone.shown = zone.count + zone.pile
  }

  /** A body's speed in u/s, for tests and debug overlays. */
  speedOf(body: Matter.Body): number {
    return fromMatterSpeed(Math.hypot(body.velocity.x, body.velocity.y))
  }

  /** Frees the engine. The world can't be used afterwards. */
  dispose(): void {
    Composite.clear(this.engine.world, false)
    Matter.Engine.clear(this.engine)
    this.beans.length = 0
    this.held.length = 0
    this.ducks.length = 0
    this.swollen.clear()
  }

  private hold(body: Matter.Body, dx: number, dy: number): void {
    const index = this.beans.indexOf(body)
    if (index >= 0) this.beans.splice(index, 1)
    Composite.remove(this.engine.world, body)
    Body.setVelocity(body, { x: 0, y: 0 })
    Body.setAngularVelocity(body, 0)
    this.held.push({ body, dx, dy })
  }

  private addBean(x: number, y: number, angle: number): Matter.Body {
    const body = this.makeBean(x, y, angle)
    this.addBody(body)
    return body
  }

  /** A bean body that isn't in the world yet. */
  private makeBean(x: number, y: number, angle: number): Matter.Body {
    return Bodies.circle(x, y, BEAN_RADIUS, {
      frictionAir: BEAN_FRICTION_AIR,
      restitution: BEAN_RESTITUTION,
      density: BEAN_DENSITY,
      angle,
      collisionFilter: {
        category: BEAN_CATEGORY,
        mask: BEAN_CATEGORY | POT_CATEGORY | WALL_CATEGORY
      }
    })
  }

  private addBody(body: Matter.Body): void {
    this.beans.push(body)
    Composite.add(this.engine.world, body)
    Sleeping.set(body, false)
  }

  /** Clamps escaped bodies back inside the play rect. A body with a broken position respawns above the pot. */
  private keepInside(body: Matter.Body): void {
    const { x, y } = body.position
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      Body.setPosition(body, { x: POT_X, y: POT_Y - POT_RADIUS - 40 })
      Body.setVelocity(body, { x: 0, y: 0 })
      return
    }
    const r = BEAN_RADIUS
    const cx = Math.min(PLAY_RIGHT - r, Math.max(PLAY_LEFT + r, x))
    const cy = Math.min(PLAY_BOTTOM - r, Math.max(this.top + r, y))
    if (cx === x && cy === y) return
    Body.setPosition(body, { x: cx, y: cy })
    Body.setVelocity(body, { x: 0, y: 0 })
  }
}

/** True when a point overlaps the pot: within the pot radius plus a bean radius. */
export function overPot(x: number, y: number): boolean {
  return Math.hypot(x - POT_X, y - POT_Y) < POT_ACCEPT
}

function distance2(body: Matter.Body, x: number, y: number): number {
  const dx = body.position.x - x
  const dy = body.position.y - y
  return dx * dx + dy * dy
}
