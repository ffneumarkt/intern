/// <reference lib="dom" />
import { authState, expect, test } from './fixtures.ts'

// The legal pages are public and part of the offline shell; anonymous visitors reach them through the
// Info tab, members through Einstellungen.

const heading = (page: import('@playwright/test').Page, name: string) => page.getByRole('heading', { name, level: 1 })

test.describe('anonymous', () => {
  test('reaches Impressum and Datenschutzerklärung through the Info tab', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Hauptmenü' }).getByRole('link', { name: 'Info' }).click()
    await expect(heading(page, 'Info')).toBeVisible()
    await page.getByText('Impressum', { exact: true }).click()
    await expect(heading(page, 'Impressum')).toBeVisible()
    await expect(page.getByRole('link', { name: '02121@fr.ooelfv.at' })).toBeVisible()
    await page.goBack()
    await page.getByText('Datenschutz', { exact: true }).click()
    await expect(heading(page, 'Datenschutzerklärung')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Push-Nachrichten', level: 2 })).toBeVisible()
  })

  test('opens a legal page directly and has no Material tab', async ({ page }) => {
    await page.goto('/info/datenschutz')
    await expect(heading(page, 'Datenschutzerklärung')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Hauptmenü' }).getByRole('link', { name: 'Material' })).toHaveCount(0)
  })

  test('works offline after the first visit', async ({ page, context }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
    await context.setOffline(true)
    await page.goto('/info/impressum')
    await expect(heading(page, 'Impressum')).toBeVisible()
  })
})

test.describe('signed in', () => {
  test.use({ storageState: authState('verwendung') })

  test('reaches the legal pages from Einstellungen, and the Info tab is gone', async ({ page }) => {
    await page.goto('/einstellungen')
    await expect(page.getByRole('navigation', { name: 'Hauptmenü' }).getByRole('link', { name: 'Info' })).toHaveCount(0)
    await expect(page.getByText('Rechtliches', { exact: true })).toBeVisible()
    await page.getByText('Impressum', { exact: true }).click()
    await expect(heading(page, 'Impressum')).toBeVisible()
    await page.goBack()
    await expect(page.getByText('Rechtliches', { exact: true })).toBeVisible()
  })
})
