const viennaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' })

// Today's calendar date in Europe/Vienna as yyyy-mm-dd.
export function today(): string {
  return viennaDate.format(new Date())
}
