import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonText, IonTitle, IonToolbar } from '@ionic/react'
import { barcodeOutline } from 'ionicons/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Item } from '../api/material'
import { findByBarcode } from '../material/items'
import { paths } from '../routes'
import { useSession } from '../session'
import AssignCode from './AssignCode'
import Scanner from './Scanner'

// Quick search: scan a code and open its item.
export default function ScanSearch({ items }: { items: Item[] }) {
  const { canAnywhere } = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [unknown, setUnknown] = useState<string | null>(null)

  const close = () => {
    setOpen(false)
    setUnknown(null)
  }
  const openItem = (item: Item) => {
    close()
    navigate(paths.item(item.id))
  }
  const handleCode = (code: string) => {
    const item = findByBarcode(items, code)
    if (item) openItem(item)
    else setUnknown(code)
  }

  return (
    <>
      <IonButton fill="outline" size="small" onClick={() => setOpen(true)}>
        <IonIcon slot="start" icon={barcodeOutline} aria-hidden />
        Scannen
      </IonButton>
      <IonModal isOpen={open} onDidDismiss={close}>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>Gerät scannen</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={close}>Schließen</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <Scanner onCode={handleCode} active={open} />
          {unknown && (
            <div className="ui-hint">
              <IonText color="danger">Nicht gefunden: {unknown}</IonText>
              {canAnywhere('manage') && <AssignCode code={unknown} items={items} onAssigned={openItem} />}
            </div>
          )}
        </IonContent>
      </IonModal>
    </>
  )
}
