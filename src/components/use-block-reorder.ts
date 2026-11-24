'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { REORDER_HOLD_MS, REORDER_SLOP_PX, edgeScrollDelta, holdCancelled, insertionIndex } from '@/lib/reorder'

type Session = {
  blockKey: string
  key: string
  pointerId: number
  x: number
  y: number
  timer: number
  active: boolean
  grabOffset: number
}

/**
 * Long-press, then drag an exercise up or down inside its own block.
 * The pointer is captured only after the hold, so a normal scroll never takes it.
 */
export function useBlockReorder(options: {
  enabled: boolean
  onReorder: (blockKey: string, exerciseKey: string, toIndex: number) => void
  onActiveChange?: (active: boolean) => void
}) {
  const { enabled, onReorder, onActiveChange } = options
  const onReorderRef = useRef(onReorder)
  const onActiveRef = useRef(onActiveChange)
  onReorderRef.current = onReorder
  onActiveRef.current = onActiveChange
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const listRef = useRef<HTMLElement | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const suppressClick = useRef(false)
  const flipTops = useRef<Map<string, number> | null>(null)
  const lastY = useRef(0)
  const scrollRaf = useRef(0)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [sorting, setSorting] = useState(false)

  function cards() {
    const list = listRef.current
    if (!list) return []
    return [...list.querySelectorAll<HTMLElement>('[data-ex-key]')]
  }

  function measureMids() {
    const nodes = cards()
    const previous = nodes.map((node) => node.style.transform)
    for (const node of nodes) node.style.transform = 'none'
    const mids = nodes.map((node) => {
      const box = node.getBoundingClientRect()
      return { key: node.dataset.exKey || '', mid: box.top + box.height / 2 }
    })
    nodes.forEach((node, index) => {
      node.style.transform = previous[index] || ''
    })
    return mids
  }

  function applyLift(clientY: number) {
    const session = sessionRef.current
    if (!session?.active) return
    const node = cards().find((card) => card.dataset.exKey === session.key)
    if (!node) return
    const previous = node.style.transform
    node.style.transform = 'none'
    const layoutTop = node.getBoundingClientRect().top
    node.style.transform = previous
    const translate = clientY - session.grabOffset - layoutTop
    node.style.transform = `translateY(${translate}px) scale(1.02)`
  }

  function moveToPointer(clientY: number) {
    const session = sessionRef.current
    if (!session?.active) return
    lastY.current = clientY
    applyLift(clientY)
    const mids = measureMids()
    const toIndex = insertionIndex(mids, session.key, clientY)
    const fromIndex = mids.findIndex((item) => item.key === session.key)
    if (fromIndex < 0 || fromIndex === toIndex) return
    const before = new Map<string, number>()
    for (const node of cards()) before.set(node.dataset.exKey || '', node.getBoundingClientRect().top)
    flipTops.current = before
    onReorderRef.current(session.blockKey, session.key, toIndex)
  }

  useLayoutEffect(() => {
    const before = flipTops.current
    if (!before) return
    flipTops.current = null
    const dragged = sessionRef.current?.key
    for (const node of cards()) {
      const key = node.dataset.exKey || ''
      if (key === dragged) {
        applyLift(lastY.current)
        continue
      }
      const prevTop = before.get(key)
      if (prevTop == null) continue
      const delta = prevTop - node.getBoundingClientRect().top
      if (Math.abs(delta) < 1) continue
      node.style.transition = 'none'
      node.style.transform = `translateY(${delta}px)`
      requestAnimationFrame(() => {
        node.style.transition = 'transform 180ms ease'
        node.style.transform = ''
      })
    }
  })

  const api = useRef({
    blockTouch(event: TouchEvent) {
      if (sessionRef.current?.active) event.preventDefault()
    },
    scrollLoop() {
      const session = sessionRef.current
      if (!session?.active) return
      const delta = edgeScrollDelta(lastY.current, window.innerHeight, 72, 16, 96)
      if (delta) {
        window.scrollBy(0, delta)
        moveToPointer(lastY.current)
      }
      scrollRaf.current = requestAnimationFrame(() => api.current.scrollLoop())
    },
    clearLift() {
      for (const node of cards()) {
        node.style.transform = ''
        node.style.transition = ''
        node.classList.remove('is-holding', 'is-lifted')
      }
      document.body.classList.remove('is-reordering')
    },
    endGesture(pointerId: number) {
      const session = sessionRef.current
      if (!session || session.pointerId !== pointerId) return
      window.clearTimeout(session.timer)
      const wasActive = session.active
      sessionRef.current = null
      window.removeEventListener('pointermove', api.current.onPointerMove)
      window.removeEventListener('pointerup', api.current.onPointerUp)
      window.removeEventListener('pointercancel', api.current.onPointerUp)
      window.removeEventListener('touchmove', api.current.blockTouch)
      window.cancelAnimationFrame(scrollRaf.current)
      api.current.clearLift()
      setDragKey(null)
      setSorting(false)
      if (wasActive) {
        suppressClick.current = true
        onActiveRef.current?.(false)
      }
    },
    onPointerMove(event: PointerEvent) {
      const session = sessionRef.current
      if (!session || event.pointerId !== session.pointerId) return
      if (!session.active) {
        if (holdCancelled(event.clientX - session.x, event.clientY - session.y, REORDER_SLOP_PX)) {
          window.clearTimeout(session.timer)
          api.current.endGesture(session.pointerId)
        }
        return
      }
      moveToPointer(event.clientY)
    },
    onPointerUp(event: PointerEvent) {
      api.current.endGesture(event.pointerId)
    },
    activate(pointerId: number) {
      const session = sessionRef.current
      if (!session || session.pointerId !== pointerId || session.active) return
      const node = cards().find((card) => card.dataset.exKey === session.key)
      if (!node) return
      session.active = true
      const box = node.getBoundingClientRect()
      session.grabOffset = session.y - box.top
      lastY.current = session.y
      node.classList.remove('is-holding')
      node.classList.add('is-lifted')
      document.body.classList.add('is-reordering')
      setDragKey(session.key)
      setSorting(true)
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      window.getSelection()?.removeAllRanges()
      try {
        node.setPointerCapture(pointerId)
      } catch {
        /* window listeners still follow the finger */
      }
      try {
        navigator.vibrate?.(12)
      } catch {
        /* vibration can throw when the browser blocks it */
      }
      window.addEventListener('touchmove', api.current.blockTouch, { passive: false })
      onActiveRef.current?.(true)
      scrollRaf.current = requestAnimationFrame(() => api.current.scrollLoop())
      applyLift(session.y)
    },
  })

  useEffect(() => {
    const handlers = api.current
    return () => {
      const session = sessionRef.current
      if (session) window.clearTimeout(session.timer)
      sessionRef.current = null
      window.cancelAnimationFrame(scrollRaf.current)
      window.removeEventListener('pointermove', handlers.onPointerMove)
      window.removeEventListener('pointerup', handlers.onPointerUp)
      window.removeEventListener('pointercancel', handlers.onPointerUp)
      window.removeEventListener('touchmove', handlers.blockTouch)
    }
  }, [])

  function bind(blockKey: string, exerciseKey: string) {
    return {
      onPointerDown(event: React.PointerEvent<HTMLElement>) {
        if (!enabledRef.current || event.button !== 0 || sessionRef.current) return
        const list = event.currentTarget.parentElement
        if (!list) return
        listRef.current = list
        event.currentTarget.classList.add('is-holding')
        const session: Session = {
          blockKey,
          key: exerciseKey,
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          timer: window.setTimeout(() => api.current.activate(event.pointerId), REORDER_HOLD_MS),
          active: false,
          grabOffset: 0,
        }
        sessionRef.current = session
        window.addEventListener('pointermove', api.current.onPointerMove)
        window.addEventListener('pointerup', api.current.onPointerUp)
        window.addEventListener('pointercancel', api.current.onPointerUp)
      },
      onContextMenu(event: React.MouseEvent) {
        if (sessionRef.current || suppressClick.current) event.preventDefault()
      },
      onClickCapture(event: React.MouseEvent) {
        if (!suppressClick.current) return
        suppressClick.current = false
        event.preventDefault()
        event.stopPropagation()
      },
    }
  }

  return { dragKey, sorting, bind }
}
