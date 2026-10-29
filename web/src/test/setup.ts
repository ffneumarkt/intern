import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { setupIonicReact } from '@ionic/react'
import { afterEach, vi } from 'vitest'

setupIonicReact({ mode: 'md' })

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// jsdom lacks hit testing, which ion-segment uses for its indicator.
document.elementFromPoint = () => null
