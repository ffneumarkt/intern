// Ionic web components keep roles and focus inside the shadow DOM, which jsdom does not model.
// These helpers find them by their visible text instead.
import { waitFor } from '@testing-library/react'

const byText = (selector: string, text: string) =>
  [...document.querySelectorAll(selector)].find((el) => el.textContent?.trim() === text) ?? null

export const ionButton = (text: string) => byText('ion-button', text)
export const ionTab = (text: string) => byText('ion-tab-button', text)

export const findIon = <T,>(get: () => T | null) =>
  waitFor(() => {
    const el = get()
    if (!el) throw new Error('element not found')
    return el
  })
