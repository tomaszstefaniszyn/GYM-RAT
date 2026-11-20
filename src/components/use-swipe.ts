'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Horizontal swipe that leaves vertical scrolling to the browser.
 * touch-action: pan-y is set in CSS. The pointer is captured only after
 * the gesture is clearly more horizontal than vertical.
 */
export function useHorizontalSwipe(
  open: boolean,
  onOpen: () => void,
  onClose: () => void,
  reveal = 96,
  capture = true,
) {
  const [shift, setShift] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; pointer: number } | null>(null)
  const suppress = useRef(false)

  useEffect(() => {
    if (!dragging) setShift(open ? -reveal : 0)
  }, [open, dragging, reveal])

  function reset() {
    start.current = null
    setDragging(false)
  }

  const bind = {
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      if (event.button !== 0) return
      start.current = { x: event.clientX, y: event.clientY, axis: null, pointer: event.pointerId }
      suppress.current = false
    },
    onPointerMove(event: React.PointerEvent<HTMLElement>) {
      const origin = start.current
      if (!origin || origin.pointer !== event.pointerId) return
      const dx = event.clientX - origin.x
      const dy = event.clientY - origin.y
      if (!origin.axis) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
        origin.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        if (origin.axis === 'y') {
          reset()
          return
        }
        setDragging(true)
        if (capture) event.currentTarget.setPointerCapture(event.pointerId)
      }
      if (origin.axis !== 'x') return
      suppress.current = true
      const base = open ? -reveal : 0
      setShift(Math.min(0, Math.max(-reveal, base + dx)))
    },
    onPointerUp(event: React.PointerEvent<HTMLElement>) {
      const origin = start.current
      const horizontal = origin?.pointer === event.pointerId && origin.axis === 'x'
      reset()
      if (!origin || !horizontal) return
      const base = open ? -reveal : 0
      const next = Math.min(0, Math.max(-reveal, base + (event.clientX - origin.x)))
      if (next < -reveal / 2) onOpen()
      else onClose()
    },
    onPointerCancel() {
      reset()
      setShift(open ? -reveal : 0)
    },
  }

  return { shift, dragging, suppress, bind }
}
