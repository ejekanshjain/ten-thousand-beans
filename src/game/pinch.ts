import { PINCH_CLOSE_PX, PINCH_CLOSE_SHARE, PINCH_TIP_LIFT_PX } from './tuning'

/**
 * True when a two-finger pinch has closed enough to grab: under PINCH_CLOSE_SHARE of the
 * distance it started at, or under PINCH_CLOSE_PX. Gaps are CSS px, so the rule means the
 * same on every screen size.
 */
export function pinchGrabs(gapPx: number, startGapPx: number): boolean {
  return gapPx < PINCH_CLOSE_PX || gapPx < startGapPx * PINCH_CLOSE_SHARE
}

/** The tweezer tip's y for a pinch centred at `centerY`, at `scale` CSS px per u. */
export function pinchTipY(centerY: number, scale: number): number {
  return centerY - PINCH_TIP_LIFT_PX / Math.max(0.01, scale)
}

/** How open the drawn tweezers are, from 0 (closed) to 1 (as wide as the pinch started). */
export function pinchOpening(gapPx: number, startGapPx: number): number {
  if (startGapPx <= 0) return 0
  return Math.max(0, Math.min(1, (gapPx - PINCH_CLOSE_PX * 0.6) / startGapPx))
}
