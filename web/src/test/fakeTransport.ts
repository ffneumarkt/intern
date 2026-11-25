// Stand-in for api/transport. Tests change `transportState`; setup.ts resets it.
import type { TransportSettings } from '../api/transport'

export type { TransportSettings }

export const defaultSettings = (): TransportSettings => ({
  stationLabel: 'FF Neumarkt',
  checklist: ['Schutzkappen montiert', 'Restdruck vorhanden'],
  config: {
    cylinder: { label: '6,8', litresTenths: 68 },
    pointsLimit: 1000,
    station: { name: 'FF Neumarkt', street: 'Edlwies 3', postalCode: '4212', town: 'Neumarkt im Mühlkreis' },
    fillingStation: { name: 'FF Grünbach', street: 'Freiwaldstraße 15', postalCode: '4264', town: 'Grünbach bei Freistadt' },
  },
})

const fresh = () => ({ settings: defaultSettings(), failing: false, saved: [] as TransportSettings[] })

export let transportState = fresh()

export function resetTransport() {
  transportState = fresh()
}

export async function loadTransportSettings(): Promise<TransportSettings> {
  if (transportState.failing) throw new TypeError('Failed to fetch')
  return transportState.settings
}

export async function updateTransportSettings(settings: TransportSettings): Promise<void> {
  if (transportState.failing) throw new TypeError('Failed to fetch')
  transportState.saved.push(settings)
  transportState.settings = settings
}
