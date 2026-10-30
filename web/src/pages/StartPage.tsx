import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle } from '@ionic/react'
import Page from '../components/Page'
import { paths } from '../routes'
import { useSession } from '../session'

export default function StartPage() {
  const { user } = useSession()
  return (
    <Page title="Start">
      <IonCard routerLink={paths.transportDocument} button>
        <IonCardHeader>
          <IonCardTitle>Beförderungspapier</IonCardTitle>
          <IonCardSubtitle>Druckluftflaschen, funktioniert offline</IonCardSubtitle>
        </IonCardHeader>
      </IonCard>
      {user ? (
        <IonCard routerLink={paths.dueList} button>
          <IonCardHeader>
            <IonCardTitle>Material</IonCardTitle>
            <IonCardSubtitle>Prüffristen und Verwendungen</IonCardSubtitle>
          </IonCardHeader>
        </IonCard>
      ) : (
        <IonCard>
          <IonCardContent>
            <p>Für die Materialverwaltung bitte anmelden.</p>
            <IonButton routerLink={paths.login}>Anmelden</IonButton>
          </IonCardContent>
        </IonCard>
      )}
    </Page>
  )
}
