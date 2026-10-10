import type { SfxName } from '../shared'
import { addCaption, type CaptionTone } from './fx'
import { groundY } from './route'
import { currentStretch, type Game } from './state'

/** Queues a sound for the runtime to play. */
export function sound(
  game: Game,
  name: SfxName,
  volume?: number,
  pitch?: number
): void {
  game.out.push({ type: 'sound', name, volume, pitch })
}

/** Extras for a caption: a running score line, and a key naming its kind. */
export interface CaptionExtra {
  score?: string
  key?: string
}

/** Shows a caption next to you in the walk view, or near the top of Pickup and the window box. */
export function caption(
  game: Game,
  text: string,
  tone: CaptionTone = 'info',
  sub = '',
  lifeMs = 2600,
  extra?: CaptionExtra
): void {
  const walk =
    game.scene !== 'pickup' && game.scene !== 'box' && game.scene !== 'count'
  addCaption(game.fx.captions, {
    text,
    sub,
    score: extra?.score ?? '',
    key: extra?.key ?? '',
    tone,
    lifeMs,
    world: walk,
    x: walk ? game.walker.x + 40 : 300,
    // Kitchen Pickup keeps its top edge for the fridge, so captions sit lower there.
    y: walk
      ? groundY(currentStretch(game), game.walker.x) - 340
      : game.scene === 'box'
        ? 96
        : game.scene === 'count'
          ? 760
          : currentStretch(game).id === 'kitchen'
            ? 190
            : 110
  })
}

/** True while a caption of this kind is on screen. */
export function showing(game: Game, key: string): boolean {
  return game.fx.captions.some(c => c.key === key)
}
