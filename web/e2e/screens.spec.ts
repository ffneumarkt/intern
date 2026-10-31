import type { Page } from '@playwright/test'
import { authState, expect, resetNotificationData, test, type SeedUser } from './fixtures.ts'

// Screenshots of Einstellungen for a visual check, only with E2E_SCREENSHOTS=1:
// test-results/screens/<project>-<state>.png. WebKit (iPhone profile) shows Ionic's iOS mode,
// Chromium and Firefox the Material mode. Not committed.
test.skip(!process.env.E2E_SCREENSHOTS, 'set E2E_SCREENSHOTS=1 for the screenshots')

const toggle = (page: Page, name: string) => page.getByRole('switch', { name, exact: true })

// IonContent scrolls inside the page, so a full-page shot of a phone viewport would cut it off;
// a tall viewport of the same width shows the whole page.
async function shoot(page: Page, project: string, state: string) {
  await page.setViewportSize({ width: 390, height: 1500 })
  await page.screenshot({ path: `test-results/screens/${project}-${state}.png`, fullPage: true, animations: 'disabled' })
}

async function open(page: Page) {
  await page.goto('/einstellungen')
  await expect(toggle(page, 'Nicht stören')).toBeVisible()
}

for (const user of ['verwendung', 'keine'] satisfies SeedUser[]) {
  test.describe(user, () => {
    test.use({ storageState: authState(user) })
    test.beforeEach(async ({ request }) => resetNotificationData(request, user))
    test.afterEach(async ({ request }) => resetNotificationData(request, user))

    if (user === 'keine') {
      test('no permitted category', async ({ page }, info) => {
        await open(page)
        await shoot(page, info.project.name, 'keine')
      })
      return
    }

    test('nothing enabled', async ({ page }, info) => {
      await open(page)
      await toggle(page, 'Nicht stören').click()
      await expect(toggle(page, 'Nicht stören')).not.toBeChecked()
      await shoot(page, info.project.name, 'nothing')
    })

    test('one category enabled', async ({ page }, info) => {
      await open(page)
      await toggle(page, 'Nicht stören').click()
      await expect(toggle(page, 'Nicht stören')).not.toBeChecked()
      await toggle(page, 'Atemschutzmasken').click()
      await expect(page.getByText('14, 3 Tage vorher · Am Tag · wöchentlich')).toBeVisible()
      await shoot(page, info.project.name, 'category')
    })

    test('quiet time on', async ({ page }, info) => {
      await open(page)
      await expect(toggle(page, 'Nicht stören')).toBeChecked()
      await expect(page.getByLabel('Von', { exact: true })).toHaveValue('22:00')
      await shoot(page, info.project.name, 'quiet')
    })
  })
}
