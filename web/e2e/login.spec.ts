import type { Page } from '@playwright/test'
import { email, expect, password, removePasskeys, test, type SeedUser } from './fixtures.ts'

// Ionic keeps visited pages mounted and hidden, so a label can exist twice (login and settings);
// only the visible one is meant.
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true })

async function logIn(page: Page, user: SeedUser, withPassword = password) {
  await field(page, 'E-Mail').fill(email(user))
  await field(page, 'Passwort').fill(withPassword)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
}

const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

test('logs in with the password and shows the due list', async ({ page }) => {
  await page.goto('/login')
  await logIn(page, 'verwendung')
  await expect(heading(page, 'Fällig')).toBeVisible()
})

test('shows an error for a wrong password', async ({ page }) => {
  await page.goto('/login')
  await logIn(page, 'verwendung', 'falsches-passwort')
  await expect(page.getByText('Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.')).toBeVisible()
  await expect(heading(page, 'Anmelden')).toBeVisible()
})

// Regression of PR #14: the second login left the login page on top of the due list.
test('opens the due list again after logging out and back in', async ({ page }) => {
  await page.goto('/login')
  await logIn(page, 'verwendung')
  await expect(heading(page, 'Fällig')).toBeVisible()

  await page.getByRole('navigation', { name: 'Hauptmenü' }).getByRole('link', { name: 'Einstellungen' }).click()
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect(heading(page, 'Anmelden')).toBeVisible()

  await logIn(page, 'verwendung')
  await expect(heading(page, 'Fällig')).toBeVisible()
  await expect(heading(page, 'Anmelden')).toHaveCount(0)
})

test('sends logged-out visitors of protected pages to the login', async ({ page }) => {
  for (const path of ['/material', '/material/verwalten', '/einstellungen']) {
    await page.goto(path)
    await expect(page, path).toHaveURL(/\/login$/)
    await expect(heading(page, 'Anmelden')).toBeVisible()
  }
})

test.describe('passkey', () => {
  const user: SeedUser = 'pruefung'

  test.afterEach(async ({ request }) => {
    await removePasskeys(request, user)
  })

  test('adds a passkey and logs in with it', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium has a virtual authenticator (CDP)')

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })

    await page.goto('/login')
    await logIn(page, user)
    await expect(heading(page, 'Fällig')).toBeVisible()

    await page.getByRole('navigation', { name: 'Hauptmenü' }).getByRole('link', { name: 'Einstellungen' }).click()
    await field(page, 'Name des Geräts').fill('E2E-Gerät')
    await field(page, 'Passwort').fill(password)
    await page.getByRole('button', { name: 'Passkey hinzufügen' }).click()
    await expect(page.getByText(/angelegt am/)).toBeVisible()

    await page.getByRole('button', { name: 'Abmelden' }).click()
    await page.getByRole('button', { name: 'Mit Passkey anmelden' }).click()
    await expect(heading(page, 'Fällig')).toBeVisible()
  })
})
