import type { ReplayRequest } from '../game/replays'
import { REPLAY_FPS, REPLAY_H, REPLAY_SECONDS, REPLAY_W } from '../game/tuning'
import {
  createStore,
  ReplayRecorder,
  type CropRect,
  type ReplayClip,
  type Viewport
} from '../shared'

/** A cut replay: the clip, what it shows, and where it happened. */
export interface ReplayShot extends ReplayRequest {
  clip: ReplayClip
  /** Title Case name of the stretch it happened on. */
  stretch: string
  /** Beans left in the pot after it. */
  pot: number
}

export interface FilmSnapshot {
  /** The latest replay. Only the latest is kept: the next cut records over its frames. */
  shot: ReplayShot | null
  /** True while the replay dialog shows it, which pauses the game. */
  open: boolean
  /** Id of the latest replay opened, so its corner chip stops offering it. */
  seen: number
}

/** What React shows of the replays. */
export const film = createStore<FilmSnapshot>({
  shot: null,
  open: false,
  seen: 0
})

/** Opens the latest replay's dialog. */
export function openReplay(): void {
  film.set(s => (s.shot ? { open: true, seen: s.shot.id } : {}))
}

/** Closes the replay dialog, and the game carries on. */
export function closeReplay(): void {
  film.set({ open: false })
}

/** The best still is kept at this size, for the ending's share card. */
const BEST_W = 480
const BEST_H = 640

/**
 * Records the design area of the walk view for fail replays, and cuts clips when the
 * game asks. The shared recorder keeps two frame sets at most, so memory stays flat
 * however many spills a run has. It also keeps a copy of the biggest spill's still.
 */
export class Film {
  private readonly recorder = new ReplayRecorder({
    seconds: REPLAY_SECONDS,
    fps: REPLAY_FPS,
    width: REPLAY_W,
    height: REPLAY_H
  })
  private crop: CropRect
  private readonly unsubscribe: () => void
  /** The biggest spill's picture, or null before any spill worth a replay. */
  best: HTMLCanvasElement | null = null

  constructor(private readonly viewport: Viewport) {
    this.crop = viewport.designRect()
    this.unsubscribe = viewport.onResize(() => {
      this.crop = viewport.designRect()
      // Frames from before the resize would play squashed next to new ones.
      this.recorder.reset()
    })
  }

  /** Records a frame of the canvas if one is due. Call from render, after drawing. */
  capture(timeMs: number): void {
    this.recorder.capture(this.viewport.ctx.canvas, this.crop, timeMs)
  }

  /** Forgets every frame, such as on a new stretch. */
  reset(): void {
    this.recorder.reset()
  }

  /** Cuts the last seconds into a replay and publishes it, opening it when it asks to. */
  cut(request: ReplayRequest, stretch: string, pot: number): void {
    const clip = this.recorder.clip()
    if (!clip) return
    if (request.biggest && clip.still) this.keepBest(clip.still)
    film.set(s => ({
      shot: { ...request, clip, stretch, pot },
      open: request.auto,
      seen: request.auto ? request.id : s.seen
    }))
  }

  private keepBest(still: HTMLCanvasElement): void {
    const best = (this.best ??= document.createElement('canvas'))
    best.width = BEST_W
    best.height = BEST_H
    best.getContext('2d')?.drawImage(still, 0, 0, BEST_W, BEST_H)
  }

  dispose(): void {
    this.unsubscribe()
    film.set({ shot: null, open: false, seen: 0 })
  }
}
