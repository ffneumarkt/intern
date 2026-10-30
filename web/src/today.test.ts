import { afterEach, expect, it, vi } from 'vitest'
import { today } from './today'

afterEach(() => {
  vi.useRealTimers()
})

it('is the calendar date in Vienna', () => {
  vi.useFakeTimers({ now: new Date('2026-10-29T23:30:00Z') })
  expect(today()).toBe('2026-10-30')
})

it('follows summer time', () => {
  vi.useFakeTimers({ now: new Date('2026-07-15T21:30:00Z') })
  expect(today()).toBe('2026-07-15')
})
