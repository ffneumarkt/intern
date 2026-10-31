import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { request, type FullConfig } from '@playwright/test'
import { authState, email, password, seedUsers } from './fixtures.ts'

// Switches the rate limits off (the suite logs in far more often than 5 times a minute) and stores a
// signed-in browser state per seed user.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!
  const api = await request.newContext({ baseURL })
  try {
    const superuser = await api.post('/api/collections/_superusers/auth-with-password', {
      data: { identity: process.env.E2E_SUPERUSER_EMAIL, password: process.env.E2E_SUPERUSER_PASSWORD },
    })
    if (!superuser.ok()) {
      throw new Error(
        `superuser login failed (${superuser.status()}); is another server on ${baseURL} that ` +
          'e2e/server.mjs did not start with this E2E_SUPERUSER_PASSWORD?',
      )
    }
    const { token } = await superuser.json()
    const settings = await api.patch('/api/settings', {
      headers: { Authorization: token },
      data: { rateLimits: { enabled: false } },
    })
    if (!settings.ok()) throw new Error(`switching rate limits off failed (${settings.status()})`)

    for (const user of seedUsers) {
      const auth = await api.post('/api/collections/users/auth-with-password', {
        data: { identity: email(user), password },
      })
      if (!auth.ok()) throw new Error(`login of ${email(user)} failed (${auth.status()})`)
      const { token, record } = await auth.json()
      const file = authState(user)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(
        file,
        JSON.stringify({
          cookies: [],
          origins: [{ origin: baseURL, localStorage: [{ name: 'pocketbase_auth', value: JSON.stringify({ token, record }) }] }],
        }),
      )
    }
  } finally {
    await api.dispose()
  }
}
