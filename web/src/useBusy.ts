import { useRef, useState } from 'react'

// Runs one save at a time: history cannot be corrected in the app, so a double tap must not write
// twice. The ref guards against a second tap before the button re-renders as disabled.
export function useBusy() {
  const running = useRef(false)
  const [busy, setBusy] = useState(false)

  const once = async (action: () => Promise<void>) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    try {
      await action()
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return { busy, once }
}
