// The two readings of the mask test, as printed on the paper Betriebsnachweis: the Dichtprüfung
// ("-10 mbar -> 1 mbar/60 s trocken") and the Öffnungsdruck of the exhalation valve ("4,2-6,0 mbar bei
// 10 l/min, EN 137"). The limits are fixed here, like on the sheet.
export const leakSeconds = 60
export const leakStartMbar = -10
export const leakLimitMbar = 1
export const openingMinMbar = 4.2
export const openingMaxMbar = 6.0

const round = (value: number) => Math.round(value * 100) / 100

// A decimal number typed with a comma or a dot, with an optional sign. Anything else is not a value.
export function parseMbar(text: string): number | null {
  const cleaned = text.trim().replace('−', '-').replace(',', '.')
  return /^[+-]?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null
}

export const formatMbar = (value: number): string => String(round(value)).replace('.', ',')

// How far the pressure moved in the 60 seconds; the size is used, so an overpressure test works too.
export const leakLoss = (start: number, end: number): number => round(Math.abs(end - start))

export const leakOk = (loss: number): boolean => loss <= leakLimitMbar

export const openingOk = (value: number): boolean => value >= openingMinMbar && value <= openingMaxMbar

export function openingHint(value: number): string | null {
  if (value < openingMinMbar) return `zu niedrig (mindestens ${formatMbar(openingMinMbar)} mbar)`
  if (value > openingMaxMbar) return `zu hoch (höchstens ${openingMaxMbar.toFixed(1).replace('.', ',')} mbar)`
  return null
}

// null while a value is missing.
export function measurementsPass(start: number | null, end: number | null, opening: number | null): boolean | null {
  if (start === null || end === null || opening === null) return null
  return leakOk(leakLoss(start, end)) && openingOk(opening)
}
