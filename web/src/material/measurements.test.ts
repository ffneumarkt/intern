import { describe, expect, it } from 'vitest'
import { formatMbar, leakLoss, leakOk, measurementDetail, measurementsPass, openingHint, openingOk, parseMbar } from './measurements'

describe('parseMbar', () => {
  it.each([
    ['-10', -10],
    ['-0,5', -0.5],
    ['5.1', 5.1],
    ['  4,2 ', 4.2],
    ['−9', -9],
    ['0', 0],
    ['+3', 3],
  ])('reads %j as %d', (text, value) => {
    expect(parseMbar(text)).toBe(value)
  })

  it.each(['', ' ', '-', 'abc', '1,2,3', '5 mbar', '--5', '1e3'])('rejects %j', (text) => {
    expect(parseMbar(text)).toBeNull()
  })
})

describe('formatMbar', () => {
  it('uses a decimal comma and drops needless digits', () => {
    expect(formatMbar(-10)).toBe('-10')
    expect(formatMbar(5.1)).toBe('5,1')
    expect(formatMbar(0.5)).toBe('0,5')
    expect(formatMbar(4.2)).toBe('4,2')
  })
})

describe('leak test', () => {
  it('takes the size of the pressure change over the 60 seconds', () => {
    expect(leakLoss(-10, -9)).toBe(1)
    expect(leakLoss(-10, -9.5)).toBe(0.5)
    expect(leakLoss(10, 9)).toBe(1)
    expect(leakLoss(-10, -10.3)).toBe(0.3)
  })

  it('does not drift on decimals', () => {
    expect(leakLoss(-9.9, -8.9)).toBe(1)
    expect(leakOk(leakLoss(-9.9, -8.9))).toBe(true)
  })

  it('passes up to 1 mbar and fails above', () => {
    expect(leakOk(0)).toBe(true)
    expect(leakOk(1)).toBe(true)
    expect(leakOk(1.1)).toBe(false)
    expect(leakOk(5)).toBe(false)
  })
})

describe('opening pressure', () => {
  it('passes from 4,2 to 6,0 mbar inclusive', () => {
    expect(openingOk(4.2)).toBe(true)
    expect(openingOk(5)).toBe(true)
    expect(openingOk(6)).toBe(true)
    expect(openingOk(4.1)).toBe(false)
    expect(openingOk(6.1)).toBe(false)
  })

  it('names the missed limit', () => {
    expect(openingHint(5)).toBeNull()
    expect(openingHint(3.9)).toBe('zu niedrig (mindestens 4,2 mbar)')
    expect(openingHint(6.5)).toBe('zu hoch (höchstens 6,0 mbar)')
  })
})

describe('measurementsPass', () => {
  it('needs all three values', () => {
    expect(measurementsPass(-10, null, 5)).toBeNull()
    expect(measurementsPass(null, -9, 5)).toBeNull()
    expect(measurementsPass(-10, -9, null)).toBeNull()
  })

  it('is true only when both tests are within their limits', () => {
    expect(measurementsPass(-10, -9.5, 5.1)).toBe(true)
    expect(measurementsPass(-10, -5, 5.1)).toBe(false)
    expect(measurementsPass(-10, -9.5, 7)).toBe(false)
  })
})

describe('measurementDetail', () => {
  it('writes both readings for the history', () => {
    expect(measurementDetail(-10, -9, 5.1)).toBe('Dichtheit -10 → -9 mbar (Verlust 1), Öffnungsdruck 5,1 mbar')
    expect(measurementDetail(-10, -9.5, 4.2)).toBe('Dichtheit -10 → -9,5 mbar (Verlust 0,5), Öffnungsdruck 4,2 mbar')
  })

  it('is empty for a check without readings (the server stores empty numbers as 0)', () => {
    expect(measurementDetail(0, 0, 0)).toBeNull()
    expect(measurementDetail(undefined, undefined, undefined)).toBeNull()
  })
})
