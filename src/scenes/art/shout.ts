import { settings } from '../../shared'

/**
 * A character's shout size this frame, such as "WOOF!" or "DING!": it bounces like a
 * cartoon yell, and holds still under Reduced Motion.
 */
export function shoutSize(base: number, timeMs: number): number {
  if (settings.get().reducedMotion) return base
  return base * (1 + 0.16 * Math.abs(Math.sin(timeMs / 70)))
}
