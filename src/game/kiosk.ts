import { sound } from './effects'
import { cleanBonus, fullBonus } from './economy'
import { landed } from './emit'
import { LEAVE_STRETCH } from './gate'
import { LINES } from './gossip'
import { clearFlock } from './pigeons'
import { muddy } from './upgrades'
import { tipJar } from './windowBox'
import { stretchLog } from './runLog'
import { resetPot } from './slosh'
import { currentStretch, type Game } from './state'
import { EDITOR_SAYS_MS } from './tuning'

/** What the kiosk shows about the stretch you just cleared. Made once per visit. */
export interface KioskSummary {
  /** Title Case names of the stretch you cleared and the next one. */
  cleared: string
  next: string
  /** Beans that left the pot on the cleared stretch. */
  spilled: number
  /** The clean bonus that paid, and the most it could have paid. */
  bonus: number
  full: number
}

/** The Weekly Whisper's newspaper kiosk, between two stretches. */
export interface KioskState {
  summary: KioskSummary
  /** The editor's speech bubble, '' for none, and how long it has left in ms. */
  says: string
  saysMs: number
  /** Lines sold at this visit, in order, for the sandwich board. */
  sold: number[]
  /** Simulated ms since it opened. */
  ms: number
}

/**
 * You walked off the end of a cleared stretch: the kiosk opens, the clean bonus pays,
 * and the editor greets you. Returns false after the last stretch, which has no kiosk.
 */
export function openKiosk(game: Game): boolean {
  const def = currentStretch(game)
  const next = game.route[game.stretch + 1]
  if (!next) return false
  game.fx.particles.landAll((zoneId, kind) => landed(game, zoneId, kind))
  const spilled = game.stretchSpilled
  const bonus = cleanBonus(def.id, spilled)
  const full = fullBonus(def.id)
  if (bonus > 0) game.wallet.earn(bonus, `Clean bonus: ${def.name}`)
  stretchLog(game).bonus = bonus
  game.kiosk = {
    summary: { cleared: def.name, next: next.name, spilled, bonus, full },
    says: greeting(game, bonus, full),
    saysMs: EDITOR_SAYS_MS,
    sold: [],
    ms: 0
  }
  game.scene = 'kiosk'
  clearFlock(game.flock)
  game.walker.carrying = false
  game.walker.v = game.walker.ax = 0
  resetPot(game.pot)
  game.fx.captions.length = 0
  game.fx.shake = 0
  game.fx.kick.ms = 0
  tipJar(game)
  if (def.id === 'park') muddy(game)
  if (game.mud.on) game.kiosk.says = 'Wipe your feet first, love.'
  sound(game, 'ding', 0.6, 1.1)
  if (bonus > 0) sound(game, 'coin', 0.8)
  game.out.push({ type: 'scene' })
  return true
}

/** The editor's hello: a tip for a clean stretch, or a nudge about gossip. */
function greeting(game: Game, bonus: number, full: number): string {
  if (bonus > 0 && bonus === full) return 'Not a bean spilled? Have a tip.'
  if (bonus > 0) return 'A bit messy. Half a tip.'
  if (unsoldPages(game) > 0) return 'Got any gossip for me?'
  return 'No gossip? Spill something juicy.'
}

/** Pages jotted down but not sold yet. */
export function unsoldPages(game: Game): number {
  let n = 0
  for (const status of game.gossip.status) if (status === 'found') n++
  return n
}

/**
 * Sells a jotted page to the editor at its table price, with a `coin` and his verdict.
 * Returns false away from the kiosk, or for a line that isn't jotted or is already sold.
 */
export function sellPage(game: Game, line: number): boolean {
  const kiosk = game.kiosk
  const page = LINES[line]
  if (!kiosk || !page || game.gossip.status[line] !== 'found') return false
  game.gossip.status[line] = 'sold'
  game.wallet.earn(page.price, `Sold "${page.text}"`)
  kiosk.sold.push(line)
  say(kiosk, page.quip)
  sound(game, 'coin', 0.9)
  sound(game, 'ding', 0.5, 1.3)
  game.out.push({ type: 'scene' })
  return true
}

/** True while a chore, such as cleaning muddy shoes, keeps you at the kiosk. */
export function kioskBlocked(game: Game): boolean {
  return !game.chores.canDo(LEAVE_STRETCH)
}

/** Next Stretch while a chore blocks it: a buzz and a word from the editor. */
export function refuseLeave(game: Game): void {
  if (!game.kiosk) return
  say(game.kiosk, 'Chores first, love.')
  sound(game, 'buzz', 0.6)
}

function say(kiosk: KioskState, text: string): void {
  kiosk.says = text
  kiosk.saysMs = EDITOR_SAYS_MS
}

/** One step at the kiosk: the editor's bubble times out. */
export function updateKiosk(game: Game, simMs: number): void {
  const kiosk = game.kiosk
  if (!kiosk) return
  kiosk.ms += simMs
  kiosk.saysMs -= simMs
  if (kiosk.saysMs <= 0) kiosk.says = ''
}
