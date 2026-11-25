// Helpers that find the app's controls by their visible text. The file keeps its old name from the Ionic days.
import { fireEvent, waitFor } from '@testing-library/react'

const byText = (selector: string, text: string) =>
  [...document.querySelectorAll(selector)].find((el) => el.textContent?.trim() === text) ?? null

export const ionButton = (text: string) => byText('button[data-slot="button"], a[data-slot="button"]', text)
export const ionTab = (text: string) => byText('[data-slot="tab"]', text)
export const ionSegmentButton = (text: string) => byText('[data-slot="segment-button"]', text)

export const findIon = <T,>(get: () => T | null) =>
  waitFor(() => {
    const el = get()
    if (!el) throw new Error('element not found')
    return el
  })

export const ionChip = (text: string) => byText('[data-slot="chip"]', text)

// Rows whose text starts with the label (a second line may follow).
export const ionItem = (label: string) =>
  [...document.querySelectorAll('[data-slot="row"]')].find((el) => el.textContent?.trim().startsWith(label)) ?? null

// Switches carry their label as aria-label.
export const ionToggle = (label: string) => document.querySelector<HTMLElement>(`[role="switch"][aria-label="${label}"]`)

// A button of the open alert dialog.
export const alertButton = (text: string) => byText('[role="alertdialog"] button', text) as HTMLElement | null

// Types into an input or textarea of components/Field.tsx.
export function typeInto(input: HTMLElement, value: string): void {
  fireEvent.input(input, { target: { value } })
}

// A select is found by its label: the native <select> of components/Field.tsx.
export const ionSelect = (label: string): HTMLElement | null => {
  const wanted = [...document.querySelectorAll<HTMLLabelElement>('label')].find((l) => l.textContent?.trim() === label)
  const native = wanted?.htmlFor ? document.getElementById(wanted.htmlFor) : null
  return native instanceof HTMLSelectElement ? native : null
}

export const selectedText = (select: HTMLElement) => (select as HTMLSelectElement).selectedOptions[0]?.textContent ?? ''

// Picks an option as the user would. Only existing options.
export function choose(select: HTMLElement, value: string): void {
  const native = select as HTMLSelectElement
  if (![...native.options].some((o) => o.value === value)) throw new Error(`no option ${value}`)
  fireEvent.change(native, { target: { value } })
}

// Clicks a switch unless it already shows the wanted state.
export function setToggle(toggle: HTMLElement, on: boolean): void {
  if ((toggle.getAttribute('aria-checked') === 'true') !== on) fireEvent.click(toggle)
}
