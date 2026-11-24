/// <reference lib="dom" />
import { randomBytes } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import { authState, expect, removeItemWithHistory, test, tokenOf } from './fixtures.ts'

// Scanning with the camera. Chromium films e2e/fixtures/qr.y4m (see playwright.config.ts), a QR code
// for scanCode, so the real decoder runs. Made with:
//   qrencode -o qr.png -s 10 -m 4 E2E-SCAN-1
//   ffmpeg -i qr.png -vf "scale=480:360:force_original_aspect_ratio=decrease:flags=neighbor,pad=480:360:(ow-iw)/2:(oh-ih)/2:white" -frames:v 1 -pix_fmt yuv420p qr.y4m
// Firefox and WebKit have no such camera (a pending permission prompt, no error): there only the page and
// the manual field are checked.
const scanCode = 'E2E-SCAN-1'

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true })
const scanned = (page: Page) => page.getByRole('list', { name: 'Gescannte Geräte' })

// A throwaway mask made by verwaltung, with or without a code.
async function createMask(request: APIRequestContext, name: string, barcode: string): Promise<string> {
  const headers = { Authorization: tokenOf('verwaltung') }
  const categories = await request.get('/api/collections/categories/records', {
    headers,
    params: { filter: 'name="Atemschutzmasken"', fields: 'id' },
  })
  const created = await request.post('/api/collections/items/records', {
    headers,
    data: { name, serial: '', barcode, manufactured_on: '2020-01-01', note: '', status: 'active', category: (await categories.json()).items[0].id },
  })
  expect(created.ok(), 'create item').toBe(true)
  return (await created.json()).id
}

test.describe('as verwaltung', () => {
  test.use({ storageState: authState('verwaltung') })

  test('manual entry works without a camera', async ({ page }) => {
    await page.goto('/material/verwendung')
    await field(page, 'Code manuell eingeben').fill('M-001')
    await field(page, 'Code manuell eingeben').press('Enter')
    await expect(scanned(page).getByText('Maske 01')).toBeVisible()
  })

  test('adds the item of a code seen by the camera', async ({ page, request, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium has a fake camera that shows a chosen picture')
    const name = `Scan ${randomBytes(3).toString('hex')}`
    const id = await createMask(request, name, scanCode)
    try {
      await page.goto('/material/verwendung')
      await expect(scanned(page).getByText(name)).toBeVisible({ timeout: 20_000 })
      await expect(scanned(page).getByRole('listitem')).toHaveCount(1)
    } finally {
      await removeItemWithHistory(request, id)
    }
  })

  test('assigns a code seen by the camera to an item without one', async ({ page, request, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium has a fake camera that shows a chosen picture')
    const name = `Scan ${randomBytes(3).toString('hex')}`
    const id = await createMask(request, name, '')
    try {
      await page.goto('/material/verwendung')
      await expect(page.getByText(`Nicht gefunden: ${scanCode}`)).toBeVisible({ timeout: 20_000 })
      await page.getByRole('button', { name: 'Gerät zuordnen' }).click()
      await field(page, 'Gerät suchen').fill(name)
      await page.locator('ion-item').filter({ visible: true, hasText: name }).click()
      await expect(scanned(page).getByText(name)).toBeVisible()
      const saved = await request.get(`/api/collections/items/records/${id}`, { headers: { Authorization: tokenOf('verwaltung') } })
      expect((await saved.json()).barcode).toBe(scanCode)
    } finally {
      await removeItemWithHistory(request, id)
    }
  })
})
