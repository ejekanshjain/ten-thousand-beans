import { MAX_PARTICLES, PARTICLE_GRAVITY, SLOPE_ROLL_SPEED } from './tuning'

/** Walk-view layout shared by the simulation (spill launch points) and the renderer. */
export const GROUND_Y = 640
/** The camera keeps you this far from the design's left edge, so you see about 420 u ahead. */
export const PLAYER_SCREEN_X = 180
/** The pot's rim centre, relative to your feet. It is also the pot's pivot. */
export const POT_OFFSET_X = 62
export const POT_RIM_Y = 500
/** Drawn depth of the pot below the rim. */
export const POT_DRAW_DEPTH = 86
/** The Taller Pot draws this many times deeper. */
export const POT_TALL_SCALE = 1.4

/** Drawn depth of the pot below the rim: deeper for the Taller Pot. */
export function potDepth(tall: boolean): number {
  return tall ? POT_DRAW_DEPTH * POT_TALL_SCALE : POT_DRAW_DEPTH
}
/** Set down in the walk view, the pot sits this far further ahead than in your hands. */
export const GROUND_POT_SHIFT = 30

/** Where a flying bean ends up, so its landing can play the right plop. */
export const LAND_GROUND = 0
export const LAND_DRAIN = 1
export const LAND_PUDDLE = 2
export const LAND_RIVER = 3
export const LAND_MAT = 4
/** The zone id river beans' particles carry: they join no zone, since the river took them. */
export const RIVER_ZONE = -1
/** The zone id of the bean Grandma's dog knocks under her doormat. */
export const MAT_ZONE = -2

/** Called when a flying bean lands: its zone, where it landed (LAND_*), and the spot. */
export type LandListener = (
  zoneId: number,
  kind: number,
  x: number,
  y: number
) => void

/** How long a ripple spreads where a bean dropped into water or a drain, in real ms. */
export const RIPPLE_MS = 700
/** Most ripples alive at once; a new one replaces the oldest. */
const MAX_RIPPLES = 16

/**
 * Rings spreading where beans dropped into the river, a puddle or a drain in the walk
 * view. A fixed ring buffer, so a burst of beans allocates nothing.
 */
export class Ripples {
  readonly x = new Float32Array(MAX_RIPPLES)
  readonly y = new Float32Array(MAX_RIPPLES)
  /** Real ms since the ripple started, or RIPPLE_MS once it has faded. */
  readonly ms = new Float32Array(MAX_RIPPLES).fill(RIPPLE_MS)
  /** LAND_DRAIN, LAND_PUDDLE or LAND_RIVER per slot. */
  readonly kind = new Uint8Array(MAX_RIPPLES)
  private next = 0

  add(x: number, y: number, kind: number): void {
    const i = this.next
    this.next = (i + 1) % MAX_RIPPLES
    this.x[i] = x
    this.y[i] = y
    this.ms[i] = 0
    this.kind[i] = kind
  }

  step(dtMs: number): void {
    for (let i = 0; i < MAX_RIPPLES; i++)
      if ((this.ms[i] as number) < RIPPLE_MS)
        this.ms[i] = Math.min(RIPPLE_MS, (this.ms[i] as number) + dtMs)
  }

  clear(): void {
    this.ms.fill(RIPPLE_MS)
  }
}

/**
 * Pooled bean particles flying out of the pot in the walk view. Purely visual: the ledger
 * moved each bean when it left. A landing tells its zone to show one more bean.
 */
export class Particles {
  readonly x = new Float32Array(MAX_PARTICLES)
  readonly y = new Float32Array(MAX_PARTICLES)
  readonly vx = new Float32Array(MAX_PARTICLES)
  readonly vy = new Float32Array(MAX_PARTICLES)
  readonly angle = new Float32Array(MAX_PARTICLES)
  readonly spin = new Float32Array(MAX_PARTICLES)
  /** Zone id per slot, or 0 when the slot is free. */
  readonly zone = new Int32Array(MAX_PARTICLES)
  /** Ground height each particle lands on. */
  readonly floor = new Float32Array(MAX_PARTICLES)
  /** LAND_GROUND, LAND_DRAIN, LAND_PUDDLE, LAND_RIVER or LAND_MAT per slot. */
  readonly kind = new Uint8Array(MAX_PARTICLES)
  /** Where a bean that lands on a slope rolls to, or NaN when it stays where it lands. */
  readonly rollX = new Float32Array(MAX_PARTICLES)
  readonly rollY = new Float32Array(MAX_PARTICLES)
  /** 1 while a bean rolls down the slope after landing. */
  readonly rolling = new Uint8Array(MAX_PARTICLES)
  alive = 0

  /**
   * Starts a particle. A bean given `rollX` and `rollY` rolls there at SLOPE_ROLL_SPEED
   * once it lands, such as down a hill. Returns false when the pool is full, so the
   * caller lands the bean at once.
   */
  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    spin: number,
    floor: number,
    zoneId: number,
    kind = LAND_GROUND,
    rollX = NaN,
    rollY = NaN
  ): boolean {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.zone[i] !== 0) continue
      this.kind[i] = kind
      this.rollX[i] = rollX
      this.rollY[i] = rollY
      this.rolling[i] = 0
      this.x[i] = x
      this.y[i] = y
      this.vx[i] = vx
      this.vy[i] = vy
      this.angle[i] = 0
      this.spin[i] = spin
      this.floor[i] = floor
      this.zone[i] = zoneId
      this.alive++
      return true
    }
    return false
  }

  /** Moves particles under gravity and calls `onLand(zoneId, kind, x, y)` for each one that lands. */
  step(dtS: number, onLand: LandListener): void {
    if (this.alive === 0) return
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const zoneId = this.zone[i] as number
      if (zoneId === 0) continue
      if (this.rolling[i] === 1) {
        this.roll(i, dtS, zoneId, onLand)
        continue
      }
      this.vy[i] = (this.vy[i] as number) + PARTICLE_GRAVITY * dtS
      this.x[i] = (this.x[i] as number) + (this.vx[i] as number) * dtS
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dtS
      this.angle[i] = (this.angle[i] as number) + (this.spin[i] as number) * dtS
      if ((this.y[i] as number) < (this.floor[i] as number)) continue
      if (Number.isNaN(this.rollX[i])) {
        this.zone[i] = 0
        this.alive--
        onLand(
          zoneId,
          this.kind[i] as number,
          this.x[i] as number,
          this.floor[i] as number
        )
        continue
      }
      // Landed on a slope: it rolls straight down to its resting spot.
      this.y[i] = this.floor[i] as number
      const dx = (this.rollX[i] as number) - (this.x[i] as number)
      const dy = (this.rollY[i] as number) - (this.y[i] as number)
      const d = Math.hypot(dx, dy) || 1
      this.vx[i] = (dx / d) * SLOPE_ROLL_SPEED
      this.vy[i] = (dy / d) * SLOPE_ROLL_SPEED
      this.spin[i] = -Math.sign(dx) * 14
      this.rolling[i] = 1
    }
  }

  /** One step of a bean rolling down a slope; it lands once it reaches its spot. */
  private roll(
    i: number,
    dtS: number,
    zoneId: number,
    onLand: LandListener
  ): void {
    const left =
      Math.hypot(
        (this.rollX[i] as number) - (this.x[i] as number),
        (this.rollY[i] as number) - (this.y[i] as number)
      ) -
      SLOPE_ROLL_SPEED * dtS
    this.angle[i] = (this.angle[i] as number) + (this.spin[i] as number) * dtS
    if (left > 0) {
      this.x[i] = (this.x[i] as number) + (this.vx[i] as number) * dtS
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dtS
      return
    }
    this.zone[i] = 0
    this.rolling[i] = 0
    this.alive--
    onLand(
      zoneId,
      this.kind[i] as number,
      this.rollX[i] as number,
      this.rollY[i] as number
    )
  }

  /** Lands every particle at once, for scene changes. */
  landAll(onLand: LandListener): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const zoneId = this.zone[i] as number
      if (zoneId === 0) continue
      this.zone[i] = 0
      onLand(
        zoneId,
        this.kind[i] as number,
        this.x[i] as number,
        this.floor[i] as number
      )
    }
    this.alive = 0
  }
}

/** Time to fall from height `y` to `floor` with launch speed `vy` (negative is up). */
export function flightTime(y: number, vy: number, floor: number): number {
  // Solves y + vy t + g t² / 2 = floor for the later root; y grows downward.
  const drop = floor - y
  return (
    (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * PARTICLE_GRAVITY * drop))) /
    PARTICLE_GRAVITY
  )
}

export type CaptionTone = 'bad' | 'good' | 'info'

/** A short canvas caption near its cause. */
export interface Caption {
  text: string
  /** A smaller second line, such as Grandma's reaction. */
  sub: string
  /** A running score under it, such as "Ladder: 2. You: 0.", or ''. */
  score: string
  /** Names a kind of caption, such as 'river', so a burst of beans shows it only once and a new one replaces the old. */
  key: string
  x: number
  y: number
  /** True when x and y are route coordinates that scroll with the camera. */
  world: boolean
  tone: CaptionTone
  ageMs: number
  lifeMs: number
}

/** Most captions on screen at once. */
export const MAX_CAPTIONS = 3

/**
 * Adds a caption, dropping the oldest beyond MAX_CAPTIONS. Repeating the newest caption
 * restarts it instead, and a caption with a key replaces the one with the same key.
 */
export function addCaption(
  list: Caption[],
  caption: Omit<Caption, 'ageMs'>
): void {
  const newest = list[list.length - 1]
  if (newest && newest.text === caption.text && newest.sub === caption.sub) {
    newest.ageMs = Math.min(newest.ageMs, 160)
    newest.lifeMs = caption.lifeMs
    newest.score = caption.score
    return
  }
  if (caption.key) {
    const same = list.findIndex(c => c.key === caption.key)
    if (same >= 0) list.splice(same, 1)
  }
  list.push({ ...caption, ageMs: 0 })
  while (list.length > MAX_CAPTIONS) list.shift()
}

/** Ages captions by real time and drops finished ones. */
export function stepCaptions(list: Caption[], dtMs: number): void {
  for (const caption of list) caption.ageMs += dtMs
  for (let i = list.length - 1; i >= 0; i--)
    if ((list[i] as Caption).ageMs >= (list[i] as Caption).lifeMs)
      list.splice(i, 1)
}
