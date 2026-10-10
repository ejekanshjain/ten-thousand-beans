import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import {
  CAUSE_LINES,
  DODGE_LINES,
  LineBook,
  LINES,
  SCORE_NAMES,
  scoreDodge,
  scoreFamily,
  scoreHit,
  type Scores
} from './lines'
import { GRANDMA_LINES } from './spill'
import { simulate, testGame } from './testing'

const words = (text: string) => text.split(/\s+/).filter(Boolean).length

describe('rotating captions', () => {
  it('show the plain version first, then every version once per round, never twice in a row', () => {
    const book = new LineBook()
    const lines = ['a', 'b', 'c', 'd', 'e']
    const random = rng(7)
    expect(book.pick('k', lines, random)).toBe('a')
    let last = 'a'
    for (let round = 0; round < 40; round++) {
      const seen = new Set<string>()
      for (let i = 0; i < lines.length; i++) {
        const line = book.pick('k', lines, random)
        expect(line).not.toBe(last)
        seen.add(line)
        last = line
      }
      expect(seen.size).toBe(lines.length)
    }
  })

  it('have 4 to 6 short, distinct versions for every recurring caption', () => {
    const sets: [string, readonly string[], number][] = [
      ...Object.entries(LINES).map(
        ([k, v]) => [k, v, 0] as [string, readonly string[], number]
      ),
      // A lead-in is followed by "14 beans.".
      ...Object.entries(CAUSE_LINES)
        .filter(([k]) => k !== 'test')
        .map(([k, v]) => [k, v, 2] as [string, readonly string[], number]),
      ...Object.entries(DODGE_LINES).map(
        ([k, v]) => [k, v, 0] as [string, readonly string[], number]
      ),
      ...Object.entries(GRANDMA_LINES).map(
        ([k, v]) => [k, v, 0] as [string, readonly string[], number]
      )
    ]
    for (const [key, lines, extra] of sets) {
      expect(lines.length, key).toBeGreaterThanOrEqual(4)
      expect(lines.length, key).toBeLessThanOrEqual(6)
      expect(new Set(lines).size, key).toBe(lines.length)
      for (const line of lines)
        expect(words(line) + extra, line).toBeLessThan(8)
    }
  })
})

describe('running scores', () => {
  it('group causes into families with a name each', () => {
    expect(scoreFamily('pothole-hurry')).toBe('pothole')
    expect(scoreFamily('peek')).toBe('neighbour')
    expect(scoreFamily('start')).toBe('hurry')
    for (const cause of Object.keys(CAUSE_LINES))
      if (cause !== 'test')
        expect(SCORE_NAMES[scoreFamily(cause)], cause).toBeTruthy()
  })

  it('count hits against dodges per family', () => {
    const scores: Scores = new Map()
    expect(scoreHit(scores, 'ladder')).toBe('Ladder: 1. You: 0.')
    expect(scoreDodge(scores, 'ladder')).toBe('Ladder: 1. You: 1.')
    expect(scoreHit(scores, 'pothole')).toBe('Potholes: 1. You: 0.')
    expect(scoreHit(scores, 'pothole-hurry')).toBe('Potholes: 2. You: 0.')
    expect(scoreHit(scores, 'test')).toBe('')
  })

  it('ride under each spill caption, whose lead-in rotates', () => {
    const game = testGame()
    const heads: string[] = []
    for (let i = 0; i < 2; i++) {
      simulate(game, 1, input => void (input.tilt.rate = 1))
      // Held keys speed up to 75°/s, so about half a second brings 40° back near level.
      simulate(game, 0.55, input => void (input.tilt.rate = -1))
      simulate(game, 2)
      const spill = game.fx.captions.find(c =>
        c.score.startsWith('Your wrists')
      )
      expect(spill?.score).toBe(`Your wrists: ${i + 1}. You: 0.`)
      heads.push(spill!.text.replace(/ \d+ beans?\.$/, ''))
    }
    expect(heads[0]).toBe('Tilted too far.')
    expect(heads[1]).not.toBe(heads[0])
  })
})
