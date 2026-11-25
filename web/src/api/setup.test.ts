import { afterEach, describe, expect, it, vi } from 'vitest'
import { SetupLinkInvalidError, TooManyAttemptsError } from './errors'
import { checkSetupLink, completeSetup } from './setup'

function serve(status: number, body: object = {}) {
  const fetchMock = vi.fn(async () => new Response(status === 204 ? null : JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('setup api', () => {
  it('sends the token in the body of a POST, never in the address', async () => {
    const fetchMock = serve(200, { name: 'Neu' })
    expect(await checkSetupLink('geheim-token')).toBe('Neu')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(String(url)).toContain('/api/setup/check')
    expect(String(url)).not.toContain('geheim-token')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ token: 'geheim-token' })
  })

  it('sends the password with the token to complete', async () => {
    const fetchMock = serve(204)
    await completeSetup('geheim-token', 'ein-langes-passwort')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(String(url)).toContain('/api/setup/complete')
    expect(String(url)).not.toContain('geheim-token')
    expect(JSON.parse(String(init.body))).toEqual({ token: 'geheim-token', password: 'ein-langes-passwort' })
  })

  it('reports a link the server refuses', async () => {
    serve(400, { message: 'The link is invalid or has expired.' })
    await expect(checkSetupLink('x')).rejects.toBeInstanceOf(SetupLinkInvalidError)
    await expect(completeSetup('x', 'ein-langes-passwort')).rejects.toBeInstanceOf(SetupLinkInvalidError)
  })

  it('reports too many attempts', async () => {
    serve(429)
    await expect(completeSetup('x', 'ein-langes-passwort')).rejects.toBeInstanceOf(TooManyAttemptsError)
  })
})
