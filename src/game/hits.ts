import { caption, sound } from './effects'
import { emitBeans } from './emit'
import { dodgeLine, line, scoreDodge, scoreFamily } from './lines'
import { kickPot } from './slosh'
import type { Game } from './state'
import { DODGE_COINS, LEAN_SAVE, LID_HIT_SHARE, MAX_SHAKE } from './tuning'
import { DEG } from './units'
import { lidHeld, lidLaunch, lidOn, lidRattle } from './upgrades'

/** A telegraphed hit from a character, such as the cat's swat or a neighbour's elbow. */
export interface Hit {
  /** Cause id for the spill caption, such as 'cat'. */
  cause: string
  /** The way the hit throws the beans: 1 forward (right), -1 back (left). */
  side: number
  /** Kick to the bean surface, in rad/s. */
  kick: number
  /** Kick to the pot angle toward `side`, in degrees. */
  tilt: number
  /** Beans thrown straight out over the rim on `side`. */
  splash: number
  /**
   * True for the hardest hits, the ladder and the ambushes. Unless you lean against one,
   * it knocks the Pot Lid off and throws the full splash.
   */
  hard?: boolean
}

/** What a hit did. */
export interface HitResult {
  /** Beans the splash threw out. */
  splash: number
  /** True when you leaned against the hit, which halved it. */
  leaned: boolean
}

/** True when the pot leans at least `degrees` against a hit that throws toward `side`. */
export function leaningAgainst(
  psiTarget: number,
  side: number,
  degrees = LEAN_SAVE
): boolean {
  return psiTarget * side <= -degrees * DEG
}

/**
 * Lands a character hit on the pot. Leaning against it (raising the rim it throws
 * toward) halves the kick and the splash. The Pot Lid keeps all but LID_HIT_SHARE of the
 * splash in, unless a hard hit you didn't lean against knocks it off. Plays the thud,
 * shake and buzz, and points the kick arrow the way the beans go.
 */
export function characterHit(game: Game, hit: Hit): HitResult {
  const leaned = leaningAgainst(game.pot.psiTarget, hit.side)
  const share = leaned ? 0.5 : 1
  // A negative surface velocity heaps beans toward the front rim.
  kickPot(
    game.pot,
    -hit.side * hit.kick * share,
    hit.side * hit.tilt * DEG * share
  )
  game.lastKick = { cause: hit.cause, at: game.timeMs }
  let splash = Math.min(game.counts.pot, Math.round(hit.splash * share))
  if (splash === 0) lidRattle(game, hit.kick * share, hit.side)
  else if (lidOn(game)) {
    if (hit.hard && !leaned) lidLaunch(game, hit.side)
    else {
      splash = Math.max(1, Math.round(splash * LID_HIT_SHARE))
      lidHeld(game, splash)
    }
  }
  if (splash > 0) emitBeans(game, splash, hit.side, 30)
  const fx = game.fx
  fx.kick.side = hit.side
  fx.kick.strength = hit.kick * share
  fx.kick.ms = 900
  fx.shake = Math.max(fx.shake, MAX_SHAKE * 0.6 * share)
  fx.squash = 0.88
  sound(game, 'thud', 1, 0.6)
  game.out.push({ type: 'vibrate', ms: 30 })
  if (leaned)
    caption(game, line(game, 'leaned'), 'good', 'Half of them stayed in.')
  return { splash, leaned }
}

/**
 * You read a telegraph and dodged a hit from `cause`: pays DODGE_COINS with a `coin`
 * sound, a caption such as "Not today, cat." and the cause's running score. `reason`
 * labels the coins in the wallet history. `text` overrides the rotating dodge line.
 */
export function dodged(
  game: Game,
  cause: string,
  reason: string,
  text = dodgeLine(game, scoreFamily(cause))
): void {
  game.wallet.earn(DODGE_COINS, reason)
  game.stats.dodges++
  sound(game, 'coin', 0.7, 1.15)
  caption(game, text, 'good', `+${DODGE_COINS} coins`, 2400, {
    score: scoreDodge(game.scores, cause)
  })
}
