import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ActionBar, BlockButton, Card, ErrorText, Hint } from './ui'

describe('ErrorText', () => {
  it('shows the message as danger text', () => {
    const { container } = render(<ErrorText>Speichern fehlgeschlagen.</ErrorText>)
    const text = container.querySelector('ion-text')!
    expect(text).toHaveTextContent('Speichern fehlgeschlagen.')
    expect(text).toHaveProperty('color', 'danger')
  })

  it.each([undefined, null, '', false])('shows nothing for %j', (message) => {
    const { container } = render(<ErrorText>{message}</ErrorText>)
    expect(container.querySelector('ion-text')).toBeNull()
  })

  it('passes a role on, for messages that should be announced', () => {
    const { container } = render(<ErrorText role="status">Kamerazugriff verweigert</ErrorText>)
    expect(container.querySelector('ion-text')).toHaveAttribute('role', 'status')
  })
})

describe('ActionBar', () => {
  it('is the sticky bar at the bottom of a page, around its buttons', () => {
    const { container } = render(
      <ActionBar>
        <button>Speichern</button>
      </ActionBar>,
    )
    const bar = container.firstElementChild!
    expect(bar).toHaveClass('ui-actions')
    expect(bar).toContainElement(container.querySelector('button'))
  })
})

describe('Hint', () => {
  it('is a muted paragraph', () => {
    const { container } = render(<Hint>Weiteres Gerät scannen?</Hint>)
    expect(container.querySelector('p')).toHaveClass('ui-hint')
  })

  it('can be centred and takes extra spacing', () => {
    const { container } = render(
      <Hint center style={{ margin: '6px 0 14px' }}>
        oder
      </Hint>,
    )
    const p = container.querySelector('p')!
    expect(p).toHaveClass('ui-hint', 'ui-hint--center')
    expect(p.style.margin).toBe('6px 0px 14px')
  })
})

describe('Card', () => {
  it('wraps its content in an Ionic card', () => {
    const { container } = render(<Card>Inhalt</Card>)
    expect(container.querySelector('ion-card > ion-card-content')).toHaveTextContent('Inhalt')
  })

  it('can be a warning card', () => {
    const { container } = render(<Card tone="warning">Nicht gefunden</Card>)
    expect(container.querySelector('ion-card')).toHaveAttribute('color', 'warning')
  })
})

describe('BlockButton', () => {
  it('is a full-width Ionic button that passes its props on', () => {
    const onClick = vi.fn()
    const { container } = render(
      <BlockButton fill="outline" disabled onClick={onClick}>
        Fertig
      </BlockButton>,
    )
    const button = container.querySelector('ion-button')!
    expect(button).toHaveTextContent('Fertig')
    expect(button).toHaveAttribute('expand', 'block')
    expect(button).toHaveAttribute('fill', 'outline')
    expect(button).toHaveProperty('disabled', true)
  })

  it('reacts to a click', () => {
    const onClick = vi.fn()
    const { container } = render(<BlockButton onClick={onClick}>Speichern</BlockButton>)
    fireEvent.click(container.querySelector('ion-button')!)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
