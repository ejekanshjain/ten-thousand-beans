import { hud } from '../game/hud'
import type { Runtime } from '../scenes/runtime'
import { Button, Modal, SettingsPanel, toast, useStore } from '../shared'

/** The Settings dialog: the shared settings plus Level Here for phone tilt. It pauses the game while open. */
export function SettingsModal({
  runtime,
  open,
  onClose
}: {
  runtime: Runtime
  open: boolean
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <SettingsPanel extra={<LevelHere runtime={runtime} />} />
    </Modal>
  )
}

/** Treats the way you hold the phone right now as level. */
function LevelHere({ runtime }: { runtime: Runtime }) {
  // The HUD hides tilt buttons exactly when device tilt steers the pot.
  const tilting = useStore(hud, s => s.touch && !s.tiltButtons)
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        disabled={!tilting}
        onClick={() => {
          runtime.input.motion.calibrate()
          toast('Level set. Hold the phone like this to walk.', 'good')
        }}
      >
        Level Here
      </Button>
      <p className="font-hand text-base text-ink-soft">
        {tilting
          ? 'Picking up the pot also sets level.'
          : "Needs phone tilt, which this device isn't sending."}
      </p>
      <p className="font-hand text-base text-ink-soft">
        Assist Mode here also lets one finger drag beans and gives the pot a
        little more room before it spills.
      </p>
    </div>
  )
}
