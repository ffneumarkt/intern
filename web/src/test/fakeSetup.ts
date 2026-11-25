// In-memory stand-in for api/setup. Tests set `setupState`; setup.ts resets it.
import { SetupLinkInvalidError, TooManyAttemptsError } from '../api/errors'

const fresh = () => ({
  // token -> the member's name
  links: { gueltig: 'Neu Mitglied' } as Record<string, string>,
  checked: [] as string[],
  completed: [] as { token: string; password: string }[],
  failing: false,
  tooMany: false,
})

export let setupState = fresh()

export function resetSetup() {
  setupState = fresh()
}

export async function checkSetupLink(token: string): Promise<string> {
  setupState.checked.push(token)
  const name = setupState.links[token]
  if (name === undefined) throw new SetupLinkInvalidError()
  return name
}

export async function completeSetup(token: string, password: string): Promise<void> {
  if (setupState.tooMany) throw new TooManyAttemptsError()
  if (setupState.failing) throw new Error('failing')
  if (setupState.links[token] === undefined) throw new SetupLinkInvalidError()
  setupState.completed.push({ token, password })
}
