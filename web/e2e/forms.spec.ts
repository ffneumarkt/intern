import { randomBytes } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import { authState, email, expect, password, removeItemWithHistory, test, tokenOf, viennaToday } from './fixtures.ts'

// The Ionic form fields of components/Field.tsx in a real browser: Enter submits, autofill hints
// reach the native input, selects and toggles work through their overlays, and the real forms save.
// Saving tests work on throwaway items, created through the REST API (or the form itself) and removed
// with their history afterwards; seed items are never touched.

// Ionic keeps visited pages mounted and hidden; only the visible field is meant.
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true })
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })
// An ion-select by its label, which lives in the select's shadow DOM (CSS and text locators pierce it).
const select = (page: Page, label: string) =>
  page.locator('ion-select').filter({ visible: true, has: page.getByText(label, { exact: true }) })
const unique = () => randomBytes(3).toString('hex')

// Picks an option in the select's popover: one tap on the option closes it.
async function choose(page: Page, label: string, option: string) {
  await select(page, label).click()
  await page.locator('ion-popover').getByRole('radio', { name: option, exact: true }).click()
  await expect(page.locator('ion-popover')).toHaveCount(0)
  await expect(select(page, label).locator('.select-text')).toHaveText(option)
}

const historyEntry = (page: Page, title: string) => page.locator('ion-item').filter({ visible: true, has: heading(page, title) })

async function categoryId(request: APIRequestContext, name: string): Promise<string> {
  const list = await request.get('/api/collections/categories/records', {
    headers: { Authorization: tokenOf('verwaltung') },
    params: { filter: `name="${name}"`, fields: 'id' },
  })
  expect(list.ok()).toBe(true)
  return (await list.json()).items[0].id
}

// A throwaway mask, created by verwaltung.
async function createMask(request: APIRequestContext, name: string): Promise<string> {
  const created = await request.post('/api/collections/items/records', {
    headers: { Authorization: tokenOf('verwaltung') },
    data: {
      name,
      serial: '',
      barcode: `E2E-${randomBytes(6).toString('hex')}`,
      manufactured_on: '2020-01-01',
      note: '',
      status: 'active',
      category: await categoryId(request, 'Atemschutzmasken'),
    },
  })
  expect(created.ok(), 'create item').toBe(true)
  return (await created.json()).id
}

test('logs in with Enter in the password field', async ({ page }) => {
  await page.goto('/login')
  await expect(field(page, 'E-Mail')).toHaveAttribute('autocomplete', 'username')
  await expect(field(page, 'E-Mail')).toHaveAttribute('type', 'email')
  await expect(field(page, 'Passwort')).toHaveAttribute('autocomplete', 'current-password')
  await expect(field(page, 'Passwort')).toHaveAttribute('type', 'password')
  await field(page, 'E-Mail').fill(email('verwendung'))
  await field(page, 'Passwort').fill(password)
  // Enter goes to the focused field, as for a person typing. A second lookup of the label would find the
  // visible copy that Ionic's iOS input shim makes of a focused field, not the real one.
  await page.keyboard.press('Enter')
  await expect(heading(page, 'Fällig')).toBeVisible()
})

test.describe('as verwaltung', () => {
  test.use({ storageState: authState('verwaltung') })

  test('adds a scanned code with Enter and chooses the kind of use', async ({ page }) => {
    await page.goto('/material/verwendung')
    const code = field(page, 'Code manuell eingeben')
    await code.fill('M-001')
    await expect(code).toHaveAttribute('autocapitalize', 'off')
    await expect(code).toHaveAttribute('autocorrect', 'off')
    await expect(code).toHaveAttribute('spellcheck', 'false')
    await code.press('Enter')
    await expect(page.getByRole('list', { name: 'Gescannte Geräte' }).getByText('Maske 01')).toBeVisible()
    await expect(code).toHaveValue('')

    await page.getByRole('button', { name: 'Fertig' }).click()
    // Typing help as the browser gives it: on for names, off for codes.
    await expect(field(page, 'Erfasst von')).toHaveAttribute('autocapitalize', 'sentences')
    await expect(field(page, 'Erfasst von')).toHaveAttribute('spellcheck', 'true')
    await expect(field(page, 'Notiz')).toHaveAttribute('spellcheck', 'true')
    const kind = select(page, 'Art')
    await expect(kind.locator('.select-text')).toHaveText('Einsatz')
    await kind.click()
    // The popover marks the current value.
    const popover = page.locator('ion-popover')
    await expect(popover.getByRole('radio', { name: 'Einsatz', exact: true })).toBeChecked()
    await popover.getByRole('radio', { name: 'Übung', exact: true }).click()
    await expect(popover).toHaveCount(0)
    await expect(kind).toHaveJSProperty('value', 'exercise')
    await expect(kind.locator('.select-text')).toHaveText('Übung')
  })

  test('switches a check type toggle', async ({ page }) => {
    await page.goto('/material/verwalten')
    await page.getByRole('tab', { name: 'Prüfarten' }).click()
    await page.getByRole('link', { name: 'Neue Prüfart' }).click()
    const toggle = page.getByRole('switch', { name: 'nach Verwendung' }).filter({ visible: true })
    await expect(toggle).not.toBeChecked()
    await toggle.click()
    await expect(toggle).toBeChecked()
  })
})

test.describe('as verwendung', () => {
  test.use({ storageState: authState('verwendung') })

  test('records an exercise and shows it in the history', async ({ page, request }) => {
    const name = `E2E Verwendung ${unique()}`
    const id = await createMask(request, name)
    try {
      await page.goto(`/material/verwendung?geraet=${id}`)
      // Opened from an item page: the form starts with that device, no scan step.
      await expect(page.getByText(name)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Weiteres Gerät hinzufügen' })).toBeVisible()

      await expect(field(page, 'Datum')).toHaveValue(viennaToday())
      await choose(page, 'Art', 'Übung')
      await field(page, 'Erfasst von').fill('E2E Gruppenführer')
      await field(page, 'Notiz').fill('Atemschutzübung Halle')
      await page.getByRole('button', { name: 'Speichern' }).click()
      await expect(heading(page, 'Fällig')).toBeVisible()

      await page.goto(`/material/geraete/${id}`)
      const entry = historyEntry(page, 'Übung')
      // A use puts the mask in the workshop (the server does it), and the history says so.
      await expect(entry).toContainText('Erfasst von E2E Gruppenführer · Standort: AS-Werkstatt · Atemschutzübung Halle')
      await expect(entry).toContainText(viennaToday())
    } finally {
      await removeItemWithHistory(request, id)
    }
  })
})

test.describe('as pruefung', () => {
  test.use({ storageState: authState('pruefung') })

  test('records a check and shows it in the history', async ({ page, request }) => {
    const name = `E2E Prüfung ${unique()}`
    const id = await createMask(request, name)
    try {
      await page.goto(`/material/geraete/${id}/pruefung`)
      await expect(select(page, 'Prüfart').locator('.select-text')).toHaveText('Maskenprüfung')
      await expect(field(page, 'Datum')).toHaveValue(viennaToday())
      await choose(page, 'Prüfart', '5-Jahres-Prüfung')
      await choose(page, 'Ergebnis', 'Mangel')
      await field(page, 'Notiz').fill('Bänderung porös')
      await page.getByRole('button', { name: 'Speichern' }).click()

      await expect(heading(page, name)).toBeVisible()
      const entry = historyEntry(page, '5-Jahres-Prüfung: Mangel')
      await expect(entry).toContainText('Prüfer · Bänderung porös')
      await expect(entry).toContainText(viennaToday())
    } finally {
      await removeItemWithHistory(request, id)
    }
  })
})

test.describe('as verwaltung, creating', () => {
  test.use({ storageState: authState('verwaltung') })

  test('creates an item with a last check date in another category', async ({ page, request }) => {
    const name = `E2E Gerät ${unique()}`
    const serial = `SN-${unique()}`
    try {
      await page.goto('/material/verwalten')
      await choose(page, 'Kategorie', 'Lungenautomaten')
      await page.getByRole('link', { name: 'Neues Gerät' }).click()
      await field(page, 'Bezeichnung').fill(name)
      await field(page, 'Seriennummer').fill(serial)
      await field(page, 'Code').fill(`E2E-${randomBytes(6).toString('hex')}`)
      await field(page, 'Zuletzt geprüft am (Jahresprüfung)').fill('2026-01-15')
      await page.getByRole('button', { name: 'Gerät anlegen' }).click()

      await expect(heading(page, name)).toBeVisible()
      const id = new URL(page.url()).pathname.split('/').pop()
      await expect(page.getByText(`Seriennummer: ${serial}`)).toBeVisible()
      await expect(historyEntry(page, 'Jahresprüfung: bestanden')).toContainText('2026-01-15')

      const saved = await request.get(`/api/collections/items/records/${id}`, {
        headers: { Authorization: tokenOf('verwaltung') },
      })
      expect(saved.ok()).toBe(true)
      expect((await saved.json()).category).toBe(await categoryId(request, 'Lungenautomaten'))
    } finally {
      // Found by name, so a test that failed after saving cleans up too. With a check in its
      // history the item cannot be deleted in the app, only retired.
      const found = await request.get('/api/collections/items/records', {
        headers: { Authorization: tokenOf('verwaltung') },
        params: { filter: `name="${name}"`, fields: 'id' },
      })
      for (const { id } of (await found.json()).items as { id: string }[]) await removeItemWithHistory(request, id)
    }
  })
})
