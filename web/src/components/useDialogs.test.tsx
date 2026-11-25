import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { alertButton, findIon } from '../test/ionic'
import { DialogProvider, useDialogs, type ConfirmOptions } from './useDialogs'

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

const mount = (props: Parameters<typeof Harness>[0] = {}) =>
  render(
    <DialogProvider>
      <Harness {...props} />
    </DialogProvider>,
  )
const open = (name: string) => fireEvent.click(screen.getByText(name))
const dialogs = () => document.querySelectorAll('[role="alertdialog"]')
const press = async (text: string) => fireEvent.click(await findIon(() => alertButton(text)))
const dismiss = async () => fireEvent.keyDown(await findIon(() => document.querySelector('[role="alertdialog"]')), { key: 'Escape' })
const settled = (n: number) => waitFor(() => expect(results).toHaveLength(n))

describe('useDialogs', () => {
  beforeEach(() => {
    results.length = 0
  })

  it('confirms with the confirm button', async () => {
    mount()
    open('confirm')
    expect(await screen.findByText('Wirklich?')).toBeInTheDocument()
    await press('Löschen')
    await settled(1)
    expect(results).toEqual([true])
    await waitFor(() => expect(dialogs()).toHaveLength(0))
  })

  it('does not confirm on Abbrechen', async () => {
    mount()
    open('confirm')
    await press('Abbrechen')
    await settled(1)
    expect(results).toEqual([false])
  })

  it('does not confirm when dismissed with Escape', async () => {
    mount()
    open('confirm')
    await dismiss()
    await settled(1)
    expect(results).toEqual([false])
  })

  it('marks a destructive confirm button', async () => {
    mount({ options: { destructive: true } })
    open('confirm')
    await findIon(() => alertButton('Löschen'))
    expect(alertButton('Löschen')).toHaveAttribute('data-variant', 'destructive')
    expect(alertButton('Abbrechen')).toHaveAttribute('data-variant', 'outline')
  })

  it('shows a header when given', async () => {
    mount({ options: { header: 'Gerät' } })
    open('confirm')
    expect(await screen.findByText('Gerät')).toBeInTheDocument()
  })

  it('names the dialog for screen readers, with or without a header', async () => {
    mount()
    open('confirm')
    expect(await screen.findByRole('alertdialog', { name: /./ })).toBeInTheDocument()
  })

  it('opens no second dialog and acts once while one is open', async () => {
    mount()
    open('confirm')
    await findIon(() => alertButton('Löschen'))
    open('confirm')
    await settled(1)
    expect(results).toEqual([false])
    expect(dialogs()).toHaveLength(1)
    await press('Löschen')
    await settled(2)
    expect(results).toEqual([false, true])
  })

  it('allows a new dialog after the first closed', async () => {
    mount()
    open('confirm')
    await press('Abbrechen')
    await settled(1)
    open('confirm')
    await press('Löschen')
    await settled(2)
    expect(results).toEqual([false, true])
  })

  it('returns the trimmed text of a prompt, pre-filled', async () => {
    mount()
    open('prompt')
    const input = await findIon(() => document.querySelector<HTMLInputElement>('[role="alertdialog"] input'))
    expect(input.value).toBe('Alt')
    expect(input).toHaveAccessibleName('Neuer Name')
    fireEvent.change(input, { target: { value: '  Neu  ' } })
    await press('Speichern')
    await settled(1)
    expect(results).toEqual(['Neu'])
  })

  it('submits a prompt with Enter', async () => {
    mount()
    open('prompt')
    const input = await findIon(() => document.querySelector<HTMLInputElement>('[role="alertdialog"] input'))
    fireEvent.change(input, { target: { value: 'Neu' } })
    fireEvent.submit(input.closest('form')!)
    await settled(1)
    expect(results).toEqual(['Neu'])
  })

  it.each([['cancel'], ['dismiss'], ['empty']])('returns null from a prompt on %s', async (how) => {
    mount()
    open('prompt')
    const input = await findIon(() => document.querySelector<HTMLInputElement>('[role="alertdialog"] input'))
    if (how === 'cancel') await press('Abbrechen')
    else if (how === 'dismiss') await dismiss()
    else {
      fireEvent.change(input, { target: { value: '   ' } })
      await press('Speichern')
    }
    await settled(1)
    expect(results).toEqual([null])
  })
})
