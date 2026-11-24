// What a form says and does when Speichern is pressed with required fields empty.
export const requiredMessage = 'Bitte ausfüllen.'

// The errors are drawn by the next render: then scroll to the first field that has one and put the
// cursor in it. Ionic keeps visited pages mounted, so fields of a hidden page are skipped.
export function focusFirstInvalid(): void {
  setTimeout(() => {
    const field = [...document.querySelectorAll<HTMLElement>('.ion-invalid.ion-touched')].find((el) => !el.closest('.ion-page-hidden'))
    if (!field) return
    field.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    field.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true })
  }, 0)
}
