import { afterEach, describe, expect, it, vi } from 'vitest'
import { pb } from './client'
import { defaultQuietTime, enableCategory, listNotificationSettings, saveQuietTime, loadQuietTime } from './notifications'

function token(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, type: 'auth' }))
  return `e30.${payload}.signature`
}

const list = (items: object[]) => new Response(JSON.stringify({ page: 1, perPage: 500, totalItems: items.length, totalPages: 1, items }))

function serve(handler: (url: string, init: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => handler(String(url), init))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const requests = (fetchMock: ReturnType<typeof serve>, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === method) as unknown as [string, RequestInit][]

afterEach(() => {
  vi.unstubAllGlobals()
  pb.authStore.clear()
})

describe('notification settings', () => {
  it('maps records to camelCase', async () => {
    serve(() => list([{ id: 's1', category: 'masken', timings: [14, 0], weekly_overdue: true }]))
    expect(await listNotificationSettings()).toEqual([{ id: 's1', categoryId: 'masken', timings: [14, 0], weeklyOverdue: true }])
  })

  it('creates a setting with the defaults for the user', async () => {
    pb.authStore.save(token(), { id: 'u1' } as never)
    const fetchMock = serve(() => new Response('{"id":"s2"}'))
    await enableCategory('masken')
    expect(JSON.parse(String(requests(fetchMock, 'POST')[0][1].body))).toEqual({
      user: 'u1',
      category: 'masken',
      timings: [14, 3, 0],
      weekly_overdue: true,
    })
  })
})

describe('quiet time', () => {
  it('defaults without a row', async () => {
    serve(() => list([]))
    expect(await loadQuietTime()).toEqual(defaultQuietTime)
  })

  it('reads the saved row, empty strings meaning off', async () => {
    serve(() => list([{ id: 'p1', quiet_from: '', quiet_until: '' }]))
    expect(await loadQuietTime()).toEqual({ from: '', until: '' })
  })

  it('creates the row without one', async () => {
    pb.authStore.save(token(), { id: 'u1' } as never)
    const fetchMock = serve((_, init) => (init.method === 'POST' ? new Response('{"id":"p1"}') : list([])))
    await saveQuietTime({ from: '21:00', until: '06:00' })
    expect(JSON.parse(String(requests(fetchMock, 'POST')[0][1].body))).toEqual({ user: 'u1', quiet_from: '21:00', quiet_until: '06:00' })
  })

  it('updates the existing row', async () => {
    pb.authStore.save(token(), { id: 'u1' } as never)
    const fetchMock = serve((_, init) => (init.method === 'PATCH' ? new Response('{"id":"p1"}') : list([{ id: 'p1', quiet_from: '22:00', quiet_until: '07:00' }])))
    await saveQuietTime({ from: '', until: '' })
    const [url, init] = requests(fetchMock, 'PATCH')[0]
    expect(url).toContain('/records/p1')
    expect(JSON.parse(String(init.body))).toEqual({ quiet_from: '', quiet_until: '' })
  })
})
