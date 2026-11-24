import { IonList } from '@ionic/react'
import LegalItems from '../components/LegalItems'
import Page from '../components/Page'
import { Hint } from '../components/ui'

export default function InfoPage() {
  return (
    <Page title="Info">
      <Hint>Rechtliche Informationen zu dieser Anwendung der Freiwilligen Feuerwehr Neumarkt im Mühlkreis.</Hint>
      <IonList>
        <LegalItems />
      </IonList>
    </Page>
  )
}
