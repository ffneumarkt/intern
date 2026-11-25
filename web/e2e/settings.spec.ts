import type { Page } from '@playwright/test'
import { authState, expect, resetNotificationData, test } from './fixtures.ts'

// The real-browser layer on top of the jsdom tests in pages.test.tsx: state that survives a reload
// against the real server, real switches and time inputs, and Firefox and WebKit behaviour.

const toggle = (page: Page, name: string) => page.getByRole('switch', { name, exact: true })
// The item of a switch; its second line is the summary or „Aus“.
const secondLine = (page: Page, name: string) =>
  page.locator('[data-slot="row"]').filter({ has: toggle(page, name) }).locator('p')
const chip = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
// Every group has an empty alert region from the start; the message is the one with text.
const announced = (page: Page) => page.getByRole('alert').filter({ hasText: /\S/ })
const time = (page: Page, label: 'Von' | 'Bis') => page.getByLabel(label, { exact: true })

async function open(page: Page) {
  await page.goto('/einstellungen')
  await expect(toggle(page, 'Nicht stören')).toBeVisible()
}

test.describe('signed in with the use level', () => {
  const user = 'verwendung'
  test.use({ storageState: authState(user) })

  test.beforeEach(async ({ request }) => {
    await resetNotificationData(request, user)
  })
  test.afterEach(async ({ request }) => {
    await resetNotificationData(request, user)
  })

  test('turns a category on and off, and the state survives a reload', async ({ page }) => {
    await open(page)
    await expect(toggle(page, 'Atemschutzmasken')).not.toBeChecked()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('Aus')

    await toggle(page, 'Atemschutzmasken').click()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('14, 3 Tage vorher · Am Tag · wöchentlich')
    await expect(page.getByText('Erinnerung vor Fälligkeit')).toBeVisible()
    await expect(toggle(page, 'Wöchentlich bei Überfälligem')).toBeChecked()

    await page.reload()
    await expect(toggle(page, 'Atemschutzmasken')).toBeChecked()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('14, 3 Tage vorher · Am Tag · wöchentlich')
    await expect(toggle(page, 'Lungenautomaten')).not.toBeChecked()

    await toggle(page, 'Atemschutzmasken').click()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('Aus')
    await expect(page.getByText('Erinnerung vor Fälligkeit')).toHaveCount(0)
    await page.reload()
    await expect(toggle(page, 'Nicht stören')).toBeVisible()
    await expect(toggle(page, 'Atemschutzmasken')).not.toBeChecked()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('Aus')
  })

  test('the day chips change the summary and survive a reload', async ({ page }) => {
    await open(page)
    await toggle(page, 'Atemschutzmasken').click()
    await expect(chip(page, '7')).toHaveAttribute('aria-pressed', 'false')

    await chip(page, '7').click()
    await expect(chip(page, '7')).toHaveAttribute('aria-pressed', 'true')
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('14, 7, 3 Tage vorher · Am Tag · wöchentlich')
    // 30 days ahead is beyond the old 14 day limit; the server saves it.
    await chip(page, '30').click()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('30, 14, 7, 3 Tage vorher · Am Tag · wöchentlich')
    // The keyboard works too.
    await chip(page, 'Am Tag').focus()
    await page.keyboard.press('Enter')
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('30, 14, 7, 3 Tage vorher · wöchentlich')

    await page.reload()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('30, 14, 7, 3 Tage vorher · wöchentlich')
    for (const [name, pressed] of [['30', true], ['14', true], ['7', true], ['3', true], ['1', false], ['Am Tag', false]] as const) {
      await expect(chip(page, name), name).toHaveAttribute('aria-pressed', String(pressed))
    }
  })

  test('keeps a value set outside the chips', async ({ page }) => {
    await open(page)
    await toggle(page, 'Atemschutzmasken').click()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('14, 3 Tage vorher · Am Tag · wöchentlich')

    // 45 days is no chip, but the server accepts any whole day from 0 to 90.
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem('pocketbase_auth')!).token as string)
    const headers = { Authorization: token }
    const list = await page.request.get('/api/collections/notification_settings/records', { headers })
    const [setting] = (await list.json()).items as { id: string }[]
    const patched = await page.request.patch(`/api/collections/notification_settings/records/${setting.id}`, {
      headers,
      data: { timings: [45, 3] },
    })
    expect(patched.ok(), await patched.text()).toBe(true)
    // ...and nothing further than 90.
    const tooFar = await page.request.patch(`/api/collections/notification_settings/records/${setting.id}`, {
      headers,
      data: { timings: [91] },
    })
    expect(tooFar.status()).toBe(400)

    await page.reload()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('45, 3 Tage vorher · wöchentlich')
    await chip(page, '1').click()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('45, 3, 1 Tage vorher · wöchentlich')
    await page.reload()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('45, 3, 1 Tage vorher · wöchentlich')
  })

  test('the weekly switch changes the summary', async ({ page }) => {
    await open(page)
    await toggle(page, 'Atemschutzmasken').click()
    await expect(toggle(page, 'Wöchentlich bei Überfälligem')).toBeChecked()

    await toggle(page, 'Wöchentlich bei Überfälligem').click()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('14, 3 Tage vorher · Am Tag')
    await page.reload()
    await expect(toggle(page, 'Wöchentlich bei Überfälligem')).not.toBeChecked()
    await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('14, 3 Tage vorher · Am Tag')
  })

  test('quiet time: default, changed times persist', async ({ page }) => {
    await open(page)
    await expect(toggle(page, 'Nicht stören')).toBeChecked()
    await expect(secondLine(page, 'Nicht stören')).toHaveText('22:00 bis 07:00')
    await expect(time(page, 'Von')).toHaveValue('22:00')
    await expect(time(page, 'Bis')).toHaveValue('07:00')

    await time(page, 'Von').fill('21:30')
    await expect(secondLine(page, 'Nicht stören')).toHaveText('21:30 bis 07:00')
    await time(page, 'Bis').fill('06:15')
    await expect(secondLine(page, 'Nicht stören')).toHaveText('21:30 bis 06:15')

    await page.reload()
    await expect(secondLine(page, 'Nicht stören')).toHaveText('21:30 bis 06:15')
    await expect(time(page, 'Von')).toHaveValue('21:30')
    await expect(time(page, 'Bis')).toHaveValue('06:15')
  })

  test('quiet time: equal times are refused and not saved', async ({ page }) => {
    await open(page)
    await time(page, 'Von').fill('21:30')
    await expect(secondLine(page, 'Nicht stören')).toHaveText('21:30 bis 07:00')

    await time(page, 'Bis').fill('21:30')
    await expect(announced(page)).toHaveText('Von und Bis dürfen nicht gleich sein.')
    await expect(secondLine(page, 'Nicht stören')).toHaveText('21:30 bis 07:00')

    await page.reload()
    await expect(time(page, 'Von')).toHaveValue('21:30')
    await expect(time(page, 'Bis')).toHaveValue('07:00')
    await expect(announced(page)).toHaveCount(0)
  })

  test('quiet time: off survives a reload', async ({ page }) => {
    await open(page)
    await time(page, 'Von').fill('23:00')
    await expect(secondLine(page, 'Nicht stören')).toHaveText('23:00 bis 07:00')

    await toggle(page, 'Nicht stören').click()
    await expect(secondLine(page, 'Nicht stören')).toHaveText('Aus')
    await expect(time(page, 'Von')).toHaveCount(0)
    await page.reload()
    await expect(toggle(page, 'Nicht stören')).not.toBeChecked()
    await expect(secondLine(page, 'Nicht stören')).toHaveText('Aus')
    await expect(time(page, 'Von')).toHaveCount(0)

    // After a reload the entered times are gone; switching on starts from the default.
    await toggle(page, 'Nicht stören').click()
    await expect(toggle(page, 'Nicht stören')).toBeChecked()
    await expect(secondLine(page, 'Nicht stören')).toHaveText('22:00 bis 07:00')
  })

  test('quiet time: off and on in one visit keeps the entered times', async ({ page }) => {
    await open(page)
    await time(page, 'Von').fill('23:00')
    await expect(secondLine(page, 'Nicht stören')).toHaveText('23:00 bis 07:00')

    await toggle(page, 'Nicht stören').click()
    await expect(secondLine(page, 'Nicht stören')).toHaveText('Aus')
    await toggle(page, 'Nicht stören').click()
    await expect(secondLine(page, 'Nicht stören')).toHaveText('23:00 bis 07:00')
    await expect(time(page, 'Von')).toHaveValue('23:00')
    await page.reload()
    await expect(secondLine(page, 'Nicht stören')).toHaveText('23:00 bis 07:00')
  })

  test.describe('with a failing save', () => {
    // WebKit does not pass requests of a page that the PWA service worker controls to page.route.
    test.use({ serviceWorkers: async ({ browserName }, use) => use(browserName === 'webkit' ? 'block' : 'allow') })

    test('flips the switch back', async ({ page }) => {
      await open(page)
      await page.route('**/api/collections/notification_settings/records**', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 500, json: { status: 500, message: 'e2e', data: {} } })
          : route.fallback(),
      )

      await toggle(page, 'Atemschutzmasken').click()
      await expect(announced(page)).toHaveText('Speichern fehlgeschlagen.')
      await expect(toggle(page, 'Atemschutzmasken')).not.toBeChecked()
      await expect(secondLine(page, 'Atemschutzmasken')).toHaveText('Aus')
      await expect(chip(page, '14')).toHaveCount(0)

      await page.unrouteAll()
      await page.reload()
      await expect(toggle(page, 'Nicht stören')).toBeVisible()
      await expect(toggle(page, 'Atemschutzmasken')).not.toBeChecked()
    })

    test('puts the times back after a failed quiet time save', async ({ page }) => {
      await open(page)
      await page.route('**/api/collections/notification_preferences/records**', (route) =>
        route.request().method() === 'GET'
          ? route.fallback()
          : route.fulfill({ status: 500, json: { status: 500, message: 'e2e', data: {} } }),
      )

      await time(page, 'Von').fill('21:30')
      await expect(announced(page)).toHaveText('Speichern fehlgeschlagen.')
      await expect(time(page, 'Von')).toHaveValue('22:00')
      await expect(secondLine(page, 'Nicht stören')).toHaveText('22:00 bis 07:00')
    })
  })

  test('push on this device is off with a hint', async ({ page, browserName }) => {
    await open(page)
    await expect(toggle(page, 'Push-Nachrichten')).not.toBeChecked()
    await expect(secondLine(page, 'Push-Nachrichten')).toHaveText('Aus')
    if (browserName === 'webkit') {
      // The iPhone profile is Safari outside the home screen: push needs the installed app.
      await expect(toggle(page, 'Push-Nachrichten')).toBeDisabled()
      await expect(page.getByText(/^Für Push-Nachrichten die App zum Home-Bildschirm hinzufügen/)).toBeVisible()
    } else {
      await expect(toggle(page, 'Push-Nachrichten')).toBeEnabled()
      await expect(page.getByText('Ohne Push auf diesem Gerät kommen keine Nachrichten an.')).toBeVisible()
    }
  })

  test('push stays off when the browser blocks notifications', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'headless Chromium refuses the permission prompt; the others differ')
    await open(page)
    await toggle(page, 'Push-Nachrichten').click()
    await expect(announced(page)).toHaveText('Benachrichtigungen sind im Browser blockiert.')
    await expect(toggle(page, 'Push-Nachrichten')).not.toBeChecked()
    await expect(secondLine(page, 'Push-Nachrichten')).toHaveText('Aus')
  })
})

test.describe('signed in without any level', () => {
  test.use({ storageState: authState('keine') })

  test('says why there are no reminders', async ({ page }) => {
    await open(page)
    await expect(page.getByText('Noch keine Kategorie freigegeben, daher keine Erinnerungen.')).toBeVisible()
    await expect(page.getByRole('switch')).toHaveCount(2)
    await expect(toggle(page, 'Push-Nachrichten')).toBeVisible()
  })
})
