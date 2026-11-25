// What a form says and does when Speichern is pressed with required fields empty.
export const requiredMessage = 'Bitte ausfüllen.'

// The errors are drawn by the next render: then scroll to the first field that has one. Ionic keeps visited
// pages mounted, so fields of a hidden page are skipped. The focus stays where it is: moving it into the
// field would pop up the keyboard before the user has read the message.
export function showFirstInvalid(): void {
  setTimeout(() => {
    const field = [...document.querySelectorAll<HTMLElement>('[aria-invalid="true"]')].find((el) => !el.closest('.ion-page-hidden'))
    field?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, 0)
}
