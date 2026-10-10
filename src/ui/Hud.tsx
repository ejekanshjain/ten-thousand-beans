import { beansBehind } from '../game/game'
import { hud } from '../game/hud'
import { formatBeans } from '../game/units'
import type { Runtime } from '../scenes/runtime'
import {
  Button,
  ChoreList,
  CoinBadge,
  CoinIcon,
  formatClock,
  LiveText,
  Meter,
  timeLeftMs,
  TimerChip,
  useCoins,
  useNow,
  useStore,
  type RealTimer,
  type Wallet
} from '../shared'
import { HoldButton } from './HoldButton'

/** A label with a number that updates every frame without re-rendering React. */
function Stat({ label, read }: { label: string; read: () => string }) {
  return (
    <p className="flex items-baseline gap-1 leading-none">
      <span className="wide:text-lg font-hand text-base text-ink-soft">
        {label}
      </span>
      <LiveText
        read={read}
        className="wide:text-2xl font-marker text-xl text-ink tabular-nums"
      />
    </p>
  )
}

/** A compact countdown for the phone bar, beside the slosh meter, such as "Drying 2 0:42". */
function TimerCompact({ label, timer }: { label: string; timer: RealTimer }) {
  const now = useNow(250)
  const left = formatClock(timeLeftMs(timer, now))
  return (
    <p
      role="timer"
      aria-label={`${label}, ${left} left`}
      className="wide:hidden shrink-0 font-hand text-base leading-none text-ink"
    >
      {label} <span className="font-marker tabular-nums">{left}</span>
    </p>
  )
}

/** The phone bar's compact coin count. Wide screens show the full badge with its coin floats. */
function Coins({ wallet }: { wallet: Wallet }) {
  const coins = useCoins(wallet)
  return (
    <p
      aria-label={`Coins: ${coins}`}
      className="wide:hidden flex items-center gap-1 font-marker text-xl leading-none text-ink tabular-nums"
    >
      <CoinIcon className="size-5" />
      <span key={coins} className="animate-wobble">
        {coins}
      </span>
    </p>
  )
}

/**
 * Counts, the slosh meter and the next-step hint. A bar above the canvas on phones, a rail
 * on its left on wide screens.
 */
export function StatusPanel({
  runtime,
  onMenu
}: {
  runtime: Runtime
  onMenu: () => void
}) {
  const game = runtime.game
  const prompt = useStore(hud, s => s.prompt)
  const stretchName = useStore(hud, s => s.stretchName)
  const drying = useStore(hud, s => s.drying)
  const lost = useStore(hud, s => s.lost)
  const growing = useStore(hud, s => s.growing)
  return (
    <section
      aria-label="Status"
      className="wide:gap-4 wide:p-4 flex min-w-0 flex-col gap-1 px-2 py-1"
    >
      <h2 className="wide:block hidden -rotate-2 font-marker text-3xl">
        {stretchName}
      </h2>
      <div className="wide:block flex items-center gap-2">
        <div className="wide:gap-4 flex min-w-0 flex-1 flex-col gap-1">
          <div className="wide:flex-col wide:items-start wide:gap-3 flex items-center justify-between gap-2">
            <Stat label="Pot" read={() => formatBeans(game.counts.pot)} />
            <Stat label="Behind" read={() => formatBeans(beansBehind(game))} />
            <div className="wide:block hidden">
              <Stat
                label="Lost"
                read={() =>
                  formatBeans(game.counts.packets + game.counts.growing)
                }
              />
            </div>
            <Coins wallet={game.wallet} />
          </div>
          <div className="wide:block flex items-center gap-2">
            <Meter
              label="Slosh"
              read={() => (game.scene === 'walk' ? game.pot.danger : 0)}
              max={1.5}
              limit={1}
              zones={[{ from: 1, to: 1.5, className: 'bg-marker-red/25' }]}
              className="wide:[&>span]:block wide:[&>div]:h-6 min-w-0 flex-1 [&>div]:h-4 [&>span]:hidden"
            />
            {lost > 0 && (
              <p
                aria-label={`${lost} lost for good`}
                className="wide:hidden shrink-0 font-hand text-base leading-none text-ink"
              >
                Lost{' '}
                <span className="font-marker text-marker-red tabular-nums">
                  {formatBeans(lost)}
                </span>
              </p>
            )}
            {drying && (
              <TimerCompact
                label={`Drying ${drying.count}`}
                timer={drying.timer}
              />
            )}
            {growing && <TimerCompact label="Growing" timer={growing} />}
          </div>
        </div>
        <div className="wide:mt-4 wide:block hidden">
          <CoinBadge wallet={game.wallet} />
        </div>
        {drying && (
          <div className="wide:mt-4 wide:block hidden">
            <TimerChip
              timer={drying.timer}
              label={`Drying ${drying.count}`}
              doneLabel="Hopping in"
            />
          </div>
        )}
        {growing && (
          <div className="wide:mt-4 wide:block hidden">
            <TimerChip
              timer={growing}
              label="Beans growing"
              doneLabel="Ready to pick"
            />
          </div>
        )}
        <div className="wide:hidden">
          <Button variant="ghost" onClick={onMenu}>
            Menu
          </Button>
        </div>
      </div>
      <p className="wide:text-xl short:text-sm min-h-[2lh] font-hand text-base leading-tight text-ink">
        {prompt}
      </p>
      <div className="wide:block hidden">
        <ChoreList board={game.chores} emptyText="Nothing blocking you." />
      </div>
    </section>
  )
}

/** The action buttons. A bar under the canvas on phones, a rail on its right on wide screens. */
export function ActionPanel({
  runtime,
  onSettings,
  onNotebook
}: {
  runtime: Runtime
  onSettings: () => void
  onNotebook: () => void
}) {
  const scene = useStore(hud, s => s.scene)
  const carrying = useStore(hud, s => s.carrying)
  const holding = useStore(hud, s => s.holding)
  const busy = useStore(hud, s => s.busy)
  const touch = useStore(hud, s => s.touch)
  const tiltButtons = useStore(hud, s => s.tiltButtons)
  const jotReady = useStore(hud, s => s.jotReady)
  const boxWants = useStore(hud, s => s.boxWants)
  const canPour = useStore(hud, s => s.canPour)
  const walking = scene === 'walk' && carrying
  const buttons = runtime.input.buttons
  const keyHint = (key: string) =>
    !touch && <span className="font-hand text-base text-ink-soft">({key})</span>
  if (scene === 'box')
    return (
      <section
        aria-label="Actions"
        className="wide:flex-col wide:items-stretch wide:justify-start wide:gap-3 wide:p-4 flex items-center justify-center gap-1.5 px-2 py-1"
      >
        <Button
          onClick={() => runtime.toggleBox()}
          className="min-h-14 min-w-32"
        >
          Close Box {keyHint('E')}
        </Button>
      </section>
    )
  return (
    <section
      aria-label="Actions"
      className="wide:flex-col wide:items-stretch wide:justify-start wide:gap-3 wide:p-4 flex items-center justify-center gap-1.5 px-2 py-1"
    >
      {walking && tiltButtons && (
        <HoldButton label="Tilt Left" onHold={down => (buttons.left = down)}>
          Tilt Left
        </HoldButton>
      )}
      {scene !== 'count' && (
        <Button
          onClick={() => runtime.toggleCarry()}
          disabled={holding || busy}
          className="wide:min-w-32 min-h-14 min-w-28"
        >
          {walking
            ? 'Set Down'
            : scene === 'drain'
              ? 'Back'
              : scene === 'kiosk'
                ? 'Next Stretch'
                : 'Pick Up Pot'}
          {keyHint('Space')}
        </Button>
      )}
      <Button
        variant="ghost"
        onClick={() => runtime.toggleBox()}
        disabled={holding || busy}
        aria-label="Window Box"
        className={boxWants ? 'animate-nudge' : undefined}
      >
        <span className="wide:inline hidden">Window&nbsp;</span>Box{' '}
        {keyHint('E')}
      </Button>
      {walking && tiltButtons && (
        <HoldButton label="Tilt Right" onHold={down => (buttons.right = down)}>
          Tilt Right
        </HoldButton>
      )}
      {canPour && (
        <HoldButton
          label="Pour Off"
          onHold={down => runtime.pour(down)}
          className="bg-marker-water"
        >
          Pour Off
          {!touch && (
            <span className="ml-1.5 font-hand text-base text-ink-soft">
              (P)
            </span>
          )}
        </HoldButton>
      )}
      {jotReady && (
        <HoldButton
          label="Jot It Down"
          onHold={down => runtime.jot(down)}
          className="bg-marker-yellow"
        >
          Jot It Down
          {!touch && (
            <span className="ml-1.5 font-hand text-base text-ink-soft">
              (J)
            </span>
          )}
        </HoldButton>
      )}
      <div className="wide:flex hidden flex-col gap-3">
        <Button variant="ghost" onClick={onNotebook}>
          Notebook
          <span className="font-hand text-base text-ink-soft">(N)</span>
        </Button>
        <Button variant="ghost" onClick={onSettings}>
          Settings
          <span className="font-hand text-base text-ink-soft">(Esc)</span>
        </Button>
      </div>
    </section>
  )
}
