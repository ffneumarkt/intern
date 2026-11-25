import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { paths } from './routes'
import { currentUser, signInAs, signOutWithLogin, type Level } from './test/fakeAuth'
import { passkeyState } from './test/fakePasskeys'
import { pushDisableMode, pushState } from './test/fakePush'
import { alertButton, findIon, ionButton, ionTab, typeInto } from './test/ionic'

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
  typeInto(await screen.findByLabelText('E-Mail'), 'test@example.com')
  typeInto(screen.getByLabelText('Passwort'), password)
  fireEvent.submit(document.querySelector('form')!)
}

describe('App shell', () => {
  it('shows public tabs only', async () => {
    renderAt(paths.start, null)
    expect(await findTab('Start')).toBeInTheDocument()
    expect(tab('ADR')).toBeInTheDocument()
    expect(tab('Material')).not.toBeInTheDocument()
    expect(tab('Einstellungen')).not.toBeInTheDocument()
  })

  it('shows material tabs when logged in', async () => {
    renderAt(paths.start, 'use')
    expect(await findTab('Material')).toBeInTheDocument()
    expect(tab('Start')).toBeInTheDocument()
    expect(tab('ADR')).toBeInTheDocument()
    expect(tab('Einstellungen')).toBeInTheDocument()
  })

  it('hides the tab bar while a field is being edited, as the keyboard needs the room', async () => {
    renderAt(paths.login, null)
    const email = await screen.findByLabelText('E-Mail')
    expect(screen.getByRole('navigation', { name: 'Hauptmenü' })).toBeVisible()
    fireEvent.focusIn(email)
    expect(document.querySelector('.app-shell')).toHaveAttribute('data-typing', 'true')
    fireEvent.focusOut(email)
    // Not at once: a tap on a button blurs the field before it ends, and the layout must not move under it.
    expect(document.querySelector('.app-shell')).toHaveAttribute('data-typing', 'true')
    await waitFor(() => expect(document.querySelector('.app-shell')).not.toHaveAttribute('data-typing', 'true'))
  })

  it('redirects material to login when logged out', async () => {
    renderAt(paths.dueList, null)
    expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeInTheDocument()
  })

  it('logging out turns push off on this device before ending the session', async () => {
    renderAt(paths.settings, 'use')
    expect(await screen.findByText('Test Benutzer')).toBeInTheDocument()
    let signedInDuringDisable: boolean | null = null
    const original = pushState.calls.push.bind(pushState.calls)
    pushState.calls.push = (...args: string[]) => {
      if (args[0] === 'disablePush') signedInDuringDisable = currentUser() !== null
      return original(...args)
    }
    fireEvent.click(await findIon(() => ionButton('Abmelden')))
    await waitFor(() => expect(tab('Material')).not.toBeInTheDocument())
    expect(signedInDuringDisable).toBe(true)
  })

  it('logs out even when turning push off fails', async () => {
    renderAt(paths.settings, 'use')
    expect(await screen.findByText('Test Benutzer')).toBeInTheDocument()
    pushDisableMode.value = 'reject'
    fireEvent.click(await findIon(() => ionButton('Abmelden')))
    await waitFor(() => expect(tab('Material')).not.toBeInTheDocument())
  })

  it('logs out even when turning push off hangs', async () => {
    renderAt(paths.settings, 'use')
    expect(await screen.findByText('Test Benutzer')).toBeInTheDocument()
    pushDisableMode.value = 'hang'
    fireEvent.click(await findIon(() => ionButton('Abmelden')))
    await waitFor(() => expect(tab('Material')).not.toBeInTheDocument(), { timeout: 6000 })
  }, 10000)

  it('syncs the subscription after login', async () => {
    signOutWithLogin('use')
    render(<App initialPath={paths.login} />)
    expect(pushState.calls).not.toContain('syncPush')
    typeInto(await screen.findByLabelText('E-Mail'), 'a@b.at')
    typeInto(screen.getByLabelText('Passwort'), 'richtig')
    fireEvent.click(await findIon(() => ionButton('Anmelden')))
    await waitFor(() => expect(pushState.calls).toContain('syncPush'))
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

  it('opens the due list again after logging out and back in', async () => {
    signOutWithLogin('use')
    render(<App initialPath={paths.login} />)
    await submitLogin('richtig')
    expect(await screen.findByRole('heading', { name: 'Fällig' })).toBeInTheDocument()

    fireEvent.click(await findTab('Einstellungen'))
    fireEvent.click(await findIon(() => ionButton('Abmelden')))
    expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeInTheDocument()

    await submitLogin('richtig')
    expect(await screen.findByRole('heading', { name: 'Fällig' })).toBeInTheDocument()
    // The login page is gone, not merely behind the due list.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Anmelden' })).not.toBeInTheDocument())
  })

  it('submits through a native button of its own, so Enter works before Ionic has rendered its button', async () => {
    signOutWithLogin('use')
    render(<App initialPath={paths.login} />)
    // Ionic's ion-button adds its hidden submit button only once its lazy component has rendered; a form
    // with two text fields and no submit button does not submit on Enter. The page must not wait for it.
    typeInto(await screen.findByLabelText('E-Mail'), 'test@example.com')
    typeInto(screen.getByLabelText('Passwort'), 'richtig')
    fireEvent.click(screen.getByTestId('enter-submit'))
    expect(await screen.findByRole('heading', { name: 'Fällig' })).toBeInTheDocument()
  })

  it('still submits when Ionic\'s iOS input shim has added an empty copy of a required field', async () => {
    signOutWithLogin('use')
    render(<App initialPath={paths.login} />)
    typeInto(await screen.findByLabelText('E-Mail'), 'test@example.com')
    const password = screen.getByLabelText('Passwort')
    typeInto(password, 'richtig')
    // On iOS the shim copies the focused field (attributes such as `required`, not the typed value) and
    // moves the real one aside. An empty required field makes the browser's validation refuse the
    // submit without a word, so Enter did nothing. The form must not depend on that validation.
    const copy = password.cloneNode(false) as HTMLInputElement
    copy.classList.add('cloned-input')
    copy.tabIndex = -1
    copy.value = ''
    password.closest('form')!.appendChild(copy)
    expect(copy.required).toBe(true)
    expect(copy.value).toBe('')
    fireEvent.click(screen.getByTestId('enter-submit'))
    expect(await screen.findByRole('heading', { name: 'Fällig' })).toBeInTheDocument()
  })

  it('marks E-Mail and Passwort as required, and both when the form is sent empty', async () => {
    renderAt(paths.login, null)
    const email = (await screen.findByLabelText('E-Mail'))
    const password = screen.getByLabelText('Passwort')
    expect(email).toBeRequired()
    expect(password).toBeRequired()
    fireEvent.submit(document.querySelector('form')!)
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))
    expect(email).toHaveAccessibleDescription('Bitte ausfüllen.')
    expect(password).toHaveAttribute('aria-invalid', 'true')
    // No wrong-password message: nothing was sent.
    expect(screen.queryByText('Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.')).toBeNull()
  })

  it('marks only the field that is missing', async () => {
    renderAt(paths.login, null)
    typeInto(await screen.findByLabelText('E-Mail'), 'test@example.com')
    fireEvent.submit(document.querySelector('form')!)
    await waitFor(() => expect(screen.getByLabelText('Passwort')).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByLabelText('E-Mail')).not.toHaveAttribute('aria-invalid')
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
    typeInto(await screen.findByLabelText('Name des Geräts'), name)
    typeInto(screen.getByLabelText('Passwort'), password)
    fireEvent.click(await findIon(() => ionButton('Passkey hinzufügen')))
  }
  const confirmAndAdd = async (name: string) => {
    fireEvent.click(await findIon(() => ionButton('Mit Passkey bestätigen')))
    typeInto(await screen.findByLabelText('Name des Geräts'), name)
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
    renderAt(paths.settings, 'use')
    await screen.findByText('iPhone')
    fireEvent.click(await findIon(() => ionButton('Umbenennen')))
    expect(await screen.findByText('Passkey umbenennen')).toBeInTheDocument()
    const input = await findIon(() => document.querySelector<HTMLInputElement>('[role="alertdialog"] input'))
    expect(input.value).toBe('iPhone')
    fireEvent.change(input, { target: { value: 'Diensthandy' } })
    fireEvent.click(await findIon(() => alertButton('Speichern')))
    expect(await screen.findByText('Diensthandy')).toBeInTheDocument()
  })

  it.each([['cancelled', null], ['empty', '  ']])('keeps the name when the prompt is %s', async (_how, answer) => {
    passkeyState.items = [iPhone]
    renderAt(paths.settings, 'use')
    await screen.findByText('iPhone')
    fireEvent.click(await findIon(() => ionButton('Umbenennen')))
    if (answer === null) fireEvent.click(await findIon(() => alertButton('Abbrechen')))
    else {
      const input = await findIon(() => document.querySelector<HTMLInputElement>('[role="alertdialog"] input'))
      fireEvent.change(input, { target: { value: answer } })
      fireEvent.click(await findIon(() => alertButton('Speichern')))
    }
    await waitFor(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeInTheDocument())
    expect(passkeyState.items[0].name).toBe('iPhone')
  })

  it('removes after confirmation', async () => {
    passkeyState.items = [iPhone]
    renderAt(paths.settings, 'use')
    await screen.findByText('iPhone')
    fireEvent.click(await findIon(() => ionButton('Entfernen')))
    expect(await screen.findByText('Passkey „iPhone“ entfernen?')).toBeInTheDocument()
    fireEvent.click(await findIon(() => alertButton('Entfernen')))
    expect(await screen.findByText('Noch kein Passkey angelegt.')).toBeInTheDocument()
  })

  it('keeps it when dismissed', async () => {
    passkeyState.items = [iPhone]
    renderAt(paths.settings, 'use')
    await screen.findByText('iPhone')
    fireEvent.click(await findIon(() => ionButton('Entfernen')))
    fireEvent.click(await findIon(() => alertButton('Abbrechen')))
    await waitFor(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeInTheDocument())
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
