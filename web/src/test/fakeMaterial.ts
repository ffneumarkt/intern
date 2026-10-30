// In-memory stand-in for api/material. Tests read and change `data`; setup.ts resets it.
import { freshData } from './fixtures'

export type * from '../api/material'

export let data = freshData()
export const failing = { reads: false }

export function resetMaterial() {
  data = freshData()
  failing.reads = false
}

async function read<T>(value: () => T): Promise<T> {
  if (failing.reads) throw new TypeError('Failed to fetch')
  return value()
}

export const listCategories = () => read(() => data.categories)
export const listCheckTypes = () => read(() => data.checkTypes)
export const listItems = () => read(() => data.items)
export const listHistory = (itemId: string) => read(() => data.history.filter((h) => h.itemId === itemId))
