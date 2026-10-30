import { IonButton, IonList, IonText } from '@ionic/react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field } from '../components/Field'
import Page from '../components/Page'
import { paths } from '../routes'
import { useSession } from '../session'

export default function LoginPage() {
  const { login } = useSession()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [failed, setFailed] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFailed(false)
    try {
      await login(email, password)
      navigate(paths.dueList, { replace: true })
    } catch {
      setFailed(true)
    }
  }

  return (
    <Page title="Anmelden">
      <form onSubmit={submit}>
        <IonList inset>
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
        <IonButton expand="block" type="submit">
          Anmelden
        </IonButton>
      </form>
    </Page>
  )
}
