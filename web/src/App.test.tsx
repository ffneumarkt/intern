import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { paths } from './routes'
import { signInAs, signOutWithLogin, type Level } from './test/fakeAuth'
import { passkeyState } from './test/fakePasskeys'
import { findIon, ionButton, ionTab } from './test/ionic'

vi.mock('./api/auth', () => import('./test/fakeAuth'))
vi.mock('./api/notifications', () => import('./test/fakeNotifications'))
vi.mock('./api/passkeys', () => import('./test/fakePasskeys'))
vi.mock('./api/push', () => import('./test/fakePush'))

function renderAt(path: string, level: Level | null) {
  signInAs(level)
  return render(<App initialPath={path} />)
}

const tab = ionTab

const tooManyAttempts = 'Zu viele Versuche. Bitte eine Minute warten.'
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

  it('asks to wait after too many attempts instead of blaming the password', async () => {
    renderAt(paths.login, null)
    await submitLogin('zu-oft')
    expect(await screen.findByText(tooManyAttempts)).toBeInTheDocument()
    expect(screen.queryByText('Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.')).not.toBeInTheDocument()
  })

  it('asks to wait when passkey login is rate limited', async () => {
    passkeyState.tooMany = true
    renderAt(paths.login, null)
    fireEvent.click(await findIon(() => ionButton('Mit Passkey anmelden')))
    expect(await screen.findByText(tooManyAttempts)).toBeInTheDocument()
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

describe('passkeys in settings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const iPhone = { id: 'k1', name: 'iPhone', created: '2026-10-29' }
  const add = async (name: string, password = 'richtig') => {
    fireEvent.change(await screen.findByLabelText('Name des Geräts'), { target: { value: name } })
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: password } })
    fireEvent.click(await findIon(() => ionButton('Passkey hinzufügen')))
  }
  const confirmAndAdd = async (name: string) => {
    fireEvent.click(await findIon(() => ionButton('Mit Passkey bestätigen')))
    fireEvent.change(await screen.findByLabelText('Name des Geräts'), { target: { value: name } })
    fireEvent.click(await findIon(() => ionButton('Passkey hinzufügen')))
  }

  it('lists passkeys with their date', async () => {
    passkeyState.items = [iPhone]
    renderAt(paths.settings, 'use')
    expect(await screen.findByText('iPhone')).toBeInTheDocument()
    expect(screen.getByText('angelegt am 2026-10-29')).toBeInTheDocument()
  })

  it('says when there is none yet', async () => {
    renderAt(paths.settings, 'use')
    expect(await screen.findByText('Noch kein Passkey angelegt.')).toBeInTheDocument()
  })

  it('adds one, clears the field and shows it', async () => {
    renderAt(paths.settings, 'use')
    await add('Laptop')
    expect(await screen.findByText('Laptop')).toBeInTheDocument()
    expect(passkeyState.added).toEqual(['Laptop'])
    fireEvent.click(await findIon(() => ionButton('Mit Passkey bestätigen')))
    expect(await screen.findByLabelText('Name des Geräts')).toHaveValue('')
  })

  it('asks for the password for the first passkey', async () => {
    renderAt(paths.settings, 'use')
    await add('Laptop')
    await screen.findByText('Laptop')
    expect(passkeyState.grants).toEqual(['grant-password'])
  })

  it('asks to wait after too many password attempts', async () => {
    renderAt(paths.settings, 'use')
    await add('Laptop', 'zu-oft')
    expect(await screen.findByText(tooManyAttempts)).toBeInTheDocument()
  })

  it('asks to wait when a confirmation is rate limited', async () => {
    passkeyState.items = [iPhone]
    passkeyState.tooMany = true
    renderAt(paths.settings, 'use')
    fireEvent.click(await findIon(() => ionButton('Mit Passkey bestätigen')))
    expect(await screen.findByText(tooManyAttempts)).toBeInTheDocument()
  })

  it('refuses a wrong password and keeps the form', async () => {
    renderAt(paths.settings, 'use')
    await add('Laptop', 'falsch')
    expect(await screen.findByText('Passwort ist falsch.')).toBeInTheDocument()
    expect(passkeyState.added).toEqual([])
    expect(screen.getByLabelText('Name des Geräts')).toHaveValue('Laptop')
  })

  it('asks for an existing passkey before adding another', async () => {
    passkeyState.items = [iPhone]
    renderAt(paths.settings, 'use')
    await findIon(() => ionButton('Mit Passkey bestätigen'))
    expect(ionButton('Passkey hinzufügen')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Passwort')).not.toBeInTheDocument()
    await confirmAndAdd('Laptop')
    await screen.findByText('Laptop')
    expect(passkeyState.grants).toEqual(['grant-passkey'])
  })

  it('needs a new confirmation after each attempt', async () => {
    passkeyState.items = [iPhone]
    passkeyState.cancelled = true
    renderAt(paths.settings, 'use')
    await confirmAndAdd('Laptop')
    expect(await findIon(() => ionButton('Mit Passkey bestätigen'))).toBeInTheDocument()
    expect(ionButton('Passkey hinzufügen')).not.toBeInTheDocument()
  })

  it('says nothing when the confirmation dialog is closed', async () => {
    passkeyState.items = [iPhone]
    passkeyState.confirmCancelled = true
    renderAt(paths.settings, 'use')
    fireEvent.click(await findIon(() => ionButton('Mit Passkey bestätigen')))
    await findIon(() => ionButton('Mit Passkey bestätigen'))
    expect(screen.queryByText('Bestätigung fehlgeschlagen.')).not.toBeInTheDocument()
  })

  it('reports a failed confirmation', async () => {
    passkeyState.items = [iPhone]
    passkeyState.confirmFails = true
    renderAt(paths.settings, 'use')
    fireEvent.click(await findIon(() => ionButton('Mit Passkey bestätigen')))
    expect(await screen.findByText('Bestätigung fehlgeschlagen.')).toBeInTheDocument()
  })

  it('confirms once on a double tap', async () => {
    passkeyState.items = [iPhone]
    renderAt(paths.settings, 'use')
    fireEvent.click(await findIon(() => ionButton('Mit Passkey bestätigen')))
    fireEvent.click(ionButton('Mit Passkey bestätigen')!)
    await screen.findByLabelText('Name des Geräts')
    expect(passkeyState.confirmations).toBe(1)
  })

  it('explains the way out when the existing passkey is out of reach', async () => {
    passkeyState.items = [iPhone]
    renderAt(paths.settings, 'use')
    expect(await screen.findByText('Kein Zugriff auf den Passkey? Nach dem Entfernen genügt das Passwort.')).toBeInTheDocument()
  })

  it('adds once on a double tap', async () => {
    renderAt(paths.settings, 'use')
    await add('Laptop')
    fireEvent.click(ionButton('Passkey hinzufügen')!)
    await screen.findByText('Laptop')
    expect(passkeyState.added).toEqual(['Laptop'])
  })

  it('needs a name', async () => {
    renderAt(paths.settings, 'use')
    await add('   ')
    await screen.findByText('Noch kein Passkey angelegt.')
    expect(passkeyState.added).toEqual([])
  })

  it('says nothing when the dialog is closed', async () => {
    passkeyState.cancelled = true
    renderAt(paths.settings, 'use')
    await add('Laptop')
    await waitFor(() => expect(screen.getByLabelText('Name des Geräts')).toHaveValue('Laptop'))
    expect(screen.queryByText('Passkey konnte nicht angelegt werden.')).not.toBeInTheDocument()
  })

  it('recognises a device that already has one', async () => {
    passkeyState.items = [iPhone]
    passkeyState.exists = true
    renderAt(paths.settings, 'use')
    await confirmAndAdd('Laptop')
    expect(await screen.findByText('Dieses Gerät hat bereits einen Passkey.')).toBeInTheDocument()
  })

  it('reports a failed registration', async () => {
    renderAt(paths.settings, 'use')
    await screen.findByText('Noch kein Passkey angelegt.')
    passkeyState.failing = true
    await add('Laptop')
    expect(await screen.findByText('Passkey konnte nicht angelegt werden.')).toBeInTheDocument()
  })

  it('renames through a prompt', async () => {
    passkeyState.items = [iPhone]
    vi.spyOn(window, 'prompt').mockReturnValue('Diensthandy')
    renderAt(paths.settings, 'use')
    await screen.findByText('iPhone')
    fireEvent.click(await findIon(() => ionButton('Umbenennen')))
    expect(await screen.findByText('Diensthandy')).toBeInTheDocument()
    expect(window.prompt).toHaveBeenCalledWith('Neuer Name', 'iPhone')
  })

  it.each([[null], ['  ']])('keeps the name when the prompt returns %j', async (answer) => {
    passkeyState.items = [iPhone]
    vi.spyOn(window, 'prompt').mockReturnValue(answer)
    renderAt(paths.settings, 'use')
    await screen.findByText('iPhone')
    fireEvent.click(await findIon(() => ionButton('Umbenennen')))
    await waitFor(() => expect(window.prompt).toHaveBeenCalled())
    expect(passkeyState.items[0].name).toBe('iPhone')
  })

  it('removes after confirmation', async () => {
    passkeyState.items = [iPhone]
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt(paths.settings, 'use')
    await screen.findByText('iPhone')
    fireEvent.click(await findIon(() => ionButton('Entfernen')))
    expect(await screen.findByText('Noch kein Passkey angelegt.')).toBeInTheDocument()
    expect(window.confirm).toHaveBeenCalledWith('Passkey „iPhone“ entfernen?')
  })

  it('keeps it when dismissed', async () => {
    passkeyState.items = [iPhone]
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt(paths.settings, 'use')
    await screen.findByText('iPhone')
    fireEvent.click(await findIon(() => ionButton('Entfernen')))
    await waitFor(() => expect(window.confirm).toHaveBeenCalled())
    expect(passkeyState.items).toHaveLength(1)
  })

  it('hides adding in a browser without passkeys, keeps the list', async () => {
    passkeyState.supported = false
    passkeyState.items = [iPhone]
    renderAt(paths.settings, 'use')
    expect(await screen.findByText('iPhone')).toBeInTheDocument()
    expect(ionButton('Passkey hinzufügen')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Name des Geräts')).not.toBeInTheDocument()
    expect(ionButton('Mit Passkey bestätigen')).not.toBeInTheDocument()
  })

  it('still offers logout while offline', async () => {
    passkeyState.failing = true
    renderAt(paths.settings, 'use')
    expect(await screen.findByText(/^Keine Verbindung\./)).toBeInTheDocument()
    expect(await findIon(() => ionButton('Abmelden'))).toBeInTheDocument()
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
