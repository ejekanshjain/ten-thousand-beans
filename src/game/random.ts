import { hash01, rng, type Rng } from '../shared'

/** One random stream per system, so a new random call in one system doesn't shift the others. */
export const STREAMS = {
  spill: 1,
  zones: 2,
  pickup: 3,
  fx: 4,
  events: 5,
  critters: 6,
  net: 7,
  weather: 8,
  lines: 9
} as const

export type StreamName = keyof typeof STREAMS

/** A seeded random source for one system, derived from the run seed. */
export function stream(seed: number, name: StreamName): Rng {
  return rng(Math.floor(hash01(seed, STREAMS[name]) * 2 ** 32))
}

/** Every system's random stream for one run. */
export type Streams = Record<StreamName, Rng>

export function createStreams(seed: number): Streams {
  const out = {} as Streams
  for (const name of Object.keys(STREAMS) as StreamName[])
    out[name] = stream(seed, name)
  return out
}
