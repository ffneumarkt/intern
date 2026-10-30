import { useIonViewWillEnter } from '@ionic/react'
import { useCallback, useRef, useState } from 'react'

export interface Resource<T> {
  data?: T
  error?: unknown
  reload(): void
}

// Loads whenever the page is entered: Ionic keeps pages mounted, so an effect would show stale
// data when coming back.
export function useResource<T>(load: () => Promise<T>): Resource<T> {
  const [state, setState] = useState<{ data?: T; error?: unknown }>({})
  const latestLoad = useRef(load)
  latestLoad.current = load
  const latestRequest = useRef(0)

  const reload = useCallback(() => {
    const request = ++latestRequest.current
    latestLoad.current().then(
      (data) => {
        if (request === latestRequest.current) setState({ data })
      },
      (error: unknown) => {
        if (request === latestRequest.current) setState({ error })
      },
    )
  }, [])

  useIonViewWillEnter(reload)
  return { ...state, reload }
}
