import { IonList } from '@ionic/react'
import LegalItems from '../components/LegalItems'
import Page from '../components/Page'

export default function InfoPage() {
  return (
    <Page title="Info">
      <p className="ui-hint">Rechtliche Informationen zu dieser Anwendung der Freiwilligen Feuerwehr Neumarkt im Mühlkreis.</p>
      <IonList>
        <LegalItems />
      </IonList>
    </Page>
  )
}
