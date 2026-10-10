/** Degrees to radians. */
export const DEG = Math.PI / 180

/** Matter.js measures velocity per 60 Hz base step, not per second. */
const MATTER_STEPS_PER_SECOND = 60

/** Converts a speed in u/s to Matter's per-step velocity. */
export function toMatterSpeed(unitsPerSecond: number): number {
  return unitsPerSecond / MATTER_STEPS_PER_SECOND
}

/** Converts Matter's per-step velocity to u/s. */
export function fromMatterSpeed(perStep: number): number {
  return perStep * MATTER_STEPS_PER_SECOND
}

/** Formats a bean count with thousands separators, such as "9,874". */
export function formatBeans(n: number): string {
  return n.toLocaleString('en-GB')
}
