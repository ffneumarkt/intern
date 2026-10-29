import { IonButton } from '@ionic/react'
import { useParams } from 'react-router-dom'
import Page from '../components/Page'
import { paths } from '../routes'
import { items } from '../sketch/mockData'

export default function LabelPage() {
  const { itemId = '' } = useParams()
  const item = items.find((i) => i.id === itemId)
  return (
    <Page title="Etikett" back={paths.item(itemId)}>
      <div className="label-preview">
        <div className="qr-placeholder" aria-label="QR-Code">
          QR
        </div>
        <strong>{item?.name}</strong>
        <span>{item?.barcode ?? itemId}</span>
      </div>
      <IonButton expand="block" onClick={() => window.print()}>
        Drucken
      </IonButton>
    </Page>
  )
}
