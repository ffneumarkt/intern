import type { DueState } from '../components/DueStateBadge'
import { pb } from './client'

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

export type DueKind = 'check' | 'endOfLife' | 'defect'

export interface Due {
  kind: DueKind
  checkTypeId?: string
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

interface DueResponse {
  items: (Omit<Item, 'dueState' | 'dues'> & { state: DueState; dues: Omit<Due, 'label'>[] })[]
}

const useKindLabels: Record<string, string> = { operation: 'Einsatz', exercise: 'Übung', other: 'Sonstiges' }
const resultLabels: Record<string, string> = { passed: 'bestanden', defect: 'Mangel', retired: 'ausgeschieden' }

const calendarDate = (value: string) => value.slice(0, 10)

const joined = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ')

export async function listCategories(): Promise<Category[]> {
  const records = await pb.collection('categories').getFullList({ sort: 'name' })
  return records.map((r) => ({ id: r.id, name: r.name, maxServiceLifeYears: r.max_service_life_years || undefined }))
}

export async function listCheckTypes(): Promise<CheckType[]> {
  const records = await pb.collection('check_types').getFullList({ sort: 'name' })
  return records.map((r) => ({
    id: r.id,
    categoryId: r.category,
    name: r.name,
    intervalMonths: r.interval_months || undefined,
    afterUse: r.after_use,
    alsoSatisfies: r.also_satisfies ?? [],
  }))
}

// The only source of item lists: the server computes due dates, so the logic exists once.
export async function listItems(): Promise<Item[]> {
  const [{ items }, checkTypes] = await Promise.all([
    pb.send<DueResponse>('/api/material/due', {}),
    listCheckTypes(),
  ])
  const dueLabel = (due: Omit<Due, 'label'>) => {
    if (due.kind === 'endOfLife') return 'Lebensdauer'
    if (due.kind === 'defect') return 'Mangel'
    return checkTypes.find((t) => t.id === due.checkTypeId)?.name ?? 'Prüfung'
  }
  return items.map(({ state, dues, ...item }) => ({
    ...item,
    dueState: state,
    dues: dues.map((due) => ({ ...due, label: dueLabel(due) })),
  }))
}

export async function listHistory(itemId: string): Promise<HistoryEntry[]> {
  const filter = pb.filter('item = {:itemId}', { itemId })
  const [uses, checks] = await Promise.all([
    pb.collection('uses').getFullList({ filter, expand: 'created_by' }),
    pb.collection('checks').getFullList({ filter, expand: 'check_type,performed_by' }),
  ])
  const entries: (HistoryEntry & { created: string })[] = [
    ...uses.map((u) => ({
      itemId,
      created: u.created,
      date: calendarDate(u.date),
      kind: 'use' as const,
      title: useKindLabels[u.kind],
      detail: joined(`Erfasst von ${u.recorded_by_name || u.expand?.created_by?.name}`, u.note),
    })),
    ...checks.map((c) => ({
      itemId,
      created: c.created,
      date: calendarDate(c.date),
      kind: 'check' as const,
      title: `${c.expand?.check_type?.name}: ${resultLabels[c.result]}`,
      detail: joined(c.expand?.performed_by?.name, c.note),
    })),
  ]
  return entries.sort((a, b) => b.date.localeCompare(a.date) || (b.created ?? '').localeCompare(a.created ?? ''))
}
