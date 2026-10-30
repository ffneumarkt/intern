import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pb } from './client'
import { PasskeyCancelledError, PasskeyExistsError, WrongPasswordError } from './errors'
import { addPasskey, confirmWithPasskey, confirmWithPassword, listPasskeys, loginWithPasskey } from './passkeys'

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => true,
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}))

const browserError = (name: string) => Object.assign(new Error(name), { name })

function token(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, type: 'auth' }))
  return `e30.${payload}.signature`
}

function serve(routes: Record<string, object>) {
  const fetchMock = vi.fn(async (url: string) => {
    const path = Object.keys(routes).find((route) => String(url).includes(route))
    if (!path) throw new Error(`unexpected request ${url}`)
    return new Response(JSON.stringify(routes[path]), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const sentTo = (fetchMock: ReturnType<typeof serve>, path: string) => {
  const call = fetchMock.mock.calls.find(([url]) => String(url).includes(path)) as unknown as [string, RequestInit]
  return JSON.parse(String(call[1].body))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(startAuthentication).mockReset()
  vi.mocked(startRegistration).mockReset()
  pb.authStore.clear()
})

describe('loginWithPasskey', () => {
  it('sends the assertion with its session and stores the token', async () => {
    const fetchMock = serve({
      '/api/passkey/login/begin': { sessionId: 's1', options: { challenge: 'c' } },
      '/api/passkey/login/finish': { token: token(), record: { id: 'u1', name: 'Rainer', email: 'r@example.com' } },
    })
    vi.mocked(startAuthentication).mockResolvedValue({ id: 'cred' } as never)
    await loginWithPasskey()
    expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: { challenge: 'c' } })
    expect(sentTo(fetchMock, 'login/finish')).toEqual({ sessionId: 's1', credential: { id: 'cred' } })
    expect(pb.authStore.record?.id).toBe('u1')
  })

  it('reports a closed dialog as cancelled', async () => {
    serve({ '/api/passkey/login/begin': { sessionId: 's1', options: {} } })
    vi.mocked(startAuthentication).mockRejectedValue(browserError('NotAllowedError'))
    await expect(loginWithPasskey()).rejects.toBeInstanceOf(PasskeyCancelledError)
  })

  it('passes other failures on', async () => {
    serve({ '/api/passkey/login/begin': { sessionId: 's1', options: {} } })
    vi.mocked(startAuthentication).mockRejectedValue(browserError('SecurityError'))
    await expect(loginWithPasskey()).rejects.not.toBeInstanceOf(PasskeyCancelledError)
  })
})

describe('confirming', () => {
  it('exchanges the password for a grant', async () => {
    const fetchMock = serve({ '/api/passkey/confirm/finish': { grant: 'g1' } })
    expect(await confirmWithPassword('geheim')).toBe('g1')
    expect(sentTo(fetchMock, 'confirm/finish')).toEqual({ password: 'geheim' })
  })

  it('recognises a wrong password', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })))
    await expect(confirmWithPassword('falsch')).rejects.toBeInstanceOf(WrongPasswordError)
  })

  it('exchanges a passkey assertion for a grant', async () => {
    const fetchMock = serve({
      '/api/passkey/confirm/begin': { sessionId: 's3', options: { challenge: 'c' } },
      '/api/passkey/confirm/finish': { grant: 'g2' },
    })
    vi.mocked(startAuthentication).mockResolvedValue({ id: 'cred' } as never)
    expect(await confirmWithPasskey()).toBe('g2')
    expect(sentTo(fetchMock, 'confirm/finish')).toEqual({ sessionId: 's3', credential: { id: 'cred' } })
  })

  it('reports a closed dialog as cancelled', async () => {
    serve({ '/api/passkey/confirm/begin': { sessionId: 's3', options: {} } })
    vi.mocked(startAuthentication).mockRejectedValue(browserError('NotAllowedError'))
    await expect(confirmWithPasskey()).rejects.toBeInstanceOf(PasskeyCancelledError)
  })
})

describe('addPasskey', () => {
  it('sends the name with the credential', async () => {
    const fetchMock = serve({
      '/api/passkey/register/begin': { sessionId: 's2', options: { challenge: 'c' } },
      '/api/passkey/register/finish': { id: 'k1' },
    })
    vi.mocked(startRegistration).mockResolvedValue({ id: 'cred' } as never)
    await addPasskey('iPhone', 'g1')
    expect(sentTo(fetchMock, 'register/begin')).toEqual({ grant: 'g1' })
    expect(sentTo(fetchMock, 'register/finish')).toEqual({ sessionId: 's2', name: 'iPhone', credential: { id: 'cred' } })
  })

  it('recognises a device that already has a passkey', async () => {
    serve({ '/api/passkey/register/begin': { sessionId: 's2', options: {} } })
    vi.mocked(startRegistration).mockRejectedValue(browserError('InvalidStateError'))
    await expect(addPasskey('iPhone', 'g1')).rejects.toBeInstanceOf(PasskeyExistsError)
  })

  it('reports a closed dialog as cancelled', async () => {
    serve({ '/api/passkey/register/begin': { sessionId: 's2', options: {} } })
    vi.mocked(startRegistration).mockRejectedValue(browserError('NotAllowedError'))
    await expect(addPasskey('iPhone', 'g1')).rejects.toBeInstanceOf(PasskeyCancelledError)
  })
})

describe('listPasskeys', () => {
  it('reads names and creation days', async () => {
    serve({
      '/api/collections/passkeys/records': {
        page: 1,
        perPage: 1000,
        totalItems: 1,
        totalPages: 1,
        items: [{ id: 'k1', name: 'iPhone', created: '2026-10-29 10:00:00.000Z' }],
      },
    })
    expect(await listPasskeys()).toEqual([{ id: 'k1', name: 'iPhone', created: '2026-10-29' }])
  })
})
