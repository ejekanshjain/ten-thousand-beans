import { createGame, updateGame, type Game, type GameInput } from './game'
import { TEST_ROUTE, type StretchDef } from './route'

/** Fixed step used by the game loop. */
export const STEP_MS = 1000 / 60

/** A blank input: standing still, no tilt, pointer at rest. */
export function idleInput(): GameInput {
  return {
    walk: { walk: 0, hurry: 0 },
    tilt: { rate: 0, absolute: null },
    pointer: { x: 0, y: 0, vx: 0, vy: 0, down: false }
  }
}

/**
 * Runs the game for `seconds` of real time, calling `drive` before each step to set the
 * input. Returns the beans that left the pot. Test helper only.
 */
export function simulate(
  game: Game,
  seconds: number,
  drive: (input: GameInput, game: Game) => void = () => {}
): number {
  const input = idleInput()
  const start = game.counts.pot
  const steps = Math.round((seconds * 1000) / STEP_MS)
  for (let i = 0; i < steps; i++) {
    drive(input, game)
    updateGame(game, STEP_MS, input)
    game.out.length = 0
  }
  return start - game.counts.pot
}

/** A fresh game for a test, on a flat 4,000 u test street unless given a route. */
export function testGame(
  seed = 1,
  route: readonly StretchDef[] = TEST_ROUTE
): Game {
  return createGame(seed, route)
}
