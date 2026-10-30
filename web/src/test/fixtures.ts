// Test data, the former UI sketch: Maske 01–06 and LA 01–02 in two categories.
import type { Category, CheckType, Due, HistoryEntry, Item } from '../api/material'
import type { DueState } from '../components/DueStateBadge'

const categories: Category[] = [
  { id: 'masken', name: 'Atemschutzmasken', maxServiceLifeYears: 15 },
  { id: 'lungenautomaten', name: 'Lungenautomaten' },
]

const checkTypes: CheckType[] = [
  { id: 'maskenpruefung', categoryId: 'masken', name: 'Maskenprüfung', intervalMonths: 12, afterUse: true, isDefault: false, alsoSatisfies: [] },
  { id: 'fuenfjahr', categoryId: 'masken', name: '5-Jahres-Prüfung', intervalMonths: 60, afterUse: false, isDefault: false, alsoSatisfies: ['maskenpruefung'] },
  { id: 'la-jahr', categoryId: 'lungenautomaten', name: 'Jahresprüfung', intervalMonths: 12, afterUse: true, isDefault: false, alsoSatisfies: [] },
]

const checkDue = (label: string, date: string, state: DueState, checkTypeId = 'maskenpruefung'): Due => ({
  kind: 'check',
  checkTypeId,
  label,
  date,
  state,
})

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
    checkDue('Maskenprüfung', dueDate, dueState),
    checkDue('5-Jahres-Prüfung', '2028-05-12', 'ok', 'fuenfjahr'),
    { kind: 'endOfLife', label: 'Lebensdauer', date: '2031-03-01', state: 'ok' },
  ],
  ...extra,
})

const items = (): Item[] => [
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
    dues: [checkDue('Jahresprüfung', '2026-11-05', 'dueSoon', 'la-jahr')],
  },
  { id: 'l02', categoryId: 'lungenautomaten', name: 'LA 02', status: 'active', dueState: 'ok', dues: [] },
]

const history: HistoryEntry[] = [
  { itemId: 'm01', date: '2026-10-21', kind: 'use', title: 'Einsatz', detail: 'Erfasst von Stationsrechner · Brand Wohnhaus' },
  { itemId: 'm01', date: '2025-11-03', kind: 'check', title: 'Maskenprüfung: bestanden', detail: 'R. Loisinger' },
  { itemId: 'm01', date: '2023-05-12', kind: 'check', title: '5-Jahres-Prüfung: bestanden', detail: 'Prüfstelle' },
]

export const freshData = () => ({ categories, checkTypes, items: items(), history: [...history] })
