import {
  createChoreBoard,
  createShop,
  createWallet,
  JoltMeter,
  type ChoreBoard,
  type RealTimer,
  type SfxName,
  type Shop,
  type Wallet
} from '../shared'
import { createAmbush, type AmbushState } from './ambush'
import { Particles, Ripples, type Caption } from './fx'
import { createDoor, type DoorState } from './door'
import type { DrainState } from './drainFlow'
import { SHOP_UPGRADES, type BeanUpgrade } from './economy'
import { createGossip, type GossipState } from './gossip'
import { createKitchen, type KitchenState } from './kitchen'
import { LineBook, type Scores } from './lines'
import type { KioskState } from './kiosk'
import { createCounts, type Counts } from './ledger'
import { createMarket, type MarketState } from './market'
import { createNet, type NetState } from './net'
import { createPackets, type PacketSet } from './packets'
import { createPark, type ParkState } from './park'
import { createReplays, type ReplayRequest, type ReplayState } from './replays'
import type { StretchLog } from './runLog'
import type { PickupWorld } from './pickupWorld'
import { createFlock, type Flock } from './pigeons'
import { createStreams, type Streams } from './random'
import { ROUTE, type StretchDef } from './route'
import { createStreet, type StreetState } from './street'
import {
  createPot,
  DEFAULT_POT_OPTIONS,
  type PotOptions,
  type PotState,
  type TiltInput
} from './slosh'
import { createSpillEvent, type KickRecord, type SpillEvent } from './spill'
import { STRAIN_JOLT_REF, TITLE_MS } from './tuning'
import { createLid, createMud, type LidState, type MudState } from './upgrades'
import { createWalker, type WalkerState, type WalkInput } from './walk'
import { createWeather, type WeatherState } from './weather'
import { createWindowBox, type WindowBoxState } from './windowBox'
import { createZoneSet, type ZoneSet } from './zones'

export type SceneId =
  | 'walk'
  | 'grounded'
  | 'pickup'
  | 'drain'
  | 'kiosk'
  | 'box'
  /** Grandma's doorstep: the count, the doormat, the taste and the secret. */
  | 'count'

/** Side effects the simulation asks the runtime to play. Drained once per frame. */
export type GameEvent =
  | { type: 'sound'; name: SfxName; volume?: number; pitch?: number }
  | { type: 'vibrate'; ms: number }
  | { type: 'scene' }
  | { type: 'potLifted' }
  | { type: 'potted'; n: number }
  /** Cut the latest seconds of the walk view into a replay clip now. */
  | { type: 'replay'; replay: ReplayRequest }

/** The pointer as the simulation sees it, in logical units. */
export interface PointerInput {
  x: number
  y: number
  vx: number
  vy: number
  /** True while the primary pointer is pressed. */
  down: boolean
}

/** Everything the simulation reads from the player in one step. */
export interface GameInput {
  walk: WalkInput
  tilt: TiltInput
  pointer: PointerInput
}

/** What you are holding in Pickup. */
export interface CarryState {
  /** 'tweezers' for one bean or a clump, 'hands' for a scoop. */
  mode: 'tweezers' | 'hands'
  /** Beans held, including pile beans in cupped hands. */
  count: number
  strain: number
  /** Remaining wiggle of a slippery bean, in ms. */
  slipperyMs: number
  /** Delay before a slippery bean starts wiggling, in ms. */
  slipperyIn: number
  /** Time since the last creak, so the tremble sound doesn't spam. */
  creakMs: number
  /** Time since the last dribble from fast hands, in ms. */
  dribbleMs: number
}

/** A press that turns into cupped hands if it stays still long enough. */
export interface CupState {
  armed: boolean
  ms: number
  x: number
  y: number
  source: 'pile' | 'cluster'
}

export interface PickupState {
  world: PickupWorld | null
  carry: CarryState
  cup: CupState
  jolt: JoltMeter
  streak: number
  /** Tutorial captions already shown this run. */
  taught: { tweezers: boolean; hands: boolean }
}

/** The stretch-end gate. */
export interface GateState {
  /** Real ms left of the blocked wobble. */
  wobbleMs: number
  /** Real ms left before the gate buzzes again. */
  cooldownMs: number
  /** Real ms left of the arrow pointing back at the beans. */
  arrowMs: number
  /** True once you walked through with nothing left behind. */
  passed: boolean
}

/** The arrow over the pot that shows which way a bump throws the beans. */
export interface KickFx {
  /** 1 when beans surge forward (right), -1 back (left). */
  side: number
  /** Real ms left on screen. */
  ms: number
  /** Kick size in rad/s, which sets the arrow's size. */
  strength: number
}

/** A big centred title, such as a stretch name when you arrive. */
export interface TitleFx {
  text: string
  sub: string
  /** Real ms shown so far. */
  ageMs: number
  lifeMs: number
}

export interface FxState {
  /** Screen shake amplitude in u. */
  shake: number
  /** Real ms of slow motion left. */
  slowMs: number
  /** Real ms of the "O" mouth left. */
  gaspMs: number
  /** Body squash, 1 at rest. */
  squash: number
  particles: Particles
  /** Rings where beans dropped into water or a drain in the walk view. */
  ripples: Ripples
  captions: Caption[]
  kick: KickFx
  title: TitleFx | null
  /** Goes up by one on every cut, such as a new stretch, so cameras snap instead of panning. */
  cut: number
}

export interface Stats {
  pickedUp: number
  spilled: number
  biggestSpill: number
  /** Beans fished out of drains and from under the fridge. */
  fished: number
  /** Gossip lines jotted down. */
  gossip: number
  /** Telegraphed hits you dodged. */
  dodges: number
  /** Beans lost for good into seed packets. */
  lost: number
  /** Beans picked from the window box. */
  regrown: number
  /** Wall-clock ms when the run started, from the start screen's tap. */
  startedAt: number
  /** Real ms played, with dialogs that pause the game left out. */
  playedMs: number
  /** Where the time went on each stretch you reached, by index, for the balance pass. */
  stretches: StretchLog[]
}

/** The whole simulation. One mutable object, owned by the runtime. */
export interface Game {
  seed: number
  random: Streams
  scene: SceneId
  /** The stretches of this run, in order. Tests use a flat test route. */
  route: readonly StretchDef[]
  /** Index into `route`. */
  stretch: number
  counts: Counts
  walker: WalkerState
  pot: PotState
  options: PotOptions
  zones: ZoneSet
  pickup: PickupState
  /** The Drain scene while it is open, else null. Pickup stays open underneath. */
  drain: DrainState | null
  /** Tutorial captions already shown, outside Pickup and the kitchen. */
  taught: {
    hanger: boolean
    neighbour: boolean
    peek: boolean
    bell: boolean
    drain: boolean
    grate: boolean
    puddle: boolean
    rack: boolean
    shopper: boolean
    feet: boolean
    pigeon: boolean
    gull: boolean
    pigeonBean: boolean
    football: boolean
    dog: boolean
    dogPickup: boolean
    creep: boolean
    river: boolean
    duck: boolean
    bridge: boolean
  }
  gate: GateState
  /** "This must be done before that": picking up beans blocks leaving the stretch. */
  chores: ChoreBoard
  /** Your coins: dodges, clean stretches and gossip sales pay into it. */
  wallet: Wallet
  /** The kiosk's upgrade shop, selling the upgrades built so far. */
  shop: Shop<BeanUpgrade>
  /** Beans behind and down drains at the last chore sync, so chores update only on change. */
  lastBehind: number
  lastDrain: number
  spill: SpillEvent
  lastKick: KickRecord | null
  /** Rotating versions of recurring captions, Grandma's lines included. */
  lines: LineBook
  /** Each cause's running score, for "Ladder: 2. You: 0.". */
  scores: Scores
  fx: FxState
  stats: Stats
  /** Town gossip: which lines are found, the one spelled out now, and Jot It Down. */
  gossip: GossipState
  /** Your kitchen: the opening gag, the door cat and the cat in Pickup. */
  kitchen: KitchenState
  /** Characters on this stretch: nosy neighbours and cyclists. */
  street: StreetState
  /** The market's characters: shoppers, tasting spoons, the ladder man, and feet in Pickup. */
  market: MarketState
  /** The park's characters: the kid's football, off-lead dogs, wet grass, and the dog in Pickup. */
  park: ParkState
  /** This stretch's hard encounter (Mrs Pryce, the sale or Bruno), or null. */
  ambush: AmbushState | null
  /** The newspaper kiosk while you stand at it between stretches, else null. */
  kiosk: KioskState | null
  /** Beans that left the pot on this stretch, for the clean bonus. The cat's opening bean doesn't count. */
  stretchSpilled: number
  /** One real-time timer per swollen bean drying on the rack on your back, oldest first. */
  drying: RealTimer[]
  /** Seed packets of beans lost for good, waiting to be planted. */
  packets: PacketSet
  /** Pigeons coming for the pot while it sits on the ground. */
  flock: Flock
  /** The Pigeon Net over the pot while it sits on the ground, when you own one. */
  net: NetState
  /** The window box on your back, where seed packets grow back into beans. */
  box: WindowBoxState
  /** The Pot Lid, when you own it: on the pot, or knocked off onto the route. */
  lid: LidState
  /** Mud on Grippy Shoes after the park. */
  mud: MudState
  /** Rain, wind and pouring the rain off, on the stretches that have weather. */
  weather: WeatherState
  /** A finished spill waiting for its beans to land before its replay clip is cut. */
  replays: ReplayState
  /** Grandma's door: her dog, then the count, the doormat bean, the taste and her secret. */
  door: DoorState
  /** True when the latest input was a finger, so tutorial captions talk about taps. */
  touch: boolean
  /** True on a phone without working tilt, so captions point at the tilt buttons. */
  tiltButtons: boolean
  /** Simulated ms; slows down in slow motion. */
  timeMs: number
  out: GameEvent[]
  /** Slosh-sound peak detection. */
  sloshPrev: number
  sloshRising: boolean
}

/** The stretch you are on. */
export function currentStretch(game: Game): StretchDef {
  const def = game.route[game.stretch]
  if (!def)
    throw new RangeError(
      `Route: stretch ${game.stretch} does not exist, so the game has nowhere to walk`
    )
  return def
}

export function createGame(
  seed = 1,
  route: readonly StretchDef[] = ROUTE
): Game {
  const first = route[0]
  if (!first)
    throw new RangeError('createGame: the route is empty, so there is no start')
  // A run starts in the kitchen with the pot on the counter and the cat beside it.
  const intro = first.id === 'kitchen'
  const walker = createWalker(0, first.length)
  walker.carrying = !intro
  const random = createStreams(seed)
  const wallet = createWallet()
  return {
    seed,
    random,
    scene: intro ? 'grounded' : 'walk',
    route,
    stretch: 0,
    counts: createCounts(),
    walker,
    pot: createPot(),
    options: { ...DEFAULT_POT_OPTIONS },
    zones: createZoneSet(),
    pickup: {
      world: null,
      carry: {
        mode: 'tweezers',
        count: 0,
        strain: 0,
        slipperyMs: 0,
        slipperyIn: 0,
        creakMs: 0,
        dribbleMs: 0
      },
      cup: { armed: false, ms: 0, x: 0, y: 0, source: 'pile' },
      jolt: new JoltMeter({ pointerRef: STRAIN_JOLT_REF }),
      streak: 0,
      taught: { tweezers: false, hands: false }
    },
    drain: null,
    taught: {
      hanger: false,
      neighbour: false,
      peek: false,
      bell: false,
      drain: false,
      grate: false,
      puddle: false,
      rack: false,
      shopper: false,
      feet: false,
      pigeon: false,
      gull: false,
      pigeonBean: false,
      football: false,
      dog: false,
      dogPickup: false,
      creep: false,
      river: false,
      duck: false,
      bridge: false
    },
    gate: { wobbleMs: 0, cooldownMs: 0, arrowMs: 0, passed: false },
    chores: createChoreBoard(),
    wallet,
    shop: createShop(SHOP_UPGRADES, wallet),
    lastBehind: 0,
    lastDrain: 0,
    spill: createSpillEvent(),
    lastKick: null,
    lines: new LineBook(),
    scores: new Map(),
    fx: {
      shake: 0,
      slowMs: 0,
      gaspMs: 0,
      squash: 1,
      particles: new Particles(),
      ripples: new Ripples(),
      captions: [],
      kick: { side: 0, ms: 0, strength: 0 },
      title: {
        text: first.name,
        sub: `Stretch 1 of ${route.length}`,
        ageMs: 0,
        lifeMs: TITLE_MS
      },
      cut: 0
    },
    stats: {
      pickedUp: 0,
      spilled: 0,
      biggestSpill: 0,
      fished: 0,
      gossip: 0,
      dodges: 0,
      lost: 0,
      regrown: 0,
      startedAt: Date.now(),
      playedMs: 0,
      stretches: []
    },
    gossip: createGossip(),
    kitchen: createKitchen(intro),
    street: createStreet(first, random.events),
    market: createMarket(first, random.events),
    park: createPark(first),
    ambush: createAmbush(first),
    kiosk: null,
    stretchSpilled: 0,
    drying: [],
    packets: createPackets(),
    flock: createFlock(),
    net: createNet(),
    box: createWindowBox(),
    lid: createLid(),
    mud: createMud(),
    weather: createWeather(),
    replays: createReplays(),
    door: createDoor(),
    touch: false,
    tiltButtons: false,
    timeMs: 0,
    out: [],
    sloshPrev: 0,
    sloshRising: false
  }
}
