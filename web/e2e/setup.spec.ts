import { randomBytes } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expect, test, tokenOf } from './fixtures.ts'

// A new member gets a one-time link from an admin, sets a password on the public page and logs in.

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true })

test('a member sets a password through the setup link and logs in', async ({ page, request }) => {
  const email = `e2e-${randomBytes(4).toString('hex')}@ffneumarkt.local`
  const created = await request.post('/api/admin/members', {
    headers: { Authorization: tokenOf('verwaltung') },
    data: { name: 'E2E Neu', email },
  })
  expect(created.ok(), 'create member').toBe(true)
  const { id, token } = await created.json()
  try {
    const response = await page.goto(`/einrichtung#${token}`)
    expect(response?.headers()['referrer-policy']).toBe('no-referrer')
    await expect(page.getByText('E2E Neu')).toBeVisible()

    await field(page, 'Passwort').fill('ein-langes-passwort-1')
    await field(page, 'Passwort wiederholen').fill('ein-langes-passwort-1')
    await page.getByRole('button', { name: 'Passwort setzen' }).click()
    await expect(page.getByText('Passwort gesetzt.')).toBeVisible()

    await page.getByRole('link', { name: 'Zur Anmeldung' }).click()
    await field(page, 'E-Mail').fill(email)
    await field(page, 'Passwort').fill('ein-langes-passwort-1')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Fällig', exact: true })).toBeVisible()

    // The link is used up.
    await page.goto(`/einrichtung#${token}`)
    await expect(page.getByText(/Link ist ungültig oder abgelaufen/)).toBeVisible()
  } finally {
    // Members are deactivated, never deleted.
    await request.patch(`/api/admin/members/${id}`, { headers: { Authorization: tokenOf('verwaltung') }, data: { deactivated: true } })
  }
})

test('an unknown link says only that it does not work', async ({ page }) => {
  await page.goto('/einrichtung#kein-gueltiger-token')
  await expect(page.getByText(/Link ist ungültig oder abgelaufen/)).toBeVisible()
  await expect(page.getByLabel('Passwort', { exact: true })).toHaveCount(0)
})
