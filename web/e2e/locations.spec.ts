import { randomBytes } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import { authState, expect, removeItemWithHistory, test, tokenOf } from './fixtures.ts'

// Where a mask is: after a passed check it goes to the workshop or a truck, and the lists can be
// filtered by it. The seed has the locations AS-Werkstatt, RLF and LAST.

const select = (page: Page, label: string) =>
  page.locator('ion-select').filter({ visible: true, has: page.getByText(label, { exact: true }) })
// The location chips of the page with the given heading; Ionic keeps the page it came from mounted behind it.
const chip = (page: Page, heading: string, name: string) =>
  page
    .locator('ion-content')
    .filter({ has: page.locator('h1.page-heading', { hasText: heading }) })
    .getByRole('group', { name: 'Standort' })
    .getByText(name, { exact: true })

async function createMask(request: APIRequestContext, name: string): Promise<string> {
  const headers = { Authorization: tokenOf('verwaltung') }
  const categories = await request.get('/api/collections/categories/records', {
    headers,
    params: { filter: 'name="Atemschutzmasken"', fields: 'id' },
  })
  const workshop = await request.get('/api/collections/locations/records', { headers, params: { filter: 'is_default=true', fields: 'id' } })
  const created = await request.post('/api/collections/items/records', {
    headers,
    data: {
      name,
      serial: '',
      barcode: `E2E-${randomBytes(6).toString('hex')}`,
      manufactured_on: '2020-01-01',
      note: '',
      status: 'active',
      category: (await categories.json()).items[0].id,
      location: (await workshop.json()).items[0].id,
    },
  })
  expect(created.ok(), 'create item').toBe(true)
  return (await created.json()).id
}

test.describe('as pruefung', () => {
  test.use({ storageState: authState('pruefung') })

  test('puts a checked mask on a truck and finds it with the filter', async ({ page, request }) => {
    const name = `E2E Standort ${randomBytes(3).toString('hex')}`
    const id = await createMask(request, name)
    try {
      await page.goto(`/material/geraete/${id}/pruefung`)
      // A check type without readings keeps the form short.
      await select(page, 'Prüfart').click()
      await page.locator('ion-popover').getByRole('radio', { name: '5-Jahres-Prüfung', exact: true }).click()
      await expect(page.locator('ion-popover')).toHaveCount(0)

      // The workshop is preselected; a passed check offers the trucks.
      const where = select(page, 'Standort')
      await expect(where.locator('.select-text')).toHaveText('AS-Werkstatt')
      await where.click()
      await page.locator('ion-popover').getByRole('radio', { name: 'RLF', exact: true }).click()
      await expect(where.locator('.select-text')).toHaveText('RLF')
      await page.getByRole('button', { name: 'Speichern' }).click()

      await expect(page.getByText('Standort: RLF').first()).toBeVisible()

      // The category page lists it under RLF and no longer under LAST.
      await page.goto('/material')
      await page.getByText('Atemschutzmasken', { exact: true }).last().click()
      await expect(page.locator('h1.page-heading').filter({ hasText: 'Atemschutzmasken' })).toBeVisible()
      await chip(page, 'Atemschutzmasken', 'RLF').click()
      await expect(page.locator('ion-item.item-row').filter({ visible: true, hasText: name })).toBeVisible()
      await chip(page, 'Atemschutzmasken', 'LAST').click()
      await expect(page.locator('ion-item.item-row').filter({ visible: true, hasText: name })).toHaveCount(0)
    } finally {
      await removeItemWithHistory(request, id)
    }
  })

  test('a failed check does not offer a Standort', async ({ page, request }) => {
    const name = `E2E Standort ${randomBytes(3).toString('hex')}`
    const id = await createMask(request, name)
    try {
      await page.goto(`/material/geraete/${id}/pruefung`)
      await select(page, 'Ergebnis').click()
      await page.locator('ion-popover').getByRole('radio', { name: 'Mangel', exact: true }).click()
      await expect(page.locator('ion-popover')).toHaveCount(0)
      await expect(select(page, 'Standort')).toHaveCount(0)
    } finally {
      await removeItemWithHistory(request, id)
    }
  })
})
