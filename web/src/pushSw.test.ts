import { beforeEach, describe, expect, it, vi } from 'vitest'
import source from '../public/push-sw.js?raw'

const origin = 'https://intern.example'

type Handler = (event: unknown) => void
let handlers: Record<string, Handler>
let shown: { title: string; options: { body: string; data: { url: string } } }[]
let opened: string[]
let clients: unknown[]

beforeEach(() => {
  handlers = {}
  shown = []
  opened = []
  clients = []
  const self = {
    location: { origin },
    addEventListener: (type: string, handler: Handler) => (handlers[type] = handler),
    registration: { showNotification: vi.fn(async (title: string, options) => void shown.push({ title, options })) },
    clients: {
      matchAll: vi.fn(async () => clients),
      openWindow: vi.fn(async (url: string) => void opened.push(url)),
    },
  }
  new Function('self', source)(self)
})

async function push(data: unknown) {
  let pending: Promise<unknown> = Promise.resolve()
  handlers.push({ data, waitUntil: (p: Promise<unknown>) => (pending = p) })
  await pending
}

async function click(data: unknown) {
  let pending: Promise<unknown> = Promise.resolve()
  handlers.notificationclick({ notification: { close: vi.fn(), data }, waitUntil: (p: Promise<unknown>) => (pending = p) })
  await pending
}

describe('push', () => {
  it('shows the payload', async () => {
    await push({ json: () => ({ title: 'Fällig', body: '2 Geräte', url: '/material?geraete=a,b' }) })
    expect(shown).toEqual([{ title: 'Fällig', options: expect.objectContaining({ body: '2 Geräte', data: { url: '/material?geraete=a,b' } }) }])
  })

  it('still shows a notification without data', async () => {
    await push(null)
    expect(shown[0].title).toBe('FF Intern')
    expect(shown[0].options.data.url).toBe('/material')
  })

  it('still shows a notification for a payload that is not JSON', async () => {
    await push({
      json: () => {
        throw new SyntaxError('bad')
      },
    })
    expect(shown[0].title).toBe('FF Intern')
  })
})

describe('notification click', () => {
  it('opens a window when none is open', async () => {
    await click({ url: '/material?geraete=a' })
    expect(opened).toEqual([`${origin}/material?geraete=a`])
  })

  it('focuses and navigates an open window', async () => {
    const navigate = vi.fn(async () => ({}))
    const client = { focus: vi.fn(async () => ({ navigate })) }
    clients = [client]
    await click({ url: '/material?geraete=a' })
    expect(navigate).toHaveBeenCalledWith(`${origin}/material?geraete=a`)
    expect(opened).toEqual([])
  })

  it('opens a window when navigating fails', async () => {
    clients = [{ focus: async () => ({ navigate: async () => Promise.reject(new TypeError('uncontrolled')) }) }]
    await click({ url: '/material' })
    expect(opened).toEqual([`${origin}/material`])
  })

  it('opens a window when focusing fails', async () => {
    clients = [{ focus: async () => Promise.reject(new Error('not allowed')) }]
    await click({ url: '/material' })
    expect(opened).toEqual([`${origin}/material`])
  })

  it('opens a window when navigate returns nothing', async () => {
    clients = [{ focus: async () => ({ navigate: async () => null }) }]
    await click({ url: '/material' })
    expect(opened).toEqual([`${origin}/material`])
  })

  it('survives a notification without data', async () => {
    await click(undefined)
    expect(opened).toEqual([`${origin}/material`])
  })

  it('does not follow a cross-origin url', async () => {
    await click({ url: 'https://evil.example/x' })
    expect(opened).toEqual([`${origin}/material`])
  })
})
