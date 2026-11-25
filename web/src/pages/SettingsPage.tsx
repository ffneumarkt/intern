import { CircleUser, KeyRound, Plus, ShieldCheck } from 'lucide-react'
import { List, Note, Row, RowLabel } from '@/components/ui/list'
import { useState } from 'react'
import { PasskeyCancelledError, PasskeyExistsError, TooManyAttemptsError, tooManyAttemptsMessage, WrongPasswordError } from '../api/errors'
import {
  addPasskey,
  confirmWithPasskey,
  confirmWithPassword,
  listPasskeys,
  passkeysSupported,
  removePasskey,
  renamePasskey,
  type Passkey,
} from '../api/passkeys'
import { Field } from '../components/Field'
import LegalItems from '../components/LegalItems'
import NotificationSettings from '../components/NotificationSettings'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { SettingsFooter, SettingsHeader } from '../components/SettingsGroup'
import { useDialogs } from '../components/useDialogs'
import { paths } from '../routes'
import { useSession } from '../session'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'
import { AppButton, BlockButton } from '../components/ui'

export default function SettingsPage() {
  const { user, logout, areas } = useSession()
  const resource = useResource(listPasskeys)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  // From a confirmation with an existing passkey. Adding is a second tap, because Safari may refuse
  // a second passkey dialog without a new tap.
  const [grant, setGrant] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dialogs = useDialogs()
  const { busy, once } = useBusy()

  const confirm = async () => {
    setError(null)
    try {
      setGrant(await confirmWithPasskey())
    } catch (err) {
      if (err instanceof TooManyAttemptsError) setError(tooManyAttemptsMessage)
      else if (!(err instanceof PasskeyCancelledError)) setError('Bestätigung fehlgeschlagen.')
    }
  }

  const addError = (err: unknown) => {
    if (err instanceof PasskeyCancelledError) return null
    if (err instanceof TooManyAttemptsError) return tooManyAttemptsMessage
    if (err instanceof WrongPasswordError) return 'Passwort ist falsch.'
    if (err instanceof PasskeyExistsError) return 'Dieses Gerät hat bereits einen Passkey.'
    return 'Passkey konnte nicht angelegt werden.'
  }

  const add = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setError(null)
    try {
      await addPasskey(trimmed, grant ?? (await confirmWithPassword(password)))
      setName('')
      setPassword('')
      resource.reload()
    } catch (err) {
      setError(addError(err))
    } finally {
      // Each grant works once, whatever happened to the attempt.
      setGrant(null)
    }
  }

  const change = async (action: () => Promise<void>) => {
    setError(null)
    try {
      await action()
      resource.reload()
    } catch {
      setError('Speichern fehlgeschlagen.')
    }
  }

  const rename = async (key: Passkey) => {
    const answer = await dialogs.prompt({ header: 'Passkey umbenennen', label: 'Neuer Name', value: key.name, confirmText: 'Speichern' })
    if (answer) void change(() => renamePasskey(key.id, answer))
  }

  const remove = async (key: Passkey) => {
    const confirmed = await dialogs.confirm({ message: `Passkey „${key.name}“ entfernen?`, confirmText: 'Entfernen', destructive: true })
    if (confirmed) void change(() => removePasskey(key.id))
  }

  const hasPasskeys = (resource.data?.length ?? 0) > 0
  const loaded = resource.data !== undefined
  const needsConfirmation = passkeysSupported() && hasPasskeys && !grant
  const canAdd = passkeysSupported() && loaded && !needsConfirmation

  return (
    <Page title="Einstellungen" grouped>
      <List inset>
        <Row>
          <CircleUser aria-hidden="true" />
          <RowLabel>
            <h3>{user?.name}</h3>
            <p>{user?.email}</p>
          </RowLabel>
        </Row>
      </List>
      {areas.length > 0 && (
        <List inset>
          <Row to={paths.admin} detail>
            <ShieldCheck aria-hidden="true" />
            <RowLabel>Verwaltung</RowLabel>
          </Row>
        </List>
      )}
      <NotificationSettings />
      <SettingsHeader>Passkeys</SettingsHeader>
      <List inset>
        <Loaded resource={resource}>
          {(keys) =>
            keys.length === 0 ? (
              <Row>
                <RowLabel>Noch kein Passkey angelegt.</RowLabel>
              </Row>
            ) : (
              keys.map((key) => (
                <Row key={key.id}>
                  <KeyRound aria-hidden="true" />
                  <RowLabel>
                    {key.name}
                    <p>angelegt am {key.created}</p>
                    <AppButton fill="clear" size="small" onClick={() => rename(key)}>
                      Umbenennen
                    </AppButton>
                    <AppButton fill="clear" size="small" color="danger" onClick={() => remove(key)}>
                      Entfernen
                    </AppButton>
                  </RowLabel>
                </Row>
              ))
            )
          }
        </Loaded>
        {canAdd && <Field label="Name des Geräts" value={name} onChange={setName} />}
        {canAdd && !hasPasskeys && (
          <Field label="Passwort" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
        )}
      </List>
      <SettingsFooter message={error ? { text: error, role: 'alert' } : null} />
      <div className="px-4">
        {canAdd && (
          <BlockButton fill="outline" disabled={busy || !name.trim()} onClick={() => once(add)}>
            <Plus aria-hidden="true" />
            Passkey hinzufügen
          </BlockButton>
        )}
        {needsConfirmation && (
          <>
            <BlockButton fill="outline" disabled={busy} onClick={() => once(confirm)}>
              <KeyRound aria-hidden="true" />
              Mit Passkey bestätigen
            </BlockButton>
            <Note className="my-4 block text-center">
              Kein Zugriff auf den Passkey? Nach dem Entfernen genügt das Passwort.
            </Note>
          </>
        )}
      </div>
      <SettingsHeader>Rechtliches</SettingsHeader>
      <List inset>
        <LegalItems />
      </List>
      <div className="px-4">
        <BlockButton fill="clear" color="danger" onClick={logout}>
          Abmelden
        </BlockButton>
      </div>
    </Page>
  )
}
