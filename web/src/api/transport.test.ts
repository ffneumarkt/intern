import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTransportSettings } from './transport'

const record = {
  id: 'abc',
  station_name: 'FF Neumarkt',
  station_street: 'Edlwies 3',
  station_postal_code: '4212',
  station_town: 'Neumarkt im Mühlkreis',
  cylinder_label: '6,8',
  cylinder_litres_tenths: 68,
  points_limit: 1000,
  filling_station_name: 'FF Grünbach',
  filling_station_street: 'Freiwaldstraße 15',
  filling_station_postal_code: '4264',
  filling_station_town: 'Grünbach bei Freistadt',
  checklist: ['Schutzkappen montiert'],
}

function serve(items: object[]) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ page: 1, perPage: 1, totalItems: items.length, totalPages: 1, items })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('loadTransportSettings', () => {
  it('turns the record into the generator config', async () => {
    serve([record])
    const settings = await loadTransportSettings()
    expect(settings.stationLabel).toBe('FF Neumarkt')
    expect(settings.checklist).toEqual(['Schutzkappen montiert'])
    expect(settings.config).toEqual({
      cylinder: { label: '6,8', litresTenths: 68 },
      pointsLimit: 1000,
      station: { name: 'FF Neumarkt', street: 'Edlwies 3', postalCode: '4212', town: 'Neumarkt im Mühlkreis' },
      fillingStation: { name: 'FF Grünbach', street: 'Freiwaldstraße 15', postalCode: '4264', town: 'Grünbach bei Freistadt' },
    })
  })

  it('has no filling station when its name is empty', async () => {
    serve([{ ...record, filling_station_name: '  ' }])
    expect((await loadTransportSettings()).config.fillingStation).toBeNull()
  })

  it('treats a missing checklist as empty', async () => {
    serve([{ ...record, checklist: null }])
    expect((await loadTransportSettings()).checklist).toEqual([])
  })

  it('fails when no record exists', async () => {
    serve([])
    await expect(loadTransportSettings()).rejects.toThrow()
  })

  it('reads the list without logging in', async () => {
    const fetchMock = serve([record])
    await loadTransportSettings()
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/api/collections/transport_document_settings/records')
  })
})
