import type { Game } from './state'
import {
  REPLAY_AUTO_MIN,
  REPLAY_MIN,
  REPLAY_SETTLE_MS,
  REPLAY_SHARE_MIN
} from './tuning'
import { formatBeans } from './units'

/** A spill worth replaying. The runtime cuts the clip when the game asks for it. */
export interface ReplayRequest {
  id: number
  /** The big caption over the clip, such as "47 beans in 0.4s". */
  label: string
  /** Who to blame, and Grandma's reaction. */
  blame: string
  count: number
  cause: string
  /** True when the replay opens by itself: a tip-over, or a new biggest spill. */
  auto: boolean
  /** True when it offers Share: 100 beans or more, or a tip-over. */
  share: boolean
  /** True when no earlier spill was this big, so its still can go on the ending card. */
  biggest: boolean
}

/** A finished spill waiting for its beans to land before its clip is cut. */
export interface ReplayState {
  pending: ReplayRequest | null
  /** Real ms since the last flying bean landed. */
  settleMs: number
  nextId: number
}

export function createReplays(): ReplayState {
  return { pending: null, settleMs: 0, nextId: 1 }
}

/** What a finished spill event tells the replay. */
export interface SpillReplay {
  count: number
  cause: string
  durationMs: number
  /** The caption's lead-in naming the cause, such as "Hurried.". */
  lead: string
  /** Grandma's reaction line, shown under the clip. */
  grandma: string
  /** The biggest spill before this one. */
  previousBiggest: number
}

/** True for causes that tip the whole pot over. */
export function isTip(cause: string): boolean {
  return cause === 'tip' || cause === 'doorstep'
}

/** Run time as "1:02:41", or "4:05" under an hour. */
export function formatRunTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** The big caption for a spill's replay. */
export function replayLabel(
  game: Game,
  count: number,
  cause: string,
  durationMs: number
): string {
  if (cause === 'doorstep')
    return `Carried for ${formatRunTime(game.stats.playedMs)}. So close.`
  if (durationMs < 100) return `${formatBeans(count)} beans at once.`
  return `${formatBeans(count)} beans in ${(durationMs / 1000).toFixed(1)}s`
}

/**
 * A spill event ended: queue its replay, cut once its beans have landed. Spills under
 * REPLAY_MIN beans get none. A replay still waiting merges into this one, keeping the
 * bigger spill's caption and every reason to open or share.
 */
export function queueReplay(game: Game, spill: SpillReplay): void {
  const { count, cause } = spill
  const tip = isTip(cause)
  if (count < REPLAY_MIN && !tip) return
  const replays = game.replays
  const biggest = count > spill.previousBiggest
  const next: ReplayRequest = {
    id: replays.nextId++,
    label: replayLabel(game, count, cause, spill.durationMs),
    blame: `${spill.lead} ${spill.grandma}`,
    count,
    cause,
    auto: tip || (biggest && count >= REPLAY_AUTO_MIN),
    share: tip || count >= REPLAY_SHARE_MIN,
    biggest
  }
  const old = replays.pending
  const keep = old && (old.count >= count || isTip(old.cause)) ? old : next
  replays.pending = {
    ...keep,
    id: next.id,
    auto: next.auto || (old?.auto ?? false),
    share: next.share || (old?.share ?? false),
    biggest: next.biggest || (old?.biggest ?? false)
  }
  replays.settleMs = 0
}

/**
 * Asks the runtime to cut the waiting clip REPLAY_SETTLE_MS after the last flying bean
 * lands, or at once when you leave the walk view. Call every step with real ms.
 */
export function stepReplay(game: Game, dtMs: number): void {
  const replays = game.replays
  const pending = replays.pending
  if (!pending) return
  const walking = game.scene === 'walk' || game.scene === 'grounded'
  if (walking && game.fx.particles.alive > 0) {
    replays.settleMs = 0
    return
  }
  replays.settleMs += dtMs
  if (walking && replays.settleMs < REPLAY_SETTLE_MS) return
  game.out.push({ type: 'replay', replay: pending })
  replays.pending = null
}
