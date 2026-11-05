import type { ReactNode } from 'react'

// One block of a legal page: a title and its paragraphs on a card.
export default function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ui-card legal">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
