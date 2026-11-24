import { describe, expect, it } from 'vitest'
import type { Item } from '../api/material'
import { findByBarcode, searchItems } from './items'

const item = (id: string, name: string, barcode?: string, status: Item['status'] = 'active'): Item => ({
  id,
  categoryId: 'c',
  name,
  barcode,
  status,
  dueState: 'ok',
  dues: [],
})

const items = [item('a', 'Maske 01', 'M-001'), item('b', 'Maske 02', 'M-002', 'retired'), item('c', 'Leiter', undefined)]

describe('findByBarcode', () => {
  it('needs the exact code', () => {
    expect(findByBarcode(items, 'M-001')?.id).toBe('a')
    expect(findByBarcode(items, 'M-00')).toBeUndefined()
  })

  it('ignores retired items', () => {
    expect(findByBarcode(items, 'M-002')).toBeUndefined()
  })
})

describe('searchItems', () => {
  it('matches name or code, case-insensitive, without retired items', () => {
    expect(searchItems(items, 'm-0', []).map((i) => i.id)).toEqual(['a'])
    expect(searchItems(items, 'LEI', []).map((i) => i.id)).toEqual(['c'])
  })

  it('excludes the given ids and returns nothing for blank text', () => {
    expect(searchItems(items, 'maske', ['a'])).toEqual([])
    expect(searchItems(items, '  ', [])).toEqual([])
  })
})
