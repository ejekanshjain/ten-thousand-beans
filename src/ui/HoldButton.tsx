import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode
} from 'react'

import { cn } from '../shared'

export interface HoldButtonProps {
  /** Called with true when the hold starts and false when it ends, however it ends. */
  onHold: (down: boolean) => void
  /** Accessible name, such as "Tilt Left". */
  label: string
  children: ReactNode
  className?: string
}

/**
 * A button you hold rather than click, for tilt, jotting and pouring. It captures the
 * pointer, plays no click, and ends the hold on release, cancel, lost capture, window
 * blur or unmount, so a thumb sliding off can't leave it stuck. Space and Enter hold it
 * from the keyboard.
 */
export function HoldButton({
  onHold,
  label,
  children,
  className
}: HoldButtonProps) {
  const held = useRef(false)
  const onHoldRef = useRef(onHold)
  useLayoutEffect(() => {
    onHoldRef.current = onHold
  })

  const set = (down: boolean) => {
    if (held.current === down) return
    held.current = down
    onHoldRef.current(down)
  }

  useEffect(() => {
    const end = () => set(false)
    window.addEventListener('blur', end)
    return () => {
      window.removeEventListener('blur', end)
      end()
    }
  }, [])

  const key = (down: boolean) => (event: KeyboardEvent) => {
    if (event.code !== 'Space' && event.code !== 'Enter') return
    event.preventDefault()
    if (down && event.repeat) return
    set(down)
  }

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={event => {
        event.preventDefault()
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Synthetic pointers can't be captured; the hold still works without it.
        }
        set(true)
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onKeyDown={key(true)}
      onKeyUp={key(false)}
      onContextMenu={event => event.preventDefault()}
      className={cn(
        'pointer-events-auto inline-flex min-h-14 min-w-14 touch-none items-center justify-center rounded-sketch border-[3px] border-ink bg-paper px-3 font-marker text-lg text-ink shadow-[3px_4px_0_var(--color-ink)] select-none active:translate-y-0.5 active:bg-marker-yellow active:shadow-none',
        className
      )}
    >
      {children}
    </button>
  )
}
