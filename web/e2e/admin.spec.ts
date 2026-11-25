import { randomBytes } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import { authState, expect, removeItemWithHistory, test, tokenOf } from './fixtures.ts'

// The admin screens, as the seeded manager (who holds every admin area): members, categories and
// corrections. Throwaway data is removed (members are deactivated, never deleted).

test.use({ storageState: authState('verwaltung') })

const unique = () => randomBytes(3).toString('hex')
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true })
const alertButton = (page: Page, name: string) => page.locator('ion-alert').getByRole('button', { name, exact: true })
const headers = () => ({ Authorization: tokenOf('verwaltung') })

test('creates a member, shows the setup link, and deactivates the member', async ({ page }) => {
  const name = `E2E Mitglied ${unique()}`
  await page.goto('/einstellungen')
  await page.getByRole('link', { name: 'Verwaltung' }).click()
  await page.getByRole('link', { name: 'Mitglieder' }).click()
  await page.getByRole('link', { name: 'Neues Mitglied' }).click()
  await field(page, 'Name').fill(name)
  await field(page, 'E-Mail').fill(`e2e-${unique()}@ffneumarkt.local`)
  await page.getByRole('button', { name: 'Mitglied anlegen' }).click()
  await expect(page.getByTestId('setup-link')).toContainText('/einrichtung#')
  await page.getByRole('button', { name: 'Fertig' }).click()

  await page.locator('ion-item', { hasText: name }).filter({ visible: true }).click()
  await page.getByRole('button', { name: 'Deaktivieren' }).click()
  await alertButton(page, 'Deaktivieren').click()
  await expect(page.getByRole('button', { name: 'Wieder aktivieren' })).toBeVisible()
})

test('creates, renames and deletes a category', async ({ page }) => {
  const name = `E2E Kategorie ${unique()}`
  await page.goto('/verwaltung/kategorien')
  await page.getByRole('link', { name: 'Neue Kategorie' }).click()
  await field(page, 'Name').fill(name)
  await page.getByRole('button', { name: 'Kategorie anlegen' }).click()
  await page.locator('ion-item', { hasText: name }).filter({ visible: true }).click()
  await page.getByRole('button', { name: 'Kategorie löschen' }).click()
  await alertButton(page, 'Löschen').click()
  await expect(page.locator('ion-item', { hasText: name }).filter({ visible: true })).toHaveCount(0)
})

async function createMaskWithUse(request: APIRequestContext, name: string): Promise<string> {
  const categories = await request.get('/api/collections/categories/records', { headers: headers(), params: { filter: 'name="Atemschutzmasken"', fields: 'id' } })
  const category = (await categories.json()).items[0].id
  const created = await request.post('/api/collections/items/records', {
    headers: headers(),
    data: { name, serial: '', barcode: `E2E-${randomBytes(6).toString('hex')}`, manufactured_on: '2020-01-01', note: '', status: 'active', category },
  })
  expect(created.ok(), 'create item').toBe(true)
  const id = (await created.json()).id
  // The users cannot be listed; the id is in the token.
  const userId = JSON.parse(Buffer.from(tokenOf('verwaltung').split('.')[1], 'base64url').toString()).id as string
  const used = await request.post('/api/collections/uses/records', {
    headers: headers(),
    data: { item: id, date: '2026-01-10', kind: 'operation', note: 'Falscher Text', created_by: userId },
  })
  expect(used.ok(), 'create use').toBe(true)
  return id
}

test('corrects a use from the history of its item and lists the correction', async ({ page, request }) => {
  const name = `E2E Korrektur ${unique()}`
  const id = await createMaskWithUse(request, name)
  try {
    await page.goto(`/material/geraete/${id}`)
    await page.locator('ion-item', { hasText: 'Falscher Text' }).filter({ visible: true }).click()
    // With a value in it the label of the textarea includes the value, so it is found by its start.
    await page.getByLabel(/^Notiz/).filter({ visible: true }).fill('Richtiger Text')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.locator('ion-item', { hasText: 'Richtiger Text' }).filter({ visible: true })).toBeVisible()
    await expect(page.getByText('Eintrag geändert')).toBeVisible()
  } finally {
    await removeItemWithHistory(request, id)
  }
})
