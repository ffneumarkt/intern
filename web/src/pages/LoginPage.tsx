import { IonButton, IonIcon, IonInput, IonItem, IonList, IonNote } from '@ionic/react'
import { keyOutline } from 'ionicons/icons'
import Page from '../components/Page'

export default function LoginPage() {
  return (
    <Page title="Anmelden">
      <IonButton expand="block" size="large">
        <IonIcon slot="start" icon={keyOutline} aria-hidden />
        Mit Passkey anmelden
      </IonButton>
      <IonNote className="ion-text-center ion-margin-vertical" style={{ display: 'block' }}>
        oder mit E-Mail und Passwort
      </IonNote>
      <IonList inset>
        <IonItem>
          <IonInput label="E-Mail" labelPlacement="stacked" type="email" autocomplete="username" />
        </IonItem>
        <IonItem>
          <IonInput label="Passwort" labelPlacement="stacked" type="password" autocomplete="current-password" />
        </IonItem>
      </IonList>
      <IonButton expand="block" fill="outline">
        Anmelden
      </IonButton>
    </Page>
  )
}
