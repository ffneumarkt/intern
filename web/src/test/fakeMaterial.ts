// In-memory stand-in for api/material. Tests read and change `data`; setup.ts resets it.
import { BarcodeTakenError, CheckTypeInUseError, ItemHasHistoryError, ItemPartlySavedError } from '../api/errors'
import type { CheckInput, CheckTypeInput, ItemInput, UseInput } from '../api/material'
import { freshData } from './fixtures'

export type * from '../api/material'

export let data = freshData()
export const failing = {
  reads: false,
  check: false,
  useFor: new Set<string>(),
  barcode: false,
  initialChecks: false,
  deleteCheckType: false,
  deleteItem: false,
}
export const calls = { uses: [] as { itemId: string; input: UseInput }[], checks: [] as { itemId: string; input: CheckInput }[], retired: [] as string[], createdItems: [] as { input: ItemInput; lastChecked: Record<string, string> }[], updatedItems: [] as { itemId: string; input: Omit<ItemInput, 'categoryId'> }[], deletedItems: [] as string[], createdCheckTypes: [] as CheckTypeInput[], updatedCheckTypes: [] as { id: string; input: Omit<CheckTypeInput, 'categoryId'> }[] }

export function resetMaterial() {
  data = freshData()
  failing.reads = false
  failing.check = false
  failing.barcode = false
  failing.initialChecks = false
  failing.deleteCheckType = false
  failing.deleteItem = false
  calls.createdItems = []
  calls.updatedItems = []
  calls.deletedItems = []
  calls.createdCheckTypes = []
  calls.updatedCheckTypes = []
  failing.useFor.clear()
  calls.uses = []
  calls.checks = []
  calls.retired = []
}

async function read<T>(value: () => T): Promise<T> {
  if (failing.reads) throw new TypeError('Failed to fetch')
  return value()
}

export const listCategories = () => read(() => data.categories)
export const listCheckTypes = () => read(() => data.checkTypes)
export const listItems = () => read(() => data.items)
export const listHistory = (itemId: string) => read(() => data.history.filter((h) => h.itemId === itemId))

export async function recordUse(itemId: string, input: UseInput) {
  if (failing.useFor.has(itemId)) throw new TypeError('Failed to fetch')
  calls.uses.push({ itemId, input })
}

const resultLabels = { passed: 'bestanden', defect: 'Mangel', retired: 'ausgeschieden' }

export async function recordCheck(itemId: string, input: CheckInput) {
  if (failing.check) throw new TypeError('Failed to fetch')
  calls.checks.push({ itemId, input })
  const type = data.checkTypes.find((t) => t.id === input.checkTypeId)
  data.history.unshift({
    itemId,
    date: input.date,
    kind: 'check',
    title: `${type?.name}: ${resultLabels[input.result]}`,
    detail: input.note,
  })
}

export async function retireItem(itemId: string) {
  calls.retired.push(itemId)
}

export async function createItem(input: ItemInput, lastChecked: Record<string, string>) {
  if (failing.barcode) throw new BarcodeTakenError()
  calls.createdItems.push({ input, lastChecked })
  data.items.push({ ...input, id: 'neu', status: 'active', dueState: 'ok', dues: [] })
  if (failing.initialChecks) throw new ItemPartlySavedError()
  return 'neu'
}

export async function updateItem(itemId: string, input: Omit<ItemInput, 'categoryId'>) {
  if (failing.barcode) throw new BarcodeTakenError()
  calls.updatedItems.push({ itemId, input })
}

export async function deleteItem(itemId: string) {
  if (failing.deleteItem) throw new ItemHasHistoryError()
  calls.deletedItems.push(itemId)
  data.items = data.items.filter((i) => i.id !== itemId)
}

export async function createCheckType(input: CheckTypeInput) {
  calls.createdCheckTypes.push(input)
}

export async function updateCheckType(id: string, input: Omit<CheckTypeInput, 'categoryId'>) {
  calls.updatedCheckTypes.push({ id, input })
}

export async function deleteCheckType(id: string) {
  if (failing.deleteCheckType) throw new CheckTypeInUseError()
  data.checkTypes = data.checkTypes.filter((t) => t.id !== id)
}
