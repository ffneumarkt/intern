// Ionic web components keep roles and focus inside the shadow DOM, which jsdom does not model.
// These helpers find them by their visible text instead.
import { fireEvent, waitFor } from '@testing-library/react'

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

// A button of the open ion-alert; its buttons are real <button>s in the alert's light DOM. Ionic
// marks an alert overlay-hidden until it is presented, and a click before that is ignored, so
// the buttons of an alert still being presented are not offered.
export const alertButton = (text: string) =>
  byText('ion-alert:not(.overlay-hidden) button', text) as HTMLElement | null

// Form controls of components/Field.tsx. IonInput and IonTextarea render a native input in the
// light DOM, which getByLabelText finds; Ionic listens for its native input event (not change).
export function typeInto(input: HTMLElement, value: string): void {
  fireEvent.input(input, { target: { value } })
}

// An ion-select keeps its label and the chosen option's text in its shadow DOM.
export const ionSelect = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('ion-select')].find(
    (el) => el.shadowRoot?.querySelector('.label-text')?.textContent?.trim() === label,
  ) ?? null

export const selectedText = (select: HTMLElement) => select.shadowRoot?.querySelector('.select-text')?.textContent ?? ''

// Picks an option as the overlay would: ionChange with its value. Only existing options.
export function choose(select: HTMLElement, value: string): void {
  const options = [...select.querySelectorAll<HTMLIonSelectOptionElement>('ion-select-option')]
  if (!options.some((o) => o.value === value)) throw new Error(`no option ${value}`)
  fireEvent(select, new CustomEvent('ionChange', { detail: { value } }))
}

// Clicks an ion-toggle unless it already shows the wanted state.
export function setToggle(toggle: HTMLElement, on: boolean): void {
  if ((toggle as HTMLInputElement).checked !== on) fireEvent.click(toggle)
}
