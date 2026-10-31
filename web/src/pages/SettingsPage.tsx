import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonText } from '@ionic/react'
import { addOutline, keyOutline } from 'ionicons/icons'
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
import NotificationSettings from '../components/NotificationSettings'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { useSession } from '../session'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'

export default function SettingsPage() {
  const { user, logout } = useSession()
  const resource = useResource(listPasskeys)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  // From a confirmation with an existing passkey. Adding is a second tap, because Safari may refuse
  // a second passkey dialog without a new tap.
  const [grant, setGrant] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  const rename = (key: Passkey) => {
    const answer = window.prompt('Neuer Name', key.name)?.trim()
    if (answer) void change(() => renamePasskey(key.id, answer))
  }

  const remove = (key: Passkey) => {
    if (window.confirm(`Passkey „${key.name}“ entfernen?`)) void change(() => removePasskey(key.id))
  }

  const hasPasskeys = (resource.data?.length ?? 0) > 0
  const loaded = resource.data !== undefined
  const needsConfirmation = passkeysSupported() && hasPasskeys && !grant
  const canAdd = passkeysSupported() && loaded && !needsConfirmation

  return (
    <Page title="Einstellungen">
      <IonList>
        <IonItem>
          <IonLabel>
            <h3>{user?.name}</h3>
            <p>{user?.email}</p>
          </IonLabel>
        </IonItem>
      </IonList>
      <NotificationSettings />
      <IonList>
        <IonListHeader>
          <IonLabel>Passkeys</IonLabel>
        </IonListHeader>
        <Loaded resource={resource}>
          {(keys) =>
            keys.length === 0 ? (
              <IonItem>
                <IonLabel>Noch kein Passkey angelegt.</IonLabel>
              </IonItem>
            ) : (
              keys.map((key) => (
                <IonItem key={key.id}>
                  <IonIcon slot="start" icon={keyOutline} aria-hidden />
                  <IonLabel>
                    {key.name}
                    <p>angelegt am {key.created}</p>
                    <IonButton fill="clear" size="small" onClick={() => rename(key)}>
                      Umbenennen
                    </IonButton>
                    <IonButton fill="clear" size="small" color="danger" onClick={() => remove(key)}>
                      Entfernen
                    </IonButton>
                  </IonLabel>
                </IonItem>
              ))
            )
          }
        </Loaded>
        {canAdd && <Field label="Name des Geräts" value={name} onChange={setName} />}
        {canAdd && !hasPasskeys && (
          <Field label="Passwort" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
        )}
      </IonList>
      {error && <IonText color="danger">{error}</IonText>}
      {canAdd && (
        <IonButton expand="block" fill="outline" disabled={busy || !name.trim()} onClick={() => once(add)}>
          <IonIcon slot="start" icon={addOutline} aria-hidden />
          Passkey hinzufügen
        </IonButton>
      )}
      {needsConfirmation && (
        <>
          <IonButton expand="block" fill="outline" disabled={busy} onClick={() => once(confirm)}>
            <IonIcon slot="start" icon={keyOutline} aria-hidden />
            Mit Passkey bestätigen
          </IonButton>
          <IonNote className="ion-text-center ion-margin-vertical" style={{ display: 'block' }}>
            Kein Zugriff auf den Passkey? Nach dem Entfernen genügt das Passwort.
          </IonNote>
        </>
      )}
      <IonButton expand="block" color="medium" fill="clear" onClick={logout}>
        Abmelden
      </IonButton>
    </Page>
  )
}
