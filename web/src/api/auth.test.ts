import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentUser, refresh } from './auth'
import { pb } from './client'

function token(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, type: 'auth' }))
  return `e30.${payload}.signature`
}

function signIn() {
  pb.authStore.save(token(), { id: 'u1', name: 'Rainer', email: 'r@example.com', collectionName: 'users' } as never)
}

function respondWith(status: number, body: object = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))
}

afterEach(() => {
  vi.unstubAllGlobals()
  pb.authStore.clear()
})

describe('refresh', () => {
  it('ends the session when the server rejects the token', async () => {
    signIn()
    respondWith(401)
    await refresh()
    expect(currentUser()).toBeNull()
  })

  it('keeps the session when the server cannot be reached', async () => {
    signIn()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await refresh()
    expect(currentUser()?.name).toBe('Rainer')
  })

  it('keeps the session on a server error', async () => {
    signIn()
    respondWith(500)
    await refresh()
    expect(currentUser()?.name).toBe('Rainer')
  })

  it('does not call the server when logged out', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await refresh()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('any request', () => {
  it('ends the session on a 401', async () => {
    signIn()
    respondWith(401)
    await expect(pb.collection('items').getFullList()).rejects.toThrow()
    expect(currentUser()).toBeNull()
  })
})
