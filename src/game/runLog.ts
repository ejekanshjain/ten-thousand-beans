import { LINES } from './gossip'
import { UPGRADES } from './economy'
import type { Game, SceneId } from './state'
import { DODGE_COINS } from './tuning'
import { behind } from './zones'

/** Where the time went on one stretch, and what spilled there. */
export interface StretchLog {
  /** Real ms spent in each scene. Dialogs that pause the game don't count. */
  ms: Record<SceneId, number>
  /** Beans that left the pot, as the clean bonus counts them. */
  spilled: number
  /** Beans you potted in Pickup. */
  pickedUp: number
  /** Beans lost for good into seed packets. */
  lost: number
  /** Coins the clean bonus paid at this stretch's kiosk. */
  bonus: number
}

function createStretchLog(): StretchLog {
  return {
    ms: {
      walk: 0,
      grounded: 0,
      pickup: 0,
      drain: 0,
      kiosk: 0,
      box: 0,
      count: 0
    },
    spilled: 0,
    pickedUp: 0,
    lost: 0,
    bonus: 0
  }
}

/** This stretch's log, created when you first reach it. */
export function stretchLog(game: Game): StretchLog {
  const logs = game.stats.stretches
  while (logs.length <= game.stretch) logs.push(createStretchLog())
  return logs[game.stretch]!
}

/** Adds one update step of `dtMs` real ms to the run's clock and this stretch's log. */
export function logStep(game: Game, dtMs: number): void {
  const log = stretchLog(game)
  log.ms[game.scene] += dtMs
  log.spilled = game.stretchSpilled
  game.stats.playedMs += dtMs
}

/** One stretch in `runReport`, with times in minutes. */
export interface StretchReport {
  stretch: string
  minutes: number
  /** Carrying the pot, and standing by it on the ground. */
  walking: number
  /** Pickup and the coat hanger. */
  pickup: number
  box: number
  kiosk: number
  /** Grandma's count and the ending. */
  count: number
  spilled: number
  pickedUp: number
  lost: number
  /** Seconds in Pickup per bean potted, or null before any. */
  secondsPerBean: number | null
}

/** The run so far, for the balance pass: `__game.beans.stats()` in dev builds. */
export interface RunReport {
  stretches: StretchReport[]
  /** Minutes played, with dialogs that pause the game left out. */
  played: number
  /** Minutes on the wall clock since the start screen. */
  wall: number
  /** Share of the played time spent in Pickup and the coat hanger. */
  pickupShare: number
  secondsPerBean: number | null
  spilled: number
  pickedUp: number
  lost: number
  /** Coins earned from each source, spent on upgrades, and left. */
  coins: {
    dodges: number
    bonuses: number
    pages: number
    spent: number
    left: number
  }
  upgrades: string[]
  pages: number
}

const minutes = (ms: number) => Math.round(ms / 600) / 100

/** Seconds per bean, to 0.01s, or null with no beans. */
function perBean(ms: number, beans: number): number | null {
  return beans > 0 ? Math.round(ms / beans / 10) / 100 : null
}

/** Sums up the run's logs, coins and pages at wall-clock time `now`. */
export function runReport(game: Game, now: number): RunReport {
  let pickupMs = 0
  const stretches = game.stats.stretches.map((log, i) => {
    const ms = log.ms
    const total = Object.values(ms).reduce((sum, t) => sum + t, 0)
    const pickup = ms.pickup + ms.drain
    pickupMs += pickup
    return {
      stretch: game.route[i]?.name ?? String(i),
      minutes: minutes(total),
      walking: minutes(ms.walk + ms.grounded),
      pickup: minutes(pickup),
      box: minutes(ms.box),
      kiosk: minutes(ms.kiosk),
      count: minutes(ms.count),
      spilled: log.spilled,
      pickedUp: log.pickedUp,
      lost: log.lost,
      secondsPerBean: perBean(ms.pickup, log.pickedUp)
    }
  })
  const logs = game.stats.stretches
  const sum = (pick: (log: StretchLog) => number) =>
    logs.reduce((total, log) => total + pick(log), 0)
  const owned = game.shop.store.get().owned
  const status = game.gossip.status
  const played = game.stats.playedMs
  return {
    stretches,
    played: minutes(played),
    wall: minutes(now - game.stats.startedAt),
    pickupShare: played > 0 ? Math.round((pickupMs / played) * 100) / 100 : 0,
    secondsPerBean: perBean(
      sum(log => log.ms.pickup),
      sum(log => log.pickedUp)
    ),
    spilled: sum(log => log.spilled),
    pickedUp: sum(log => log.pickedUp),
    lost: sum(log => log.lost),
    coins: {
      dodges: game.stats.dodges * DODGE_COINS,
      bonuses: sum(log => log.bonus),
      pages: LINES.reduce(
        (total, line, i) => total + (status[i] === 'sold' ? line.price : 0),
        0
      ),
      spent: UPGRADES.reduce(
        (total, u) => total + (owned.includes(u.id) ? u.cost : 0),
        0
      ),
      left: game.wallet.coins()
    },
    upgrades: [...owned],
    pages: status.filter(s => s === 'found' || s === 'sold').length
  }
}

/**
 * A dev timing trial: beans spilled at once, then timed in Pickup until none lie on the
 * trial's stretch. Start one with nothing behind you, so every bean potted is a trial bean.
 */
export interface Trial {
  stretch: number
  /** The stretch's Pickup and coat hanger ms when the trial began. */
  pickupMs: number
  /** Beans potted on the stretch when the trial began. */
  pickedUp: number
}

/** What a finished trial measured. */
export interface TrialResult {
  beans: number
  /** Seconds in Pickup and the coat hanger. */
  seconds: number
  secondsPerBean: number | null
}

/** Marks where the time and the potted count stand before a trial's spill. */
export function startTrial(game: Game): Trial {
  const log = stretchLog(game)
  return {
    stretch: game.stretch,
    pickupMs: log.ms.pickup + log.ms.drain,
    pickedUp: log.pickedUp
  }
}

/** The trial's result once its stretch has no beans on the ground, else null. */
export function trialResult(game: Game, trial: Trial): TrialResult | null {
  if (behind(game.zones.list, trial.stretch) > 0) return null
  const log = game.stats.stretches[trial.stretch]
  if (!log) return null
  const ms = log.ms.pickup + log.ms.drain - trial.pickupMs
  const beans = log.pickedUp - trial.pickedUp
  return {
    beans,
    seconds: Math.round(ms / 100) / 10,
    secondsPerBean: perBean(ms, beans)
  }
}

const tenths = (n: number) => n.toFixed(1)
const perBeanText = (s: number | null) =>
  s === null ? 'no beans potted' : `${s.toFixed(2)}s a bean`

/** One line per finished trial, such as "50 beans in 72.0s, 1.44s a bean". */
export function trialText(result: TrialResult): string {
  return `${result.beans} beans in ${tenths(result.seconds)}s, ${perBeanText(result.secondsPerBean)}`
}

/** The run report as short lines of plain text that fit a phone screen, for M27's timings. */
export function reportText(
  report: RunReport,
  trials: readonly TrialResult[] = []
): string {
  const { coins } = report
  const names = report.upgrades.map(
    id => UPGRADES.find(u => u.id === id)?.name ?? id
  )
  const lines = [
    `Played ${tenths(report.played)} min, wall clock ${tenths(report.wall)} min.`,
    `Pickup ${Math.round(report.pickupShare * 100)}% of play, ${perBeanText(report.secondsPerBean)}.`,
    `Spilled ${report.spilled}, potted ${report.pickedUp}, lost ${report.lost}.`,
    `Coins: ${coins.dodges} dodges, ${coins.bonuses} bonuses, ${coins.pages} pages.`,
    `Spent ${coins.spent}, ${coins.left} left.`,
    `Upgrades: ${names.length > 0 ? names.join(', ') : 'none'}.`,
    `Gossip pages: ${report.pages}.`
  ]
  for (const s of report.stretches) {
    lines.push(
      '',
      `${s.stretch}: ${tenths(s.minutes)} min`,
      `  walk ${tenths(s.walking)}, Pickup ${tenths(s.pickup)}, box ${tenths(s.box)}`,
      `  kiosk ${tenths(s.kiosk)}, count ${tenths(s.count)}`,
      `  spilled ${s.spilled}, potted ${s.pickedUp}, lost ${s.lost}`,
      `  ${perBeanText(s.secondsPerBean)}`
    )
  }
  if (trials.length > 0)
    lines.push('', 'Timed pickups:', ...trials.map(t => `  ${trialText(t)}`))
  return lines.join('\n')
}
