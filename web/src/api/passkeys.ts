import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { pb } from './client'
import { PasskeyCancelledError, PasskeyExistsError } from './errors'

export interface Passkey {
  id: string
  name: string
  created: string
}

interface Begun {
  sessionId: string
  // The server's WebAuthn options, passed on to the browser as they are.
  options: never
}

const post = <T>(path: string, body: object = {}) => pb.send<T>(`/api/passkey/${path}`, { method: 'POST', body })

// The browser reports a closed dialog as NotAllowedError.
async function ceremony<T>(start: () => Promise<T>): Promise<T> {
  try {
    return await start()
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'NotAllowedError' || name === 'AbortError') throw new PasskeyCancelledError()
    if (name === 'InvalidStateError') throw new PasskeyExistsError()
    throw err
  }
}

export const passkeysSupported = () => browserSupportsWebAuthn()

export async function loginWithPasskey(): Promise<void> {
  const { sessionId, options } = await post<Begun>('login/begin')
  const credential = await ceremony(() => startAuthentication({ optionsJSON: options }))
  const { token, record } = await post<{ token: string; record: never }>('login/finish', { sessionId, credential })
  pb.authStore.save(token, record)
}

export async function listPasskeys(): Promise<Passkey[]> {
  const records = await pb.collection('passkeys').getFullList({ sort: 'created' })
  return records.map((r) => ({ id: r.id, name: r.name, created: r.created.slice(0, 10) }))
}

export async function addPasskey(name: string): Promise<void> {
  const { sessionId, options } = await post<Begun>('register/begin')
  const credential = await ceremony(() => startRegistration({ optionsJSON: options }))
  await post('register/finish', { sessionId, name, credential })
}

export async function renamePasskey(id: string, name: string): Promise<void> {
  await pb.collection('passkeys').update(id, { name })
}

export async function removePasskey(id: string): Promise<void> {
  await pb.collection('passkeys').delete(id)
}
