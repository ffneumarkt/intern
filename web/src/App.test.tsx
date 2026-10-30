import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { paths } from './routes'
import { signInAs, signOutWithLogin, type Level } from './test/fakeAuth'
import { passkeyState } from './test/fakePasskeys'
import { findIon, ionButton, ionTab } from './test/ionic'

vi.mock('./api/auth', () => import('./test/fakeAuth'))
vi.mock('./api/passkeys', () => import('./test/fakePasskeys'))

function renderAt(path: string, level: Level | null) {
  signInAs(level)
  return render(<App initialPath={path} />)
}

const tab = ionTab
const findTab = (name: string) => findIon(() => ionTab(name))

async function submitLogin(password: string) {
  fireEvent.change(await screen.findByLabelText('E-Mail'), { target: { value: 'test@example.com' } })
  fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: password } })
  fireEvent.submit(document.querySelector('form')!)
}

describe('App shell', () => {
  it('shows public tabs only', async () => {
    renderAt(paths.start, null)
    expect(await findTab('Start')).toBeInTheDocument()
    expect(tab('Beförderungspapier')).toBeInTheDocument()
    expect(tab('Material')).not.toBeInTheDocument()
    expect(tab('Einstellungen')).not.toBeInTheDocument()
  })

  it('shows material tabs when logged in', async () => {
    renderAt(paths.start, 'use')
    expect(await findTab('Material')).toBeInTheDocument()
    expect(tab('Start')).toBeInTheDocument()
    expect(tab('Beförderungspapier')).toBeInTheDocument()
    expect(tab('Einstellungen')).toBeInTheDocument()
  })

  it('redirects material to login when logged out', async () => {
    renderAt(paths.dueList, null)
    expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeInTheDocument()
  })
})

describe('login', () => {
  it('opens the due list after logging in', async () => {
    signOutWithLogin('use')
    render(<App initialPath={paths.login} />)
    await submitLogin('richtig')
    expect(await screen.findByRole('heading', { name: 'Fällig' })).toBeInTheDocument()
    expect(await findTab('Material')).toBeInTheDocument()
  })

  it('shows an error for wrong credentials', async () => {
    renderAt(paths.login, null)
    await submitLogin('falsch')
    expect(await screen.findByText('Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.')).toBeInTheDocument()
    expect(tab('Material')).not.toBeInTheDocument()
  })

  it('logs in with a passkey', async () => {
    signOutWithLogin('use')
    render(<App initialPath={paths.login} />)
    fireEvent.click(await findIon(() => ionButton('Mit Passkey anmelden')))
    expect(await screen.findByRole('heading', { name: 'Fällig' })).toBeInTheDocument()
    expect(await findTab('Material')).toBeInTheDocument()
  })

  it('offers the passkey before the password', async () => {
    renderAt(paths.login, null)
    const passkey = await findIon(() => ionButton('Mit Passkey anmelden'))
    const position = passkey.compareDocumentPosition(screen.getByLabelText('E-Mail'))
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('oder mit E-Mail und Passwort')).toBeInTheDocument()
  })

  it('says nothing when the dialog is closed', async () => {
    passkeyState.cancelled = true
    renderAt(paths.login, null)
    fireEvent.click(await findIon(() => ionButton('Mit Passkey anmelden')))
    await waitFor(() => expect(ionButton('Mit Passkey anmelden')).not.toHaveAttribute('disabled'))
    expect(screen.queryByText('Anmeldung mit Passkey fehlgeschlagen.')).not.toBeInTheDocument()
  })

  it('reports a failed passkey login', async () => {
    passkeyState.loginFails = true
    renderAt(paths.login, null)
    fireEvent.click(await findIon(() => ionButton('Mit Passkey anmelden')))
    expect(await screen.findByText('Anmeldung mit Passkey fehlgeschlagen.')).toBeInTheDocument()
  })

  it('offers only the password in a browser without passkeys', async () => {
    passkeyState.supported = false
    renderAt(paths.login, null)
    await screen.findByLabelText('E-Mail')
    expect(ionButton('Mit Passkey anmelden')).not.toBeInTheDocument()
    expect(screen.queryByText('oder mit E-Mail und Passwort')).not.toBeInTheDocument()
  })
})

describe('settings', () => {
  it('shows the account and logs out', async () => {
    renderAt(paths.settings, 'use')
    expect(await screen.findByText('Test Benutzer')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    fireEvent.click(await findIon(() => ionButton('Abmelden')))
    await waitFor(() => expect(tab('Material')).not.toBeInTheDocument())
    expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeInTheDocument()
  })
})
