import { randomBytes } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import { authState, expect, removeItemWithHistory, test, tokenOf } from './fixtures.ts'

// „Prüfen“ on a row of the due list opens the check form of that item directly, and saving returns to the list.

const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })
// The native select of components/Field.tsx by its label (the page the user came from stays mounted, hence visible).
const select = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true })

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

  test('checks an item straight from its row and lands on the list again', async ({ page, request }) => {
    const name = `E2E Zeile ${randomBytes(3).toString('hex')}`
    const id = await createMask(request, name)
    try {
      await page.goto('/material')
      const row = page.locator('[data-slot="row"]').filter({ visible: true, hasText: name })
      await expect(row).toBeVisible()
      await row.getByRole('button', { name: 'Prüfen' }).click()

      // The check form of that item, not its item page.
      await expect(heading(page, 'Prüfung erfassen')).toBeVisible()
      // Ionic keeps the list mounted behind the form, so the name is looked for in the form's own line.
      await expect(page.locator('p.ui-hint strong').filter({ hasText: name })).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`/material/geraete/${id}/pruefung`))

      // A check type without readings keeps the form short.
      await select(page, 'Prüfart').selectOption({ label: '5-Jahres-Prüfung' })
      await page.getByRole('button', { name: 'Speichern' }).click()

      await expect(heading(page, 'Fällig')).toBeVisible()
      await expect(page).toHaveURL(/\/material$/)
    } finally {
      await removeItemWithHistory(request, id)
    }
  })

  test('the rest of the row still opens the item page', async ({ page, request }) => {
    const name = `E2E Zeile ${randomBytes(3).toString('hex')}`
    const id = await createMask(request, name)
    try {
      await page.goto('/material')
      await page.locator('[data-slot="row"]').filter({ visible: true, hasText: name }).getByText(name, { exact: true }).click()
      // The item page's own title (the list row behind it has an h2, not the page heading).
      await expect(page.locator('h1.page-heading').filter({ hasText: name })).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`/material/geraete/${id}$`))
    } finally {
      await removeItemWithHistory(request, id)
    }
  })
})
