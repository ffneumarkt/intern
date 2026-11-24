import { ClientResponseError } from 'pocketbase'
import type { DueState } from '../components/DueStateBadge'
import { pb } from './client'
import { measurementDetail } from '../material/measurements'
import { BarcodeTakenError, CheckTypeInUseError, ItemHasHistoryError, ItemPartlySavedError } from './errors'

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
  isDefault: boolean
  // Asks for the Dichtprüfung and Öffnungsdruck readings when a check is recorded.
  measurements: boolean
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
    isDefault: r.is_default,
    measurements: !!r.measurements,
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
      detail: joined(
        c.expand?.performed_by?.name,
        measurementDetail(c.leak_start_mbar, c.leak_end_mbar, c.opening_pressure_mbar) ?? undefined,
        c.note,
      ),
    })),
  ]
  return entries.sort((a, b) => b.date.localeCompare(a.date) || (b.created ?? '').localeCompare(a.created ?? ''))
}

export interface UseInput {
  date: string
  kind: 'operation' | 'exercise' | 'other'
  recordedByName: string
  note: string
}

export interface CheckInput {
  checkTypeId: string
  date: string
  result: 'passed' | 'defect' | 'retired'
  note: string
  // The readings of a check type with measurements, in mbar.
  leakStartMbar?: number
  leakEndMbar?: number
  openingPressureMbar?: number
}

export async function recordUse(itemId: string, input: UseInput): Promise<void> {
  await pb.collection('uses').create({
    item: itemId,
    date: input.date,
    kind: input.kind,
    recorded_by_name: input.recordedByName,
    note: input.note,
    created_by: pb.authStore.record?.id,
  })
}

export async function recordCheck(itemId: string, input: CheckInput): Promise<void> {
  await pb.collection('checks').create({
    item: itemId,
    check_type: input.checkTypeId,
    date: input.date,
    result: input.result,
    note: input.note,
    performed_by: pb.authStore.record?.id,
    ...(input.leakStartMbar !== undefined && { leak_start_mbar: input.leakStartMbar }),
    ...(input.leakEndMbar !== undefined && { leak_end_mbar: input.leakEndMbar }),
    ...(input.openingPressureMbar !== undefined && { opening_pressure_mbar: input.openingPressureMbar }),
  })
}

export async function retireItem(itemId: string): Promise<void> {
  await pb.collection('items').update(itemId, { status: 'retired' })
}

export interface ItemInput {
  categoryId: string
  name: string
  serial: string
  barcode: string
  manufacturedOn: string
  note: string
}

export interface CheckTypeInput {
  categoryId: string
  name: string
  intervalMonths: number
  afterUse: boolean
  isDefault: boolean
  measurements: boolean
  alsoSatisfies: string[]
}

const itemFields = (input: Omit<ItemInput, 'categoryId'>) => ({
  name: input.name,
  serial: input.serial,
  barcode: input.barcode,
  manufactured_on: input.manufacturedOn,
  note: input.note,
})

const checkTypeFields = (input: Omit<CheckTypeInput, 'categoryId'>) => ({
  name: input.name,
  interval_months: input.intervalMonths,
  after_use: input.afterUse,
  is_default: input.isDefault,
  measurements: input.measurements,
  also_satisfies: input.alsoSatisfies,
})

function explainItemError(err: unknown): unknown {
  return err instanceof ClientResponseError && err.response?.data?.barcode ? new BarcodeTakenError() : err
}

// lastChecked maps check type ids to dates; each creates an initial passed check, so existing
// equipment does not start out overdue.
export async function createItem(input: ItemInput, lastChecked: Record<string, string>): Promise<string> {
  let id: string
  try {
    const record = await pb.collection('items').create({ ...itemFields(input), category: input.categoryId, status: 'active' })
    id = record.id
  } catch (err) {
    throw explainItemError(err)
  }
  try {
    for (const [checkTypeId, date] of Object.entries(lastChecked)) {
      await recordCheck(id, { checkTypeId, date, result: 'passed', note: '' })
    }
  } catch {
    throw new ItemPartlySavedError()
  }
  return id
}

export async function updateItem(itemId: string, input: Omit<ItemInput, 'categoryId'>): Promise<void> {
  try {
    await pb.collection('items').update(itemId, itemFields(input))
  } catch (err) {
    throw explainItemError(err)
  }
}

// Saves a scanned manufacturer code on an item; a code another item has throws BarcodeTakenError.
export async function assignBarcode(itemId: string, barcode: string): Promise<void> {
  try {
    await pb.collection('items').update(itemId, { barcode })
  } catch (err) {
    throw explainItemError(err)
  }
}

// The server refuses this once an item has uses or checks.
export async function deleteItem(itemId: string): Promise<void> {
  try {
    await pb.collection('items').delete(itemId)
  } catch (err) {
    throw err instanceof ClientResponseError && err.status === 400 ? new ItemHasHistoryError() : err
  }
}

export async function createCheckType(input: CheckTypeInput): Promise<void> {
  await pb.collection('check_types').create({ ...checkTypeFields(input), category: input.categoryId })
}

export async function updateCheckType(id: string, input: Omit<CheckTypeInput, 'categoryId'>): Promise<void> {
  await pb.collection('check_types').update(id, checkTypeFields(input))
}

export async function deleteCheckType(id: string): Promise<void> {
  try {
    await pb.collection('check_types').delete(id)
  } catch (err) {
    throw err instanceof ClientResponseError && err.status === 400 ? new CheckTypeInUseError() : err
  }
}
