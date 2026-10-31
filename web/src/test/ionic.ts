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

export const ionChip = (text: string) => byText('ion-chip', text)

// Items whose text starts with the label (a second line may follow).
export const ionItem = (label: string) =>
  [...document.querySelectorAll('ion-item')].find((el) => el.textContent?.trim().startsWith(label)) ?? null

// Toggles carry their label as aria-label, which Ionic passes to the input in its shadow DOM.
export const ionToggle = (label: string) => document.querySelector<HTMLElement>(`ion-toggle[aria-label="${label}"]`)
