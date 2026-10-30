import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { paths } from './routes'
import { signInAs, signOutWithLogin, type Level } from './test/fakeAuth'
import { findIon, ionButton, ionTab } from './test/ionic'

vi.mock('./api/auth', () => import('./test/fakeAuth'))

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

  it('has no passkey button yet', async () => {
    renderAt(paths.login, null)
    await screen.findByLabelText('E-Mail')
    expect(screen.queryByText('Mit Passkey anmelden')).not.toBeInTheDocument()
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
