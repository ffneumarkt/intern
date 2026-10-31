const viennaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' })

// Today's calendar date in Europe/Vienna as yyyy-mm-dd.
export function today(): string {
  return viennaDate.format(new Date())
}

// A calendar date moved by whole days (yyyy-mm-dd in, yyyy-mm-dd out).
export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`)
  moved.setUTCDate(moved.getUTCDate() + days)
  return moved.toISOString().slice(0, 10)
}

export const isFuture = (date: string) => date > today()

export const futureDateMessage = 'Datum darf nicht in der Zukunft liegen.'
