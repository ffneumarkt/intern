import { IonButton, IonItem, IonLabel, IonList } from '@ionic/react'
import Page from '../components/Page'
import { useSession } from '../session'

export default function SettingsPage() {
  const { user, logout } = useSession()

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
      <IonButton expand="block" color="medium" fill="clear" onClick={logout}>
        Abmelden
      </IonButton>
    </Page>
  )
}
