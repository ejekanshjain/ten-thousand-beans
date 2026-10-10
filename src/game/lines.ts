import type { Rng } from '../shared'
import type { Game } from './state'

/**
 * Rotating versions of every caption that can show more than once in a run. The first
 * version is the plain one and always shows first, so the first time teaches. After that
 * each key deals its versions from a shuffled bag: every version shows once before any
 * repeats, and a new round never opens with the line that closed the last one.
 */
export class LineBook {
  private readonly bags = new Map<string, string[]>()
  private readonly last = new Map<string, string>()

  pick(key: string, lines: readonly string[], random: Rng): string {
    const first = lines[0]
    if (first === undefined)
      throw new RangeError(`LineBook: "${key}" has no lines to pick from`)
    const last = this.last.get(key)
    if (last === undefined || lines.length === 1) {
      this.last.set(key, first)
      return first
    }
    let bag = this.bags.get(key)
    if (!bag || bag.length === 0) {
      bag = shuffled(lines, random)
      // The bag deals from its end, so keep the last line shown away from there.
      if (bag[bag.length - 1] === last) bag.unshift(bag.pop() as string)
      this.bags.set(key, bag)
    }
    const line = bag.pop() as string
    this.last.set(key, line)
    return line
  }
}

function shuffled(lines: readonly string[], random: Rng): string[] {
  const out = lines.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = out[i] as string
    out[i] = out[j] as string
    out[j] = swap
  }
  return out
}

/** Recurring captions outside spills and dodges. Each has 4 to 6 versions. */
export const LINES = {
  /** A teetering pot tilted back upright. */
  saved: [
    'Saved it!',
    'Phew.',
    'Nerves of steel.',
    'Close one.',
    'Not today, floor.'
  ],
  /** A bean dropped through a drain grate, in the walk view or Pickup. */
  drain: [
    'Down the drain.',
    'Plop.',
    'Gone. For now.',
    'Glug.',
    'Into the gunk.'
  ],
  /** A bean landed in a puddle and swelled. */
  puddle: [
    'That bean is swimming now.',
    'Puddle bean.',
    'Splosh.',
    'It went for a paddle.',
    'Soggy bean.'
  ],
  /** A bean fell into the river for good. */
  river: [
    'Bye, bean.',
    'Swim, bean, swim.',
    'The river took one.',
    'Splash. Gone.',
    'Bean overboard.'
  ],
  /** A duck brought back a bean you flung into the river. */
  duck: [
    'Grandma saw that.',
    'The duck saw that too.',
    'Do not fling the beans.',
    'Returned by duck.',
    'The duck is disappointed.'
  ],
  /** The coat hanger brought a bean up. */
  fished: [
    'Got one.',
    'Slimy, but it counts.',
    'Back you come.',
    'Rescued.',
    'One less bean in the gunk.'
  ],
  /** A carried bean let go short of the pot. */
  missed: [
    'Missed the pot.',
    'Not in the pot.',
    'So near.',
    'The pot is over there.',
    'Close. Not in.'
  ],
  /** Tweezers dropped beans from shaking. */
  jerky: [
    'Too jerky.',
    'Steady, steady.',
    'Shaky tweezers.',
    'Smooth moves only.',
    'Wobbled it off.'
  ],
  /** Tweezers dropped beans from moving too fast. */
  fast: [
    'Too fast.',
    'Whoosh. Gone.',
    'Slow your hand.',
    'Speed dropped it.',
    'Easy, speedy.'
  ],
  /** A wriggling bean slipped out. */
  slippery: [
    'Butterfingers.',
    'It wriggled free.',
    'Slippery one.',
    'Greasy bean.',
    'Oops. Slippy.'
  ],
  /** The kitchen cat batted another bean under the fridge. */
  catBat: [
    'The cat strikes again.',
    'Under the fridge. Again.',
    'That cat.',
    'Batted. Smugly.',
    'The fridge eats well.'
  ],
  /** One click scattered the flock. */
  shoo: ['Shoo!', 'Scram!', 'Off you pop.', 'Go on. Shoo.', 'Flap off.'],
  /** The gate turned you back while beans wait behind you. */
  gate: [
    'Nobody leaves until every bean is back.',
    'Grandma counts every one.',
    'Go back and get them.',
    'The gate says no.',
    'Not without those beans.'
  ],
  /** Leaning against a hit halved it. */
  leaned: [
    'Leaned into it.',
    'Braced for it.',
    'Took it on the chin.',
    'Leaned like a pro.'
  ],
  /** A gust blew over with nothing spilled. */
  rode: [
    'Rode it out.',
    'Steady.',
    'Not a bean.',
    'Wind: denied.',
    'Like a lighthouse.'
  ]
} as const satisfies Record<string, readonly string[]>

export type LineKey = keyof typeof LINES

/** The next version of a recurring caption. */
export function line(game: Game, key: LineKey): string {
  return game.lines.pick(key, LINES[key], game.random.lines)
}

/**
 * Spill caption lead-ins per cause, ahead of the count: "Hurried. 14 beans.". Causes
 * missing here, such as dev spills, use their id.
 */
export const CAUSE_LINES: Record<string, readonly string[]> = {
  hurry: [
    'Hurried.',
    'Too fast.',
    'Speed kills beans.',
    'Rushed it.',
    'Slow down, champ.'
  ],
  tilt: [
    'Tilted too far.',
    'Leaned it right over.',
    'That is not level.',
    'Pot at a jaunty angle.',
    'Tilted. Bravely.'
  ],
  start: [
    'Started too fast.',
    'Off like a rocket.',
    'Jumped the start.',
    'Easy off the mark.'
  ],
  slosh: [
    'Sloshed over.',
    'The slosh won.',
    'Bean wave.',
    'It rocked. They left.'
  ],
  tip: ['Tipped it.', 'Over it goes.', 'The whole pot.', 'Pot down.'],
  test: ['Dev spill.'],
  cat: ['Cat swat.', 'The cat struck.', 'Swatted.', 'Paw to the pot.'],
  pothole: [
    'Pothole.',
    'Found a pothole.',
    'The road bit back.',
    'Pothole got you.'
  ],
  'pothole-hurry': [
    'Hurried into a pothole.',
    'Sprinted into a pothole.',
    'Pothole at full speed.',
    'Rushed a pothole.'
  ],
  kerb: ['Tripped on the kerb.', 'Kerb.', 'The kerb won.', 'Stubbed the kerb.'],
  'kerb-hurry': [
    'Hurried up the kerb.',
    'Took the kerb at speed.',
    'Rushed the kerb.',
    'Kerb at full tilt.'
  ],
  rug: [
    'Tripped on the rug.',
    'The rug got you.',
    'Rug ambush.',
    'Caught the rug.'
  ],
  'rug-hurry': [
    'Hurried over the rug.',
    'Rushed the rug.',
    'Rug at full speed.',
    'Skidded on the rug.'
  ],
  stair: ['Stairs.', 'A step too far.', 'The stairs won.', 'Clonked a step.'],
  'stair-hurry': [
    'Rushed the stairs.',
    'Bounded up the stairs.',
    'Stairs at full speed.',
    'Ran up the stairs.'
  ],
  cobbles: ['Cobbles.', 'Bumpy cobbles.', 'Cobbled.', 'Rattled by cobbles.'],
  'cobbles-hurry': [
    'Hurried over cobbles.',
    'Rushed the cobbles.',
    'Cobbles at full speed.',
    'Bounced over cobbles.'
  ],
  neighbour: [
    'Elbowed by a neighbour.',
    'Neighbourly elbow.',
    'Bumped by a nosy neighbour.',
    'Neighbour got you.'
  ],
  peek: [
    'Nosy neighbour.',
    'They pulled the rim.',
    'Peeked too hard.',
    'Nosy hands.'
  ],
  cyclist: [
    'Startled by a bike.',
    'Bike bell panic.',
    'Ding-dinged.',
    'Spooked by a cyclist.'
  ],
  shopper: [
    'Bumped by a shopper.',
    'Shopper shoulder.',
    'Excuse you.',
    'Crowd bump.'
  ],
  spoon: [
    'Poked by a tasting spoon.',
    'Spooned.',
    'Chutney ambush.',
    'Spoon to the pot.'
  ],
  ladder: [
    'Ladder to the pot.',
    'Laddered.',
    'Mind the ladder.',
    'Ladder man strikes.'
  ],
  football: [
    'Football to the pot.',
    'Headed by a football.',
    'Back of the net.',
    'The kid scored.'
  ],
  dog: ['Jumped by a dog.', 'Good boy. Bad pot.', 'Dog hug.', 'Pounced on.'],
  wet: [
    'Slipped on wet grass.',
    'Wet grass.',
    'Skidded on the grass.',
    'Whoa, then whoops.'
  ],
  gust: [
    'Blown about by a gust.',
    'Gusted.',
    'The wind took some.',
    'Windswept.'
  ],
  rain: ['Swam for it.', 'Floated off.', 'Flood escape.', 'Bean overboard.'],
  sway: [
    'The bridge swayed.',
    'Bridge wobble.',
    'Swayed off.',
    'The bridge did that.'
  ],
  doorstep: [
    "Jumped by Grandma's dog.",
    'So close.',
    "Grandma's dog strikes.",
    'On the doorstep. Really.'
  ],
  pryce: [
    'Grabbed by Mrs Pryce.',
    'Mrs Pryce had a rummage.',
    'Inspected by Mrs Pryce.',
    'Pryced.'
  ],
  sale: [
    'Trampled by a sale.',
    'Bargain hunters.',
    'Stampeded.',
    'Everything must go.'
  ],
  bruno: [
    'Bruno said hello.',
    'Flattened by Bruno.',
    'Great Dane, great splash.',
    'Bruno: very good boy.'
  ]
}

/** The next lead-in for a spill caused by `cause`. */
export function causeLine(game: Game, cause: string): string {
  const lines = CAUSE_LINES[cause] ?? [`${cause}.`]
  return game.lines.pick(`cause:${cause}`, lines, game.random.lines)
}

/** Dodge captions per cause family, for telegraphed hits you read in time. */
export const DODGE_LINES: Record<string, readonly string[]> = {
  cat: [
    'Not today, cat.',
    'Outfoxed the cat.',
    'Cat: foiled.',
    'Too slow, whiskers.',
    'The cat saw nothing.'
  ],
  cyclist: [
    'Not today, cyclist.',
    'Ding ding yourself.',
    'Saw that coming.',
    'Bell? What bell?',
    'Ride on, Lycra.'
  ],
  spoon: [
    'No chutney, thanks.',
    'Not today, spoon.',
    'Keep your chutney.',
    'Spoon dodged.',
    'The pot says no.'
  ],
  ladder: [
    'Not today, ladder man.',
    'Ducked the ladder.',
    'Timed it.',
    'Swung and missed.',
    'Mind your own back.'
  ],
  shopper: [
    'Not today, shoppers.',
    'After you.',
    'Let them pass.',
    'Polite and level.',
    'Queue respected.'
  ],
  football: [
    'Not today, kid.',
    'Saw it coming.',
    'The kid missed.',
    'Wide of the pot.',
    'Not in my pot.'
  ],
  dog: [
    'Good dog.',
    'Sit. Good.',
    'Who is a good boy?',
    'Stay. Good.',
    'Sat nicely.'
  ],
  wet: [
    'Saved it!',
    'Steady on the grass.',
    'Did not slip.',
    'Graceful. Ish.',
    'Feet of a dancer.'
  ],
  pryce: [
    'Outran Mrs Pryce.',
    'Not today, Mrs Pryce.',
    'Too quick for her.',
    'Nothing to see here.',
    'She saw nothing.'
  ],
  sale: [
    'Beat the rush.',
    'Not today, bargains.',
    'Outran the sale.',
    'First out of the shop.',
    'Sale dodged.'
  ],
  bruno: [
    'Out of reach, Bruno.',
    'Not today, Bruno.',
    'His lead says no.',
    'Outran a Great Dane.',
    'Good boy. Stay.'
  ]
}

/** The next dodge line for a cause family. */
export function dodgeLine(game: Game, family: string): string {
  const lines = DODGE_LINES[family] ?? ['Dodged it.']
  return game.lines.pick(`dodge:${family}`, lines, game.random.lines)
}

/** Who scores when a cause gets you, for "Ladder: 2. You: 0.". */
export const SCORE_NAMES: Record<string, string> = {
  hurry: 'Your legs',
  tilt: 'Your wrists',
  slosh: 'Physics',
  tip: 'Floor',
  cat: 'Cat',
  pothole: 'Potholes',
  kerb: 'Kerbs',
  rug: 'Rug',
  stair: 'Stairs',
  cobbles: 'Cobbles',
  neighbour: 'Neighbours',
  cyclist: 'Bikes',
  shopper: 'Shoppers',
  spoon: 'Spoons',
  ladder: 'Ladder',
  football: 'Kid',
  dog: 'Dogs',
  wet: 'Wet grass',
  gust: 'Wind',
  rain: 'Rain',
  sway: 'Bridge',
  doorstep: "Grandma's dog",
  pryce: 'Mrs Pryce',
  sale: 'The sale',
  bruno: 'Bruno'
}

/** Causes that share a score with another: a hurried pothole is still a pothole. */
const FAMILY: Record<string, string> = { start: 'hurry', peek: 'neighbour' }

/** The score a cause counts toward, such as 'pothole' for 'pothole-hurry'. */
export function scoreFamily(cause: string): string {
  const base = cause.endsWith('-hurry') ? cause.slice(0, -6) : cause
  return FAMILY[base] ?? base
}

/** One cause's running score: its hits against your dodges. */
export interface Score {
  them: number
  you: number
}

/** Every cause's running score this run. */
export type Scores = Map<string, Score>

function scoreFor(scores: Scores, family: string): Score {
  let score = scores.get(family)
  if (!score) {
    score = { them: 0, you: 0 }
    scores.set(family, score)
  }
  return score
}

/** "Ladder: 2. You: 0.", or '' for a cause with no scoreboard. */
export function scoreText(scores: Scores, family: string): string {
  const name = SCORE_NAMES[family]
  if (!name) return ''
  const score = scoreFor(scores, family)
  return `${name}: ${score.them}. You: ${score.you}.`
}

/** A spill caused by `cause` scores against you. Returns the new score line. */
export function scoreHit(scores: Scores, cause: string): string {
  const family = scoreFamily(cause)
  if (!SCORE_NAMES[family]) return ''
  scoreFor(scores, family).them++
  return scoreText(scores, family)
}

/** You dodged a hit from `cause`, or saved the pot from it. Returns the new score line. */
export function scoreDodge(scores: Scores, cause: string): string {
  const family = scoreFamily(cause)
  if (!SCORE_NAMES[family]) return ''
  scoreFor(scores, family).you++
  return scoreText(scores, family)
}
