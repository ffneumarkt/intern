import type { Page } from '@playwright/test'
import { authState, email, expect, resetNotificationData, test, tokenOf, type SeedUser } from './fixtures.ts'

// Screenshots of Einstellungen and the forms for a visual check, only with E2E_SCREENSHOTS=1:
// <E2E_SCREENS_DIR or test-results/screens>/<project>-<state>.png. WebKit (iPhone profile) shows
// Ionic's iOS mode, Chromium and Firefox the Material mode. Nothing is saved; not committed.
test.skip(!process.env.E2E_SCREENSHOTS, 'set E2E_SCREENSHOTS=1 for the screenshots')

const screensDir = process.env.E2E_SCREENS_DIR ?? 'test-results/screens'

const toggle = (page: Page, name: string) => page.getByRole('switch', { name, exact: true })

// IonContent scrolls inside the page, so a full-page shot of a phone viewport would cut it off;
// a tall viewport of the same width shows the whole page.
async function shoot(page: Page, project: string, state: string) {
  await page.setViewportSize({ width: 390, height: 1500 })
  await page.screenshot({ path: `${screensDir}/${project}-${state}.png`, fullPage: true, animations: 'disabled' })
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

// Ionic keeps visited pages mounted and hidden; only the visible field is meant.
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true })
const select = (page: Page, label: string) =>
  page.locator('ion-select').filter({ visible: true, has: page.getByText(label, { exact: true }) })

test.describe('forms', () => {
  test('login with a failed attempt', async ({ page }, info) => {
    await page.goto('/login')
    await shoot(page, info.project.name, 'login')
    await field(page, 'E-Mail').fill(email('verwendung'))
    await field(page, 'Passwort').fill('falsch')
    // The focused field, not a second lookup (see forms.spec.ts: Ionic's iOS input shim copies the field).
    await page.keyboard.press('Enter')
    await expect(page.getByText('Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.')).toBeVisible()
    await shoot(page, info.project.name, 'login-error')
  })

  test.describe('verwendung', () => {
    test.use({ storageState: authState('verwendung') })

    test('record use', async ({ page }, info) => {
      await page.goto('/material/verwendung')
      const code = field(page, 'Code manuell eingeben')
      await code.fill('M-001')
      await code.press('Enter')
      await code.fill('Mask')
      await expect(page.getByRole('list', { name: 'Vorschläge' })).toBeVisible()
      await shoot(page, info.project.name, 'use-scan')
      await code.fill('')
      await page.getByRole('button', { name: 'Fertig' }).click()
      await expect(field(page, 'Erfasst von')).toBeVisible()
      await shoot(page, info.project.name, 'use-form')
      await select(page, 'Art').click()
      await expect(page.locator('ion-popover').getByRole('radio', { name: 'Übung', exact: true })).toBeVisible()
      await shoot(page, info.project.name, 'use-select')
    })
  })

  test.describe('pruefung', () => {
    test.use({ storageState: authState('pruefung') })

    test('record check', async ({ page, request }, info) => {
      const list = await request.get('/api/collections/items/records', {
        headers: { Authorization: tokenOf('pruefung') },
        params: { filter: 'name="Maske 01"', fields: 'id' },
      })
      const { id } = (await list.json()).items[0]
      await page.goto(`/material/geraete/${id}/pruefung`)
      await expect(select(page, 'Prüfart').locator('.select-text')).toHaveText('Maskenprüfung')
      await shoot(page, info.project.name, 'check-form')
    })
  })

  test.describe('verwaltung', () => {
    test.use({ storageState: authState('verwaltung') })

    test('item form', async ({ page }, info) => {
      await page.goto('/material/verwalten')
      await page.getByRole('link', { name: 'Neues Gerät' }).click()
      await expect(field(page, 'Bezeichnung')).toBeVisible()
      await shoot(page, info.project.name, 'item-form')
    })

    test('check type form and its validation error', async ({ page }, info) => {
      await page.goto('/material/verwalten')
      await page.locator('ion-segment-button', { hasText: 'Prüfarten' }).click()
      await page.locator('ion-item', { hasText: 'Maskenprüfung' }).filter({ visible: true }).first().click()
      await expect(page.getByText('Prüfart bearbeiten')).toBeVisible()
      await shoot(page, info.project.name, 'checktype-edit')

      await page.goto('/material/verwalten')
      await page.locator('ion-segment-button', { hasText: 'Prüfarten' }).click()
      await page.getByRole('link', { name: 'Neue Prüfart' }).click()
      await field(page, 'Name').fill('Sichtprüfung')
      await page.getByRole('button', { name: 'Prüfart anlegen' }).click()
      await expect(page.getByText('Intervall oder „nach Verwendung“ angeben.')).toBeVisible()
      await shoot(page, info.project.name, 'checktype-error')
    })
  })
})
