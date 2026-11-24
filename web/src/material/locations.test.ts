import { describe, expect, it } from 'vitest'
import { inLocation, locationName, place } from './locations'

const items = [
  { id: 'a', locationId: 'rlf' },
  { id: 'b', locationId: 'werkstatt' },
  { id: 'c', locationId: 'rlf' },
  { id: 'd' },
]

describe('inLocation', () => {
  it('keeps everything without a filter', () => {
    expect(inLocation(items, null)).toEqual(items)
  })

  it('keeps only the items currently in the location', () => {
    expect(inLocation(items, 'rlf').map((i) => i.id)).toEqual(['a', 'c'])
    expect(inLocation(items, 'werkstatt').map((i) => i.id)).toEqual(['b'])
  })

  it('finds nothing in a location nothing is in', () => {
    expect(inLocation(items, 'last')).toEqual([])
  })
})

describe('place', () => {
  it('writes the location for a history entry', () => {
    expect(place('RLF')).toBe('Standort: RLF')
    expect(place(undefined)).toBeUndefined()
    expect(place('')).toBeUndefined()
  })
})

describe('locationName', () => {
  const locations = [
    { id: 'werkstatt', name: 'AS-Werkstatt', isDefault: true },
    { id: 'rlf', name: 'RLF', isDefault: false },
  ]

  it('looks the name up', () => {
    expect(locationName(locations, 'rlf')).toBe('RLF')
  })

  it('has none for an unknown or missing id', () => {
    expect(locationName(locations, 'gone')).toBeUndefined()
    expect(locationName(locations, undefined)).toBeUndefined()
  })
})
