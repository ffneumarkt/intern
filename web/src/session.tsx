import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import * as auth from './api/auth'
import type { Level, User } from './api/auth'
import * as passkeys from './api/passkeys'

const order: Level[] = ['use', 'check', 'manage']

const reaches = (level: Level | undefined, required: Level) =>
  level !== undefined && order.indexOf(level) >= order.indexOf(required)

interface Session {
  user: User | null
  can(categoryId: string, required: Level): boolean
  canAnywhere(required: Level): boolean
  reloadLevels(): Promise<void>
  login(email: string, password: string): Promise<void>
  loginWithPasskey(): Promise<void>
  logout(): void
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(auth.currentUser)
  const [levels, setLevels] = useState<Record<string, Level>>({})

  // On failure the last known levels stay; the next page entry tries again.
  const reloadLevels = useCallback(
    () =>
      auth
        .listLevels()
        .then(setLevels)
        .catch(() => {}),
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

  const session: Session = {
    user,
    can: (categoryId, required) => reaches(levels[categoryId], required),
    canAnywhere: (required) => Object.values(levels).some((level) => reaches(level, required)),
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
    logout: auth.logout,
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession needs a SessionProvider')
  return session
}
