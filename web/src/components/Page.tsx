import { ChevronLeft } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { backLabel } from './backLabel'
import { useGoBack } from './useGoBack'

// Common page frame, as in iOS: a navigation bar (back button, the title once it scrolled away, an action on the
// right) and the content on the grey page in a centred column with a large title on top (see theme/ui.css).
// `grouped` is for pages of inset lists, as in the iOS settings: the column has no side padding, the lists bring
// their own margins. `fab` is an icon button for the right of the navigation bar.
export default function Page({ title, back, grouped, fab, children }: { title: string; back?: string; grouped?: boolean; fab?: ReactNode; children?: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  // The bar shows its own title when the large one has scrolled under it.
  useEffect(() => {
    const el = heading.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), { rootMargin: '-48px 0px 0px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div className="app-page">
      <header className="app-header" data-collapsed={collapsed}>
        {back && <BackButton fallback={back} />}
        <div className="app-title" aria-hidden="true">
          {title}
        </div>
        {fab && <div className="app-actions">{fab}</div>}
      </header>
      <main>
        <div className={grouped ? 'ui-page ui-page--flat' : 'ui-page'}>
          <h1 className="page-heading" ref={heading}>
            {title}
          </h1>
          {children}
        </div>
      </main>
    </div>
  )
}

function BackButton({ fallback }: { fallback: string }) {
  const goBack = useGoBack(fallback)
  return (
    <button type="button" className="app-back" aria-label="Zurück" onClick={goBack}>
      <ChevronLeft aria-hidden="true" />
      <span aria-hidden="true">{backLabel(fallback)}</span>
    </button>
  )
}
