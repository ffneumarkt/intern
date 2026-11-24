// Locations of items: where an item is now (the workshop or a truck).

// The items currently in a location; null keeps all of them.
export function inLocation<T extends { locationId?: string }>(items: T[], locationId: string | null): T[] {
  return locationId === null ? items : items.filter((i) => i.locationId === locationId)
}

// The location of a history entry.
export const place = (name?: string) => (name ? `Standort: ${name}` : undefined)

export const locationName = (locations: { id: string; name: string }[], id?: string): string | undefined =>
  locations.find((l) => l.id === id)?.name
