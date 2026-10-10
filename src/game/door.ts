import { timeLeftMs } from '../shared'
import { caption, sound } from './effects'
import { clampLanding, emitBeans, rimPoint } from './emit'
import { LAND_MAT, MAT_ZONE, POT_OFFSET_X } from './fx'
import { cleanBonus } from './economy'
import { COUNT_ACTION } from './gate'
import { pagesFound, secretShown } from './gossip'
import { layoutLine, type FontOptions, type LaidLine } from './gossipFont'
import { leaningAgainst } from './hits'
import { scoreDodge } from './lines'
import { move } from './ledger'
import { clearFlock } from './pigeons'
import { groundDrop, groundY } from './route'
import { effectiveAngle, resetPot } from './slosh'
import { stretchLog } from './runLog'
import { noteSpill } from './spill'
import { currentStretch, type Game } from './state'
import {
  COUNT_MS,
  COUNT_RESUME_RATE,
  DOOR_BARK_X,
  DOOR_DOG_WARN_MS,
  DOOR_LEAN,
  DOOR_SLOW_MS,
  DOOR_STOP_X,
  DOOR_TIP_LOOSE,
  DOORMAT_X,
  LID_TIP_SHARE,
  MAT_BEAN_GRAB,
  MAT_H,
  MAT_LIFT,
  MAT_W,
  MAT_X,
  MAT_Y,
  MAX_SHAKE,
  SECRET_MS,
  SECRET_SAY_MS,
  STEW_REACH,
  STEW_X,
  STEW_Y,
  STILL_SPEED,
  TASTE_HMM_MS,
  TASTE_MS,
  TASTE_SALT_MS,
  TASTE_SNEEZE_MS,
  TOTAL_BEANS
} from './tuning'
import { formatBeans } from './units'
import { lidLaunch } from './upgrades'
import { canPlant, podsReady, sillPackets, tipJar } from './windowBox'
import { landFromPot, pileFromPot } from './zones'

/**
 * Grandma's door: her dog on the last step, then the count, the bean under the doormat,
 * the taste and her secret. The walk view handles the dog; the count view the rest.
 */

/** The doorstep dog: asleep until you reach the steps, barking, then done one way or the other. */
export type DogPhase = 'waiting' | 'bark' | 'made' | 'tipped'

/** The ending once you reach the door: 'done' opens the ending screen. */
export type EndingPhase =
  'none' | 'count' | 'doormat' | 'taste' | 'secret' | 'done'

export interface DoorState {
  dog: DogPhase
  /** Simulated ms in the dog's phase. */
  dogMs: number
  /** True once Grandma handed you her dustpan after the dog tipped the pot. */
  dustpan: boolean
  /** Grandma's speech bubble, '' for none, and the real ms it has left. */
  says: string
  saysMs: number
  /** Real ms before the door turns you away again, so it doesn't repeat every step. */
  refuseMs: number
  phase: EndingPhase
  /** Simulated ms in the ending's phase. */
  ms: number
  /** Beans Grandma has counted out loud. */
  counted: number
  /** How far through her count she is, 0 to 1, before the pot's own limit. */
  progress: number
  /** Fractional beans counted at the resume rate. */
  resumeAcc: number
  /** Index of the next count line in COUNT_LINES. */
  line: number
  /** Simulated ms since the last tick. */
  tickMs: number
  /** True while she waits at the shortfall for beans still growing. */
  holding: boolean
  /** True once she has waited, after which she counts on at COUNT_RESUME_RATE. */
  waited: boolean
  /** How far the doormat is lifted, 0 to MAT_LIFT u, and whether it stays up. */
  mat: number
  matUp: boolean
  /** What the pointer holds in the count view. */
  drag: 'none' | 'mat' | 'bean'
  /** Where the press on the mat started, and the lift then. */
  dragY: number
  dragMat: number
  /** The doormat bean in the count view. */
  bean: { x: number; y: number }
  /** Grandma's secret laid out in beans, once the stew spells it. */
  secret: LaidLine | null
  /** The secret's text with only the letters your pages earned. */
  secretText: string
}

/** Grandma counts to this: everything but the bean under the doormat. */
export const COUNT_FULL = TOTAL_BEANS - 1

/** The chore that holds the count while swollen beans dry. */
export const DRY_CHORE = 'dry-beans'

/** What Grandma says as the count passes each number. */
const COUNT_LINES: readonly (readonly [number, string])[] = [
  [1, 'One.'],
  [2, 'Two.'],
  [3, 'Three.'],
  [50, "This'll take a while."],
  [1_000, 'Tea break? No.'],
  [4_321, 'Ooh, my knee.'],
  [6_000, "This one's been in a puddle."],
  [7_777, 'Lucky bean!'],
  [COUNT_FULL, 'One is missing.']
]

/** The secret in beans: three short rows over the doorway. */
const SECRET_FONT: FontOptions = {
  height: 56,
  spacing: 24,
  maxWidth: 400,
  centerX: 300,
  centerY: 296
}

/** Where the doormat bean sits in the count view until you find it. */
const BEAN_HOME = { x: MAT_X + 46, y: MAT_Y + 26 }

export function createDoor(): DoorState {
  return {
    dog: 'waiting',
    dogMs: 0,
    dustpan: false,
    says: '',
    saysMs: 0,
    refuseMs: 0,
    phase: 'none',
    ms: 0,
    counted: 0,
    progress: 0,
    resumeAcc: 0,
    line: 0,
    tickMs: 0,
    holding: false,
    waited: false,
    mat: 0,
    matUp: false,
    drag: 'none',
    dragY: 0,
    dragMat: 0,
    bean: { ...BEAN_HOME },
    secret: null,
    secretText: ''
  }
}

/** True on Grandma's door stretch. */
export function atDoorStretch(game: Game): boolean {
  return currentStretch(game).id === 'door'
}

/** Grandma's speech bubble for `ms` real ms. */
function say(game: Game, text: string, ms = 2400): void {
  game.door.says = text
  game.door.saysMs = ms
}

// ---------------------------------------------------------------- The dog

const rim = { x: 0, y: 0 }

/** The dog's jump knocks one bean out of the pot, and it rolls under the doormat. */
function hideBean(game: Game): void {
  if (game.counts.pot === 0) return
  move(game.counts, 'pot', 'hidden', 1)
  const { walker, pot } = game
  const def = currentStretch(game)
  rimPoint(walker.x, effectiveAngle(pot), 1, groundDrop(def, walker.x), rim)
  const floor = groundY(def, DOORMAT_X) - 4
  // A 0.6s hop from the front rim onto the mat.
  const t = 0.6
  const vx = (DOORMAT_X - rim.x) / t
  const vy = (floor - rim.y - 0.5 * 900 * t * t) / t
  if (
    !game.fx.particles.spawn(
      rim.x,
      rim.y,
      vx,
      vy,
      16,
      floor,
      MAT_ZONE,
      LAND_MAT
    )
  )
    caption(
      game,
      'One rolled under the doormat.',
      'info',
      "Grandma didn't see."
    )
}

/** The dog jumped and you stopped or leaned into it: one bean, and you made it. */
function madeIt(game: Game): void {
  const door = game.door
  door.dog = 'made'
  door.dogMs = 0
  hideBean(game)
  game.fx.squash = 0.9
  sound(game, 'pop', 0.8, 1.3)
  sound(game, 'bark', 0.7, 1.3)
  caption(game, 'Made it!', 'good', 'He only got one bean.', 2600, {
    score: scoreDodge(game.scores, 'doorstep')
  })
  say(game, 'Good boy. Down.')
}

/**
 * The dog jumped while you walked on: the whole pot tips onto the steps in slow motion.
 * DOOR_TIP_LOOSE beans scatter (half with the Pot Lid) and the rest land in a pile, and
 * one bean still rolls under the doormat. Grandma hands you her dustpan.
 */
export function doorTip(game: Game): void {
  const { counts, walker, pot, fx, door } = game
  door.dog = 'tipped'
  door.dogMs = 0
  hideBean(game)
  // The dog jumps at the front rim, so the beans go back over the rear one.
  const side = -1
  const lidded = lidLaunch(game, side)
  game.lastKick = { cause: 'doorstep', at: game.timeMs }
  const scatter = lidded
    ? Math.round(DOOR_TIP_LOOSE * LID_TIP_SHARE)
    : DOOR_TIP_LOOSE
  const loose = Math.min(scatter, counts.pot)
  if (loose > 0) emitBeans(game, loose, side, 30)
  const pile = counts.pot
  if (pile > 0) {
    const zone = landFromPot(
      counts,
      game.zones,
      game.stretch,
      clampLanding(game, walker.x + POT_OFFSET_X + side * 90),
      0,
      game.random.zones
    )
    pileFromPot(counts, zone, pile)
    zone.shown = Math.min(zone.count + zone.pile, zone.shown + pile)
    noteSpill(game.spill, pile, side, game.timeMs, () => 'doorstep')
    game.stats.spilled += pile
    game.stretchSpilled += pile
  }
  if (game.spill.active) game.spill.cause = 'doorstep'
  resetPot(pot)
  walker.v = 0
  door.dustpan = true
  sound(game, 'thud', 1, 0.5)
  sound(game, 'bark', 0.9, 1.2)
  fx.shake = MAX_SHAKE
  fx.slowMs = DOOR_SLOW_MS
  fx.gaspMs = 2400
  say(game, 'Oh dear. Again.', 3600)
}

/**
 * One walking step on the door stretch: the dog barks once you reach the steps and
 * jumps DOOR_DOG_WARN_MS later, and the top step stops you until Grandma counts.
 * Returns true when the step ended in a tip or the count, so walking stops here.
 */
export function stepDoorWalk(game: Game, simMs: number): boolean {
  if (!atDoorStretch(game)) return false
  const { door, walker } = game
  if (door.dog === 'waiting' && walker.x >= DOOR_BARK_X) {
    door.dog = 'bark'
    door.dogMs = 0
    sound(game, 'bark', 1, 1.4)
    say(game, 'Oh! He gets so excited.', 1800)
    caption(
      game,
      'WOOF!',
      'bad',
      game.touch
        ? 'Stop, or tilt toward the dog!'
        : 'Let go of W, or lean on D!',
      1400
    )
  } else if (door.dog === 'bark') {
    door.dogMs += simMs
    if (door.dogMs >= DOOR_DOG_WARN_MS) {
      const still = Math.abs(walker.v) < STILL_SPEED
      // The dog throws the beans back (-1), so leaning against it means toward it.
      const leaned = leaningAgainst(game.pot.psiTarget, -1, DOOR_LEAN)
      if (still || leaned) madeIt(game)
      else {
        doorTip(game)
        return true
      }
    }
  } else door.dogMs += simMs
  if (walker.x > DOOR_STOP_X) {
    walker.x = DOOR_STOP_X
    walker.v = Math.min(0, walker.v)
  }
  if (walker.x < DOOR_STOP_X - 0.5 || door.dog === 'waiting') return false
  if (door.dog === 'bark') return false
  return arriveAtDoor(game)
}

/** Warning arrow side for the walk view: the dog throws beans back while it barks. */
export function doorWarningSide(game: Game): number {
  return atDoorStretch(game) && game.door.dog === 'bark' ? -1 : 0
}

/** Advice for bots: 'doordog' while the dog barks, so a heeding bot stops. */
export function doorWait(game: Game): string | null {
  return atDoorStretch(game) && game.door.dog === 'bark' ? 'doordog' : null
}

// ---------------------------------------------------------------- The count gate

/**
 * What stops Grandma counting, in her words, or null when she can start. Seed packets
 * don't: she counts while you plant them and they grow.
 */
export function countBlocker(game: Game): string | null {
  const c = game.counts
  const ground = c.loose + c.pile + c.puddle
  if (ground > 0)
    return `${formatBeans(ground)} ${ground === 1 ? 'bean is' : 'beans are'} still on my steps, dear.`
  if (c.drain > 0) return 'Fish the drain beans out first, dear.'
  if (c.drying > 0) return 'Let those soggy beans dry first, dear.'
  return null
}

/**
 * Keeps the count's drying chore in step on the door stretch. Beans on the ground
 * already have their own chores.
 */
export function syncCountChores(game: Game): void {
  const door = atDoorStretch(game)
  const drying = game.counts.drying
  syncChore(
    game,
    DRY_CHORE,
    door && drying > 0
      ? `Let ${drying} ${drying === 1 ? 'bean' : 'beans'} dry`
      : '',
    'They hop into the pot by themselves.'
  )
}

function syncChore(game: Game, id: string, label: string, detail: string) {
  const chores = game.chores
  const open = chores.list().find(c => c.id === id)
  if (open?.label === label) return
  if (open) chores.complete(id)
  if (label) chores.add({ id, label, detail, blocks: [COUNT_ACTION] })
}

/** You reached the top step: Grandma counts, or tells you what is missing. */
function arriveAtDoor(game: Game): boolean {
  const door = game.door
  const blocker = countBlocker(game)
  if (!blocker) {
    startCount(game)
    return true
  }
  if (door.refuseMs > 0) return false
  door.refuseMs = 4_000
  sound(game, 'buzz', 0.5, 0.9)
  say(game, blocker, 3400)
  return false
}

/** Grandma takes the pot at the door and starts counting out loud. */
export function startCount(game: Game): void {
  const door = game.door
  const walker = game.walker
  game.fx.particles.landAll(() => {})
  game.scene = 'count'
  walker.carrying = false
  walker.v = walker.ax = 0
  resetPot(game.pot)
  clearFlock(game.flock)
  game.fx.captions.length = 0
  game.fx.shake = 0
  game.fx.kick.ms = 0
  game.fx.cut++
  tipJar(game)
  door.phase = 'count'
  door.ms = 0
  door.counted = 0
  door.progress = 0
  door.resumeAcc = 0
  door.line = 0
  door.holding = false
  door.waited = false
  sound(game, 'slam', 0.6, 0.9)
  say(game, 'Let me count them, dear.', 1600)
  payDoorBonus(game)
  game.out.push({ type: 'scene' })
}

/** A clean walk up her path: Grandma pays the door's clean bonus, as a kiosk would. */
function payDoorBonus(game: Game): void {
  const bonus = cleanBonus('door', game.stretchSpilled)
  if (bonus === 0) return
  game.wallet.earn(bonus, "Clean bonus: Grandma's Door")
  stretchLog(game).bonus = bonus
  sound(game, 'coin', 0.8)
  caption(
    game,
    'Not a bean on her steps.',
    'good',
    `Grandma tips you ${bonus} coins.`,
    3200
  )
}

// ---------------------------------------------------------------- The count and after

/** Grandma's count `progress` of the way through (0 to 1), before the pot's own limit. */
export function countAt(progress: number): number {
  return Math.round(COUNT_FULL * Math.min(1, Math.max(0, progress)) ** 3)
}

/**
 * Real ms until the window box's batch grows, or 0. Grandma paces her count so she
 * reaches the beans still growing just as they arrive.
 */
function growLeft(game: Game): number {
  return game.box.batch ? timeLeftMs(game.box.batch) : 0
}

/** One step of the ending in the count view. */
export function updateEnding(game: Game, simMs: number): void {
  const door = game.door
  door.ms += simMs
  if (door.phase === 'count') stepCount(game, simMs)
  else if (door.phase === 'taste') stepTaste(game, door.ms - simMs, door.ms)
  else if (door.phase === 'secret') stepSecret(game, door.ms - simMs, door.ms)
}

/** Real-time bits of the door in any scene: Grandma's bubble and the refusal cooldown. */
export function stepDoorTimers(game: Game, dtMs: number): void {
  const door = game.door
  door.refuseMs = Math.max(0, door.refuseMs - dtMs)
  door.saysMs -= dtMs
  if (door.saysMs <= 0) door.says = ''
}

function stepCount(game: Game, simMs: number): void {
  const door = game.door
  const target = Math.min(COUNT_FULL, game.counts.pot)
  // Beans arrived while she waited. She says so first, so "One is missing." can follow.
  const arrived = door.holding && target > door.counted
  if (arrived) {
    door.holding = false
    say(game, 'There we are.', 1200)
  }
  // Packets the box can't take while its batch grows go on her windowsill and join it.
  // Both often happen as you close the box, so one bubble says both.
  const packets = game.packets.list.length
  const beans = game.counts.packets
  if (packets > 0 && game.box.batch && sillPackets(game) > 0) {
    sound(game, 'pop', 0.6, 0.9)
    say(
      game,
      `${arrived ? 'There we are. ' : ''}Pass those here, dear. They'll grow on my windowsill.`,
      3600
    )
    caption(
      game,
      `Grandma took ${packets} seed ${packets === 1 ? 'packet' : 'packets'}.`,
      'info',
      `${formatBeans(beans)} ${beans === 1 ? 'bean grows' : 'beans grow'} on her windowsill with your batch.`,
      3600
    )
  }
  let next = door.counted
  if (!door.waited) {
    // COUNT_MS from the start, or longer while a batch grows. A steady pace to the end.
    const left = Math.max(COUNT_MS - door.ms + simMs, growLeft(game), simMs)
    door.progress += ((1 - door.progress) * simMs) / left
    next = Math.max(next, Math.min(countAt(door.progress), target))
  } else if (next < target) {
    // Beans picked while she waited: she carries on at a steady pace.
    door.resumeAcc += (COUNT_RESUME_RATE * simMs) / 1000
    const add = Math.floor(door.resumeAcc)
    door.resumeAcc -= add
    next = Math.min(target, next + add)
  }
  door.tickMs += simMs
  if (next > door.counted) {
    door.counted = next
    if (door.tickMs >= 75) {
      door.tickMs = 0
      sound(game, 'tick', 0.45, 0.8 + (1.2 * next) / COUNT_FULL)
    }
    while (door.line < COUNT_LINES.length) {
      const [at, text] = COUNT_LINES[door.line]!
      if (next < at) break
      door.line++
      say(game, text, at === COUNT_FULL ? 3200 : 1300)
    }
  }
  const short = COUNT_FULL - target
  if (door.counted >= target && short > 0) {
    door.holding = true
    door.waited = true
    // She finishes what she is saying first, such as the windowsill line.
    if (door.says === '')
      say(game, `Still ${formatBeans(short)} short, dear.`, 600_000)
    return
  }
  if (door.counted < COUNT_FULL) return
  door.phase = 'doormat'
  door.ms = 0
  sound(game, 'fail', 0.6)
}

/** True when (x, y) in the count view is on the doormat. */
function onMat(x: number, y: number): boolean {
  return Math.abs(x - MAT_X) <= MAT_W / 2 && Math.abs(y - MAT_Y) <= MAT_H / 2
}

/** A press in the count view: on the doormat to lift it, or on the bean once it shows. */
export function doorPress(game: Game, x: number, y: number): boolean {
  const door = game.door
  if (game.scene !== 'count' || door.phase !== 'doormat') return false
  if (
    door.matUp &&
    Math.hypot(x - door.bean.x, y - door.bean.y) <= MAT_BEAN_GRAB
  ) {
    door.drag = 'bean'
    sound(game, 'click', 0.4, 1.6)
    return true
  }
  if (!door.matUp && onMat(x, y)) {
    door.drag = 'mat'
    door.dragY = y
    door.dragMat = door.mat
    return true
  }
  return false
}

/** The pointer moves in the count view: the mat lifts as you drag up, or the bean follows. */
export function doorDrag(game: Game, x: number, y: number): void {
  const door = game.door
  if (door.drag === 'mat')
    door.mat = Math.min(MAT_LIFT, Math.max(0, door.dragMat + door.dragY - y))
  else if (door.drag === 'bean') {
    door.bean.x = Math.min(570, Math.max(30, x))
    door.bean.y = Math.min(780, Math.max(140, y))
  }
}

/** The pointer lifts in the count view. */
export function doorRelease(game: Game): void {
  const door = game.door
  const drag = door.drag
  door.drag = 'none'
  if (drag === 'mat') {
    if (door.mat >= MAT_LIFT * 0.85) {
      door.mat = MAT_LIFT
      door.matUp = true
      sound(game, 'whoosh', 0.5, 1.2)
      say(game, 'Oh! There it is.', 2400)
    } else if (door.mat > 0) {
      door.mat = 0
      sound(game, 'thud', 0.4, 1.2)
    }
    return
  }
  if (drag !== 'bean') return
  if (Math.hypot(door.bean.x - STEW_X, door.bean.y - STEW_Y) > STEW_REACH) {
    sound(game, 'squish', 0.5, 1.1)
    say(game, 'In the stew, dear.', 1800)
    return
  }
  if (game.counts.hidden > 0) move(game.counts, 'hidden', 'pot', 1)
  door.counted = TOTAL_BEANS
  door.phase = 'taste'
  door.ms = 0
  sound(game, 'pop', 1, 1.2)
  sound(game, 'coin', 0.8)
  sound(game, 'ding', 0.7)
  game.out.push({ type: 'potted', n: 1 })
  say(game, 'Ten thousand.', TASTE_HMM_MS)
}

/** True when the script time `at` falls between `from` (exclusive) and `to`. */
function crossed(from: number, to: number, at: number): boolean {
  return from < at && to >= at
}

function stepTaste(game: Game, from: number, to: number): void {
  if (crossed(from, to, TASTE_HMM_MS)) {
    sound(game, 'squish', 0.8, 0.6)
    say(game, 'Hmm.', TASTE_SALT_MS - TASTE_HMM_MS)
  }
  if (crossed(from, to, TASTE_SALT_MS)) {
    sound(game, 'rattle', 0.8, 1.4)
    say(game, 'Needs salt.', TASTE_SNEEZE_MS - TASTE_SALT_MS)
  }
  if (crossed(from, to, TASTE_SNEEZE_MS)) sound(game, 'sneeze', 0.9)
  if (to < TASTE_MS) return
  const door = game.door
  door.phase = 'secret'
  door.ms = 0
  door.secretText = secretShown(pagesFound(game.gossip.status))
  door.secret = layoutLine(door.secretText, SECRET_FONT)
  sound(game, 'whoosh', 0.6, 0.8)
  caption(
    game,
    "Grandma's secret.",
    'info',
    'One share of the letters for each gossip page you found.',
    3000
  )
}

function stepSecret(game: Game, from: number, to: number): void {
  if (crossed(from, to, SECRET_SAY_MS)) {
    sound(game, 'laugh', 0.6, 1.2)
    say(game, 'Every year, dear. It builds character.', 4000)
  }
  if (to < SECRET_MS) return
  game.door.phase = 'done'
  game.out.push({ type: 'scene' })
}

/** The next step in the count view, for the HUD. */
export function countPrompt(game: Game, touch: boolean): string {
  const door = game.door
  const open = touch ? 'Tap Box' : 'Press E'
  if (door.phase === 'count') {
    if (podsReady(game.box) > 0)
      return `Your beans grew. ${open} and pick them.`
    if (game.packets.list.length > 0 && canPlant(game.box))
      return `Plant your seed packets while she counts. ${open}.`
    return door.holding
      ? 'Grandma waits for your window box to grow.'
      : 'Grandma is counting. Every single one.'
  }
  if (door.phase === 'doormat')
    return door.matUp
      ? 'Drag the bean into the stew.'
      : 'The doormat has a bump. Drag it up.'
  return ''
}

/** The next step on the door stretch's walk, for the HUD, or null. */
export function doorPrompt(game: Game, touch: boolean): string | null {
  if (!atDoorStretch(game)) return null
  const door = game.door
  if (door.dog === 'bark')
    return touch
      ? 'The dog! Let go to stop, or tilt toward it.'
      : 'The dog! Let go of W, or lean on D.'
  if (game.scene === 'pickup' && door.dustpan)
    return touch
      ? "Drag the pile with Grandma's dustpan. Pinch the loose beans."
      : "Hold still on the pile for Grandma's dustpan. Drag the rest."
  if (door.dog === 'tipped' && game.counts.pile > 0 && game.scene === 'walk')
    return touch
      ? 'Tap Set Down by the pile. Grandma has a dustpan.'
      : 'Space sets the pot down by the pile. Grandma has a dustpan.'
  if (game.scene === 'grounded' && door.dog === 'tipped' && !countBlocker(game))
    return touch
      ? 'All clear. Tap Pick Up Pot, then carry it up to Grandma.'
      : 'All clear. Space picks up the pot. Carry it up to Grandma.'
  if (door.dog === 'waiting' || game.scene !== 'walk') return null
  if (!countBlocker(game)) return 'Walk up to Grandma.'
  // Away from her door the usual prompts lead you to the beans.
  if (game.walker.x < DOOR_STOP_X - 1) return null
  if (game.counts.drying > 0) return 'Grandma waits for the soggy beans to dry.'
  return 'Grandma waits. Pick up every bean first.'
}

/** Dev: on the door stretch with the pot in your hands, the dog barks now. */
export function devDoorDog(game: Game): boolean {
  if (!atDoorStretch(game) || game.scene !== 'walk') return false
  game.walker.x = Math.max(game.walker.x, DOOR_BARK_X)
  game.door.dog = 'waiting'
  return true
}

/** Dev: every bean but the doormat one goes back in the pot, and Grandma starts counting. */
export function devCount(game: Game): void {
  if (game.counts.hidden === 0 && game.counts.pot > 0)
    move(game.counts, 'pot', 'hidden', 1)
  if (game.door.dog === 'waiting' || game.door.dog === 'bark')
    game.door.dog = 'made'
  startCount(game)
}
