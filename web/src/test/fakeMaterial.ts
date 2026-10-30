// In-memory stand-in for api/material. Tests read and change `data`; setup.ts resets it.
import type { CheckInput, UseInput } from '../api/material'
import { freshData } from './fixtures'

export type * from '../api/material'

export let data = freshData()
export const failing = { reads: false, check: false, useFor: new Set<string>() }
export const calls = { uses: [] as { itemId: string; input: UseInput }[], checks: [] as { itemId: string; input: CheckInput }[], retired: [] as string[] }

export function resetMaterial() {
  data = freshData()
  failing.reads = false
  failing.check = false
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
