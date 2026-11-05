import { loadTransportSettings } from '../api/transport'
import Page from '../components/Page'
import TransportDocumentForm from '../transportDocument/TransportDocumentForm'
import '../transportDocument/transportDocument.css'
import { useResource } from '../useResource'

export default function TransportDocumentPage() {
  const resource = useResource(loadTransportSettings)
  return (
    <Page title="Beförderungspapier" grouped>
      {resource.error ? (
        <div className="td">
          <div className="td-problems" role="alert">
            <p style={{ margin: 0 }}>Einstellungen konnten nicht geladen werden. Beim ersten Öffnen braucht die Seite eine Internetverbindung.</p>
          </div>
        </div>
      ) : (
        resource.data && <TransportDocumentForm settings={resource.data} />
      )}
    </Page>
  )
}
