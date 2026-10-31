// In-memory stand-in for api/push. Tests set `pushState`; setup.ts resets it. `calls` records the
// calls the session makes on login and logout.
import { PushDeniedError, TooManyAttemptsError } from '../api/errors'
import type { PushSupport } from '../api/push'

export type { PushSupport }

const fresh = () => ({
  support: 'ready' as PushSupport,
  available: true,
  enabled: false,
  denied: false,
  tooMany: false,
  delivered: 1,
  calls: [] as string[],
})

// How disablePush behaves: normally, rejecting, or never settling.
export const pushDisableMode = { value: 'ok' as 'ok' | 'reject' | 'hang' }

export let pushState = fresh()

export function resetPush() {
  pushDisableMode.value = 'ok'
  pushState = fresh()
}

export const pushSupport = () => pushState.support

export async function pushAvailable() {
  return pushState.available
}

export async function pushEnabled() {
  return pushState.enabled
}

export async function enablePush() {
  pushState.calls.push('enablePush')
  if (pushState.denied) throw new PushDeniedError()
  pushState.enabled = true
}

export async function disablePush() {
  pushState.calls.push('disablePush')
  if (pushDisableMode.value === 'reject') throw new Error('unsubscribe failed')
  if (pushDisableMode.value === 'hang') return new Promise<void>(() => {})
  pushState.enabled = false
}

export async function syncPush() {
  pushState.calls.push('syncPush')
}

export async function sendTestPush() {
  pushState.calls.push('sendTestPush')
  if (pushState.tooMany) throw new TooManyAttemptsError()
  return pushState.delivered
}
