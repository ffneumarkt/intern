import { describe, expect, it } from 'vitest'
import type { Due, Item } from '../api/material'
import { groupTimeline } from './timeline'

const due = (label: string, date: string, state: Due['state'] = 'ok'): Due => ({ kind: 'check', label, date, state })
const item = (name: string, dues: Due[], extra: Partial<Item> = {}): Item => ({
  id: name,
  categoryId: 'masken',
  name,
  status: 'active',
  dueState: 'ok',
  dues,
  ...extra,
})

const today = '2026-10-29'
const names = (entries: { item: Item }[]) => entries.map((e) => e.item.name)

describe('groupTimeline', () => {
  it('puts what is overdue first, oldest first, and the rest under its month', () => {
    const items = [
      item('B', [due('Prüfung', '2026-10-21', 'overdue')]),
      item('A', [due('Prüfung', '2026-10-05', 'overdue')]),
      item('C', [due('Prüfung', '2026-11-08', 'dueSoon')]),
      item('D', [due('Prüfung', '2027-01-02')]),
    ]
    const timeline = groupTimeline(items, today, 12)
    expect(names(timeline.overdue)).toEqual(['A', 'B'])
    expect(timeline.months.map((m) => [m.key, m.label, names(m.entries)])).toEqual([
      ['2026-11', 'November 2026', ['C']],
      ['2027-01', 'Jänner 2027', ['D']],
    ])
  })

  it('counts a due date of today in the current month', () => {
    const timeline = groupTimeline([item('A', [due('Prüfung', today, 'dueToday')])], today, 12)
    expect(timeline.months.map((m) => m.key)).toEqual(['2026-10'])
  })

  it('shows every due of an item, ordered by date and then name within a month', () => {
    const items = [
      item('Zeta', [due('Prüfung', '2026-12-01'), due('Lebensdauer', '2026-12-20')]),
      item('Alpha', [due('Prüfung', '2026-12-01')]),
    ]
    const [december] = groupTimeline(items, today, 12).months
    expect(december.entries.map((e) => `${e.item.name} ${e.due.label}`)).toEqual(['Alpha Prüfung', 'Zeta Prüfung', 'Zeta Lebensdauer'])
  })

  it('leaves out retired items and items without dues', () => {
    const items = [item('Retired', [due('Prüfung', '2026-12-01')], { status: 'retired' }), item('None', [])]
    const timeline = groupTimeline(items, today, 12)
    expect(timeline.overdue).toEqual([])
    expect(timeline.months).toEqual([])
    expect(timeline.hasMore).toBe(false)
  })

  it('cuts at the horizon and says there is more', () => {
    // Twelve months from October 2026 on end with September 2027.
    const items = [item('Near', [due('Prüfung', '2027-09-30')]), item('Far', [due('Prüfung', '2027-10-01')])]
    const short = groupTimeline(items, today, 12)
    expect(short.months.map((m) => m.key)).toEqual(['2027-09'])
    expect(short.hasMore).toBe(true)
    const long = groupTimeline(items, today, 24)
    expect(long.months.map((m) => m.key)).toEqual(['2027-09', '2027-10'])
    expect(long.hasMore).toBe(false)
  })

  it('skips months with nothing due', () => {
    const items = [item('A', [due('Prüfung', '2026-11-08')]), item('B', [due('Prüfung', '2027-03-08')])]
    expect(groupTimeline(items, today, 12).months.map((m) => m.key)).toEqual(['2026-11', '2027-03'])
  })
})
