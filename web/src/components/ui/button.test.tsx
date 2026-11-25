import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('is the red primary button by default', () => {
    render(<Button>Speichern</Button>)
    const button = screen.getByRole('button', { name: 'Speichern' })
    expect(button).toHaveClass('bg-primary', 'text-primary-foreground')
  })

  it('has the green check variant and a large size', () => {
    render(
      <Button variant="check" size="lg">
        Prüfung erfassen
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Prüfung erfassen' })).toHaveClass('bg-check', 'h-[50px]')
  })

  it('takes a class that overrides the variant', () => {
    render(<Button className="bg-muted">Weiter</Button>)
    const button = screen.getByRole('button', { name: 'Weiter' })
    expect(button).toHaveClass('bg-muted')
    expect(button).not.toHaveClass('bg-primary')
  })

  it('does not react when disabled', () => {
    render(<Button disabled>Speichern</Button>)
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled()
  })

  it('renders as the child element with asChild, so a link looks like a button', () => {
    render(
      <Button asChild variant="outline">
        <a href="/material">Zur Liste</a>
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Zur Liste' })
    expect(link).toHaveAttribute('href', '/material')
    expect(link).toHaveClass('bg-primary/10')
  })
})
