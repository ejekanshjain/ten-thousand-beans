import { HoldCharge } from '../shared'
import { beansNeeded } from './gossipFont'
import type { StretchDef } from './route'
import {
  JOT_MS,
  PAGE_PRICE_BASE,
  PAGE_PRICE_STEP,
  SECRET_CURVE
} from './tuning'

/** One piece of town gossip, as spilled beans spell it. */
export interface GossipLine {
  text: string
  /** 1 is the funniest. Funnier lines sell for more. */
  rank: number
  /** Coins the Weekly Whisper pays: PAGE_PRICE_BASE + PAGE_PRICE_STEP * (13 - rank). */
  price: number
  /** Beans the stroke font needs to spell it. */
  need: number
  /** What the Weekly Whisper's editor says when he buys it. */
  quip: string
}

const TEXTS: readonly [string, number, string][] = [
  ['THE CAT KNOWS', 10, "Everyone suspected. Now it's news."],
  ['MAYOR WEARS A WIG', 9, 'I knew it. Front page.'],
  ['CHOIR MIMES', 1, 'The whole choir? Scandal!'],
  ['VICAR CHEATS AT BINGO', 4, "Ooh, the vicar. I'll take it."],
  ["LIFEGUARD CAN'T SWIM", 2, 'That explains the armbands.'],
  ['MILKMAN HATES MILK', 11, "Well, that's just sad."],
  ['BAKER BUYS BREAD', 7, 'Shocking. Utterly shocking.'],
  ['BUTCHER IS VEGAN', 3, 'Hold the front page!'],
  ['POSTMAN FEARS SNAILS', 8, 'Slow news. I love it.'],
  ['DR LUND SINGS TO LEEKS', 6, 'Do the leeks like it?'],
  ['WEATHERMAN GUESSES', 5, "We all knew. Now it's official."],
  ['JUDGE LOVES CATS', 12, "Mild. I'll take it anyway."]
]

/**
 * The twelve lines, in the order they trigger. The first belongs to the kitchen, and
 * later stretches spell it only after every other line.
 */
export const LINES: readonly GossipLine[] = TEXTS.map(([text, rank, quip]) => ({
  text,
  rank,
  price: PAGE_PRICE_BASE + PAGE_PRICE_STEP * (13 - rank),
  need: beansNeeded(text),
  quip
}))

/** Grandma's own secret, revealed a few letters per page found. */
export const SECRET = 'GRANDMA TRAINED THE DOG'

/**
 * The order the secret's letters appear, as indexes into its letters (spaces skipped).
 * Consonants of GRANDMA, THE and DOG come first, so 3 pages read
 * "GR_NDM_ _______ TH_ D_G", then TRAINED fills in.
 */
export const SECRET_ORDER: readonly number[] = [
  0, 1, 3, 4, 5, 14, 15, 17, 19, 7, 8, 11, 13, 12, 16, 2, 6, 9, 10, 18
]

/** Where a line stands in the run. */
export type LineStatus = 'waiting' | 'shown' | 'found' | 'sold'

/** A line spelled out on the ground in Pickup. */
export interface Spelling {
  line: number
  zoneId: number
  /** 'shown' until you jot it down; then the beans are ordinary beans again. */
  phase: 'shown' | 'jotted'
  /** The first gossip of the run blocks every grab until you jot it. */
  locked: boolean
  /** True once a touch on the letters has warned you. The next grab scrambles them. */
  warned: boolean
  /** Real ms left of the letters' warning wiggle. */
  wiggleMs: number
}

export interface GossipState {
  status: LineStatus[]
  /** Lines started so far. Each takes one slot. */
  started: number
  spelling: Spelling | null
  /** Jot It Down: a 2s hold. */
  jot: HoldCharge
  /** True while J or the Jot It Down button is held. */
  jotHeld: boolean
  /** Real ms since the pencil last scratched, for the jot sound. */
  scratchMs: number
}

export function createGossip(): GossipState {
  return {
    status: LINES.map(() => 'waiting'),
    started: 0,
    spelling: null,
    jot: new HoldCharge({ fillMs: JOT_MS }),
    jotHeld: false,
    scratchMs: 0
  }
}

/**
 * Gossip slots still open on stretch `index`: every stretch so far adds its slots, and
 * each started line uses one. The last stretch has none, so leftovers end at the bridge.
 */
export function slotsOpen(
  route: readonly StretchDef[],
  index: number,
  started: number
): number {
  const here = route[index]
  if (!here || here.gossipSlots === 0) return 0
  let slots = 0
  for (let i = 0; i <= index; i++) slots += route[i]?.gossipSlots ?? 0
  return Math.max(0, slots - started)
}

/**
 * The line a zone with `available` free beans would spell on stretch `stretchId`: the
 * kitchen only ever spells the first line, and everywhere else takes the first waiting
 * line that fits. A kitchen line you missed comes last, so a careful run can still find
 * all twelve. Returns -1 when none fits.
 */
export function chooseLine(
  status: readonly LineStatus[],
  stretchId: string,
  available: number
): number {
  const fits = (i: number) =>
    status[i] === 'waiting' && (LINES[i]?.need ?? Infinity) <= available
  if (stretchId === 'kitchen') return fits(0) ? 0 : -1
  for (let i = 1; i < LINES.length; i++) if (fits(i)) return i
  return fits(0) ? 0 : -1
}

/** Pages found so far: jotted lines, sold or not. */
export function pagesFound(status: readonly LineStatus[]): number {
  let n = 0
  for (const s of status) if (s === 'found' || s === 'sold') n++
  return n
}

/** The funniest line you found, or null with no pages. Rank 1 is the funniest. */
export function funniestLine(status: readonly LineStatus[]): string | null {
  let best: GossipLine | null = null
  for (let i = 0; i < LINES.length; i++) {
    const line = LINES[i]!
    const found = status[i] === 'found' || status[i] === 'sold'
    if (found && (!best || line.rank < best.rank)) best = line
  }
  return best?.text ?? null
}

/**
 * How many of the secret's 20 letters `pages` pages reveal. The first pages reveal the
 * most, so the 3 an average run finds read "GR_NDM_ _______ TH_ D_G", and only all 12
 * spell the whole secret.
 */
export function lettersRevealed(pages: number): number {
  const share = Math.min(1, Math.max(0, pages / LINES.length))
  return Math.round(20 * share ** SECRET_CURVE)
}

/** The secret with only the revealed letters, hangman style: "GR_NDM_ TR__NED ...". */
export function secretShown(pages: number): string {
  const shown = new Set(SECRET_ORDER.slice(0, lettersRevealed(pages)))
  let index = 0
  let out = ''
  for (const ch of SECRET) {
    if (ch === ' ') {
      out += ' '
      continue
    }
    out += shown.has(index) ? ch : '_'
    index++
  }
  return out
}
