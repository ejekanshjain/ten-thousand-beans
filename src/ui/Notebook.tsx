import { useState } from 'react'

import { LINES } from '../game/gossip'
import { hud, type NotebookPage } from '../game/hud'
import { drawWhisperPage } from '../scenes/art/whisper'
import {
  Button,
  Modal,
  ShareModal,
  useStore,
  type ShareCardInput
} from '../shared'

/**
 * Your notebook: every line of gossip you jotted down, as Weekly Whisper clippings, and
 * Grandma's secret with the letters your pages reveal.
 */
export function NotebookModal({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const pages = useStore(hud, s => s.pages)
  const secret = useStore(hud, s => s.secret)
  return (
    <Modal open={open} onClose={onClose} title="Notebook">
      <div className="flex flex-col gap-3">
        <p className="font-hand text-lg text-ink">
          {pages.length === 0
            ? 'No gossip yet. Spill something juicy.'
            : `${pages.length} of ${LINES.length} pages.`}
        </p>
        <ul className="flex flex-col gap-2">
          {pages.map((page, i) => (
            <li
              key={page.text}
              className={`relative rounded-sketch border-2 border-ink bg-paper p-2 ${i % 2 ? 'rotate-[0.6deg]' : '-rotate-[0.6deg]'}`}
            >
              <p className="font-marker text-xs tracking-wide text-ink-soft">
                The Weekly Whisper
              </p>
              <p className="font-marker text-xl text-ink">{page.text}</p>
              <p className="font-hand text-base text-ink-soft">
                {page.sold
                  ? 'Sold. Old news now.'
                  : `Worth ${page.price} coins at the newspaper kiosk.`}
              </p>
              {page.sold && (
                <span className="absolute top-2 right-2 -rotate-12 rounded-sketch border-2 border-marker-red px-1.5 font-marker text-marker-red">
                  SOLD
                </span>
              )}
              <ShareFrontPage page={page} number={i + 1} />
            </li>
          ))}
        </ul>
        <h3 className="font-marker text-xl text-ink">Grandma&apos;s Secret</h3>
        <p
          aria-label={`Grandma's secret so far: ${secret}`}
          className="font-marker text-xl tracking-[0.12em] break-words text-marker-purple"
        >
          {secret}
        </p>
        <p className="font-hand text-base text-ink-soft">
          Every page shows a few more letters.
        </p>
      </div>
    </Modal>
  )
}

/**
 * Share This Page: a Weekly Whisper front page with the line spelled out in beans. The
 * picture is drawn when you tap, and freed when the share dialog closes.
 */
function ShareFrontPage({
  page,
  number
}: {
  page: NotebookPage
  number: number
}) {
  const [picture, setPicture] = useState<HTMLCanvasElement | null>(null)
  const line = LINES[page.line]
  if (!line) return null
  const open = () => setPicture(drawWhisperPage(page.text, line.quip, number))
  const close = () => {
    if (picture) picture.width = picture.height = 0
    setPicture(null)
  }
  const card: ShareCardInput | null = picture && {
    game: '10,000 Beans',
    title: page.text,
    stats: [
      { label: 'Page', value: `${number} of ${LINES.length}` },
      { label: 'Spelled In', value: `${line.need} beans` },
      { label: 'Worth', value: `${line.price} coins` }
    ],
    image: picture,
    footer: 'Every bean spilled on the way to Grandma.'
  }
  return (
    <>
      <Button
        variant="ghost"
        onClick={open}
        className="mt-2 min-h-12 text-base"
      >
        Share This Page
      </Button>
      {card && (
        <ShareModal
          open
          onClose={close}
          card={card}
          title="Share This Page"
          text={`Spilled beans spelled "${page.text}". #10000Beans`}
        />
      )}
    </>
  )
}

/**
 * The phone Menu: the Notebook and Settings, which have their own rail buttons on wide
 * screens. Dev builds pass `onReport` for the Run Report, since phones have no dev panel.
 */
export function MenuModal({
  open,
  onClose,
  onNotebook,
  onSettings,
  onReport
}: {
  open: boolean
  onClose: () => void
  onNotebook: () => void
  onSettings: () => void
  onReport?: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Menu">
      <div className="flex flex-col gap-3">
        <Button size="lg" onClick={onNotebook}>
          Notebook
        </Button>
        <Button size="lg" variant="ghost" onClick={onSettings}>
          Settings
        </Button>
        {import.meta.env.DEV && onReport && (
          <Button size="lg" variant="ghost" onClick={onReport}>
            Run Report (Dev)
          </Button>
        )}
      </div>
    </Modal>
  )
}
