// In-memory stand-in for api/passkeys. Tests set `passkeyState`; setup.ts resets it.
import { PasskeyCancelledError, PasskeyExistsError } from '../api/errors'
import type { Passkey } from '../api/passkeys'
import { login } from './fakeAuth'

export type { Passkey }

const fresh = () => ({
  supported: true,
  cancelled: false,
  failing: false,
  exists: false,
  loginFails: false,
  items: [] as Passkey[],
  added: [] as string[],
})

export let passkeyState = fresh()

export function resetPasskeys() {
  passkeyState = fresh()
}

export const passkeysSupported = () => passkeyState.supported

export async function loginWithPasskey() {
  if (passkeyState.cancelled) throw new PasskeyCancelledError()
  if (passkeyState.loginFails) throw new Error('Failed to authenticate.')
  await login('', 'richtig')
}

export async function listPasskeys() {
  if (passkeyState.failing) throw new TypeError('Failed to fetch')
  return passkeyState.items
}

export async function addPasskey(name: string) {
  if (passkeyState.cancelled) throw new PasskeyCancelledError()
  if (passkeyState.exists) throw new PasskeyExistsError()
  if (passkeyState.failing) throw new Error('nope')
  passkeyState.added.push(name)
  passkeyState.items.push({ id: `k${passkeyState.added.length}`, name, created: '2026-10-30' })
}

export async function renamePasskey(id: string, name: string) {
  passkeyState.items = passkeyState.items.map((k) => (k.id === id ? { ...k, name } : k))
}

export async function removePasskey(id: string) {
  passkeyState.items = passkeyState.items.filter((k) => k.id !== id)
}
