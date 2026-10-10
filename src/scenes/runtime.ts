import {
  createGame,
  groundTap,
  toggleCarry,
  updateGame,
  type Game,
  type GameInput
} from '../game/game'
import { publish } from '../game/hud'
import { doorDrag, doorPress, doorRelease } from '../game/door'
import { netDrag, netPress, netRelease } from '../game/net'
import { sellPage } from '../game/kiosk'
import { bought, mudDrag, mudPress, mudRelease } from '../game/upgrades'
import { boxDrag, boxPress, boxRelease, toggleBox } from '../game/windowBox'
import { currentStretch } from '../game/state'
import { GUST_WARN_MS } from '../game/tuning'
import { endPour, startPour } from '../game/weather'
import {
  createMotion,
  devFlags,
  isGameInputBlocked,
  sfx,
  startLoop,
  vibrate,
  type LoopHandle,
  type LoopName,
  type Viewport
} from '../shared'
import { createBeanStamps, type BeanStamps } from './art/bean'
import { colors } from './art/colors'
import { BoxScene } from './boxScene'
import { drawDebugOverlay } from './debugOverlay'
import { devHooks, logSound } from './devHooks'
import { InputRig } from './input'
import { DoorScene } from './doorScene'
import { DrainScene } from './drainScene'
import { Film } from './film'
import { KioskScene } from './kioskScene'
import { PickupControls } from './pickupControls'
import { PickupScene } from './pickupScene'
import { WalkScene } from './walkScene'

/** HUD snapshots publish this often, in ms. */
const HUD_INTERVAL_MS = 100

/**
 * Owns one running game: the simulation, input devices, scene renderers and the loop.
 * React talks to it through the HUD store and a few methods for buttons.
 */
export class Runtime {
  readonly game: Game
  readonly input: InputRig
  private readonly stamps: BeanStamps
  readonly walkScene: WalkScene
  private readonly pickupScene: PickupScene
  private readonly drainScene: DrainScene
  private readonly kioskScene: KioskScene
  private readonly boxScene: BoxScene
  private readonly doorScene: DoorScene
  /** Records the walk view for fail replays. */
  readonly film: Film
  /** The stretch cut the film last saw, so a new stretch starts a fresh recording. */
  private filmCut = -1
  private readonly gameInput: GameInput = {
    walk: { walk: 0, hurry: 0 },
    tilt: { rate: 0, absolute: null },
    pointer: { x: 0, y: 0, vx: 0, vy: 0, down: false }
  }
  private readonly controls: PickupControls
  private hudMs = 0
  private lastRenderMs = 0
  /** Looping weather sounds playing now. */
  private readonly loops = new Map<LoopName, LoopHandle>()
  /** False until the start screen is tapped; the world draws but doesn't move. */
  started = false

  constructor(
    readonly viewport: Viewport,
    canvas: HTMLCanvasElement,
    seed = Date.now() % 100_000
  ) {
    this.game = createGame(seed)
    this.input = new InputRig(canvas, viewport)
    this.stamps = createBeanStamps(viewport)
    this.walkScene = new WalkScene(viewport, this.stamps)
    this.pickupScene = new PickupScene(viewport, this.stamps)
    this.drainScene = new DrainScene(viewport, this.stamps)
    this.kioskScene = new KioskScene(viewport, this.stamps)
    this.boxScene = new BoxScene(viewport, this.stamps)
    this.doorScene = new DoorScene(viewport, this.stamps)
    this.film = new Film(viewport)
    this.controls = new PickupControls(
      this.game,
      this.input.pointer,
      viewport,
      () => this.live()
    )
  }

  /** True while the game runs and no dialog blocks input. */
  live(): boolean {
    return this.started && !isGameInputBlocked()
  }

  /** Starts input listeners and the loop. Returns a function that stops everything. */
  start(): () => void {
    const unsubscribe = [
      this.input.keys.onPress('Space', event => {
        event.preventDefault()
        if (this.live()) this.toggleCarry()
      }),
      this.input.keys.onPress('KeyJ', () => this.jot(true)),
      this.input.keys.onRelease('KeyJ', () => this.jot(false)),
      this.controls.attach(),
      this.input.keys.onPress('KeyE', () => {
        if (this.live()) this.toggleBox()
      }),
      this.input.keys.onPress('KeyP', () => this.pour(true)),
      this.input.keys.onRelease('KeyP', () => this.pour(false)),
      ...this.attachSceneTaps()
    ]
    const stop = startLoop({
      update: dt => this.update(dt),
      render: (_alpha, timeMs) => this.render(timeMs)
    })
    this.publish()
    return () => {
      stop()
      for (const off of unsubscribe) off()
      for (const loop of this.loops.values()) loop.stop()
      this.loops.clear()
      this.input.dispose()
      this.walkScene.dispose()
      this.pickupScene.dispose()
      this.drainScene.dispose()
      this.kioskScene.release()
      this.boxScene.release()
      this.doorScene.dispose()
      this.film.dispose()
      this.stamps.dispose()
    }
  }

  /**
   * Pointer input outside Pickup: circling the Pigeon Net's knots and taps that shoo
   * pigeons off the pot in the walk view, digging, planting, watering and picking in the
   * window box, and rubbing mud off your shoes at the kiosk.
   */
  private attachSceneTaps(): (() => void)[] {
    const pointer = this.input.pointer
    const game = this.game
    return [
      pointer.onPress((p, e) => {
        if (!this.live()) return
        if (game.scene === 'box') boxPress(game, p.x, p.y)
        else if (game.scene === 'kiosk') mudPress(game, p.x, p.y)
        else if (game.scene === 'count') doorPress(game, p.x, p.y)
        else if (game.scene === 'grounded') {
          const at = this.walkScene.toWorld(p.x, p.y)
          // A pigeon shoos even when it stands over a knot of the net.
          if (!groundTap(game, at.x, at.y))
            netPress(game, at.x, at.y, e.timeStamp)
        }
        this.drain()
      }),
      pointer.onDrag((p, e) => {
        if (!this.live()) return
        if (game.scene === 'box') boxDrag(game, p.x, p.y)
        else if (game.scene === 'kiosk') mudDrag(game, p.x, p.y)
        else if (game.scene === 'count') doorDrag(game, p.x, p.y)
        else if (game.scene === 'grounded') {
          const at = this.walkScene.toWorld(p.x, p.y)
          netDrag(game, at.x, at.y, e.timeStamp)
        }
        this.drain()
      }),
      pointer.onRelease(() => {
        if (game.scene === 'box') boxRelease(game)
        else if (game.scene === 'grounded') netRelease(game)
        mudRelease(game)
        doorRelease(game)
        this.drain()
      })
    ]
  }

  /** The start screen was tapped: the run and its clock start now. */
  begin(): void {
    this.started = true
    this.game.stats.startedAt = Date.now()
  }

  /** Turns on device tilt once motion access is allowed. */
  enableMotion(): void {
    if (!this.input.motion.real) this.input.motion.real = createMotion()
  }

  /** J, or the Jot It Down button, held down or let go. */
  jot(down: boolean): void {
    this.game.gossip.jotHeld = down && this.live()
  }

  /** Space, or the Set Down / Pick Up Pot / Next Stretch button. */
  toggleCarry(): void {
    toggleCarry(this.game)
    this.drain()
  }

  /** E, or the Window Box and Close Box buttons. */
  toggleBox(): void {
    toggleBox(this.game)
    this.drain()
  }

  /** P, or the Pour Off button, held down or let go. */
  pour(down: boolean): void {
    if (down) {
      if (this.live()) startPour(this.game)
    } else endPour(this.game)
    this.drain()
  }

  /** The shop sold you an upgrade. */
  bought(id: string): void {
    bought(this.game, id)
    this.drain()
  }

  /** A Sell button at the kiosk. */
  sell(line: number): void {
    if (!this.live()) return
    sellPage(this.game, line)
    this.drain()
  }

  update(dtMs: number): void {
    if (!this.live()) {
      // A dialog can swallow the pointerup of a held tilt button.
      this.input.buttons.left = this.input.buttons.right = false
      this.ambience(false)
      return
    }
    const game = this.game
    game.touch = this.input.touch
    game.tiltButtons = this.input.touch && !this.input.motionActive
    this.input.read(game, this.gameInput, dtMs)
    if (import.meta.env.DEV)
      devHooks.driver?.(this.gameInput, game, dtMs / 1000)
    this.controls.update()
    updateGame(game, dtMs, this.gameInput)
    this.drain()
    this.ambience(true)
    this.hudMs += dtMs
    if (this.hudMs >= HUD_INTERVAL_MS) {
      this.hudMs = 0
      this.publish()
    }
    if (import.meta.env.DEV) devHooks.afterUpdate?.(game)
  }

  render(timeMs: number): void {
    const dtS = Math.min(0.1, Math.max(0, (timeMs - this.lastRenderMs) / 1000))
    this.lastRenderMs = timeMs
    const game = this.game
    // The window box opens over a blurred copy of the scene it covers.
    if (game.scene === 'box' && !this.boxScene.captured)
      this.boxScene.capture(this.viewport.ctx.canvas)
    const ctx = this.viewport.begin(colors.sky)
    if (game.scene === 'box') {
      this.boxScene.render(ctx, game, timeMs)
    } else if (game.scene === 'pickup') {
      this.pickupScene.render(ctx, game, timeMs, dtS, this.controls.tip)
    } else if (game.scene === 'drain') {
      this.drainScene.render(ctx, game, timeMs)
    } else if (game.scene === 'kiosk') {
      this.kioskScene.render(ctx, game, timeMs)
    } else if (game.scene === 'count') {
      this.doorScene.render(ctx, game, timeMs)
    } else {
      this.walkScene.render(ctx, game, timeMs, dtS)
    }
    if (import.meta.env.DEV && devFlags.debug)
      drawDebugOverlay(ctx, game, this.viewport, {
        walk: this.walkScene.camera,
        pickup: this.pickupScene.camera,
        drain: this.drainScene.camera
      })
    if (game.scene !== 'kiosk') this.kioskScene.release()
    if (game.scene !== 'box') this.boxScene.release()
    // Spills only happen in the walk view, so only it is filmed.
    if (this.live() && (game.scene === 'walk' || game.scene === 'grounded')) {
      if (this.filmCut !== game.fx.cut) {
        this.filmCut = game.fx.cut
        this.film.reset()
      }
      this.film.capture(timeMs)
    }
  }

  /** Copies the slow-changing state into the HUD store. */
  publish(): void {
    const input = this.input
    publish(this.game, {
      touch: input.touch,
      tiltButtons: input.touch && !input.motionActive
    })
  }

  /**
   * Keeps the looping sounds in step with the game: rain while it falls on the pot, wind
   * rising through a gust's warning, and the pour while you hold Pour Off or water the
   * window box.
   */
  private ambience(live: boolean): void {
    const game = this.game
    const weather = game.weather
    const gust = weather.gust
    const windy = live && game.scene === 'walk' && currentStretch(game).gusts
    const wind = !windy
      ? 0
      : gust.phase === 'warn'
        ? 0.15 + 0.6 * Math.min(1, gust.ms / GUST_WARN_MS)
        : gust.phase === 'blow'
          ? 0.8
          : 0.12
    this.setLoop('wind', wind)
    this.setLoop(
      'rain',
      live && weather.raining && game.scene === 'walk' ? 0.45 : 0
    )
    const box = game.box
    this.setLoop(
      'pour',
      !live
        ? 0
        : weather.pouring
          ? 0.25 + 0.6 * weather.pour.level
          : game.scene === 'box' && box.mode === 'water'
            ? 0.3 + 0.4 * box.water.level
            : 0
    )
  }

  private setLoop(name: LoopName, volume: number): void {
    const loop = this.loops.get(name)
    if (volume <= 0.01) {
      if (loop) {
        loop.stop()
        this.loops.delete(name)
      }
    } else if (loop) loop.setVolume(volume)
    else {
      this.loops.set(name, sfx.loop(name, { volume }))
      if (import.meta.env.DEV) logSound(`loop ${name}`)
    }
  }

  /** Plays the simulation's queued side effects. */
  private drain(): void {
    const game = this.game
    for (const event of game.out) {
      switch (event.type) {
        case 'sound':
          sfx.play(event.name, { volume: event.volume, pitch: event.pitch })
          if (import.meta.env.DEV) logSound(event.name)
          break
        case 'vibrate':
          vibrate(event.ms)
          if (import.meta.env.DEV) logSound(`vibrate ${event.ms}`)
          break
        case 'scene':
          this.publish()
          break
        case 'potLifted':
          this.input.motion.calibrate()
          break
        case 'potted':
          this.pickupScene.bump()
          break
        case 'replay':
          this.film.cut(
            event.replay,
            currentStretch(game).name,
            game.counts.pot
          )
          break
      }
    }
    game.out.length = 0
  }
}
