import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Back goes one step in the history when this page was reached from inside the app, otherwise to the fallback
// (a page opened by address or notification has nothing to go back to).
export function useGoBack(fallback: string) {
  const navigate = useNavigate()
  const { key } = useLocation()
  return useCallback(() => {
    if (key !== 'default') navigate(-1)
    else navigate(fallback, { replace: true })
  }, [key, navigate, fallback])
}
