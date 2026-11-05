import type { TransportConfig } from '../transportDocument/calc'
import { pb } from './client'

export interface TransportSettings {
  config: TransportConfig
  checklist: string[]
  // The short name of the station, e.g. "FF Neumarkt": the label of the "from here" choice.
  stationLabel: string
}

const storageKey = 'transportDocument.settings'

// The last settings that loaded, kept on the device. The service worker caches the request as well, but
// it controls a page only after the first reload (later in Safari), so this copy is what guarantees that
// a device that opened the page once can generate documents offline.
function storedSettings(): TransportSettings | null {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    const config = stored?.config
    const usable =
      typeof stored?.stationLabel === 'string' &&
      Array.isArray(stored.checklist) &&
      typeof config?.pointsLimit === 'number' &&
      typeof config.cylinder?.litresTenths === 'number' &&
      typeof config.station?.name === 'string'
    return usable ? stored : null
  } catch {
    return null
  }
}

function remember(settings: TransportSettings): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings))
  } catch {
    // Not remembering is fine.
  }
}

// The single settings record is public to read, so the generator works without a login. The server is
// asked first, so edits show up as soon as the device is online; without a connection the last copy is used.
export async function loadTransportSettings(): Promise<TransportSettings> {
  try {
    const settings = await fetchSettings()
    remember(settings)
    return settings
  } catch (error) {
    const stored = storedSettings()
    if (stored) return stored
    throw error
  }
}

async function fetchSettings(): Promise<TransportSettings> {
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
