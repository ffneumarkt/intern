import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { List, ListHeader, Note, Row, RowLabel } from '@/components/ui/list'

describe('Row', () => {
  it('is a plain row without a link or a click handler', () => {
    render(
      <Row>
        <RowLabel>Maske 01</RowLabel>
      </Row>,
    )
    const row = screen.getByText('Maske 01').closest('[data-slot="row"]')!
    expect(row.tagName).toBe('DIV')
  })

  it('is a link with `to`, and shows a chevron for `detail`', () => {
    render(
      <MemoryRouter>
        <Row to="/material/geraete/m01" detail>
          <RowLabel>Maske 01</RowLabel>
        </Row>
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Maske 01' })
    expect(link).toHaveAttribute('href', '/material/geraete/m01')
    expect(link.querySelector('svg')).not.toBeNull()
  })

  it('is a button with onClick, and does not react when disabled', () => {
    const onClick = vi.fn()
    const { rerender } = render(<Row onClick={onClick}>Wählen</Row>)
    fireEvent.click(screen.getByRole('button', { name: 'Wählen' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(
      <Row onClick={onClick} disabled>
        Wählen
      </Row>,
    )
    expect(screen.getByRole('button', { name: 'Wählen' })).toBeDisabled()
  })

  it('passes a role and a data attribute on, and can leave out the line below', () => {
    render(
      <Row role="listitem" data-state="overdue" lines="none">
        Eintrag
      </Row>,
    )
    const row = screen.getByRole('listitem')
    expect(row).toHaveAttribute('data-state', 'overdue')
    expect(row).not.toHaveClass('border-b')
  })
})

describe('List', () => {
  it('groups rows, takes a role and a label, and can be inset', () => {
    render(
      <List role="list" aria-label="Gescannte Geräte" inset>
        <Row role="listitem">Eins</Row>
        <Row role="listitem">Zwei</Row>
      </List>,
    )
    const list = screen.getByRole('list', { name: 'Gescannte Geräte' })
    expect(list.querySelectorAll('[role="listitem"]')).toHaveLength(2)
    expect(list).toHaveClass('rounded-xl')
  })
})

describe('ListHeader and Note', () => {
  it('shows a header over a list', () => {
    render(<ListHeader>Verlauf</ListHeader>)
    expect(screen.getByText('Verlauf')).toBeInTheDocument()
  })

  it('shows a muted note, which can sit at the end of a row', () => {
    render(<Note slot="end">2026-10-21</Note>)
    const note = screen.getByText('2026-10-21')
    expect(note).toHaveClass('text-muted-foreground')
    expect(note).toHaveAttribute('slot', 'end')
  })
})
