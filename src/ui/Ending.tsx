import { useState, type ReactNode } from 'react'

import {
  funniestLine,
  LINES,
  lettersRevealed,
  pagesFound,
  secretShown
} from '../game/gossip'
import { hud } from '../game/hud'
import { formatRunTime } from '../game/replays'
import { CLEAN_FULL } from '../game/tuning'
import { formatBeans } from '../game/units'
import type { Runtime } from '../scenes/runtime'
import {
  EndingScreen,
  useStore,
  type ShareCardInput,
  type ShareStat
} from '../shared'

/** What the ending shows, worked out once when it opens. */
interface EndingFacts {
  stats: ShareStat[]
  card: ShareCardInput
  text: string
  secret: string
  pages: number
}

function endingFacts(runtime: Runtime): EndingFacts {
  const game = runtime.game
  const stats = game.stats
  const time = formatRunTime(stats.playedMs)
  const pages = pagesFound(game.gossip.status)
  const funniest = funniestLine(game.gossip.status)
  const secret = secretShown(pages)
  const cardStats: ShareStat[] = [
    { label: 'Picked Up', value: formatBeans(stats.pickedUp) },
    { label: 'Lost for Good', value: formatBeans(stats.lost) },
    { label: 'Time', value: time },
    { label: 'Gossip', value: `${pages} of ${LINES.length}` }
  ]
  // A stretch counts as clean when it paid the full clean bonus.
  const clean = stats.stretches.filter(log => log.spilled <= CLEAN_FULL).length
  return {
    stats: [
      ...cardStats,
      { label: 'Biggest Spill', value: formatBeans(stats.biggestSpill) },
      {
        label: 'Clean Stretches',
        value: `${clean} of ${game.route.length}`
      },
      { label: 'Coins', value: formatBeans(game.wallet.coins()) }
    ],
    card: {
      game: '10,000 Beans',
      title: 'Grandma Got Her 10,000',
      stats: cardStats,
      image: runtime.film.best ?? undefined,
      footer: funniest
        ? `Town gossip: ${funniest}`
        : `Grandma's secret: ${secret}`
    },
    text: `I carried 10,000 beans to Grandma's in ${time} and picked up ${formatBeans(stats.pickedUp)} by hand. #10000Beans`,
    secret,
    pages
  }
}

/** How much of Grandma's secret your gossip pages showed. */
function secretLine(pages: number, letters: number): string {
  if (letters === 20) return 'Every gossip page found. Now you know her secret.'
  if (pages === 0) return 'No gossip pages, so her secret stays a mystery.'
  const noun = pages === 1 ? 'page' : 'pages'
  return `Your ${pages} gossip ${noun} showed ${letters} of her secret's 20 letters.`
}

/**
 * The ending screen, once Grandma's secret is spelled out over her stew. Dev builds pass
 * `extra`, the run report, which shows under the secret.
 */
export function Ending({
  runtime,
  extra
}: {
  runtime: Runtime
  extra?: ReactNode
}) {
  const ending = useStore(hud, s => s.ending)
  if (!ending) return null
  return <EndingDialog runtime={runtime} extra={extra} />
}

function EndingDialog({
  runtime,
  extra
}: {
  runtime: Runtime
  extra?: ReactNode
}) {
  // Worked out once, so the time stops when the dialog opens.
  const [facts] = useState(() => endingFacts(runtime))
  const letters = lettersRevealed(facts.pages)
  return (
    <EndingScreen
      title="Ten Thousand."
      stats={facts.stats}
      share={{ card: facts.card, text: facts.text, title: 'Brag About It' }}
    >
      <p>
        Grandma counted every bean. She found the last one under her doormat,
        then added salt.
      </p>
      <p className="my-3 font-marker text-2xl tracking-widest break-words text-marker-purple">
        {facts.secret}
      </p>
      <p>{secretLine(facts.pages, letters)}</p>
      {extra}
    </EndingScreen>
  )
}
