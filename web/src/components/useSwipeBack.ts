import { useEffect, type RefObject } from 'react'

const edge = 24
const commitShare = 0.33

// The iOS swipe from the left edge to go back: the page follows the finger; past a third of the width (or a fast
// flick) it goes back, otherwise it springs back. Only on pages that have a back button.
export function useSwipeBack(view: RefObject<HTMLElement | null>, goBack: () => void, enabled: boolean) {
  useEffect(() => {
    const el = view.current
    if (!el || !enabled) return
    let startX = 0
    let startY = 0
    let startTime = 0
    let dragging = false
    let page: HTMLElement | null = null

    const reset = (animate: boolean) => {
      if (!page) return
      page.style.transition = animate ? 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' : ''
      page.style.transform = ''
      page.style.boxShadow = ''
    }
    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      page = el.querySelector<HTMLElement>('.app-page')
      dragging = false
      if (!page || touch.clientX > edge || !page.querySelector('.app-back')) {
        page = null
        return
      }
      startX = touch.clientX
      startY = touch.clientY
      startTime = e.timeStamp
    }
    const onMove = (e: TouchEvent) => {
      if (!page) return
      const touch = e.touches[0]
      const dx = touch.clientX - startX
      if (!dragging) {
        // A mostly vertical move is a scroll, not a swipe.
        if (Math.abs(touch.clientY - startY) > Math.abs(dx) && Math.abs(touch.clientY - startY) > 8) {
          page = null
          return
        }
        if (dx < 8) return
        dragging = true
      }
      page.style.transition = 'none'
      page.style.transform = `translateX(${Math.max(dx, 0)}px)`
      page.style.boxShadow = '-8px 0 24px rgba(0, 0, 0, 0.18)'
    }
    const onEnd = (e: TouchEvent) => {
      if (!page || !dragging) {
        page = null
        return
      }
      const dx = e.changedTouches[0].clientX - startX
      const fast = dx / Math.max(e.timeStamp - startTime, 1) > 0.5
      const commit = dx > el.clientWidth * commitShare || (fast && dx > 40)
      reset(!commit)
      page = null
      dragging = false
      if (commit) goBack()
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [view, goBack, enabled])
}
