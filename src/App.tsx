import { useEffect, useState } from 'react'

import type { DevTools } from './dev'
import { hud } from './game/hud'
import { Runtime } from './scenes/runtime'
import {
  GameLayout,
  loadSketchFonts,
  StartScreen,
  useGameCanvas,
  useLeaveWarning,
  useStore,
  type DevAction,
  type StartInfo
} from './shared'
import { Ending } from './ui/Ending'
import { ActionPanel, StatusPanel } from './ui/Hud'
import { KioskPanel } from './ui/Kiosk'
import { MenuModal, NotebookModal } from './ui/Notebook'
import { ReplayChip, ReplayModal } from './ui/Replay'
import { SettingsModal } from './ui/Settings'

/**
 * Over the canvas on a phone turned sideways, which is too short for the game. It lets
 * touches through, so the game still runs underneath.
 */
function SidewaysNote() {
  return (
    <div className="sideways:flex pointer-events-none absolute inset-0 hidden items-center justify-center bg-paper/85 p-4">
      <div className="max-w-sm -rotate-1 rounded-sketch-alt border-[3px] border-ink bg-paper p-4 shadow-[4px_5px_0_rgb(34_34_34/0.25)]">
        <h2 className="font-marker text-2xl leading-tight">
          Turn Your Phone Upright
        </h2>
        <p className="mt-1 font-hand text-xl leading-snug text-ink">
          The pot needs the whole screen. The game carries on under this note.
        </p>
      </div>
    </div>
  )
}

/** The design space every scene draws in, in logical units. */
const DESIGN = { width: 600, height: 800, mode: 'contain' } as const

const NO_ACTIONS: readonly DevAction[] = []

export function App() {
  const { canvasRef, viewport } = useGameCanvas(DESIGN)
  const [runtime, setRuntime] = useState<Runtime | null>(null)
  // Dev builds only: the dev panel's actions and the Run Report.
  const [dev, setDev] = useState<DevTools | null>(null)
  const started = useStore(hud, s => s.started)
  const [dialog, setDialog] = useState<
    'none' | 'menu' | 'settings' | 'notebook'
  >('none')
  const openSettings = () => setDialog('settings')
  const openNotebook = () => setDialog('notebook')
  const close = () => setDialog('none')

  // Nothing is saved, so closing the tab mid-run asks first on desktop.
  useLeaveWarning(started)

  useEffect(() => {
    if (!runtime) return
    const keys = runtime.input.keys
    const offs = [
      keys.onPress('Escape', () => {
        if (hud.get().started) setDialog('settings')
      }),
      keys.onPress('KeyN', () => {
        if (hud.get().started) setDialog('notebook')
      })
    ]
    return () => {
      for (const off of offs) off()
    }
  }, [runtime])

  useEffect(() => {
    const canvas = viewport.canvas
    if (!canvas) return
    const next = new Runtime(viewport, canvas)
    next.started = hud.get().started
    const stop = next.start()
    setRuntime(next)
    void loadSketchFonts()
    let disposed = false
    let removeDev = () => {}
    if (import.meta.env.DEV) {
      void import('./dev').then(({ installDev }) => {
        if (disposed) return
        const tools = installDev(next)
        removeDev = tools.remove
        setDev(tools)
      })
    }
    return () => {
      disposed = true
      removeDev()
      stop()
    }
  }, [viewport])

  const begin = ({ motion }: StartInfo) => {
    if (!runtime) return
    if (motion === 'granted') runtime.enableMotion()
    runtime.begin()
    hud.set({ started: true })
  }

  return (
    <GameLayout dev={dev?.actions ?? NO_ACTIONS}>
      <div className="wide:grid-cols-[240px_minmax(0,1fr)_240px] wide:grid-rows-[minmax(0,1fr)] grid size-full touch-none grid-rows-[auto_minmax(0,1fr)_auto]">
        {runtime ? (
          <StatusPanel runtime={runtime} onMenu={() => setDialog('menu')} />
        ) : (
          <div />
        )}
        <div className="pointer-events-auto relative min-h-0 min-w-0 overflow-hidden rounded-sketch border-[3px] border-ink bg-paper">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 block size-full"
          />
          {runtime && <KioskPanel runtime={runtime} />}
          <ReplayChip />
          <SidewaysNote />
        </div>
        {runtime ? (
          <ActionPanel
            runtime={runtime}
            onSettings={openSettings}
            onNotebook={openNotebook}
          />
        ) : (
          <div />
        )}
      </div>
      {runtime && (
        <SettingsModal
          runtime={runtime}
          open={dialog === 'settings'}
          onClose={close}
        />
      )}
      <NotebookModal open={dialog === 'notebook'} onClose={close} />
      <ReplayModal />
      {runtime && (
        <Ending runtime={runtime} extra={dev && <dev.EndingExtra />} />
      )}
      <MenuModal
        open={dialog === 'menu'}
        onClose={close}
        onNotebook={openNotebook}
        onSettings={openSettings}
        onReport={
          dev
            ? () => {
                close()
                dev.openReport()
              }
            : undefined
        }
      />
      {dev && <dev.Overlay />}
      {!started && (
        <StartScreen
          title="10,000 Beans"
          pitch="Carry 10,000 beans across town. Pick up every one you spill."
          story="Grandma's family stew needs exactly 10,000 beans. She counts every one at the door."
          motion
          onStart={begin}
          className="bg-paper/90"
        />
      )}
    </GameLayout>
  )
}
