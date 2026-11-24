/** Hold before a tile can be dragged. Movement past this cancels the hold so the page can scroll. */
export const REORDER_HOLD_MS = 300
export const REORDER_SLOP_PX = 8

export function exerciseBadge(index: number) {
  return String(index + 1).padStart(2, '0')
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items]
  const next = items.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

/** True when the finger moved enough before the hold finished that this is a scroll, not a drag. */
export function holdCancelled(dx: number, dy: number, slop = REORDER_SLOP_PX) {
  return dx * dx + dy * dy > slop * slop
}

/**
 * Index to insert the dragged key, based on the vertical center of the other tiles.
 * `mids` must be in the current list order.
 */
export function insertionIndex(mids: readonly { key: string; mid: number }[], dragKey: string, pointerY: number) {
  let index = 0
  for (const item of mids) {
    if (item.key === dragKey) continue
    if (pointerY > item.mid) index += 1
  }
  const others = mids.reduce((count, item) => count + (item.key === dragKey ? 0 : 1), 0)
  return Math.max(0, Math.min(others, index))
}

/** Pixels to scroll this frame. Negative moves the page up. `bottomInset` keeps the finger above a fixed bar. */
export function edgeScrollDelta(pointerY: number, viewHeight: number, edge = 72, maxStep = 16, bottomInset = 0) {
  if (pointerY < edge) {
    const ratio = (edge - Math.max(0, pointerY)) / edge
    return -Math.max(1, Math.round(ratio * maxStep))
  }
  const floor = viewHeight - bottomInset
  if (pointerY > floor - edge) {
    const ratio = Math.min(1, (pointerY - (floor - edge)) / edge)
    return Math.max(1, Math.round(ratio * maxStep))
  }
  return 0
}
