import type { Page } from '@playwright/test'
import { authState, email, expect, password, test } from './fixtures.ts'

// The Ionic form fields of components/Field.tsx in a real browser: Enter submits, autofill hints
// reach the native input, selects and toggles work through their overlays. Nothing is saved.

// Ionic keeps visited pages mounted and hidden; only the visible field is meant.
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true })
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

test('logs in with Enter in the password field', async ({ page }) => {
  await page.goto('/login')
  await expect(field(page, 'E-Mail')).toHaveAttribute('autocomplete', 'username')
  await expect(field(page, 'E-Mail')).toHaveAttribute('type', 'email')
  await expect(field(page, 'Passwort')).toHaveAttribute('autocomplete', 'current-password')
  await expect(field(page, 'Passwort')).toHaveAttribute('type', 'password')
  await field(page, 'E-Mail').fill(email('verwendung'))
  await field(page, 'Passwort').fill(password)
  await field(page, 'Passwort').press('Enter')
  await expect(heading(page, 'Fällig')).toBeVisible()
})

test.describe('as verwaltung', () => {
  test.use({ storageState: authState('verwaltung') })

  test('adds a scanned code with Enter and chooses the kind of use', async ({ page }) => {
    await page.goto('/material/verwendung')
    const code = field(page, 'Code manuell eingeben')
    await code.fill('M-001')
    await code.press('Enter')
    await expect(page.getByRole('list', { name: 'Gescannte Geräte' }).getByText('Maske 01')).toBeVisible()
    await expect(code).toHaveValue('')

    await page.getByRole('button', { name: 'Fertig' }).click()
    // The form has one select (Art); its chosen text lives in the shadow DOM, which CSS pierces.
    const kind = page.locator('ion-select').filter({ visible: true })
    await expect(kind.locator('.select-text')).toHaveText('Einsatz')
    await kind.click()
    await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeVisible()
    await page.getByRole('radio', { name: 'Übung' }).click()
    await page.getByRole('button', { name: 'OK' }).click()
    await expect(kind).toHaveJSProperty('value', 'exercise')
    await expect(kind.locator('.select-text')).toHaveText('Übung')
  })

  test('switches a check type toggle', async ({ page }) => {
    await page.goto('/material/verwalten')
    await page.locator('ion-segment-button', { hasText: 'Prüfarten' }).click()
    const toggle = page.getByRole('switch', { name: 'nach Verwendung' }).filter({ visible: true })
    await expect(toggle).not.toBeChecked()
    await toggle.click()
    await expect(toggle).toBeChecked()
  })
})
