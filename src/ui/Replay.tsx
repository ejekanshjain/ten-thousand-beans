import { useEffect, useState } from 'react'

import { REPLAY_CHIP_MS, REPLAY_SPEED } from '../game/tuning'
import { formatBeans } from '../game/units'
import { closeReplay, film, openReplay, type ReplayShot } from '../scenes/film'
import {
  Button,
  Modal,
  ReplayPlayer,
  ShareCardButton,
  useStore,
  type ShareCardInput
} from '../shared'

/**
 * The corner chip offering the latest small spill's replay. It fades after
 * REPLAY_CHIP_MS; tapping it opens the replay.
 */
export function ReplayChip() {
  const shot = useStore(film, s => s.shot)
  const open = useStore(film, s => s.open)
  const seen = useStore(film, s => s.seen)
  const [faded, setFaded] = useState(0)
  const id = shot?.id ?? 0
  useEffect(() => {
    if (!id) return
    const timer = setTimeout(() => setFaded(id), REPLAY_CHIP_MS)
    return () => clearTimeout(timer)
  }, [id])
  if (!shot || open || seen === shot.id || faded === shot.id) return null
  return (
    <Button
      key={shot.id}
      variant="ghost"
      onClick={openReplay}
      aria-label={`Replay: ${shot.label}`}
      className="animate-chip absolute top-2 left-2 z-10 gap-1.5 bg-paper/90 px-3 text-base"
    >
      <PlayIcon />
      Replay
      <span className="font-hand text-base text-ink-soft">{shot.label}</span>
    </Button>
  )
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0">
      <path
        d="M5 3.5 L16.5 10 L5 16.5 Z"
        fill="var(--color-marker-red)"
        stroke="var(--color-ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The replay dialog: the clip in slow motion with its caption and who to blame. The
 * game waits while it shows. Big spills and tip-overs offer Share.
 */
export function ReplayModal() {
  const shot = useStore(film, s => s.shot)
  const open = useStore(film, s => s.open)
  const [take, setTake] = useState(0)
  return (
    <Modal
      open={open && shot !== null}
      onClose={closeReplay}
      title="Slow-Mo Replay"
      footer={
        shot && (
          <>
            <Button variant="ghost" onClick={() => setTake(n => n + 1)}>
              Watch Again
            </Button>
            {shot.share && (
              <ShareCardButton
                card={replayCard(shot)}
                text={`${shot.label} ${shot.blame} #10000Beans`}
                variant="ghost"
              />
            )}
            <Button onClick={closeReplay}>Carry On</Button>
          </>
        )
      }
    >
      {shot && (
        <div className="flex flex-col items-center gap-2">
          {/* Above the clip, not on it: the beans land at the bottom of the frame. */}
          <p className="-rotate-2 text-center font-marker text-2xl leading-tight text-marker-red sm:text-3xl">
            {shot.label}
          </p>
          {/* Sized by height too, so the 3:4 clip and the buttons fit a short phone. */}
          <div className="w-[min(100%,38dvh)]">
            <ReplayPlayer
              key={`${shot.id}-${take}`}
              clip={shot.clip}
              speed={REPLAY_SPEED}
            />
          </div>
          <p className="text-center font-hand text-xl leading-tight">
            {shot.blame}
          </p>
        </div>
      )}
    </Modal>
  )
}

/** The share card for a big spill or a tip-over: its still, the numbers and the blame. */
function replayCard(shot: ReplayShot): ShareCardInput {
  return {
    game: '10,000 Beans',
    title: shot.label,
    stats: [
      { label: 'Spilled', value: formatBeans(shot.count) },
      { label: 'Where', value: shot.stretch },
      { label: 'Left in Pot', value: formatBeans(shot.pot) },
      { label: 'Grandma Needs', value: '10,000' }
    ],
    image: shot.clip.still ?? undefined,
    footer: shot.blame
  }
}
