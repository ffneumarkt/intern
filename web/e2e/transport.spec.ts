/// <reference lib="dom" />
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

// The Beförderungspapier needs no login and has to work offline. Real browsers add what jsdom cannot:
// the PDF is really made by pdf-lib, and the service worker serves the page and settings offline.

const countField = (page: Page) => page.getByLabel('Anzahl Flaschen à 6,8 l', { exact: true }).filter({ visible: true })
const openButton = (page: Page) => page.getByRole('button', { name: 'PDF öffnen' }).filter({ visible: true })

// Keeps the Blob behind the PDF tab, so a test can check what was made (the tab itself is a PDF viewer).
async function captureBlobs(page: Page) {
  await page.addInitScript(() => {
    const blobs: Blob[] = []
    const create = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      if (blob instanceof Blob) blobs.push(blob)
      return create(blob)
    }
    ;(window as unknown as { __blobs: Blob[] }).__blobs = blobs
  })
}

async function madePdf(page: Page): Promise<string> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __blobs: Blob[] }).__blobs.length)).toBe(1)
  return page.evaluate(async () => (await (window as unknown as { __blobs: Blob[] }).__blobs[0].text()).slice(0, 5))
}

test('makes the PDF from the count alone and remembers the count', async ({ page, context }) => {
  await captureBlobs(page)
  await page.goto('/befoerderungspapier')
  await expect(countField(page)).toBeVisible()
  await expect(openButton(page)).toBeDisabled()
  await countField(page).fill('4')
  await expect(page.getByText('4 Flaschen à 6,8 l = 27,2 l = 27,2 Punkte (max. 1000)').first()).toBeVisible()

  const popup = context.waitForEvent('page')
  await openButton(page).click()
  await popup
  expect(await madePdf(page)).toBe('%PDF-')

  await page.reload()
  await expect(countField(page)).toHaveValue('4')
  await expect(openButton(page)).toBeEnabled()
})

test('shows the checklist and the route', async ({ page }) => {
  await page.goto('/befoerderungspapier')
  await expect(page.getByText('Vor der Fahrt')).toBeVisible()
  await expect(page.getByText('Restdruck in allen Flaschen vorhanden')).toBeVisible()
  await expect(page.getByText(/FF Neumarkt, Edlwies 3.*→ FF Grünbach/)).toBeVisible()
})

test('works offline after the first visit', async ({ page, context }) => {
  await captureBlobs(page)
  await page.goto('/befoerderungspapier')
  await expect(countField(page)).toBeVisible()
  // The worker takes control of the page on the reload after its first activation.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(countField(page)).toBeVisible()
  await expect(page.getByText('FF Grünbach').first()).toBeVisible()
  await countField(page).fill('2')
  const popup = context.waitForEvent('page')
  await openButton(page).click()
  await popup
  expect(await madePdf(page)).toBe('%PDF-')
})
