// What a form says and does when Speichern is pressed with required fields empty.
export const requiredMessage = 'Bitte ausfüllen.'

// The errors are drawn by the next render: then scroll to the first field that has one. Ionic keeps visited
// pages mounted, so fields of a hidden page are skipped. The focus stays where it is: moving it into the
// field starts Ionic's iOS input shim, which swaps in a copy of the field and loses what is typed next.
export function showFirstInvalid(): void {
  setTimeout(() => {
    const field = [...document.querySelectorAll<HTMLElement>('.ion-invalid.ion-touched')].find((el) => !el.closest('.ion-page-hidden'))
    field?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, 0)
}
