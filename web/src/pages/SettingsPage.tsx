import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonText } from '@ionic/react'
import { addOutline, keyOutline } from 'ionicons/icons'
import { useState } from 'react'
import { PasskeyCancelledError, PasskeyExistsError } from '../api/errors'
import { addPasskey, listPasskeys, passkeysSupported, removePasskey, renamePasskey, type Passkey } from '../api/passkeys'
import { Field } from '../components/Field'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { useSession } from '../session'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'

export default function SettingsPage() {
  const { user, logout } = useSession()
  const resource = useResource(listPasskeys)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { busy, once } = useBusy()

  const add = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setError(null)
    try {
      await addPasskey(trimmed)
      setName('')
      resource.reload()
    } catch (err) {
      if (err instanceof PasskeyCancelledError) return
      setError(err instanceof PasskeyExistsError ? 'Dieses Gerät hat bereits einen Passkey.' : 'Passkey konnte nicht angelegt werden.')
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
                  </IonLabel>
                  <IonButton slot="end" fill="clear" size="small" onClick={() => rename(key)}>
                    Umbenennen
                  </IonButton>
                  <IonButton slot="end" fill="clear" size="small" color="danger" onClick={() => remove(key)}>
                    Entfernen
                  </IonButton>
                </IonItem>
              ))
            )
          }
        </Loaded>
        {passkeysSupported() && <Field label="Name des Geräts" value={name} onChange={setName} />}
      </IonList>
      {error && <IonText color="danger">{error}</IonText>}
      {passkeysSupported() && (
        <IonButton expand="block" fill="outline" disabled={busy || !name.trim()} onClick={() => once(add)}>
          <IonIcon slot="start" icon={addOutline} aria-hidden />
          Passkey hinzufügen
        </IonButton>
      )}
      <IonButton expand="block" color="medium" fill="clear" onClick={logout}>
        Abmelden
      </IonButton>
    </Page>
  )
}
