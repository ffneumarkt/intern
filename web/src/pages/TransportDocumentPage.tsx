import { IonCard, IonCardContent, IonCardHeader, IonCardTitle } from '@ionic/react'
import Page from '../components/Page'

export default function TransportDocumentPage() {
  return (
    <Page title="Beförderungspapier">
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Generator folgt</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          Generator wird aus ffneumarkt-web übernommen (Flaschenanzahl, Füllstelle, Checkliste, PDF-Download).
        </IonCardContent>
      </IonCard>
    </Page>
  )
}
