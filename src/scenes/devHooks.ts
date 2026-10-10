import type { Game, GameInput } from '../game/game'

/** Slots `dev.ts` fills to script and check the running game. */
interface DevHooks {
  /** A scripted player that overrides the input every step, such as a bot. */
  driver: ((input: GameInput, game: Game, dtS: number) => void) | null
  /** Runs after every update step, such as the bean ledger check. */
  afterUpdate: ((game: Game) => void) | null
  /** The latest 60 sounds, loops and buzzes played, newest last, for audits. */
  sounds: string[]
}

/**
 * Dev only. The runtime reads these behind `import.meta.env.DEV` checks, so production
 * builds drop this module.
 */
export const devHooks: DevHooks = {
  driver: null,
  afterUpdate: null,
  sounds: []
}

/** Dev only: records a sound, loop or buzz in `devHooks.sounds`. */
export function logSound(entry: string): void {
  const sounds = devHooks.sounds
  sounds.push(entry)
  if (sounds.length > 60) sounds.shift()
}
