import { randomBytes } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import { authState, expect, removeItemWithHistory, test, tokenOf } from './fixtures.ts'

// The mask test of the paper Betriebsnachweis: Dichtprüfung with a 60 second countdown and the
// Öffnungsdruck, entered as values with limits. The seeded Maskenprüfung asks for them.

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true })
const select = (page: Page, label: string) =>
  page.locator('ion-select').filter({ visible: true, has: page.getByText(label, { exact: true }) })
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

async function createMask(request: APIRequestContext, name: string): Promise<string> {
  const headers = { Authorization: tokenOf('verwaltung') }
  const categories = await request.get('/api/collections/categories/records', {
    headers,
    params: { filter: 'name="Atemschutzmasken"', fields: 'id' },
  })
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
    },
  })
  expect(created.ok(), 'create item').toBe(true)
  return (await created.json()).id
}

test.describe('as pruefung', () => {
  test.use({ storageState: authState('pruefung') })

  test('records the readings, runs the countdown and shows them in the history', async ({ page, request }) => {
    const name = `E2E Messwerte ${randomBytes(3).toString('hex')}`
    const id = await createMask(request, name)
    try {
      await page.goto(`/material/geraete/${id}/pruefung`)
      await expect(select(page, 'Prüfart').locator('.select-text')).toHaveText('Maskenprüfung')
      await expect(page.getByText('Dichtprüfung', { exact: true })).toBeVisible()
      await expect(field(page, 'Startdruck (mbar)')).toHaveValue('-10')

      // The countdown runs in real time; here it only has to start and show the seconds left.
      await page.getByRole('button', { name: '60 s starten' }).click()
      await expect(page.getByRole('timer')).toHaveText(/^(60|59) s$/)
      await expect(page.getByRole('button', { name: 'Neu starten' })).toBeVisible()

      await field(page, 'Druck nach 60 s (mbar)').fill('-9,5')
      await field(page, 'Öffnungsdruck (mbar)').fill('5,1')
      await expect(page.getByText('Verlust 0,5 mbar ✓')).toBeVisible()
      await expect(page.getByText('Öffnungsdruck 5,1 mbar ✓')).toBeVisible()
      await expect(select(page, 'Ergebnis').locator('.select-text')).toHaveText('Bestanden')

      await page.getByRole('button', { name: 'Speichern' }).click()
      await expect(heading(page, name)).toBeVisible()
      await expect(page.getByText(/Dichtheit -10 → -9,5 mbar \(Verlust 0,5\), Öffnungsdruck 5,1 mbar/)).toBeVisible()
      await expect(page.getByText('Maskenprüfung: bestanden')).toBeVisible()
    } finally {
      await removeItemWithHistory(request, id)
    }
  })

  test('suggests Mangel for a reading outside the limits and asks for all values', async ({ page, request }) => {
    const name = `E2E Messwerte ${randomBytes(3).toString('hex')}`
    const id = await createMask(request, name)
    try {
      await page.goto(`/material/geraete/${id}/pruefung`)
      await page.getByRole('button', { name: 'Speichern' }).click()
      await expect(page.getByText('Bitte alle Messwerte eintragen.')).toBeVisible()

      await field(page, 'Druck nach 60 s (mbar)').fill('-5')
      await field(page, 'Öffnungsdruck (mbar)').fill('6,5')
      await expect(page.getByText('Verlust 5 mbar: mehr als 1 mbar')).toBeVisible()
      await expect(page.getByText('Öffnungsdruck 6,5 mbar: zu hoch (höchstens 6,0 mbar)')).toBeVisible()
      await expect(select(page, 'Ergebnis').locator('.select-text')).toHaveText('Mangel')
    } finally {
      await removeItemWithHistory(request, id)
    }
  })
})
