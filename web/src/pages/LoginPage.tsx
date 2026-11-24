import { IonIcon, IonList } from '@ionic/react'
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
import { BlockButton, ErrorText, Hint } from '../components/ui'

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
      <img className="login-logo" src="/icons/intern-192.png" alt="" width="72" height="72" />
      {passkeysSupported() && (
        <>
          <BlockButton className="ui-button" disabled={busy} onClick={() => once(signInWithPasskey)}>
            <IonIcon slot="start" icon={keyOutline} aria-hidden />
            Mit Passkey anmelden
          </BlockButton>
          {passkeyFailed && <ErrorText>Anmeldung mit Passkey fehlgeschlagen.</ErrorText>}
          <Hint center>
            oder mit E-Mail und Passwort
          </Hint>
        </>
      )}
      {/* noValidate: on iOS, Ionic's input shim adds an empty copy of the focused field to the form, with its
          `required`. The browser's validation then refuses the submit without a word, so Enter does nothing.
          The server rejects an empty or wrong login anyway. */}
      <form noValidate onSubmit={submit}>
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
        {failed && <ErrorText>Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.</ErrorText>}
        {tooMany && <ErrorText>{tooManyAttemptsMessage}</ErrorText>}
        {/* Enter submits through the form's default button. Ionic's button adds its own hidden one only after
            its lazy component has rendered; until then a form with two text fields would ignore Enter. */}
        <button type="submit" hidden data-testid="enter-submit" tabIndex={-1} aria-hidden="true" />
        <BlockButton className="ui-button" fill={passkeysSupported() ? 'outline' : 'solid'} type="submit">
          Anmelden
        </BlockButton>
      </form>
    </Page>
  )
}
