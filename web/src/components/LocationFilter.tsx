import { Chip } from '@/components/ui/chip'
import type { Location } from '../api/material'

// Chips to show only the items that are currently in one location ("the masks that are in RLF").
export default function LocationFilter({ locations, value, onChange }: { locations: Location[]; value: string | null; onChange(id: string | null): void }) {
  if (locations.length === 0) return null
  return (
    <div className="ui-chips" role="group" aria-label="Standort">
      <Chip outline={value !== null} onClick={() => onChange(null)}>
        Alle
      </Chip>
      {locations.map((l) => (
        <Chip key={l.id} outline={value !== l.id} onClick={() => onChange(l.id)}>
          {l.name}
        </Chip>
      ))}
    </div>
  )
}
