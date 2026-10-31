import { IonButton, IonIcon, IonList, IonNote, IonText } from '@ionic/react'
import { keyOutline } from 'ionicons/icons'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PasskeyCancelledError, TooManyAttemptsError, tooManyAttemptsMessage } from '../api/errors'
import { passkeysSupported } from '../api/passkeys'
import { Field } from '../components/Field'
import Page from '../components/Page'
import { paths } from '../routes'
import { useSession } from '../session'
import { useBusy } from '../useBusy'

export default function LoginPage() {
  const { login, loginWithPasskey } = useSession()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [failed, setFailed] = useState(false)
  const [passkeyFailed, setPasskeyFailed] = useState(false)
  const [tooMany, setTooMany] = useState(false)
  const { busy, once } = useBusy()

  const signInWithPasskey = async () => {
    setFailed(false)
    setPasskeyFailed(false)
    setTooMany(false)
    try {
      await loginWithPasskey()
      navigate(paths.dueList, { replace: true })
    } catch (err) {
      if (err instanceof TooManyAttemptsError) setTooMany(true)
      else if (!(err instanceof PasskeyCancelledError)) setPasskeyFailed(true)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFailed(false)
    setPasskeyFailed(false)
    setTooMany(false)
    try {
      await login(email, password)
      navigate(paths.dueList, { replace: true })
    } catch (err) {
      if (err instanceof TooManyAttemptsError) setTooMany(true)
      else setFailed(true)
    }
  }

  return (
    <Page title="Anmelden">
      {passkeysSupported() && (
        <>
          <IonButton expand="block" size="large" disabled={busy} onClick={() => once(signInWithPasskey)}>
            <IonIcon slot="start" icon={keyOutline} aria-hidden />
            Mit Passkey anmelden
          </IonButton>
          {passkeyFailed && <IonText color="danger">Anmeldung mit Passkey fehlgeschlagen.</IonText>}
          <IonNote className="ion-text-center ion-margin-vertical" style={{ display: 'block' }}>
            oder mit E-Mail und Passwort
          </IonNote>
        </>
      )}
      <form onSubmit={submit}>
        <IonList>
          <Field label="E-Mail" type="email" autoComplete="username" value={email} onChange={setEmail} required />
          <Field
            label="Passwort"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            required
          />
        </IonList>
        {failed && <IonText color="danger">Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.</IonText>}
        {tooMany && <IonText color="danger">{tooManyAttemptsMessage}</IonText>}
        <IonButton expand="block" fill="outline" type="submit">
          Anmelden
        </IonButton>
      </form>
    </Page>
  )
}
