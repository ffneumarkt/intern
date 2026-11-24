// Stand-in for components/Scanner: jsdom has no camera. Tests feed codes with scanCode().
import { act } from '@testing-library/react'
import { useEffect } from 'react'

let handler: ((code: string) => void) | null = null
let running = false

export function resetScanner() {
  handler = null
  running = false
}

export default function Scanner({ onCode, active = true }: { onCode(code: string): void; active?: boolean }) {
  handler = onCode
  running = active
  // An unmounted scanner has stopped its camera.
  useEffect(
    () => () => {
      running = false
    },
    [],
  )
  return active ? <div data-testid="scanner" /> : null
}

export const scannerActive = () => running

export function scanCode(code: string): void {
  act(() => handler?.(code))
}
