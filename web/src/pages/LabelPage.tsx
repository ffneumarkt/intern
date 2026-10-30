import { IonButton } from '@ionic/react'
import { useParams } from 'react-router-dom'
import { listItems } from '../api/material'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { paths } from '../routes'
import { useResource } from '../useResource'

export default function LabelPage() {
  const { itemId = '' } = useParams()
  const resource = useResource(listItems)
  return (
    <Page title="Etikett" back={paths.item(itemId)}>
      <Loaded resource={resource}>
        {(items) => {
          const item = items.find((i) => i.id === itemId)
          return (
            <>
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
            </>
          )
        }}
      </Loaded>
    </Page>
  )
}
