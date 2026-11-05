import { describe, expect, it } from 'vitest'
import { dayChips, maxLeadDays, quietSummary, summarize, toggleDay } from './notificationText'

describe('lead times', () => {
  it('reach 90 days ahead, like the backend hook', () => {
    expect(maxLeadDays).toBe(90)
  })

  it('are summarized with the longest first', () => {
    expect(summarize([30, 14, 3, 0], true)).toBe('30, 14, 3 Tage vorher · Am Tag · wöchentlich')
  })
})

describe('dayChips', () => {
  it('offers 30, 14, 7, 3 and 1 days before and the day itself', () => {
    expect(dayChips).toEqual([
      { days: 30, label: '30' },
      { days: 14, label: '14' },
      { days: 7, label: '7' },
      { days: 3, label: '3' },
      { days: 1, label: '1' },
      { days: 0, label: 'Am Tag' },
    ])
  })
})

describe('toggleDay', () => {
  it('adds a day in descending order', () => {
    expect(toggleDay([14, 3, 0], 7)).toEqual([14, 7, 3, 0])
  })

  it('removes a chosen day', () => {
    expect(toggleDay([14, 3, 0], 3)).toEqual([14, 0])
  })

  it('keeps values outside the chips', () => {
    expect(toggleDay([30, 3], 1)).toEqual([30, 3, 1])
    expect(toggleDay([30, 3], 3)).toEqual([30])
  })

  it('does not change its input', () => {
    const timings = [0, 14]
    toggleDay(timings, 7)
    expect(timings).toEqual([0, 14])
  })
})

describe('summarize', () => {
  it('lists the days before, the day itself and the weekly reminder', () => {
    expect(summarize([14, 3, 0], true)).toBe('14, 3 Tage vorher · Am Tag · wöchentlich')
  })

  it('says when nothing reminds', () => {
    expect(summarize([], false)).toBe('Keine Erinnerung')
  })

  it('shows only the day itself', () => {
    expect(summarize([0], false)).toBe('Am Tag')
  })

  it('shows days before with the weekly reminder', () => {
    expect(summarize([7], true)).toBe('7 Tage vorher · wöchentlich')
  })

  it('shows only the weekly reminder', () => {
    expect(summarize([], true)).toBe('wöchentlich')
  })

  it('uses the singular for one day', () => {
    expect(summarize([1], false)).toBe('1 Tag vorher')
  })

  it('sorts the days descending', () => {
    expect(summarize([3, 0, 14], false)).toBe('14, 3 Tage vorher · Am Tag')
  })
})

describe('quietSummary', () => {
  it('shows the time span', () => {
    expect(quietSummary({ from: '22:00', until: '07:00' })).toBe('22:00 bis 07:00')
  })

  it('says Aus without times', () => {
    expect(quietSummary({ from: '', until: '' })).toBe('Aus')
  })
})
