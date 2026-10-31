import { afterEach, describe, expect, it, vi } from 'vitest'
import { pb } from './client'
import { PushDeniedError } from './errors'
import { disablePush, enablePush, pushAvailable, pushEnabled, pushSupport, syncPush } from './push'

const endpoint = 'https://push.example.com/abc'
// base64url of the bytes 1, 2, 3
const key = 'AQID'

function token(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, type: 'auth' }))
  return `e30.${payload}.signature`
}

function stubBrowser(options: { subscription?: boolean; permission?: string } = {}) {
  const subscription = {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'pk-1', auth: 'au-1' } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  }
  let current: typeof subscription | null = options.subscription ? subscription : null
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => (current = subscription)),
  }
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('navigator', {
    userAgent: 'TestAgent/1.0',
    serviceWorker: { ready: Promise.resolve({ pushManager }) },
  })
  vi.stubGlobal('Notification', { requestPermission: vi.fn(async () => options.permission ?? 'granted') })
  return { subscription, pushManager }
}

type Handler = (init: RequestInit) => Response | Promise<Response>

function serve(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = Object.keys(routes).find((route) => String(url).includes(route))
    if (!path) throw new Error(`unexpected request ${url}`)
    return routes[path](init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status })
const bodyOf = (fetchMock: ReturnType<typeof serve>, path: string) => {
  const call = fetchMock.mock.calls.find(([url]) => String(url).includes(path)) as unknown as [string, RequestInit]
  return JSON.parse(String(call[1].body))
}

afterEach(() => {
  vi.unstubAllGlobals()
  pb.authStore.clear()
})

describe('pushSupport', () => {
  it('asks for an installation on iOS outside the home screen', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })
    expect(pushSupport()).toBe('needsInstall')
  })

  it('is unsupported without PushManager elsewhere', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })
    expect(pushSupport()).toBe('unsupported')
  })

  it('is ready with PushManager', () => {
    stubBrowser()
    expect(pushSupport()).toBe('ready')
  })
})

describe('pushAvailable', () => {
  it('is false when the server has no key', async () => {
    serve({ '/api/push/key': () => json({}, 404) })
    expect(await pushAvailable()).toBe(false)
  })

  it('is true with a key', async () => {
    serve({ '/api/push/key': () => json({ publicKey: key }) })
    expect(await pushAvailable()).toBe(true)
  })
})

describe('pushEnabled', () => {
  it('is true with a subscription', async () => {
    stubBrowser({ subscription: true })
    expect(await pushEnabled()).toBe(true)
  })

  // Firefox without its push service (Playwright's build, or dom.push.connection.enabled off)
  // rejects getSubscription with an AbortError.
  it('is false when the browser cannot read the subscription', async () => {
    const { pushManager } = stubBrowser()
    pushManager.getSubscription.mockRejectedValue(new DOMException('Error retrieving push subscription.', 'AbortError'))
    expect(await pushEnabled()).toBe(false)
  })
})

describe('enablePush', () => {
  it('subscribes and registers the device', async () => {
    const { pushManager } = stubBrowser()
    const fetchMock = serve({
      '/api/push/key': () => json({ publicKey: key }),
      '/api/push/subscribe': () => new Response(null, { status: 204 }),
    })
    pb.authStore.save(token(), { id: 'u1' } as never)
    await enablePush()
    const [{ userVisibleOnly, applicationServerKey }] = pushManager.subscribe.mock.calls[0] as unknown as [
      { userVisibleOnly: boolean; applicationServerKey: Uint8Array },
    ]
    expect(userVisibleOnly).toBe(true)
    expect(applicationServerKey).toBeInstanceOf(Uint8Array)
    expect([...applicationServerKey]).toEqual([1, 2, 3])
    expect(bodyOf(fetchMock, '/api/push/subscribe')).toEqual({ endpoint, p256dh: 'pk-1', auth: 'au-1', deviceLabel: 'TestAgent/1.0' })
  })

  it('throws when permission is refused and posts nothing', async () => {
    const { pushManager } = stubBrowser({ permission: 'denied' })
    const fetchMock = serve({})
    await expect(enablePush()).rejects.toBeInstanceOf(PushDeniedError)
    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('disablePush', () => {
  it('unsubscribes and deletes the row by endpoint', async () => {
    const { subscription } = stubBrowser({ subscription: true })
    const fetchMock = serve({
      '/api/collections/push_subscriptions/records/r1': () => new Response(null, { status: 204 }),
      '/api/collections/push_subscriptions/records': () => json({ page: 1, perPage: 1, totalItems: 1, totalPages: 1, items: [{ id: 'r1' }] }),
    })
    pb.authStore.save(token(), { id: 'u1' } as never)
    await disablePush()
    expect(subscription.unsubscribe).toHaveBeenCalled()
    const deletion = fetchMock.mock.calls.find(([, init]) => (init as RequestInit).method === 'DELETE')
    expect(String(deletion?.[0])).toContain('/records/r1')
    expect(decodeURIComponent(String(fetchMock.mock.calls[0][0]))).toContain(endpoint)
  })

  it('does not reject when the delete fails', async () => {
    stubBrowser({ subscription: true })
    serve({ '/api/collections/push_subscriptions': () => json({}, 500) })
    await expect(disablePush()).resolves.toBeUndefined()
  })
})

describe('syncPush', () => {
  it('posts the current subscription', async () => {
    stubBrowser({ subscription: true })
    const fetchMock = serve({ '/api/push/subscribe': () => new Response(null, { status: 204 }) })
    pb.authStore.save(token(), { id: 'u1' } as never)
    await syncPush()
    expect(bodyOf(fetchMock, '/api/push/subscribe').endpoint).toBe(endpoint)
  })

  it('does nothing without a subscription', async () => {
    stubBrowser()
    const fetchMock = serve({})
    await syncPush()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not reject when the post fails', async () => {
    stubBrowser({ subscription: true })
    serve({ '/api/push/subscribe': () => json({}, 500) })
    await expect(syncPush()).resolves.toBeUndefined()
  })
})
