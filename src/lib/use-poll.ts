'use client'

import { useEffect, useRef } from 'react'

export function usePoll(fn: () => void | Promise<void>, ms: number) {
  const ref = useRef(fn)
  ref.current = fn

  useEffect(() => {
    let stop = false
    let timer = 0
    const loop = () => {
      timer = window.setTimeout(async () => {
        if (stop) return
        if (!document.hidden) {
          try {
            await ref.current()
          } catch {
            /* next tick retries */
          }
        }
        if (!stop) loop()
      }, ms)
    }
    loop()
    const onWake = () => {
      if (!document.hidden) void ref.current()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      stop = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [ms])
}
