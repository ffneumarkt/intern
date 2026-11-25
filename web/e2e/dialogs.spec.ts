import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import { authState, email, expect, password, removePasskeys, test, type SeedUser } from './fixtures.ts'

// Confirm and prompt dialogs are IonAlerts. The items and check types are created through the REST
// API with the user's own token and removed again; seed rows are never touched.

const user: SeedUser = 'verwaltung'

const token = (who: SeedUser): string => {
  const state = JSON.parse(readFileSync(authState(who), 'utf8'))
  const entry = state.origins[0].localStorage.find((item: { name: string }) => item.name === 'pocketbase_auth')
  return JSON.parse(entry.value).token
}

const alert = (page: Page) => page.locator('[role="alertdialog"]')
const alertButton = (page: Page, name: string) => alert(page).getByRole('button', { name, exact: true })

async function categoryId(request: APIRequestContext, name: string): Promise<string> {
  const list = await request.get('/api/collections/categories/records', {
    headers: { Authorization: token(user) },
    params: { filter: `name="${name}"`, fields: 'id' },
  })
  expect(list.ok()).toBe(true)
  return (await list.json()).items[0].id
}

async function create(request: APIRequestContext, collection: string, data: Record<string, unknown>): Promise<string> {
  const created = await request.post(`/api/collections/${collection}/records`, {
    headers: { Authorization: token(user) },
    data,
  })
  expect(created.ok(), `create ${collection}`).toBe(true)
  return (await created.json()).id
}

const createItem = async (request: APIRequestContext, name: string) =>
  create(request, 'items', {
    name,
    serial: '',
    barcode: `E2E-${randomBytes(6).toString('hex')}`,
    manufactured_on: '2020-01-01',
    note: '',
    status: 'active',
    category: await categoryId(request, 'Atemschutzmasken'),
  })

// Best-effort cleanup: the row is gone already when the test passed.
async function remove(request: APIRequestContext, collection: string, id: string) {
  await request.delete(`/api/collections/${collection}/records/${id}`, { headers: { Authorization: token(user) } })
}

async function exists(request: APIRequestContext, collection: string, id: string) {
  const found = await request.get(`/api/collections/${collection}/records/${id}`, {
    headers: { Authorization: token(user) },
  })
  return found.ok()
}

test.describe('verwaltung', () => {
  test.use({ storageState: authState(user) })

  test('deletes an item only after confirming', async ({ page, request }) => {
    const name = `E2E Löschen ${randomBytes(3).toString('hex')}`
    const id = await createItem(request, name)
    try {
      await page.goto(`/material/geraete/${id}/bearbeiten`)
      await page.getByRole('button', { name: 'Gerät löschen' }).click()
      await expect(alert(page).getByText(`${name} löschen?`)).toBeVisible()

      await alertButton(page, 'Abbrechen').click()
      await expect(alert(page)).toHaveCount(0)
      expect(await exists(request, 'items', id)).toBe(true)

      await page.getByRole('button', { name: 'Gerät löschen' }).click()
      await alertButton(page, 'Löschen').click()
      await expect.poll(() => exists(request, 'items', id)).toBe(false)
      await expect(page).toHaveURL(/\/material\/kategorien\//)
    } finally {
      await remove(request, 'items', id)
    }
  })

  test('closes the alert with Escape without acting', async ({ page, request }) => {
    const id = await createItem(request, `E2E Escape ${randomBytes(3).toString('hex')}`)
    try {
      await page.goto(`/material/geraete/${id}/bearbeiten`)
      await page.getByRole('button', { name: 'Gerät löschen' }).click()
      await expect(alert(page)).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(alert(page)).toHaveCount(0)
      expect(await exists(request, 'items', id)).toBe(true)
    } finally {
      await remove(request, 'items', id)
    }
  })

  test('retires an item from its detail page after confirming', async ({ page, request }) => {
    const name = `E2E Ausscheiden ${randomBytes(3).toString('hex')}`
    const id = await createItem(request, name)
    try {
      await page.goto(`/material/geraete/${id}`)
      await page.getByRole('button', { name: 'Ausscheiden' }).click()
      await expect(alert(page).getByText(`${name} ausscheiden?`)).toBeVisible()

      await alertButton(page, 'Abbrechen').click()
      await expect(alert(page)).toHaveCount(0)
      await expect(page.getByText('Status: Aktiv')).toBeVisible()

      await page.getByRole('button', { name: 'Ausscheiden' }).click()
      await alertButton(page, 'Ausscheiden').click()
      await expect(page.getByText('Status: Ausgeschieden')).toBeVisible()
    } finally {
      await remove(request, 'items', id)
    }
  })

  test('deletes a check type from the manage page after confirming', async ({ page, request }) => {
    const name = `E2E Prüfart ${randomBytes(3).toString('hex')}`
    const category = await categoryId(request, 'Atemschutzmasken')
    const id = await create(request, 'check_types', {
      name,
      interval_months: 12,
      after_use: false,
      is_default: false,
      also_satisfies: [],
      category,
    })
    try {
      await page.goto(`/material/verwalten?kategorie=${category}`)
      await page.getByRole('tab', { name: 'Prüfarten' }).click()
      await page.locator('[data-slot="row"]', { hasText: name }).first().click()
      await page.getByRole('button', { name: 'Prüfart löschen' }).click()
      await expect(alert(page).getByText(`${name} löschen?`)).toBeVisible()

      await alertButton(page, 'Abbrechen').click()
      await expect(alert(page)).toHaveCount(0)
      expect(await exists(request, 'check_types', id)).toBe(true)

      await page.getByRole('button', { name: 'Prüfart löschen' }).click()
      await alertButton(page, 'Löschen').click()
      await expect.poll(() => exists(request, 'check_types', id)).toBe(false)
    } finally {
      await remove(request, 'check_types', id)
    }
  })
})

test.describe('passkey', () => {
  const owner: SeedUser = 'pruefung'

  test.afterEach(async ({ request }) => {
    await removePasskeys(request, owner)
  })

  test('renames and removes a passkey', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium has a virtual authenticator (CDP)')

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })

    const visible = (label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true })
    await page.goto('/login')
    await visible('E-Mail').fill(email(owner))
    await visible('Passwort').fill(password)
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
    await page.getByRole('navigation', { name: 'Hauptmenü' }).getByRole('link', { name: 'Einstellungen' }).click()
    await visible('Name des Geräts').fill('E2E-Gerät')
    await visible('Passwort').fill(password)
    await page.getByRole('button', { name: 'Passkey hinzufügen' }).click()
    await expect(page.getByText(/angelegt am/)).toBeVisible()
    await expect(page.locator('[data-slot="row-label"]', { hasText: 'E2E-Gerät' })).toBeVisible()

    await page.getByRole('button', { name: 'Umbenennen' }).click()
    await expect(alert(page).getByText('Passkey umbenennen')).toBeVisible()
    const input = alert(page).getByRole('textbox', { name: 'Neuer Name' })
    await expect(input).toHaveValue('E2E-Gerät')
    await input.fill('Diensthandy')
    await alertButton(page, 'Speichern').click()
    await expect(page.locator('[data-slot="row-label"]', { hasText: 'Diensthandy' })).toBeVisible()

    await page.getByRole('button', { name: 'Entfernen' }).click()
    await expect(alert(page).getByText('Passkey „Diensthandy“ entfernen?')).toBeVisible()
    await alertButton(page, 'Abbrechen').click()
    await expect(alert(page)).toHaveCount(0)
    await expect(page.locator('[data-slot="row-label"]', { hasText: 'Diensthandy' })).toBeVisible()

    await page.getByRole('button', { name: 'Entfernen' }).click()
    await alertButton(page, 'Entfernen').click()
    await expect(page.getByText('Noch kein Passkey angelegt.')).toBeVisible()
  })
})
