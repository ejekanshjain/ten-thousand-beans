import { caption, showing, sound } from './effects'
import { line } from './lines'
import { recordLost } from './packets'
import { currentStretch, type Game } from './state'
import { BRIDGE_SLIDE_SPEED, GAP_SLOW_SPEED, SLIDE_ROLL } from './tuning'
import { DEG } from './units'
import { deckRoll } from './weather'

/**
 * One step of rope bridge Pickup: the deck's roll slides every free bean toward one edge
 * then the other, beans past an edge or slow over a plank gap fall in the river for good,
 * and beans you flung in come back on a duck's head.
 */
export function updateBridgePickup(game: Game, simMs: number): void {
  const world = game.pickup.world
  if (!world?.deck) return
  world.slide.x =
    (BRIDGE_SLIDE_SPEED * deckRoll(game.timeMs)) / (SLIDE_ROLL * DEG)
  const result = world.river(GAP_SLOW_SPEED, simMs)
  if (result.lost > 0) {
    recordLost(game, result.lost, 'river')
    sound(game, 'splash', 0.5, 1.2 + game.random.fx() * 0.3)
    if (world.clear)
      caption(game, 'All clear.', 'good', 'The river helped. Sort of.', 3000)
    else if (!showing(game, 'river')) {
      caption(
        game,
        line(game, 'river'),
        'bad',
        game.taught.river
          ? ''
          : "River beans are gone. They're seed packets now.",
        game.taught.river ? 1600 : 3200,
        { key: 'river' }
      )
      game.taught.river = true
    }
  }
  if (result.ducked > 0) {
    sound(game, 'splash', 0.4, 1.4)
    sound(game, 'squish', 0.5, 1.9)
  }
  if (result.returned > 0) {
    sound(game, 'pop', 0.6, 1.3)
    const told = game.taught.duck
    game.taught.duck = true
    caption(
      game,
      line(game, 'duck'),
      'info',
      told ? '' : 'A duck brought it back. Flung beans get one chance.',
      told ? 1800 : 3200
    )
  }
}

/** The next-step hint in bridge Pickup, or null elsewhere. */
export function bridgePrompt(game: Game, touch: boolean): string | null {
  if (game.scene !== 'pickup' || !currentStretch(game).deck) return null
  if (game.pickup.world?.clear) return null
  return touch
    ? 'The deck sways. Save the beans near the edges first.'
    : 'The deck sways. Drag the beans near the edges in first.'
}
