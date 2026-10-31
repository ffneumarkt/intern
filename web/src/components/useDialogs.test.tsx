import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { alertButton, findIon } from '../test/ionic'
import { useDialogs, type ConfirmOptions } from './useDialogs'

const results: unknown[] = []

function Harness({ options, value = 'Alt' }: { options?: Partial<ConfirmOptions>; value?: string }) {
  const { confirm, prompt } = useDialogs()
  return (
    <>
      <button onClick={() => void confirm({ message: 'Wirklich?', confirmText: 'Löschen', ...options }).then((r) => results.push(r))}>
        confirm
      </button>
      <button onClick={() => void prompt({ header: 'Umbenennen', label: 'Neuer Name', value, confirmText: 'Speichern' }).then((r) => results.push(r))}>
        prompt
      </button>
    </>
  )
}

const open = (name: string) => fireEvent.click(screen.getByText(name))
const alerts = () => document.querySelectorAll('ion-alert')
const press = async (text: string) => fireEvent.click(await findIon(() => alertButton(text)))
// An alert still being presented ignores dismiss; Ionic marks it overlay-hidden until then.
const presented = () => findIon(() => document.querySelector<HTMLIonAlertElement>('ion-alert:not(.overlay-hidden)'))
const dismiss = async () => {
  await (await presented()).dismiss(undefined, 'backdrop')
}
const settled = (n: number) => waitFor(() => expect(results).toHaveLength(n))

describe('useDialogs', () => {
  beforeEach(() => {
    results.length = 0
  })

  // Ionic removes a closed alert after its leave animation; the next test starts when none is left.
  afterEach(async () => {
    if (alerts().length) await dismiss()
    await waitFor(() => expect(alerts()).toHaveLength(0))
  })

  it('confirms with the confirm button', async () => {
    render(<Harness />)
    open('confirm')
    expect(await screen.findByText('Wirklich?')).toBeInTheDocument()
    await press('Löschen')
    await settled(1)
    expect(results).toEqual([true])
  })

  it('does not confirm on Abbrechen', async () => {
    render(<Harness />)
    open('confirm')
    await press('Abbrechen')
    await settled(1)
    expect(results).toEqual([false])
  })

  it('does not confirm when dismissed', async () => {
    render(<Harness />)
    open('confirm')
    await dismiss()
    await settled(1)
    expect(results).toEqual([false])
  })

  it('marks a destructive confirm button', async () => {
    render(<Harness options={{ destructive: true }} />)
    open('confirm')
    await findIon(() => alertButton('Löschen'))
    expect(alertButton('Löschen')).toHaveClass('alert-button-role-destructive')
    expect(alertButton('Abbrechen')).toHaveClass('alert-button-role-cancel')
  })

  it('shows a header when given', async () => {
    render(<Harness options={{ header: 'Gerät' }} />)
    open('confirm')
    expect(await screen.findByText('Gerät')).toBeInTheDocument()
  })

  it('opens no second alert and acts once while one is open', async () => {
    render(<Harness />)
    open('confirm')
    await findIon(() => alertButton('Löschen'))
    open('confirm')
    await settled(1)
    expect(results).toEqual([false])
    expect(alerts()).toHaveLength(1)
    await press('Löschen')
    await settled(2)
    expect(results).toEqual([false, true])
  })

  it('allows a new dialog after the first closed', async () => {
    render(<Harness />)
    open('confirm')
    await press('Abbrechen')
    await settled(1)
    open('confirm')
    await press('Löschen')
    await settled(2)
    expect(results).toEqual([false, true])
  })

  it('returns the trimmed text of a prompt, pre-filled', async () => {
    render(<Harness />)
    open('prompt')
    const input = await findIon(() => document.querySelector<HTMLInputElement>('ion-alert input'))
    expect(input.value).toBe('Alt')
    fireEvent.input(input, { target: { value: '  Neu  ' } })
    await press('Speichern')
    await settled(1)
    expect(results).toEqual(['Neu'])
  })

  it.each([['cancel'], ['dismiss'], ['empty']])('returns null from a prompt on %s', async (how) => {
    render(<Harness />)
    open('prompt')
    const input = await findIon(() => document.querySelector<HTMLInputElement>('ion-alert input'))
    if (how === 'cancel') await press('Abbrechen')
    else if (how === 'dismiss') await dismiss()
    else {
      fireEvent.input(input, { target: { value: '   ' } })
      await press('Speichern')
    }
    await settled(1)
    expect(results).toEqual([null])
  })
})
