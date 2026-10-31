// Pure helpers for the notification settings: the reminder chips and the summary lines.

// Days before the due date; 0 is the day itself.
export const dayChips: { days: number; label: string }[] = [
  { days: 14, label: '14' },
  { days: 7, label: '7' },
  { days: 3, label: '3' },
  { days: 1, label: '1' },
  { days: 0, label: 'Am Tag' },
]

// Adds or removes one day. Values outside the chips (set in the admin UI) stay.
export function toggleDay(timings: number[], days: number): number[] {
  const next = timings.includes(days) ? timings.filter((d) => d !== days) : [...timings, days]
  return next.sort((a, b) => b - a)
}

export function summarize(timings: number[], weeklyOverdue: boolean): string {
  const before = timings.filter((d) => d > 0).sort((a, b) => b - a)
  const parts: string[] = []
  if (before.length > 0) {
    const unit = before.length === 1 && before[0] === 1 ? 'Tag' : 'Tage'
    parts.push(`${before.join(', ')} ${unit} vorher`)
  }
  if (timings.includes(0)) parts.push('Am Tag')
  if (weeklyOverdue) parts.push('wöchentlich')
  return parts.length > 0 ? parts.join(' · ') : 'Keine Erinnerung'
}

export function quietSummary(quiet: { from: string; until: string }): string {
  return quiet.from && quiet.until ? `${quiet.from} bis ${quiet.until}` : 'Aus'
}
