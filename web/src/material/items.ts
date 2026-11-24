import type { Item } from '../api/material'

export const findByBarcode = (items: Item[], code: string) => items.find((i) => i.status !== 'retired' && i.barcode === code)

// Live suggestions while typing a code: active items whose code or name contains the text.
export function searchItems(items: Item[], text: string, excludeIds: string[]) {
  const q = text.trim().toLowerCase()
  if (!q) return []
  return items.filter(
    (i) =>
      i.status !== 'retired' &&
      !excludeIds.includes(i.id) &&
      (i.barcode?.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)),
  )
}
