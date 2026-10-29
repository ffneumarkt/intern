// Sketch-only sample data. Shapes follow the spec's collections; due states are precomputed here
// and will come from /api/material/due in phase 2.
import type { DueState } from '../components/DueStateBadge'

export interface Category {
  id: string
  name: string
  maxServiceLifeYears?: number
}

export interface CheckType {
  id: string
  categoryId: string
  name: string
  intervalMonths?: number
  afterUse: boolean
  alsoSatisfies: string[]
}

export interface Due {
  label: string
  date: string
  state: DueState
}

export interface Item {
  id: string
  categoryId: string
  name: string
  serial?: string
  barcode?: string
  manufacturedOn?: string
  status: 'active' | 'defective' | 'retired'
  note?: string
  dueState: DueState
  dues: Due[]
}

export interface HistoryEntry {
  itemId: string
  date: string
  kind: 'use' | 'check'
  title: string
  detail: string
}

export const categories: Category[] = [
  { id: 'masken', name: 'Atemschutzmasken', maxServiceLifeYears: 15 },
  { id: 'lungenautomaten', name: 'Lungenautomaten' },
]

export const checkTypes: CheckType[] = [
  { id: 'maskenpruefung', categoryId: 'masken', name: 'Maskenprüfung', intervalMonths: 12, afterUse: true, alsoSatisfies: [] },
  { id: 'fuenfjahr', categoryId: 'masken', name: '5-Jahres-Prüfung', intervalMonths: 60, afterUse: false, alsoSatisfies: ['maskenpruefung'] },
  { id: 'la-jahr', categoryId: 'lungenautomaten', name: 'Jahresprüfung', intervalMonths: 12, afterUse: true, alsoSatisfies: [] },
]

const mask = (n: string, dueState: DueState, dueDate: string, extra: Partial<Item> = {}): Item => ({
  id: `m${n}`,
  categoryId: 'masken',
  name: `Maske ${n}`,
  serial: `DR-4711-${n}`,
  barcode: `M-0${n}`,
  manufacturedOn: '2016-03-01',
  status: 'active',
  dueState,
  dues: [
    { label: 'Maskenprüfung', date: dueDate, state: dueState },
    { label: '5-Jahres-Prüfung', date: '2028-05-12', state: 'ok' },
    { label: 'Lebensdauer', date: '2031-03-01', state: 'ok' },
  ],
  ...extra,
})

export const items: Item[] = [
  mask('01', 'overdue', '2026-10-21'),
  mask('02', 'dueToday', '2026-10-29'),
  mask('03', 'dueSoon', '2026-11-08'),
  mask('04', 'ok', '2027-06-14'),
  mask('05', 'overdue', '2026-10-27', { status: 'defective', note: 'Ausatemventil undicht' }),
  mask('06', 'ok', '-', { status: 'retired', dues: [] }),
  {
    id: 'l01',
    categoryId: 'lungenautomaten',
    name: 'LA 01',
    barcode: 'L-001',
    status: 'active',
    dueState: 'dueSoon',
    dues: [{ label: 'Jahresprüfung', date: '2026-11-05', state: 'dueSoon' }],
  },
]

export const history: HistoryEntry[] = [
  { itemId: 'm01', date: '2026-10-21', kind: 'use', title: 'Einsatz', detail: 'Erfasst von Stationsrechner · Brand Wohnhaus' },
  { itemId: 'm01', date: '2025-11-03', kind: 'check', title: 'Maskenprüfung: bestanden', detail: 'R. Loisinger' },
  { itemId: 'm01', date: '2023-05-12', kind: 'check', title: '5-Jahres-Prüfung: bestanden', detail: 'Prüfstelle' },
]

export const findByBarcode = (code: string) => items.find((i) => i.barcode === code)

// Live suggestions while typing a code: active items whose code or name contains the text.
export const searchItems = (text: string, excludeIds: string[] = []) => {
  const q = text.trim().toLowerCase()
  if (!q) return []
  return items.filter(
    (i) =>
      i.status !== 'retired' &&
      !excludeIds.includes(i.id) &&
      (i.barcode?.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)),
  )
}
