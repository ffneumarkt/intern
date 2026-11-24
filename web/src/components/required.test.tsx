import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requiredMessage, showFirstInvalid } from './required'

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

describe('showFirstInvalid', () => {
  it('has the German message', () => {
    expect(requiredMessage).toBe('Bitte ausfüllen.')
  })

  it('scrolls the first invalid field into view and leaves the focus alone', () => {
    const page = document.body.appendChild(document.createElement('div'))
    field(page, 'ok', false)
    const first = field(page, 'first', true)
    const second = field(page, 'second', true)
    showFirstInvalid()
    vi.runAllTimers()
    expect(first.el.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(second.el.scrollIntoView).not.toHaveBeenCalled()
    // Taking the focus would start Ionic's iOS input shim, which swaps in a copy of the field.
    expect(document.activeElement).not.toBe(first.input)
    expect(document.activeElement).toBe(document.body)
  })

  it('waits one tick, so the errors have been rendered', () => {
    const page = document.body.appendChild(document.createElement('div'))
    const late = field(page, 'late', true)
    showFirstInvalid()
    expect(late.el.scrollIntoView).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(late.el.scrollIntoView).toHaveBeenCalled()
  })

  it('skips fields on a page Ionic keeps mounted but hidden', () => {
    const hidden = document.body.appendChild(document.createElement('div'))
    hidden.className = 'ion-page-hidden'
    const old = field(hidden, 'old', true)
    const shown = document.body.appendChild(document.createElement('div'))
    const current = field(shown, 'current', true)
    showFirstInvalid()
    vi.runAllTimers()
    expect(old.el.scrollIntoView).not.toHaveBeenCalled()
    expect(current.el.scrollIntoView).toHaveBeenCalled()
  })

  it('does nothing when no field is invalid', () => {
    const page = document.body.appendChild(document.createElement('div'))
    field(page, 'fine', false)
    expect(() => {
      showFirstInvalid()
      vi.runAllTimers()
    }).not.toThrow()
  })
})
