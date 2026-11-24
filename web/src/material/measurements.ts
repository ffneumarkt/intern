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

// How far the pressure moved toward 0 in the 60 seconds: the mask leaks, so an underpressure of -10 can
// only become -9, never -11. It works for an overpressure too (10 becomes 9). Negative when the reading
// went the wrong way, which no leak can do.
export const leakLoss = (start: number, end: number): number => round(Math.abs(start) - Math.abs(end))

// What is wrong with a reading that no mask could give: on the other side of 0, or further from 0 than the
// start. null when it is possible.
export function leakReadingProblem(start: number, end: number): string | null {
  if (start * end < 0 || leakLoss(start, end) < 0) return `Nach ${leakSeconds} s kann der Druck nicht weiter von 0 entfernt sein als am Start.`
  return null
}

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
  if (leakReadingProblem(start, end)) return null
  return leakOk(leakLoss(start, end)) && openingOk(opening)
}

// The readings of a check for its history entry. The server stores an empty number as 0, so a check
// with all three at 0 has no readings.
export function measurementDetail(start?: number, end?: number, opening?: number): string | null {
  if (!start && !end && !opening) return null
  const loss = leakLoss(start ?? 0, end ?? 0)
  return `Dichtheit ${formatMbar(start ?? 0)} → ${formatMbar(end ?? 0)} mbar (Verlust ${formatMbar(loss)}), Öffnungsdruck ${formatMbar(opening ?? 0)} mbar`
}
