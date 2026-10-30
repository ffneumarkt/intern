import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as auth from './api/auth'
import type { Level, User } from './api/auth'

const order: Level[] = ['use', 'check', 'manage']

const reaches = (level: Level | undefined, required: Level) =>
  level !== undefined && order.indexOf(level) >= order.indexOf(required)

interface Session {
  user: User | null
  can(categoryId: string, required: Level): boolean
  canAnywhere(required: Level): boolean
  login(email: string, password: string): Promise<void>
  logout(): void
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(auth.currentUser)
  const [levels, setLevels] = useState<Record<string, Level>>({})

  const loadLevels = () =>
    auth
      .listLevels()
      .then(setLevels)
      .catch(() => setLevels({}))

  useEffect(() => {
    const unsubscribe = auth.onAuthChange(() => {
      setUser(auth.currentUser())
      void loadLevels()
    })
    void auth.refresh().then(loadLevels)
    return unsubscribe
  }, [])

  const session: Session = {
    user,
    can: (categoryId, required) => reaches(levels[categoryId], required),
    canAnywhere: (required) => Object.values(levels).some((level) => reaches(level, required)),
    login: async (email, password) => {
      await auth.login(email, password)
      setUser(auth.currentUser())
      await loadLevels()
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
