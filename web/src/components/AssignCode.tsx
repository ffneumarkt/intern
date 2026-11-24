import { IonButton, IonItem, IonLabel, IonList, IonText } from '@ionic/react'
import { useState } from 'react'
import { assignBarcode, type Item } from '../api/material'
import { BarcodeTakenError } from '../api/errors'
import { Field } from './Field'

interface Props {
  code: string
  items: Item[]
  onAssigned(item: Item): void
}

// Lets a manage user put a scanned code that no item has yet onto an item. Items without a code come first.
export default function AssignCode({ code, items, onAssigned }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const q = text.trim().toLowerCase()
  const candidates = items
    .filter((i) => i.status !== 'retired' && (!q || i.name.toLowerCase().includes(q) || i.barcode?.toLowerCase().includes(q)))
    .sort((a, b) => Number(!!a.barcode) - Number(!!b.barcode))

  const assign = async (item: Item) => {
    setError(null)
    try {
      await assignBarcode(item.id, code)
    } catch (err) {
      setError(err instanceof BarcodeTakenError ? 'Code ist bereits vergeben.' : 'Speichern fehlgeschlagen.')
      return
    }
    setOpen(false)
    setText('')
    onAssigned({ ...item, barcode: code })
  }

  if (!open) {
    return (
      <IonButton size="small" fill="outline" onClick={() => setOpen(true)}>
        Gerät zuordnen
      </IonButton>
    )
  }
  return (
    <div>
      <Field label="Gerät suchen" value={text} autoComplete="off" onChange={setText} />
      {error && <IonText color="danger">{error}</IonText>}
      <IonList aria-label="Geräte" className="suggestions">
        {candidates.map((i) => (
          <IonItem key={i.id} role="listitem" button detail={false} onClick={() => assign(i)}>
            <IonLabel>
              {i.name}
              <p>{i.barcode ?? 'ohne Code'}</p>
            </IonLabel>
          </IonItem>
        ))}
      </IonList>
    </div>
  )
}
