import { afterEach, describe, expect, it, vi } from 'vitest'
import { listHistory, listItems } from './material'

const list = (items: object[]) => ({ page: 1, perPage: 1000, totalItems: items.length, totalPages: 1, items })

function serve(routes: Record<string, object>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = Object.keys(routes).find((route) => String(url).includes(route))
      if (!path) throw new Error(`unexpected request ${url}`)
      return new Response(JSON.stringify(routes[path]), { status: 200 })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listItems', () => {
  it('names dues after their check type and kind', async () => {
    serve({
      '/api/material/due': {
        items: [
          {
            id: 'i1',
            categoryId: 'c1',
            name: 'Maske 01',
            status: 'defective',
            state: 'overdue',
            dues: [
              { kind: 'defect', date: '2026-10-01', state: 'overdue' },
              { kind: 'check', checkTypeId: 't1', date: '2026-10-02', state: 'overdue' },
              { kind: 'endOfLife', date: '2027-01-01', state: 'ok' },
            ],
          },
        ],
      },
      '/api/collections/check_types/records': list([
        { id: 't1', category: 'c1', name: 'Maskenprüfung', interval_months: 12, after_use: true, also_satisfies: [] },
      ]),
    })
    const [item] = await listItems()
    expect(item.dueState).toBe('overdue')
    expect(item.dues.map((d) => d.label)).toEqual(['Mangel', 'Maskenprüfung', 'Lebensdauer'])
  })
})

describe('listHistory', () => {
  it('merges uses and checks, newest first', async () => {
    serve({
      '/api/collections/uses/records': list([
        {
          id: 'u1',
          date: '2026-10-21 00:00:00.000Z',
          kind: 'operation',
          recorded_by_name: 'Stationsrechner',
          note: 'Brand Wohnhaus',
          expand: { created_by: { name: 'Konto' } },
        },
        { id: 'u2', date: '2024-01-01 00:00:00.000Z', kind: 'exercise', recorded_by_name: '', expand: { created_by: { name: 'Konto' } } },
      ]),
      '/api/collections/checks/records': list([
        {
          id: 'c1',
          date: '2025-11-03 00:00:00.000Z',
          result: 'passed',
          expand: { check_type: { name: 'Maskenprüfung' }, performed_by: { name: 'R. Loisinger' } },
        },
      ]),
    })
    const history = await listHistory('i1')
    expect(history.map((h) => [h.date, h.title, h.detail])).toEqual([
      ['2026-10-21', 'Einsatz', 'Erfasst von Stationsrechner · Brand Wohnhaus'],
      ['2025-11-03', 'Maskenprüfung: bestanden', 'R. Loisinger'],
      ['2024-01-01', 'Übung', 'Erfasst von Konto'],
    ])
  })
})
