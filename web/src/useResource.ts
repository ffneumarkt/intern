import { useIonViewWillEnter } from '@ionic/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from './session'

export interface Resource<T> {
  data?: T
  error?: unknown
  reload(): void
}

// Loads whenever the page is entered, because Ionic keeps pages mounted, and when the connection
// returns. Permissions reload along with the data, so a failed load at start does not stick.
export function useResource<T>(load: () => Promise<T>): Resource<T> {
  const { reloadLevels } = useSession()
  const [state, setState] = useState<{ data?: T; error?: unknown }>({})
  const latestLoad = useRef(load)
  latestLoad.current = load
  const latestRequest = useRef(0)

  const reload = useCallback(() => {
    const request = ++latestRequest.current
    void reloadLevels()
    latestLoad.current().then(
      (data) => {
        if (request === latestRequest.current) setState({ data })
      },
      (error: unknown) => {
        if (request === latestRequest.current) setState({ error })
      },
    )
  }, [reloadLevels])

  useIonViewWillEnter(reload)

  useEffect(() => {
    window.addEventListener('online', reload)
    return () => window.removeEventListener('online', reload)
  }, [reload])

  return { ...state, reload }
}
