import { IonText } from '@ionic/react'
import { loadTransportSettings } from '../api/transport'
import Page from '../components/Page'
import TransportDocumentForm from '../transportDocument/TransportDocumentForm'
import { useResource } from '../useResource'

export default function TransportDocumentPage() {
  const resource = useResource(loadTransportSettings)
  return (
    <Page title="Beförderungspapier">
      {resource.error ? (
        <IonText color="danger">
          <p>Einstellungen konnten nicht geladen werden. Beim ersten Öffnen braucht die Seite eine Internetverbindung.</p>
        </IonText>
      ) : (
        resource.data && <TransportDocumentForm settings={resource.data} />
      )}
    </Page>
  )
}
