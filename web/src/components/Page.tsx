import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useGoBack } from './useGoBack'

// Common page frame: a header with title (and back button), then the content on the grey page in a
// centred column (see theme/ui.css). `grouped` is for pages of inset lists, as in the iOS settings:
// the column has no side padding, the lists bring their own margins.
// `fab` is a floating button, fixed above the tab bar.
export default function Page({ title, back, grouped, fab, children }: { title: string; back?: string; grouped?: boolean; fab?: ReactNode; children?: ReactNode }) {
  return (
    <div className="app-page">
      <header className="app-header">
        {back && <BackButton fallback={back} />}
        <div className="app-title">{title}</div>
      </header>
      <main>
        {fab}
        <div className={grouped ? 'ui-page ui-page--flat' : 'ui-page'}>
          <h1 className="page-heading">{title}</h1>
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
    </button>
  )
}
