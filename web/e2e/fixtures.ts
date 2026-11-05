import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test as base, expect, type APIRequestContext } from '@playwright/test'

export type SeedUser = 'keine' | 'verwendung' | 'pruefung' | 'verwaltung'

export const seedUsers: SeedUser[] = ['keine', 'verwendung', 'pruefung', 'verwaltung']

// The documented password of all seed users (backend/internal/devseed).
export const password = 'intern-dev-1234'

export const email = (user: SeedUser) => `${user}@ffneumarkt.local`

// Storage state written by global-setup.ts; test.use({ storageState: authState('verwendung') })
// starts the tests signed in.
export const authState = (user: SeedUser) => join(import.meta.dirname, '.auth', `${user}.json`)

export const test = base.extend({})

export { expect }

// The seed user's token from the storage state of global-setup.ts.
export function tokenOf(user: SeedUser): string {
  const state = JSON.parse(readFileSync(authState(user), 'utf8'))
  const entry = state.origins[0].localStorage.find((item: { name: string }) => item.name === 'pocketbase_auth')
  return JSON.parse(entry.value).token
}

// Today's calendar date in Europe/Vienna (the configured timezone) as yyyy-mm-dd.
export const viennaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date())

// Removes a throwaway item together with its uses and checks. Nobody but the superuser may delete
// history rows, and an item with history cannot be deleted, so this logs in as the e2e superuser.
export async function removeItemWithHistory(request: APIRequestContext, itemId: string): Promise<void> {
  const login = await request.post('/api/collections/_superusers/auth-with-password', {
    data: { identity: process.env.E2E_SUPERUSER_EMAIL, password: process.env.E2E_SUPERUSER_PASSWORD },
  })
  expect(login.ok(), 'superuser login').toBe(true)
  const headers = { Authorization: (await login.json()).token }
  for (const collection of ['uses', 'checks']) {
    const list = await request.get(`/api/collections/${collection}/records`, {
      headers,
      params: { perPage: 500, fields: 'id', filter: `item="${itemId}"` },
    })
    expect(list.ok(), `list ${collection}`).toBe(true)
    for (const { id } of (await list.json()).items as { id: string }[]) {
      const removed = await request.delete(`/api/collections/${collection}/records/${id}`, { headers })
      expect(removed.ok(), `delete ${collection}/${id}`).toBe(true)
    }
  }
  const removed = await request.delete(`/api/collections/items/records/${itemId}`, { headers })
  expect([204, 404], 'delete item').toContain(removed.status())
}

// Deletes all of the user's rows in the collections, with the user's own token (the list rules of
// these collections show only the user's own rows).
async function deleteOwnRecords(request: APIRequestContext, user: SeedUser, collections: string[]) {
  const headers = { Authorization: tokenOf(user) }
  for (const collection of collections) {
    const list = await request.get(`/api/collections/${collection}/records`, {
      headers,
      params: { perPage: 500, fields: 'id' },
    })
    expect(list.ok(), `list ${collection}`).toBe(true)
    const { items } = (await list.json()) as { items: { id: string }[] }
    for (const { id } of items) {
      const removed = await request.delete(`/api/collections/${collection}/records/${id}`, { headers })
      expect(removed.ok(), `delete ${collection}/${id}`).toBe(true)
    }
  }
}

// Deletes the user's notification settings, preferences and push subscriptions.
export async function resetNotificationData(request: APIRequestContext, user: SeedUser): Promise<void> {
  await deleteOwnRecords(request, user, ['notification_settings', 'notification_preferences', 'push_subscriptions'])
}

// Deletes the user's passkeys.
export async function removePasskeys(request: APIRequestContext, user: SeedUser): Promise<void> {
  await deleteOwnRecords(request, user, ['passkeys'])
}
