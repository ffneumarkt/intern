// Sketch-only stand-in for real auth: lets the UI be viewed at each permission level.
import { createContext, useContext, useState, type ReactNode } from 'react'

export type SketchLevel = 'public' | 'use' | 'check' | 'manage'

const order: SketchLevel[] = ['public', 'use', 'check', 'manage']
const storageKey = 'sketch.level'

export function atLeast(level: SketchLevel, required: Exclude<SketchLevel, 'public'>): boolean {
  return order.indexOf(level) >= order.indexOf(required)
}

function readLevel(): SketchLevel {
  // ?ansicht=manage opens the sketch at a level, e.g. for shared review links and screenshots.
  const fromUrl = new URLSearchParams(window.location.search).get('ansicht')
  if (fromUrl && order.includes(fromUrl as SketchLevel)) return fromUrl as SketchLevel
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored && order.includes(stored as SketchLevel)) return stored as SketchLevel
  } catch {
    // storage unavailable: fall back to public
  }
  return 'public'
}

interface SketchSession {
  level: SketchLevel
  setLevel(level: SketchLevel): void
}

const SketchSessionContext = createContext<SketchSession | null>(null)

export function SketchSessionProvider({ children }: { children: ReactNode }) {
  const [level, setLevelState] = useState<SketchLevel>(readLevel)
  const setLevel = (next: SketchLevel) => {
    setLevelState(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // storage unavailable: level lives only in memory
    }
  }
  return <SketchSessionContext.Provider value={{ level, setLevel }}>{children}</SketchSessionContext.Provider>
}

export function useSketchSession(): SketchSession {
  const session = useContext(SketchSessionContext)
  if (!session) throw new Error('useSketchSession needs a SketchSessionProvider')
  return session
}
