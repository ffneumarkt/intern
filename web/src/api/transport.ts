import type { TransportConfig } from '../transportDocument/calc'
import { pb } from './client'

export interface TransportSettings {
  config: TransportConfig
  checklist: string[]
  // The short name of the station, e.g. "FF Neumarkt": the label of the "from here" choice.
  stationLabel: string
}

// The single settings record is public to read, so the generator works without a login. The service
// worker caches this request (network first), which is what keeps the generator usable offline.
export async function loadTransportSettings(): Promise<TransportSettings> {
  const { items } = await pb.collection('transport_document_settings').getList(1, 1)
  const r = items[0]
  if (!r) throw new Error('transport_document_settings has no record')
  const fillingStationName = String(r.filling_station_name ?? '').trim()
  return {
    stationLabel: r.station_name,
    checklist: Array.isArray(r.checklist) ? r.checklist : [],
    config: {
      cylinder: { label: r.cylinder_label, litresTenths: r.cylinder_litres_tenths },
      pointsLimit: r.points_limit,
      station: { name: r.station_name, street: r.station_street, postalCode: r.station_postal_code, town: r.station_town },
      fillingStation: fillingStationName
        ? { name: fillingStationName, street: r.filling_station_street, postalCode: r.filling_station_postal_code, town: r.filling_station_town }
        : null,
    },
  }
}
