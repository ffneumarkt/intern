import { authState, expect, test } from './fixtures.ts'

// The due list has a second view: every due date, grouped by month.

test.use({ storageState: authState('verwendung') })

test('shows the due dates by month and goes back to what is due now', async ({ page }) => {
  await page.goto('/material')
  await expect(page.getByRole('region', { name: 'Überfällig', exact: true })).toBeVisible()

  await page.getByRole('tab', { name: 'Zeitplan' }).click()
  await expect(page.getByRole('region', { name: 'Zeitplan: Überfällig' })).toBeVisible()
  // Later months follow with their own header; the seed has due dates in the coming year.
  await expect(page.locator('section[aria-label^="Zeitplan: "]').nth(1)).toBeVisible()

  await page.getByRole('tab', { name: 'Fällig' }).click()
  await expect(page.getByRole('region', { name: 'Überfällig', exact: true })).toBeVisible()
})
