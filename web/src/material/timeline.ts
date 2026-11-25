import type { Due, Item } from '../api/material'

export interface Entry {
  item: Item
  due: Due
}

export interface Month {
  key: string
  label: string
  entries: Entry[]
}

export interface Timeline {
  overdue: Entry[]
  months: Month[]
  // True when due dates lie beyond the months shown.
  hasMore: boolean
}

const monthName = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric', timeZone: 'UTC' })

const monthOf = (date: string) => date.slice(0, 7)

// The key of the month that many months after the one of the date.
function addMonths(date: string, months: number): string {
  const [year, month] = monthOf(date).split('-').map(Number)
  const index = year * 12 + (month - 1) + months
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

const byDate = (a: Entry, b: Entry) => a.due.date.localeCompare(b.due.date) || a.item.name.localeCompare(b.item.name, 'de')

// Every due date of the active items: what is overdue first, then the months from today on, each with its
// due dates in order. Months with nothing due are left out; months past the horizon are cut.
export function groupTimeline(items: Item[], today: string, months: number): Timeline {
  const entries = items.filter((i) => i.status !== 'retired').flatMap((item) => item.dues.map((due) => ({ item, due })))
  const overdue = entries.filter((e) => e.due.state === 'overdue').sort(byDate)
  const upcoming = entries.filter((e) => e.due.state !== 'overdue').sort(byDate)
  const horizon = addMonths(today, months)
  const shown = upcoming.filter((e) => monthOf(e.due.date) < horizon)

  const grouped = new Map<string, Entry[]>()
  for (const entry of shown) {
    const key = monthOf(entry.due.date)
    grouped.set(key, [...(grouped.get(key) ?? []), entry])
  }
  return {
    overdue,
    months: [...grouped].map(([key, list]) => ({ key, label: monthName.format(new Date(`${key}-01T00:00:00Z`)), entries: list })),
    hasMore: shown.length < upcoming.length,
  }
}
