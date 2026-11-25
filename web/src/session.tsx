import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import * as auth from './api/auth'
import type { Area, Level, User } from './api/auth'
import * as passkeys from './api/passkeys'
import * as push from './api/push'

const pushOffTimeoutMs = 4000

const order: Level[] = ['use', 'check', 'manage']

const reaches = (level: Level | undefined, required: Level) =>
  level !== undefined && order.indexOf(level) >= order.indexOf(required)

interface Session {
  user: User | null
  can(categoryId: string, required: Level): boolean
  canAnywhere(required: Level): boolean
  // The admin areas of the user, and whether they hold one.
  areas: Area[]
  holds(area: Area): boolean
  reloadLevels(): Promise<void>
  login(email: string, password: string): Promise<void>
  loginWithPasskey(): Promise<void>
  logout(): Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(auth.currentUser)
  const [levels, setLevels] = useState<Record<string, Level>>({})
  const [areas, setAreas] = useState<Area[]>([])

  // On failure the last known levels stay; the next page entry tries again.
  const reloadLevels = useCallback(
    () =>
      Promise.all([
        auth.listLevels().then(setLevels),
        auth.listAreas().then(setAreas),
      ]).then(
        () => {},
        () => {},
      ),
    [],
  )

  useEffect(() => {
    const unsubscribe = auth.onAuthChange(() => {
      setUser(auth.currentUser())
      void reloadLevels()
    })
    void auth.refresh().then(reloadLevels)
    return unsubscribe
  }, [reloadLevels])

  const userId = user?.id
  useEffect(() => {
    if (userId) void push.syncPush()
  }, [userId])

  const session: Session = {
    user,
    can: (categoryId, required) => reaches(levels[categoryId], required),
    canAnywhere: (required) => Object.values(levels).some((level) => reaches(level, required)),
    areas,
    holds: (area) => areas.includes(area),
    reloadLevels,
    login: async (email, password) => {
      await auth.login(email, password)
      setUser(auth.currentUser())
      await reloadLevels()
    },
    loginWithPasskey: async () => {
      await passkeys.loginWithPasskey()
      setUser(auth.currentUser())
      await reloadLevels()
    },
    // Push goes off while the session is still valid, so the unsubscribe request is authenticated.
    logout: async () => {
      try {
        // Bounded, so a stalled request cannot keep the user signed in.
        await Promise.race([push.disablePush(), new Promise((resolve) => setTimeout(resolve, pushOffTimeoutMs))])
      } catch {
        // Logging out matters more than unsubscribing.
      } finally {
        auth.logout()
      }
    },
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession needs a SessionProvider')
  return session
}
