import { useCallback, useEffect, useRef, useState } from 'react'

export interface Countdown {
  // Whole seconds left, rounded up.
  remaining: number
  running: boolean
  done: boolean
  // Starts, or starts over.
  start(): void
  reset(): void
}

// A countdown from a start timestamp rather than counted ticks, so a locked screen or a throttled
// background tab does not slow it. It asks the browser to keep the screen awake while it runs and
// vibrates at zero, both where supported.
export function useCountdown(seconds: number): Countdown {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [done, setDone] = useState(false)
  const lock = useRef<WakeLockSentinel | null>(null)
  // Guards a wake lock that resolves after the countdown was reset or the component left.
  const generation = useRef(0)

  const releaseLock = useCallback(() => {
    generation.current++
    const held = lock.current
    lock.current = null
    held?.release().catch(() => undefined)
  }, [])

  const running = startedAt !== null && !done
  const remaining = startedAt === null ? seconds : Math.max(0, Math.ceil(seconds - (now - startedAt) / 1000))

  useEffect(() => {
    if (!running) return
    const tick = () => setNow(Date.now())
    const timer = setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [running])

  useEffect(() => {
    if (!running || remaining > 0) return
    setDone(true)
    navigator.vibrate?.([300, 100, 300])
    releaseLock()
  }, [running, remaining, releaseLock])

  useEffect(() => releaseLock, [releaseLock])

  const start = useCallback(() => {
    releaseLock()
    const mine = generation.current
    const at = Date.now()
    setStartedAt(at)
    setNow(at)
    setDone(false)
    navigator.wakeLock
      ?.request('screen')
      .then((sentinel) => {
        if (generation.current === mine) lock.current = sentinel
        else sentinel.release().catch(() => undefined)
      })
      .catch(() => undefined)
  }, [releaseLock])

  const reset = useCallback(() => {
    releaseLock()
    setStartedAt(null)
    setDone(false)
  }, [releaseLock])

  return { remaining, running, done, start, reset }
}
