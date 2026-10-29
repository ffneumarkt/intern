import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle } from '@ionic/react'
import Page from '../components/Page'
import { paths } from '../routes'
import { atLeast, useSketchSession } from '../sketch/session'

export default function StartPage() {
  const { level } = useSketchSession()
  return (
    <Page title="Start">
      <IonCard routerLink={paths.transportDocument} button>
        <IonCardHeader>
          <IonCardTitle>Beförderungspapier</IonCardTitle>
          <IonCardSubtitle>Druckluftflaschen, funktioniert offline</IonCardSubtitle>
        </IonCardHeader>
      </IonCard>
      {atLeast(level, 'use') ? (
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
