import type { KioskSummary } from '../game/kiosk'
import { hud } from '../game/hud'
import { CLEAN_FULL, CLEAN_HALF } from '../game/tuning'
import { formatBeans } from '../game/units'
import { pastItsUse } from '../game/upgrades'
import type { Runtime } from '../scenes/runtime'
import {
  Button,
  ChoreList,
  CoinIcon,
  Panel,
  ShopPanel,
  useStore
} from '../shared'

/** One sentence on the clean bonus: what paid, or what it would take next time. */
function bonusLine(kiosk: KioskSummary): string {
  const spilled = `${formatBeans(kiosk.spilled)} ${kiosk.spilled === 1 ? 'bean' : 'beans'}`
  if (kiosk.full === 0) return ''
  if (kiosk.bonus === kiosk.full)
    return `Clean stretch bonus: ${kiosk.bonus} coins for spilling ${spilled}.`
  if (kiosk.bonus > 0)
    return `Half bonus: ${kiosk.bonus} coins for spilling ${spilled}. Spill ${CLEAN_FULL} or fewer for ${kiosk.full}.`
  return `You spilled ${spilled}, so no clean bonus. Spill ${CLEAN_HALF} or fewer for half of ${kiosk.full} coins.`
}

/**
 * The Weekly Whisper kiosk between stretches: how clean the last stretch was, your
 * unsold gossip with a Sell button each, the shop, and any chore that holds you here.
 * It covers the lower part of the canvas cell; the kiosk drawing sits above it.
 */
export function KioskPanel({ runtime }: { runtime: Runtime }) {
  const kiosk = useStore(hud, s => s.kiosk)
  const pages = useStore(hud, s => s.pages)
  if (!kiosk) return null
  const unsold = pages.filter(page => !page.sold)
  const shop = runtime.game.shop
  return (
    <div
      aria-label="Newspaper kiosk"
      className="pointer-events-auto absolute inset-x-0 top-[40%] bottom-0 flex touch-pan-y flex-col gap-3 overflow-y-auto overscroll-contain border-t-[3px] border-ink bg-paper/95 p-3"
    >
      <section className="flex flex-col gap-1">
        <h2 className="font-marker text-2xl leading-tight">
          The Weekly Whisper
        </h2>
        <p className="font-hand text-lg leading-snug text-ink">
          {kiosk.cleared} is clear. Next up: {kiosk.next}.
        </p>
        <p
          className={`font-hand text-lg leading-snug ${kiosk.bonus > 0 ? 'text-marker-green' : 'text-ink-soft'}`}
        >
          {bonusLine(kiosk)}
        </p>
      </section>
      <Panel title="Sell Gossip" className="p-3">
        {unsold.length === 0 ? (
          <p className="font-hand text-lg text-ink-soft">
            No pages to sell. Big spills spell out gossip.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unsold.map(page => (
              <li
                key={page.line}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="font-marker text-lg leading-tight">
                  {page.text}
                </span>
                <Button
                  sound={false}
                  onClick={() => runtime.sell(page.line)}
                  aria-label={`Sell "${page.text}" for ${page.price} coins`}
                >
                  Sell <CoinIcon /> {page.price}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {shop.list().length > 0 ? (
        <ShopPanel
          shop={shop}
          onBuy={upgrade => runtime.bought(upgrade.id)}
          unavailable={upgrade =>
            pastItsUse(runtime.game.route, runtime.game.stretch, upgrade.id)
          }
          className="p-3"
        />
      ) : (
        <Panel title="Shop" className="p-3">
          <p className="font-hand text-lg text-ink-soft">
            Sold out. The delivery van is stuck behind a cyclist.
          </p>
        </Panel>
      )}
      {/* Wide screens list chores in the rail already. */}
      <ChoreList
        board={runtime.game.chores}
        title="Before You Go"
        emptyText="Nothing stopping you."
        className="wide:hidden p-3"
      />
    </div>
  )
}
