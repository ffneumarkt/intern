import { afterEach, expect, it, vi } from 'vitest'
import { addDays, today } from './today'

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

it('adds days across month and year ends', () => {
  expect(addDays('2026-10-29', 90)).toBe('2027-01-27')
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  expect(addDays('2026-10-29', 0)).toBe('2026-10-29')
})
