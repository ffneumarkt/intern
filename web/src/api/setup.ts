import { ClientResponseError } from 'pocketbase'
import { pb } from './client'
import { explainRateLimit, SetupLinkInvalidError } from './errors'

// The token goes in the body of a POST, never in an address, so no server log or proxy sees it.
async function post<T>(path: string, body: object): Promise<T> {
  try {
    return await pb.send<T>(`/api/setup/${path}`, { method: 'POST', body })
  } catch (err) {
    if (err instanceof ClientResponseError && err.status === 400) throw new SetupLinkInvalidError()
    throw explainRateLimit(err)
  }
}

// The name of the member the link is for; throws SetupLinkInvalidError for a link that does not work.
export async function checkSetupLink(token: string): Promise<string> {
  return (await post<{ name: string }>('check', { token })).name
}

export async function completeSetup(token: string, password: string): Promise<void> {
  await post('complete', { token, password })
}
