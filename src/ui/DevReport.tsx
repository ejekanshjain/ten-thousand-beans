// Dev only: dev.ts is the only importer, so production builds leave this file out.
import { Button, createStore, Modal, useStore } from '../shared'
import { useState } from 'react'

/** Whether the Run Report dialog is open. */
export const devReport = createStore({ open: false })

/** The report as selectable text, sized for a phone screen and a screenshot. */
function ReportText({ read }: { read: () => string }) {
  // Read once, so the numbers hold still while you copy them.
  const [text] = useState(read)
  return (
    <pre className="font-mono text-xs leading-snug break-words whitespace-pre-wrap select-text">
      {text}
    </pre>
  )
}

/**
 * The Run Report dialog for real-player timings: the dev `stats()` as text, and Time 50
 * Beans, which spills 50 beans ahead of you and times their pickup.
 */
export function RunReportModal({
  read,
  onTrial
}: {
  read: () => string
  onTrial: () => void
}) {
  const open = useStore(devReport, s => s.open)
  const close = () => devReport.set({ open: false })
  return (
    <Modal
      open={open}
      onClose={close}
      title="Run Report"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              close()
              onTrial()
            }}
          >
            Time 50 Beans
          </Button>
          <Button onClick={close}>Close</Button>
        </>
      }
    >
      <ReportText read={read} />
    </Modal>
  )
}

/** The same report, folded away at the bottom of the ending screen. */
export function EndingReport({ read }: { read: () => string }) {
  return (
    <details className="mt-3 text-left">
      <summary className="cursor-pointer font-hand text-lg">
        Run Report (Dev)
      </summary>
      <ReportText read={read} />
    </details>
  )
}
