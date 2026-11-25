import { IonList } from '@ionic/react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { SetupLinkInvalidError, TooManyAttemptsError, tooManyAttemptsMessage } from '../api/errors'
import { checkSetupLink, completeSetup } from '../api/setup'
import { Field } from '../components/Field'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { requiredMessage, showFirstInvalid } from '../components/required'
import { BlockButton, ErrorText, Hint } from '../components/ui'
import { paths } from '../routes'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'

const minLength = 10
const invalidLink = 'Der Link ist ungültig oder abgelaufen. Bitte einen neuen Link anfordern.'

// The member sets a first password through the link an admin passed on. The token is in the fragment of the address.
export default function SetupPage() {
  const token = useLocation().hash.slice(1)
  const resource = useResource(async () => {
    if (!token) return { name: null }
    try {
      return { name: await checkSetupLink(token) }
    } catch (err) {
      if (err instanceof SetupLinkInvalidError) return { name: null }
      throw err
    }
  })
  return (
    <Page title="Passwort festlegen">
      <Loaded resource={resource}>
        {({ name }) => (name === null ? <ErrorText>{invalidLink}</ErrorText> : <SetupForm token={token} name={name} />)}
      </Loaded>
    </Page>
  )
}

function SetupForm({ token, name }: { token: string; name: string }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const { busy, once } = useBusy()

  const tooShort = password.length < minLength
  const differs = password !== repeat

  const save = async () => {
    if (!password || !repeat || tooShort || differs) {
      setTried(true)
      showFirstInvalid()
      return
    }
    setError(null)
    try {
      await completeSetup(token, password)
      setDone(true)
    } catch (err) {
      if (err instanceof SetupLinkInvalidError) setInvalid(true)
      else setError(err instanceof TooManyAttemptsError ? tooManyAttemptsMessage : 'Speichern fehlgeschlagen.')
    }
  }

  if (invalid) return <ErrorText>{invalidLink}</ErrorText>
  if (done) {
    return (
      <>
        <Hint>Passwort gesetzt.</Hint>
        <BlockButton routerLink={paths.login}>Zur Anmeldung</BlockButton>
      </>
    )
  }
  return (
    <>
      <Hint>
        Willkommen, <strong>{name}</strong>. Lege ein Passwort mit mindestens {minLength} Zeichen fest.
      </Hint>
      <IonList>
        <Field
          label="Passwort"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          required
          error={tried ? (!password ? requiredMessage : tooShort ? `Mindestens ${minLength} Zeichen.` : undefined) : undefined}
        />
        <Field
          label="Passwort wiederholen"
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={setRepeat}
          required
          error={tried ? (!repeat ? requiredMessage : differs ? 'Die Passwörter stimmen nicht überein.' : undefined) : undefined}
        />
      </IonList>
      {error && <ErrorText>{error}</ErrorText>}
      <BlockButton disabled={busy} onClick={() => once(save)}>
        Passwort setzen
      </BlockButton>
    </>
  )
}
