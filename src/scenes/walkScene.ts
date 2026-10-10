import {
  GROUND_POT_SHIFT,
  GROUND_Y,
  LAND_DRAIN,
  MAT_ZONE,
  PLAYER_SCREEN_X,
  POT_OFFSET_X,
  POT_RIM_Y,
  potDepth,
  RIPPLE_MS
} from '../game/fx'
import { ambushWarningSide, type AmbushState } from '../game/ambush'
import { currentStretch, type Game, type KickFx } from '../game/game'
import { gateOpen, gateX } from '../game/gate'
import { catWatching, counterRim } from '../game/kitchen'
import { dropSpan, groundDrop, groundY, type StretchDef } from '../game/route'
import { effectiveAngle, marginFor, tipAngle } from '../game/slosh'
import {
  ladderPhase,
  ladderSwinging,
  spoonOut,
  type MarketState
} from '../game/market'
import { shoeLook } from '../game/upgrades'
import { gustSide } from '../game/weather'
import {
  ballProgress,
  parkWarningSide,
  whoa,
  type ParkState
} from '../game/park'
import { peeking, type Neighbour } from '../game/street'
import { rimPoint } from '../game/emit'
import { doorWarningSide } from '../game/door'
import {
  BALL_FLIGHT_MS,
  BALL_REACH,
  BIG_KICK,
  CAT_REACH,
  CAT_RUN_MS,
  CAT_WINDUP_MS,
  COUNTER_TOP,
  DOOR_DOG_WARN_MS,
  DOOR_DOG_X,
  DOORMAT_X,
  GRANDMA_X,
  INTRO_PAW_MS,
  KID_WINDUP_MS,
  LID_FLIGHT_MS,
  LADDER_CYCLE_MS,
  LADDER_NOTICE,
  LADDER_REACH,
  LADDER_SWING_MS,
  NEIGHBOUR_STEP_MS,
  RIM_HALF,
  SPOON_CYCLE_MS,
  SPOON_OUT_MS,
  SPOON_REACH,
  ZONE_SPREAD
} from '../game/tuning'
import { formatBeans } from '../game/units'
import { BEAN_FIELDS, KIND_PUDDLE, type Zone } from '../game/zones'
import {
  boilSeed,
  palette,
  settings,
  sketchArrow,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import {
  drawCurtainTwitch,
  drawLead,
  drawSaleSign,
  drawSnore
} from './art/ambush'
import {
  BACKDROPS,
  doorstepY,
  houseWindow,
  paintOpenDoor,
  paintTile
} from './art/backdrops'
import type { BeanStamps } from './art/bean'
import { colors } from './art/colors'
import {
  drawCatPaw,
  drawSideCat,
  drawSwatText,
  type SideCatView
} from './art/cat'
import { drawGate } from './art/gate'
import { drawLadderMan, drawShopper, drawStallholder } from './art/market'
import {
  arcPoint,
  BRUNO,
  drawBall,
  drawBallPath,
  drawKid,
  drawSideDog,
  paintBench
} from './art/park'
import { drawDuck, drawRail } from './art/bridge'
import { drawDoorDog, drawGrandma, drawSideDoormat } from './art/grandma'
import { drawSideNet } from './art/net'
import { drawFeathers, drawSidePigeon } from './art/pigeon'
import {
  drawBellWarning,
  drawBubble,
  drawCyclist,
  drawNeighbour,
  type NeighbourView
} from './art/people'
import { drawArm, drawPlayer, shoulderOf, type PlayerView } from './art/player'
import { drawSidePot, type SidePotView } from './art/pot'
import {
  drawLeaves,
  drawPourMeter,
  drawPourStream,
  drawRain
} from './art/weather'
import { Camera } from './camera'
import { CAPTION_TOP, drawCaptions } from './captions'
import { TILE_TOP, TILE_WIDTH, TileStrip } from './tiles'

const PILE: SketchStyle = {
  fill: colors.bean,
  fillStyle: 'hatch',
  hatchGap: 5,
  color: colors.beanDark,
  width: 2.5
}
const KICK_ARROW: SketchStyle & { head: number } = {
  color: palette.red,
  width: 5,
  head: 16,
  passes: 1
}
const BACK_RACK: SketchStyle = { fill: colors.wood, width: 2.5, wobble: 1 }
const BACK_BOX: SketchStyle = { fill: colors.woodDark, width: 2.5, wobble: 1 }
const LID_OFF: SketchStyle = { fill: '#ced4da', width: 3, wobble: 1 }
const RIPPLE_WATER: SketchStyle = {
  color: '#ffffff',
  width: 3,
  wobble: 1,
  passes: 1
}
const RIPPLE_DRAIN: SketchStyle = {
  color: palette.inkSoft,
  width: 2.5,
  wobble: 1,
  passes: 1
}
const LID_KNOB: SketchStyle = { fill: '#868e96', width: 2.5, wobble: 0.6 }
const SPROUT: SketchStyle = {
  color: '#2b8a3e',
  width: 3,
  wobble: 0.5,
  passes: 1
}
const BACK_POD: SketchStyle = { fill: '#69db7c', width: 2, wobble: 0.6 }
const JAR: SketchStyle = {
  fill: 'rgba(208, 235, 255, 0.7)',
  width: 2.5,
  wobble: 0.8
}
const WARN_ARROW: SketchStyle & { head: number } = {
  color: palette.orange,
  width: 5,
  head: 16,
  passes: 1
}
const TITLE: SketchTextStyle = {
  font: 'marker',
  size: 52,
  outline: palette.paper,
  color: palette.ink,
  tilt: 0.04,
  seed: 7
}
const TITLE_SUB: SketchTextStyle = {
  font: 'hand',
  size: 26,
  outline: palette.paper,
  color: palette.inkSoft
}

/** The side-on walking view: street, spill zones, you and the pot, flying beans and captions. */
export class WalkScene {
  readonly camera: Camera
  /** This stretch's cached background tiles, or null before the first frame. Dev reads its size. */
  tiles: TileStrip | null = null
  private tileDef: StretchDef | null = null
  /** How far below the design the tiles reach, in u, for the cell size they were built at. */
  private tileBelow = 0
  private cut = -1
  /** The way you last walked, so the tile strip paints ahead in that direction. */
  private dir = 1
  private readonly player: PlayerView = {
    x: 0,
    ground: GROUND_Y,
    stepPhase: 0,
    speed: 0,
    squash: 1,
    danger: 0,
    gasp: false,
    timeMs: 0
  }
  private readonly pot: SidePotView = {
    x: 0,
    y: 0,
    angle: 0,
    phi: 0,
    margin: 10,
    danger: 0,
    lid: false,
    tall: false,
    water: 0,
    rattle: 0,
    timeMs: 0
  }
  private readonly shoulder = { x: 0, y: 0 }
  /** True while the door cat's paw is out for a swat this frame. */
  private swatting = false
  private readonly catView: SideCatView = {
    x: 0,
    y: 0,
    facing: -1,
    mood: 'watch',
    reach: 0,
    reachX: 0,
    reachY: 0,
    timeMs: 0
  }
  private readonly neighbourView: NeighbourView = {
    look: 'gown',
    x: 0,
    ground: 0,
    facing: -1,
    stepPhase: 0,
    moving: false,
    peek: 0,
    reaching: false,
    handX: 0,
    handY: 0,
    emerge: 1,
    elbow: false,
    timeMs: 0
  }
  private readonly rim = { x: 0, y: 0 }
  private readonly ball = { x: 0, y: 0 }

  constructor(
    private readonly viewport: Viewport,
    private readonly stamps: BeanStamps
  ) {
    this.camera = new Camera(viewport)
  }

  /** Scratch for the ground range in view. */
  private readonly span: [number, number] = [0, 0]

  /**
   * The tile strip for this stretch, rebuilt when the stretch changes or the cell shows a
   * different amount below the design.
   */
  private tilesFor(def: StretchDef): TileStrip {
    const view = this.viewport.view
    // Tall phone cells show this much below the design, so tiles reach down over it and
    // their hatching never stops short of the bottom edge.
    const below = Math.ceil(Math.max(0, view.y + view.height - 800))
    if (this.tiles && this.tileDef === def && this.tileBelow === below)
      return this.tiles
    this.tiles?.dispose()
    this.tileDef = def
    this.tileBelow = below
    // Each tile keeps only the height its own stretch of ground needs. The margins cover
    // scenery that overhangs its edges, such as the hill's clouds 534 u above the ground.
    const span: [number, number] = [0, 0]
    this.tiles = new TileStrip(
      this.viewport,
      (ctx, _index, left) => paintTile(ctx, def, left, left + TILE_WIDTH),
      left => {
        dropSpan(def, left - 200, left + TILE_WIDTH + 200, span)
        return {
          top: TILE_TOP + span[0] - 60,
          bottom: 800 + span[1] + below
        }
      }
    )
    return this.tiles
  }

  render(
    ctx: CanvasRenderingContext2D,
    game: Game,
    timeMs: number,
    dtS: number
  ): void {
    const camera = this.camera
    const view = this.viewport.view
    const def = currentStretch(game)
    const walker = game.walker
    const snap = this.cut !== game.fx.cut
    this.cut = game.fx.cut
    camera.follow(
      walker.x - PLAYER_SCREEN_X,
      dtS,
      snap ? Infinity : 6,
      groundDrop(def, walker.x)
    )
    camera.shake(game.fx.shake)
    camera.apply(ctx)
    if (walker.v !== 0) this.dir = Math.sign(walker.v)

    const left = camera.x + view.x
    const right = left + view.width
    const top = camera.y + view.y
    const backdrop = BACKDROPS[def.id]
    ctx.fillStyle = backdrop.sky
    ctx.fillRect(left - 20, top - 20, view.width + 40, view.height + 40)
    // Tall phone cells show more than the design below; the ground carries on down there.
    // It starts under the highest ground in view, since each tile stops below its own.
    const bottom = 800 + dropSpan(def, left, right, this.span)[0] - 4
    ctx.fillStyle = backdrop.below
    ctx.fillRect(
      left - 20,
      bottom,
      view.width + 40,
      top + view.height - bottom + 20
    )
    this.tilesFor(def).draw(ctx, left, right, this.dir)
    if (def.deck) this.drawBridgeBack(ctx, game, left, right, timeMs)

    for (const n of game.street.neighbours)
      if (isOut(n) && n.door > left - 100 && n.door < right + 100)
        paintOpenDoor(ctx, def, n.door)
    for (const zone of game.zones.list)
      if (zone.stretch === game.stretch)
        this.drawZone(ctx, def, zone, left, right)
    camera.apply(ctx)
    const gate = gateX(game)
    if (def.gate && gate > left - 150 && gate < right + 300)
      drawGate(
        ctx,
        gate,
        groundY(def, gate),
        gateOpen(game),
        game.gate.wobbleMs,
        game.gate.arrowMs,
        timeMs,
        def.id === 'kitchen' ? 'door' : 'gate'
      )

    if (def.id === 'kitchen') this.drawKitchenCat(ctx, game, def, timeMs)
    if (def.id === 'door') this.drawGrandmaDoor(ctx, game, def, timeMs)
    for (const n of game.street.neighbours)
      if (isOut(n) && n.x > left - 100 && n.x < right + 100)
        this.drawNeighbour(ctx, game, def, n, timeMs)
    this.drawMarket(ctx, game.market, def, left, right, timeMs)
    this.drawParkBehind(ctx, game.park, def, left, right, timeMs)
    if (game.ambush)
      this.drawAmbush(ctx, game, game.ambush, def, left, right, timeMs)
    this.drawCarrier(ctx, game, def, timeMs)
    this.drawParkFront(ctx, game.park, def, left, right, timeMs)
    if (def.id === 'door') this.drawDogJump(ctx, game, def, timeMs)
    // The near handrail swings opposite the far one, so you can see the deck roll.
    if (def.deck)
      drawRail(
        ctx,
        left - 40,
        right + 40,
        GROUND_Y - 14,
        -game.weather.roll * ROLL_LIFT,
        2
      )
    if (game.lid.off) this.drawLidOff(ctx, game, def, timeMs)
    for (const c of game.street.cyclists)
      if (
        (c.phase === 'bell' || c.phase === 'past') &&
        c.x > left - 200 &&
        c.x < right + 200
      )
        drawCyclist(ctx, c.x, groundY(def, c.x) + 8, c.phase === 'bell', timeMs)
    // A swatting paw reaches in front of the pot, so you see what hit it.
    if (def.id === 'kitchen' && this.swatting) {
      drawCatPaw(ctx, this.catView)
      if (this.catView.reach >= 1)
        drawSwatText(
          ctx,
          this.catView.reachX + 30,
          this.catView.reachY - 70,
          timeMs
        )
    }
    const flock = game.flock
    if (flock.view === 'grounded') {
      for (const pigeon of flock.pigeons)
        drawSidePigeon(ctx, pigeon, timeMs, def.bird)
      drawFeathers(ctx, flock.feathers)
    }
    this.drawRipples(ctx, game)
    this.drawParticles(ctx, game)
    camera.apply(ctx)
    this.drawWeather(ctx, game, left, right, top, timeMs)
    const ground = groundY(def, walker.x)
    if (game.fx.kick.ms > 0 && walker.carrying)
      this.drawKickArrow(ctx, game.fx.kick, walker.x, ground)
    else if (walker.carrying) {
      const side = warningSide(game)
      if (side !== 0)
        this.drawWarning(ctx, side, walker.x + POT_OFFSET_X, ground, timeMs)
    }
    this.drawStreetTalk(ctx, game, def, left, right, ground, timeMs)
    drawCaptions(
      ctx,
      game.fx.captions,
      camera.x,
      camera.x + this.viewport.width,
      top + CAPTION_TOP
    )
    this.drawTitle(ctx, game)
  }

  /** Converts a logical design point to world coordinates, for taps on the walk view. */
  toWorld(x: number, y: number): { x: number; y: number } {
    const camera = this.camera
    return { x: x + camera.x - camera.shakeX, y: y + camera.y - camera.shakeY }
  }

  /**
   * The arrow over the pot showing which way a bump throws the beans, so you know which
   * rim to raise. Big kicks get a bigger arrow.
   */
  private drawKickArrow(
    ctx: CanvasRenderingContext2D,
    kick: KickFx,
    walkerX: number,
    ground: number
  ): void {
    const x = walkerX + POT_OFFSET_X
    const y = ground - (GROUND_Y - POT_RIM_Y) - 70
    const big = kick.strength >= BIG_KICK
    const reach = big ? 70 : 42
    ctx.globalAlpha = Math.min(1, kick.ms / 200)
    KICK_ARROW.width = big ? 6 : 4
    KICK_ARROW.head = big ? 20 : 13
    KICK_ARROW.seed = Math.round(kick.strength * 10)
    const [tail, head] = arrowEnds(x, kick.side, reach)
    sketchArrow(ctx, tail, y, head, y + 10, KICK_ARROW)
    ctx.globalAlpha = 1
  }

  /**
   * The cat in your kitchen: on the counter for the opening gag, jumping down, then in the
   * doorway, watching or grooming. Its paw reaches for the rim and for the pot.
   */
  private drawKitchenCat(
    ctx: CanvasRenderingContext2D,
    game: Game,
    def: StretchDef,
    timeMs: number
  ): void {
    const kitchen = game.kitchen
    const cat = kitchen.cat
    const view = this.catView
    const potX = game.walker.x + POT_OFFSET_X
    this.swatting = false
    view.timeMs = timeMs
    view.x = cat.x
    view.facing = potX < cat.x ? -1 : 1
    view.reach = 0
    const floor = groundY(def, cat.x) - 26
    if (cat.phase === 'counter') {
      view.y = COUNTER_TOP
      view.mood = 'watch'
      view.facing = -1
      if (kitchen.intro === 'paw') {
        const rim = counterRim(game)
        view.reach = Math.min(1, kitchen.introMs / INTRO_PAW_MS)
        view.reachX = rim.x
        view.reachY = rim.y - 6
      }
    } else if (cat.phase === 'run') {
      const t = Math.min(1, cat.ms / CAT_RUN_MS)
      const fall = Math.min(1, t * 2.5)
      view.y =
        COUNTER_TOP +
        (floor - COUNTER_TOP) * fall -
        Math.sin(fall * Math.PI) * 40
      view.mood = 'run'
      view.facing = 1
    } else {
      view.y = floor
      view.mood =
        cat.phase === 'groom'
          ? 'groom'
          : cat.phase === 'smug'
            ? 'smug'
            : 'watch'
      const swatting =
        cat.phase === 'windup' || (cat.phase === 'smug' && cat.ms < 600)
      this.swatting = swatting
      if (swatting) {
        view.reach =
          cat.phase === 'windup' ? Math.min(1, cat.ms / CAT_WINDUP_MS) : 1
        view.reachX = potX - view.facing * 30
        view.reachY = groundY(def, game.walker.x) - (GROUND_Y - POT_RIM_Y) + 40
      }
    }
    // The swatting paw draws after the pot instead, in front of it.
    const reach = view.reach
    if (this.swatting) view.reach = 0
    drawSideCat(ctx, view)
    view.reach = reach
  }

  /**
   * While a character's hit is coming, a pulsing arrow over the pot shows which way it
   * would throw the beans, so you know which rim to raise.
   */
  private drawWarning(
    ctx: CanvasRenderingContext2D,
    side: number,
    potX: number,
    ground: number,
    timeMs: number
  ): void {
    const y = ground - (GROUND_Y - POT_RIM_Y) - 70
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(timeMs / 110)
    WARN_ARROW.seed = 7
    const [tail, head] = arrowEnds(potX, side, 56)
    sketchArrow(ctx, tail, y, head, y + 8, WARN_ARROW)
    ctx.globalAlpha = 1
  }

  /** A neighbour on the pavement: stepping out, walking over, peeking, or going home. */
  private drawNeighbour(
    ctx: CanvasRenderingContext2D,
    game: Game,
    def: StretchDef,
    n: Neighbour,
    timeMs: number
  ): void {
    const view = this.neighbourView
    const walkLine = groundY(def, n.x) - 10
    const emerge = n.phase === 'out' ? Math.min(1, n.ms / NEIGHBOUR_STEP_MS) : 1
    const homeward = n.phase === 'leave' && n.ms > 600 && n.x < n.door
    view.look = n.look
    view.x = n.x
    view.ground = doorstepY(def, n.door) * (1 - emerge) + walkLine * emerge
    view.emerge = emerge
    view.facing = homeward ? 1 : -1
    view.moving = n.phase === 'walk' || homeward
    view.stepPhase = n.x / 40
    view.peek =
      n.phase === 'peek'
        ? Math.min(1, n.ms / 400)
        : n.phase === 'leave' && !n.elbowed
          ? Math.max(0, 1 - n.ms / 500)
          : 0
    view.elbow = n.elbowed && n.phase === 'leave' && n.ms < 500
    view.timeMs = timeMs
    const walker = game.walker
    view.reaching = n.phase === 'peek' && walker.carrying
    if (view.reaching) {
      const pot = game.pot
      rimPoint(
        walker.x,
        effectiveAngle(pot),
        1,
        groundDrop(def, walker.x),
        this.rim
      )
      view.handX = this.rim.x + 4
      view.handY = this.rim.y + 6
    }
    drawNeighbour(ctx, view)
  }

  /**
   * This stretch's ambush, behind you: Mrs Pryce's twitching curtain, then her rushing out
   * of her door; the sale's sign, then its stampede; Bruno asleep by his bench on a long
   * lead, then charging.
   */
  private drawAmbush(
    ctx: CanvasRenderingContext2D,
    game: Game,
    a: AmbushState,
    def: StretchDef,
    left: number,
    right: number,
    timeMs: number
  ): void {
    if (Math.max(a.at, a.x) < left - 300 || Math.min(a.at, a.x) > right + 300)
      return
    const pot = game.walker.x + POT_OFFSET_X
    const out = a.phase === 'warn' || a.phase === 'lunge' || a.phase === 'back'
    const running = a.phase === 'lunge' || (a.phase === 'back' && a.x !== a.at)
    // They face the pot until they turn for home.
    const facing =
      a.phase === 'back' && a.ms > 1_800
        ? Math.sign(a.at - a.x) || -1
        : Math.sign(pot - a.x) || -1
    if (a.kind === 'pryce') {
      if (a.phase === 'tell')
        drawCurtainTwitch(ctx, houseWindow(def, a.at), timeMs)
      if (!out) return
      paintOpenDoor(ctx, def, a.at)
      const view = this.neighbourView
      const emerge = a.phase === 'warn' ? Math.min(1, a.ms / 400) : 1
      view.look = 'pryce'
      view.x = a.x
      view.ground =
        doorstepY(def, a.at) * (1 - emerge) + (groundY(def, a.x) - 10) * emerge
      view.emerge = emerge
      view.facing = facing
      view.moving = running
      view.stepPhase = a.x / 30
      view.peek = a.phase === 'back' && a.hit && a.ms < 1_200 ? 1 : 0
      view.elbow = false
      view.timeMs = timeMs
      view.reaching = view.peek > 0 && game.walker.carrying
      if (view.reaching) {
        rimPoint(
          game.walker.x,
          effectiveAngle(game.pot),
          -facing,
          groundDrop(def, game.walker.x),
          this.rim
        )
        view.handX = this.rim.x
        view.handY = this.rim.y + 6
      }
      drawNeighbour(ctx, view)
      return
    }
    const ground = groundY(def, a.at)
    if (a.kind === 'sale') {
      if (a.phase !== 'idle' && a.phase !== 'done')
        drawSaleSign(
          ctx,
          a.at - 110,
          ground - 36 - 250,
          a.phase === 'warn',
          timeMs
        )
      if (!out) return
      // Three bargain hunters: crowding behind the stall, then rushing the path.
      const emerge = a.phase === 'warn' ? Math.min(1, a.ms / 600) : 1
      for (let i = 0; i < 3; i++) {
        const x = a.x + i * 46
        const feet =
          (ground - 70) * (1 - emerge) + (groundY(def, x) - 10) * emerge
        ctx.save()
        ctx.globalAlpha *= 0.5 + 0.5 * emerge
        ctx.translate(x, 0)
        ctx.scale(facing < 0 ? 1 : -1, 1)
        drawShopper(
          ctx,
          0,
          feet,
          7_000 + i,
          running ? a.x / 30 + i : 0,
          a.hit && a.phase === 'back' && a.ms < 600,
          timeMs
        )
        ctx.restore()
      }
      return
    }
    // Bruno, tied to his bench by a long red lead.
    const base = ground - 36 + 6
    paintBench(ctx, a.at, base)
    const lying = !out
    const dogX = lying ? a.at + 40 : a.x
    const feet = lying ? groundY(def, dogX) - 26 : groundY(def, dogX) + 4
    const pose = lying
      ? 'lying'
      : a.phase === 'warn'
        ? 'sit'
        : a.phase === 'back' && a.hit && a.ms < 700
          ? 'jump'
          : 'run'
    drawSideDog(
      ctx,
      dogX,
      feet,
      lying ? -1 : facing,
      pose,
      a.phase === 'warn' || a.phase === 'lunge',
      timeMs,
      BRUNO
    )
    const collarX = dogX + (lying ? -1 : facing) * 40 * BRUNO.scale
    drawLead(ctx, a.at - 50, base - 10, collarX, feet - 50, timeMs)
    if (a.phase === 'tell') drawSnore(ctx, dogX - 20, feet - 70, timeMs)
  }

  /** The market's stallholders with their spoons, the ladder man, and a shopper, behind you. */
  private drawMarket(
    ctx: CanvasRenderingContext2D,
    market: MarketState,
    def: StretchDef,
    left: number,
    right: number,
    timeMs: number
  ): void {
    for (const stall of market.stalls) {
      if (stall.x < left - 150 || stall.x > right + 150) continue
      const ground = groundY(def, stall.x)
      const phase = (market.ms + stall.offset) % SPOON_CYCLE_MS
      const out =
        phase < SPOON_OUT_MS
          ? Math.min(1, phase / 150, (SPOON_OUT_MS - phase) / 150)
          : 0
      // The spoon shakes in the stallholder's hand just before it pokes.
      const shake = phase > SPOON_CYCLE_MS - 300 ? 1 : 0
      drawStallholder(
        ctx,
        stall.x,
        ground - 36 - 110,
        ground - (GROUND_Y - POT_RIM_Y),
        out,
        shake,
        timeMs
      )
    }
    const ladder = market.ladder
    if (ladder && ladder.x > left - 250 && ladder.x < right + 250) {
      const phase = ladderPhase(market.ms)
      const turn = 400
      const half =
        phase < LADDER_SWING_MS
          ? 130
          : phase < LADDER_SWING_MS + turn
            ? 130 - (110 * (phase - LADDER_SWING_MS)) / turn
            : phase > LADDER_CYCLE_MS - turn
              ? 20 + (110 * (phase - (LADDER_CYCLE_MS - turn))) / turn
              : 20
      const facing = Math.floor(market.ms / LADDER_CYCLE_MS) % 2 ? 1 : -1
      drawLadderMan(
        ctx,
        ladder.x,
        groundY(def, ladder.x) - 12,
        half,
        facing,
        timeMs
      )
    }
    const shopper = market.shopper
    if (shopper && shopper.x > left - 100 && shopper.x < right + 100)
      drawShopper(
        ctx,
        shopper.x,
        groundY(def, shopper.x) - 10,
        shopper.seed,
        shopper.x / 40,
        shopper.bumped && shopper.ms < 600,
        timeMs
      )
  }

  /** The park kid, the football's dashed path, and dogs lying in the grass, behind you. */
  private drawParkBehind(
    ctx: CanvasRenderingContext2D,
    park: ParkState,
    def: StretchDef,
    left: number,
    right: number,
    timeMs: number
  ): void {
    for (const kick of park.kicks) {
      if (Math.max(kick.kid, kick.cross) < left - 200) continue
      if (Math.min(kick.kid, kick.cross) > right + 200) continue
      const facing = Math.sign(kick.cross - kick.kid) || -1
      const feet = groundY(def, kick.kid) - 30
      const windup =
        kick.phase === 'windup' ? Math.min(1, kick.ms / KID_WINDUP_MS) : 0
      drawKid(
        ctx,
        kick.kid,
        feet,
        facing,
        windup,
        kick.phase === 'flight',
        timeMs
      )
      if (kick.phase === 'windup' || kick.phase === 'flight') {
        const rim = groundY(def, kick.cross) - (GROUND_Y - POT_RIM_Y)
        drawBallPath(
          ctx,
          kick.kid + facing * 26,
          feet - 8,
          kick.cross,
          rim,
          groundY(def, kick.cross),
          BALL_REACH,
          kick.phase === 'flight' ? 1 : Math.min(1, kick.ms / 300)
        )
        if (kick.phase === 'windup')
          drawBubble(
            ctx,
            'Heads up!',
            kick.kid,
            feet - 180,
            kick.kid,
            feet - 128,
            563
          )
      }
    }
    for (const dog of park.dogs)
      if (
        dog.phase === 'lying' &&
        dog.home > left - 100 &&
        dog.home < right + 100
      )
        drawSideDog(
          ctx,
          dog.home,
          groundY(def, dog.home) - 26,
          -1,
          'lying',
          false,
          timeMs
        )
  }

  /** The football in the air, and dogs running at you, jumping up or sitting by you. */
  private drawParkFront(
    ctx: CanvasRenderingContext2D,
    park: ParkState,
    def: StretchDef,
    left: number,
    right: number,
    timeMs: number
  ): void {
    for (const kick of park.kicks) {
      if (kick.phase === 'idle' || kick.ms > 900) continue
      if (Math.min(kick.kid, kick.cross) > right + 200) continue
      if (Math.max(kick.kid, kick.cross) < left - 200) continue
      const facing = Math.sign(kick.cross - kick.kid) || -1
      const feet = groundY(def, kick.kid) - 30
      const x0 = kick.kid + facing * 26
      const y0 = feet - 8
      const rim = groundY(def, kick.cross) - (GROUND_Y - POT_RIM_Y)
      const spin = timeMs / 60
      if (kick.phase === 'windup') drawBall(ctx, x0, y0, 0)
      else if (kick.phase === 'flight') {
        arcPoint(x0, y0, kick.cross, rim, ballProgress(kick), this.ball)
        drawBall(ctx, this.ball.x, this.ball.y, spin)
      } else if (kick.hit) {
        // It bounces off the pot, back the way it came.
        const t = kick.ms / 900
        drawBall(
          ctx,
          kick.cross - facing * t * 120,
          rim - Math.sin(t * Math.PI) * 90,
          -spin
        )
      } else {
        arcPoint(
          x0,
          y0,
          kick.cross,
          rim,
          1 + kick.ms / BALL_FLIGHT_MS,
          this.ball
        )
        drawBall(ctx, this.ball.x, this.ball.y, spin)
      }
    }
    for (const dog of park.dogs) {
      if (dog.phase === 'lying' || dog.phase === 'gone') continue
      if (dog.x < left - 150 || dog.x > right + 150) continue
      const leaving = dog.phase === 'leave'
      drawSideDog(
        ctx,
        dog.x,
        groundY(def, dog.x) + 4,
        leaving ? -1 : 1,
        dog.phase === 'bark' || leaving
          ? 'run'
          : dog.phase === 'jump'
            ? 'jump'
            : 'sit',
        dog.phase === 'bark' || (dog.phase === 'jump' && dog.ms < 500),
        timeMs
      )
    }
  }

  /**
   * The Pot Lid knocked off by a big hit: spinning through the air, then lying on the
   * path with a bobbing arrow until you walk the pot over it.
   */
  private drawLidOff(
    ctx: CanvasRenderingContext2D,
    game: Game,
    def: StretchDef,
    timeMs: number
  ): void {
    const lid = game.lid
    const ground = groundY(def, lid.x) - 4
    const t = lid.flightMs / LID_FLIGHT_MS
    if (t < 1) {
      const x = lid.fromX + (lid.x - lid.fromX) * t
      const y =
        lid.fromY + (ground - lid.fromY) * t - Math.sin(t * Math.PI) * 140
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(t * 9)
      LID_OFF.seed = 90
      sketchEllipse(ctx, 0, 0, 30, 10, LID_OFF)
      ctx.restore()
      return
    }
    LID_OFF.seed = 91
    sketchEllipse(ctx, lid.x, ground, 32, 9, LID_OFF)
    LID_KNOB.seed = 92
    sketchCircle(ctx, lid.x, ground - 7, 5, LID_KNOB)
    const bob = Math.sin(timeMs / 160) * 6
    WARN_ARROW.seed = 93
    sketchArrow(
      ctx,
      lid.x,
      ground - 90 + bob,
      lid.x,
      ground - 30 + bob,
      WARN_ARROW
    )
  }

  /**
   * Grandma in her doorway past the top step, the WELCOME mat (lumpy once a bean hides
   * under it) and her dog sitting at her feet, or barking at you.
   */
  private drawGrandmaDoor(
    ctx: CanvasRenderingContext2D,
    game: Game,
    def: StretchDef,
    timeMs: number
  ): void {
    const door = game.door
    const step = groundY(def, def.length) - 36
    drawGrandma(
      ctx,
      GRANDMA_X,
      step + 2,
      0.78,
      door.dog === 'tipped' ? 'shrug' : 'wait',
      door.says !== '',
      timeMs
    )
    const flying = game.fx.particles.zone.includes(MAT_ZONE)
    drawSideDoormat(
      ctx,
      DOORMAT_X,
      groundY(def, DOORMAT_X),
      game.counts.hidden > 0 && !flying
    )
    if (dogLeap(game) === null)
      drawDoorDog(
        ctx,
        DOOR_DOG_X,
        groundY(def, DOOR_DOG_X) - 2,
        -1,
        0.9,
        door.dog === 'bark' ? 'bark' : 'sit',
        timeMs
      )
  }

  /** Grandma's dog leaping at the front of your pot and back, in front of you. */
  private drawDogJump(
    ctx: CanvasRenderingContext2D,
    game: Game,
    def: StretchDef,
    timeMs: number
  ): void {
    const leap = dogLeap(game)
    if (leap === null) return
    const rim = game.walker.x + POT_OFFSET_X + RIM_HALF
    const x = DOOR_DOG_X + (rim - DOOR_DOG_X) * leap
    const y = groundY(def, x) - Math.sin(leap * Math.PI * 0.5) * 80
    drawDoorDog(ctx, x, y, -1, 0.9, 'jump', timeMs)
  }

  /** Speech bubbles over neighbours, and the bell's warning at the left edge. */
  private drawStreetTalk(
    ctx: CanvasRenderingContext2D,
    game: Game,
    def: StretchDef,
    left: number,
    right: number,
    ground: number,
    timeMs: number
  ): void {
    for (const n of game.street.neighbours) {
      if (!n.says || !isOut(n)) continue
      const head = groundY(def, n.x) - 205
      const x = Math.min(right - 140, Math.max(left + 140, n.x + 40))
      drawBubble(ctx, n.says, x, head - 70, n.x - 6, head + 4, n.door)
    }
    for (const c of game.street.cyclists)
      if (c.phase === 'bell' && c.x < left + 40)
        drawBellWarning(ctx, left + 12, ground - 130, timeMs)
    const a = game.ambush
    if (a?.says) {
      const head = groundY(def, a.x) - (a.kind === 'bruno' ? 150 : 205)
      const x = Math.min(right - 140, Math.max(left + 140, a.x + 40))
      drawBubble(ctx, a.says, x, head - 70, a.x - 6, head + 4, 4_000)
    }
    const door = game.door
    if (def.id === 'door' && door.says) {
      const head = groundY(def, def.length) - 36 - 190 * 0.78
      const x = Math.min(right - 130, Math.max(left + 130, GRANDMA_X - 30))
      drawBubble(ctx, door.says, x, head - 70, GRANDMA_X - 8, head - 8, 697)
    }
    const market = game.market
    const pot = game.walker.x + POT_OFFSET_X
    const shopper = market.shopper
    if (shopper?.says) {
      const head = groundY(def, shopper.x) - 200
      const x = Math.min(right - 120, Math.max(left + 120, shopper.x + 30))
      drawBubble(ctx, shopper.says, x, head - 60, shopper.x - 8, head, 560)
    }
    for (const stall of market.stalls)
      if (spoonOut(stall, market.ms) && Math.abs(pot - stall.x) < 300) {
        const top = groundY(def, stall.x) - 36 - 110 - 90
        drawBubble(
          ctx,
          'Try the chutney!',
          stall.x + 40,
          top - 40,
          stall.x,
          top,
          561
        )
      }
    const ladder = market.ladder
    if (ladder && ladderSwinging(market.ms) && Math.abs(pot - ladder.x) < 600) {
      const head = groundY(def, ladder.x) - 230
      drawBubble(
        ctx,
        'Mind your backs!',
        ladder.x + 40,
        head - 40,
        ladder.x,
        head,
        562
      )
    }
  }

  /** The stretch name, big and centred near the top, when you arrive. */
  private drawTitle(ctx: CanvasRenderingContext2D, game: Game): void {
    const title = game.fx.title
    if (!title) return
    this.viewport.apply(ctx)
    const t = title.ageMs
    const alpha = Math.min(1, t / 200, (title.lifeMs - t) / 400)
    const drop = t < 260 ? (1 - t / 260) * -30 : 0
    TITLE.alpha = alpha
    TITLE_SUB.alpha = alpha
    sketchText(ctx, title.text, 300, 190 + drop, TITLE)
    sketchText(ctx, title.sub, 300, 240 + drop, TITLE_SUB)
  }

  private drawZone(
    ctx: CanvasRenderingContext2D,
    def: StretchDef,
    zone: Zone,
    left: number,
    right: number
  ): void {
    const reach = 300 / ZONE_SPREAD + 20
    if (zone.anchorX + reach < left || zone.anchorX - reach > right) return
    const shownLoose = Math.min(zone.shown, zone.count)
    const shownPile = Math.min(zone.pile, zone.shown - shownLoose)
    const ground = groundY(def, zone.anchorX)
    if (shownPile > 0) {
      // A whole tipped pot makes a big mound, but not one that hides Grandma's door.
      const r = Math.min(80, 14 + Math.sqrt(shownPile) * 1.6)
      PILE.seed = zone.id
      sketchEllipse(ctx, zone.anchorX, ground - r * 0.3, r, r * 0.45, PILE)
    }
    const beans = zone.beans
    for (let i = 0; i < shownLoose; i++) {
      const o = i * BEAN_FIELDS
      const x = zone.anchorX + ((beans[o] as number) - 300) / ZONE_SPREAD
      const y =
        groundY(def, x) - 6 + (((beans[o + 1] as number) - 140) / 420) * 16
      this.camera.stamp(
        beans[o + 3] === KIND_PUDDLE
          ? this.stamps.swollenWalk
          : this.stamps.walk[i % 3]!,
        ctx,
        x,
        y,
        beans[o + 2] as number
      )
    }
    this.camera.apply(ctx)
    const total = zone.count + zone.pile + zone.drain
    if (total > 0)
      sketchText(ctx, formatBeans(total), zone.anchorX, ground - 46, {
        font: 'marker',
        size: 22,
        color: palette.red,
        outline: palette.paper,
        seed: zone.id
      })
  }

  private drawCarrier(
    ctx: CanvasRenderingContext2D,
    game: Game,
    def: StretchDef,
    timeMs: number
  ): void {
    const { walker, pot, fx } = game
    const player = this.player
    const ground = groundY(def, walker.x)
    player.x = walker.x
    player.ground = ground
    player.stepPhase = walker.stepPhase
    player.speed = Math.abs(walker.v)
    // A "whoa" on wet grass wobbles your whole body. Reduced Motion keeps you still.
    player.squash = settings.get().reducedMotion
      ? 1
      : whoa(game)
        ? fx.squash * (1 + Math.sin(timeMs / 28) * 0.05)
        : fx.squash
    player.danger = walker.carrying ? pot.danger : 0
    player.gasp = fx.gaspMs > 0
    player.timeMs = timeMs

    const view = this.pot
    const carried = walker.carrying
    let angle = effectiveAngle(pot)
    if (pot.teeterMs > 0)
      angle =
        pot.teeterSide * (tipAngle(game.options) + Math.sin(timeMs / 30) * 0.04)
    view.x = walker.x + POT_OFFSET_X + (carried ? 0 : GROUND_POT_SHIFT)
    const onCounter =
      !carried && def.id === 'kitchen' && game.kitchen.potOnCounter
    const depth = potDepth(game.options.tall)
    view.y = carried
      ? ground - (GROUND_Y - POT_RIM_Y)
      : onCounter
        ? COUNTER_TOP - depth
        : groundY(def, view.x) - depth - 2
    view.angle = carried ? angle : 0
    view.phi = carried ? pot.phi : 0
    view.margin = marginFor(game.counts.pot, pot.water, game.options)
    view.danger = carried ? pot.danger : 0
    view.lid = game.options.lid
    view.tall = game.options.tall
    view.water = game.pot.water
    view.rattle = game.lid.rattleMs
    view.empty = game.counts.pot === 0
    const pouring = !carried && game.weather.pouring
    if (pouring) this.tipForPour(view, depth, game.weather.pour.level)
    view.timeMs = timeMs
    player.shoes = shoeLook(game)

    this.drawBackBox(ctx, game, walker.x, ground)
    if (game.drying.length > 0)
      this.drawBackRack(ctx, walker.x, ground, game.drying.length)
    const shoulder = shoulderOf(player, this.shoulder)
    const cos = Math.cos(view.angle)
    const sin = Math.sin(view.angle)
    const handX = (lx: number, ly: number) => view.x + cos * lx - sin * ly
    const handY = (lx: number, ly: number) => view.y + sin * lx + cos * ly
    const reach = RIM_HALF + 10
    if (carried)
      drawArm(
        ctx,
        shoulder.x + 6,
        shoulder.y,
        handX(reach, 14),
        handY(reach, 14),
        timeMs
      )
    drawPlayer(ctx, player)
    drawSidePot(ctx, this.camera, this.stamps, view)
    if (carried)
      drawArm(
        ctx,
        shoulder.x,
        shoulder.y + 4,
        handX(-reach, 14),
        handY(-reach, 14),
        timeMs
      )
    else
      drawArm(
        ctx,
        shoulder.x,
        shoulder.y + 4,
        shoulder.x + 26,
        shoulder.y + 70 + (boilSeed(timeMs) % 2),
        timeMs
      )
    // The net goes over your dangling arm, so its knots stay in view.
    if (!carried && game.flock.view === 'grounded' && game.net.phase !== 'off')
      drawSideNet(ctx, game, view.x, view.y, depth, timeMs)
    if (pouring) this.drawPour(ctx, game, def, view, timeMs)
  }

  /**
   * Pour Off tips the pot forward over its front bottom corner, further the longer you
   * hold. Moves the rim, which is the pot's pivot when drawn, to match.
   */
  private tipForPour(view: SidePotView, depth: number, level: number): void {
    const a = level * 1.25
    const cornerX = view.x + RIM_HALF - 2
    const cornerY = view.y + depth
    view.x = cornerX - (RIM_HALF - 2) * Math.cos(a) + depth * Math.sin(a)
    view.y = cornerY - (RIM_HALF - 2) * Math.sin(a) - depth * Math.cos(a)
    view.angle = a
    // The beans stay level in the world while the pot tips.
    view.phi = -Math.min(a, 0.5)
  }

  /** The stream from the tipped pot's front rim, and the meter that says when to let go. */
  private drawPour(
    ctx: CanvasRenderingContext2D,
    game: Game,
    def: StretchDef,
    view: SidePotView,
    timeMs: number
  ): void {
    const level = game.weather.pour.level
    const lipX = view.x + Math.cos(view.angle) * (RIM_HALF + 4)
    const lipY = view.y + Math.sin(view.angle) * (RIM_HALF + 4)
    drawPourStream(
      ctx,
      lipX,
      lipY,
      groundY(def, lipX) + 4,
      level,
      timeMs,
      (x, y, angle) => this.camera.stamp(this.stamps.walk[0]!, ctx, x, y, angle)
    )
    this.camera.apply(ctx)
    const potX = game.walker.x + POT_OFFSET_X + GROUND_POT_SHIFT
    drawPourMeter(
      ctx,
      potX,
      groundY(def, potX) - potDepth(game.options.tall) - 150,
      level
    )
  }

  /** Behind you on the bridge: a duck paddling in the river and the far handrail rolling with the deck. */
  private drawBridgeBack(
    ctx: CanvasRenderingContext2D,
    game: Game,
    left: number,
    right: number,
    timeMs: number
  ): void {
    const length = currentStretch(game).length
    const duckX = (((timeMs / 1000) * 22) % (length + 400)) - 200
    if (duckX > left - 60 && duckX < right + 60)
      drawDuck(ctx, duckX, GROUND_Y + 96, 1, 1.2, timeMs, null)
    drawRail(
      ctx,
      left - 40,
      right + 40,
      GROUND_Y - 130,
      game.weather.roll * ROLL_LIFT,
      1
    )
  }

  /**
   * Rain over the whole view while it falls on the pot you carry, and leaves streaming
   * across ahead of and during a gust.
   */
  private drawWeather(
    ctx: CanvasRenderingContext2D,
    game: Game,
    left: number,
    right: number,
    top: number,
    timeMs: number
  ): void {
    const weather = game.weather
    const gust = weather.gust
    const ground = groundY(currentStretch(game), game.walker.x)
    if (gust.phase !== 'idle') drawLeaves(ctx, gust, left, right, top, ground)
    if (weather.raining && game.scene === 'walk' && game.walker.carrying)
      drawRain(
        ctx,
        left - 40,
        top - 40,
        right - left + 80,
        this.viewport.view.height + 80,
        gust.phase === 'blow' ? gust.side : 0,
        timeMs
      )
  }

  /**
   * The window box strapped to your back: sprouts while a batch grows, pods once it has,
   * and the jar of picked beans hanging under it until you set the pot down.
   */
  private drawBackBox(
    ctx: CanvasRenderingContext2D,
    game: Game,
    x: number,
    ground: number
  ): void {
    const left = x - 64
    const top = ground - 102
    const slots = game.box.slots
    for (let i = 0; i < slots.length && i < 4; i++) {
      const state = slots[i]!.state
      const sx = left + 7 + i * 9
      if (state === 'watered' || state === 'planted') {
        SPROUT.seed = 75 + i
        sketchLine(
          ctx,
          sx,
          top,
          sx,
          top - (state === 'watered' ? 12 : 5),
          SPROUT
        )
      } else if (state === 'grown') {
        BACK_POD.seed = 76 + i
        sketchEllipse(ctx, sx, top - 9, 4, 9, BACK_POD)
      }
    }
    BACK_BOX.seed = 74
    sketchRect(ctx, left, top, 40, 16, BACK_BOX)
    const jar = game.counts.regrown
    if (jar > 0) {
      JAR.seed = 78
      sketchRect(ctx, left + 4, top + 22, 22, 28, JAR)
      for (let i = 0; i < Math.min(4, Math.ceil(jar / 6)); i++)
        this.camera.stamp(
          this.stamps.walk[i % 3]!,
          ctx,
          left + 15 + ((i % 2) - 0.5) * 8,
          top + 44 - Math.floor(i / 2) * 8,
          0.4 * i
        )
      this.camera.apply(ctx)
    }
  }

  /** The drying rack strapped to your back, with the swollen beans drying on it. */
  private drawBackRack(
    ctx: CanvasRenderingContext2D,
    x: number,
    ground: number,
    n: number
  ): void {
    const left = x - 50
    const top = ground - 176
    BACK_RACK.seed = 70
    sketchRect(ctx, left, top, 26, 74, BACK_RACK)
    for (let i = 0; i < Math.min(n, 4); i++)
      this.camera.stamp(
        this.stamps.swollenWalk,
        ctx,
        left + 13,
        top + 12 + i * 17,
        0.3 * (i % 2 ? 1 : -1)
      )
    this.camera.apply(ctx)
  }

  /** Rings spreading where beans dropped into the river, a puddle or a drain. */
  private drawRipples(ctx: CanvasRenderingContext2D, game: Game): void {
    const ripples = game.fx.ripples
    for (let i = 0; i < ripples.ms.length; i++) {
      const t = (ripples.ms[i] as number) / RIPPLE_MS
      if (t >= 1) continue
      const x = ripples.x[i] as number
      const y = ripples.y[i] as number
      const style = ripples.kind[i] === LAND_DRAIN ? RIPPLE_DRAIN : RIPPLE_WATER
      style.alpha = 1 - t
      style.seed = 970 + i
      sketchEllipse(ctx, x, y, 6 + 26 * t, 2 + 7 * t, style)
      if (t < 0.6) sketchEllipse(ctx, x, y, 3 + 12 * t, 1 + 3 * t, style)
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, game: Game): void {
    const particles = game.fx.particles
    if (particles.alive === 0) return
    for (let i = 0; i < particles.zone.length; i++) {
      if (particles.zone[i] === 0) continue
      this.camera.stamp(
        this.stamps.walk[i % 3]!,
        ctx,
        particles.x[i] as number,
        particles.y[i] as number,
        particles.angle[i] as number
      )
    }
  }

  dispose(): void {
    this.tiles?.dispose()
    this.tiles = null
  }
}

/** True while a neighbour is outside their front door. */
function isOut(n: Neighbour): boolean {
  return n.phase !== 'home' && n.phase !== 'gone'
}

/** How long the doorstep dog's leap back to Grandma takes, in ms. */
const LEAP_BACK_MS = 600

/**
 * How far Grandma's dog is through its leap at the pot: 0 at Grandma's feet, 1 at your
 * front rim, or null while it sits. It leaps in the last 300 ms of its bark and lands
 * as the jump resolves, then trots back.
 */
function dogLeap(game: Game): number | null {
  const door = game.door
  if (door.dog === 'bark') {
    const t = door.dogMs - (DOOR_DOG_WARN_MS - 300)
    return t > 0 ? Math.min(1, t / 300) : null
  }
  if (
    (door.dog === 'made' || door.dog === 'tipped') &&
    door.dogMs < LEAP_BACK_MS
  )
    return 1 - door.dogMs / LEAP_BACK_MS
  return null
}

/** How far the bridge's handrails rise and fall per radian of deck roll, in u. */
const ROLL_LIFT = 150

/**
 * Which way a coming character's hit would throw the beans, for the warning arrow over
 * the pot: 1 forward, -1 back, 0 when nothing is coming.
 */
function warningSide(game: Game): number {
  const door = doorWarningSide(game)
  if (door !== 0) return door
  const ambush = ambushWarningSide(game)
  if (ambush !== 0) return ambush
  const park = parkWarningSide(game)
  if (park !== 0) return park
  const gust = gustSide(game)
  if (gust !== 0) return gust
  if (peeking(game)) return 1
  for (const c of game.street.cyclists) if (c.phase === 'bell') return 1
  for (const n of game.street.neighbours)
    if (n.phase === 'out' || n.phase === 'walk') return -1
  const market = game.market
  const pot = game.walker.x + POT_OFFSET_X
  if (market.shopper?.phase === 'coming') return -1
  const ladder = market.ladder
  if (
    ladder &&
    pot > ladder.x - LADDER_NOTICE &&
    pot < ladder.x + LADDER_REACH &&
    ladderPhase(market.ms) < LADDER_SWING_MS + 200
  )
    return -1
  for (const stall of market.stalls)
    if (
      pot > stall.x - 260 &&
      pot < stall.x + SPOON_REACH &&
      (stall.offset + market.ms) % SPOON_CYCLE_MS < SPOON_OUT_MS + 100
    )
      return 1
  if (currentStretch(game).id !== 'kitchen') return 0
  const cat = game.kitchen.cat
  const potX = game.walker.x + POT_OFFSET_X
  if (!catWatching(cat)) return 0
  if (potX < cat.x - CAT_REACH - 220 || potX > cat.x + CAT_REACH) return 0
  return 1
}

const ends: [number, number] = [0, 0]

/**
 * Tail and head x of an arrow over the pot at `x` pointing toward `side`. Both ways span
 * the same stretch right of your face, from x - 20 to x + reach.
 */
function arrowEnds(x: number, side: number, reach: number): [number, number] {
  ends[0] = side > 0 ? x - 20 : x + reach
  ends[1] = side > 0 ? x + reach : x - 20
  return ends
}
