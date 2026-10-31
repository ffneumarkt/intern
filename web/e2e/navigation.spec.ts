import { authState, expect, test } from './fixtures.ts'

test.describe('signed in with the use level', () => {
  test.use({ storageState: authState('verwendung') })

  test('shows all four tabs', async ({ page }) => {
    await page.goto('/')
    for (const name of ['Start', 'Beförderungspapier', 'Material', 'Einstellungen']) {
      await expect(page.getByRole('tab', { name }), name).toBeVisible()
    }
  })

  test('groups the due list by state', async ({ page }) => {
    await page.goto('/material')
    await expect(page.getByRole('heading', { name: 'Fällig', exact: true })).toBeVisible()
    for (const name of ['Überfällig', 'Heute fällig', 'Bald fällig']) {
      await expect(page.getByRole('region', { name }), name).toBeVisible()
    }
  })
})

test.describe('signed in without any level', () => {
  test.use({ storageState: authState('keine') })

  test('says that no category is shared', async ({ page }) => {
    await page.goto('/material')
    await expect(page.getByText('Noch keine Kategorie freigegeben.')).toBeVisible()
  })
})
