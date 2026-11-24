import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { focusFirstInvalid, requiredMessage } from './required'

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
})

function field(parent: HTMLElement, id: string, invalid: boolean) {
  const el = document.createElement('ion-input')
  if (invalid) el.className = 'ion-invalid ion-touched'
  const input = document.createElement('input')
  input.id = id
  el.appendChild(input)
  el.scrollIntoView = vi.fn()
  parent.appendChild(el)
  return { el, input }
}

describe('focusFirstInvalid', () => {
  it('has the German message', () => {
    expect(requiredMessage).toBe('Bitte ausfüllen.')
  })

  it('scrolls to the first invalid field and puts the cursor there', () => {
    const page = document.body.appendChild(document.createElement('div'))
    field(page, 'ok', false)
    const first = field(page, 'first', true)
    field(page, 'second', true)
    focusFirstInvalid()
    vi.runAllTimers()
    expect(first.el.scrollIntoView).toHaveBeenCalled()
    expect(document.activeElement).toBe(first.input)
  })

  it('waits one tick, so the errors have been rendered', () => {
    const page = document.body.appendChild(document.createElement('div'))
    const late = field(page, 'late', true)
    focusFirstInvalid()
    expect(document.activeElement).not.toBe(late.input)
    vi.runAllTimers()
    expect(document.activeElement).toBe(late.input)
  })

  it('skips fields on a page Ionic keeps mounted but hidden', () => {
    const hidden = document.body.appendChild(document.createElement('div'))
    hidden.className = 'ion-page-hidden'
    field(hidden, 'old', true)
    const shown = document.body.appendChild(document.createElement('div'))
    const current = field(shown, 'current', true)
    focusFirstInvalid()
    vi.runAllTimers()
    expect(document.activeElement).toBe(current.input)
  })

  it('does nothing when no field is invalid', () => {
    const page = document.body.appendChild(document.createElement('div'))
    field(page, 'fine', false)
    expect(() => {
      focusFirstInvalid()
      vi.runAllTimers()
    }).not.toThrow()
  })
})
