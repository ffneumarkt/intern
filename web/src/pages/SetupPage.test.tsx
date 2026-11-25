import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { paths } from '../routes'
import { findIon, ionButton, typeInto } from '../test/ionic'
import { setupState } from '../test/fakeSetup'
import { signInAs } from '../test/fakeAuth'

vi.mock('../api/auth', () => import('../test/fakeAuth'))
vi.mock('../api/material', () => import('../test/fakeMaterial'))
vi.mock('../api/notifications', () => import('../test/fakeNotifications'))
vi.mock('../api/passkeys', () => import('../test/fakePasskeys'))
vi.mock('../api/push', () => import('../test/fakePush'))
vi.mock('../api/setup', () => import('../test/fakeSetup'))

const open = (token: string) => {
  signInAs(null)
  render(<App initialPath={`${paths.setup}#${token}`} />)
}
const set = (label: string, value: string) => typeInto(screen.getByLabelText(label), value)
const field = (label: string) => screen.getByLabelText(label)

describe('setup page', () => {
  it('greets the member by name and asks for a password twice', async () => {
    open('gueltig')
    expect(await screen.findByText(/Neu Mitglied/)).toBeInTheDocument()
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument()
    expect(screen.getByLabelText('Passwort wiederholen')).toBeInTheDocument()
    expect(setupState.checked).toEqual(['gueltig'])
  })

  it('refuses a short password and keeps the link', async () => {
    open('gueltig')
    await screen.findByLabelText('Passwort')
    set('Passwort', 'kurz')
    set('Passwort wiederholen', 'kurz')
    fireEvent.click(await findIon(() => ionButton('Passwort setzen')))
    expect(await screen.findByText('Mindestens 10 Zeichen.')).toBeInTheDocument()
    expect(setupState.completed).toEqual([])
  })

  it('refuses two different passwords', async () => {
    open('gueltig')
    await screen.findByLabelText('Passwort')
    set('Passwort', 'ein-langes-passwort')
    set('Passwort wiederholen', 'ein-anderes-passwort')
    fireEvent.click(await findIon(() => ionButton('Passwort setzen')))
    expect(await screen.findByText('Die Passwörter stimmen nicht überein.')).toBeInTheDocument()
    expect(setupState.completed).toEqual([])
  })

  it('marks both empty fields once the button is pressed', async () => {
    open('gueltig')
    await screen.findByLabelText('Passwort')
    fireEvent.click(await findIon(() => ionButton('Passwort setzen')))
    await waitFor(() => expect(field('Passwort')).toHaveAttribute('aria-invalid', 'true'))
    expect(field('Passwort')).toBeRequired()
    expect(setupState.completed).toEqual([])
  })

  it('sets the password and leads to the login', async () => {
    open('gueltig')
    await screen.findByLabelText('Passwort')
    set('Passwort', 'ein-langes-passwort')
    set('Passwort wiederholen', 'ein-langes-passwort')
    fireEvent.click(await findIon(() => ionButton('Passwort setzen')))
    expect(await screen.findByText('Passwort gesetzt.')).toBeInTheDocument()
    expect(setupState.completed).toEqual([{ token: 'gueltig', password: 'ein-langes-passwort' }])
    expect(await findIon(() => ionButton('Zur Anmeldung'))).toBeInTheDocument()
  })

  it('says only that the link does not work, for any link that does not', async () => {
    open('unbekannt')
    expect(await screen.findByText(/Link ist ungültig oder abgelaufen/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Passwort')).not.toBeInTheDocument()
  })

  it('treats an address without a token as a link that does not work', async () => {
    open('')
    expect(await screen.findByText(/Link ist ungültig oder abgelaufen/)).toBeInTheDocument()
  })

  it('shows a link that stopped working while the form was open', async () => {
    open('gueltig')
    await screen.findByLabelText('Passwort')
    delete setupState.links.gueltig
    set('Passwort', 'ein-langes-passwort')
    set('Passwort wiederholen', 'ein-langes-passwort')
    fireEvent.click(await findIon(() => ionButton('Passwort setzen')))
    expect(await screen.findByText(/Link ist ungültig oder abgelaufen/)).toBeInTheDocument()
  })

  it('says when there were too many attempts, and when saving failed', async () => {
    open('gueltig')
    await screen.findByLabelText('Passwort')
    set('Passwort', 'ein-langes-passwort')
    set('Passwort wiederholen', 'ein-langes-passwort')
    setupState.tooMany = true
    fireEvent.click(await findIon(() => ionButton('Passwort setzen')))
    expect(await screen.findByText('Zu viele Versuche. Bitte eine Minute warten.')).toBeInTheDocument()
    setupState.tooMany = false
    setupState.failing = true
    fireEvent.click(ionButton('Passwort setzen')!)
    expect(await screen.findByText('Speichern fehlgeschlagen.')).toBeInTheDocument()
  })

  it('is reachable without a login', async () => {
    open('gueltig')
    expect(await screen.findByText(/Neu Mitglied/)).toBeInTheDocument()
    expect(screen.queryByLabelText('E-Mail')).not.toBeInTheDocument()
  })
})
