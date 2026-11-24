import { IonButton, IonIcon, IonList, IonSelectOption, IonText } from '@ionic/react'
import { addOutline } from 'ionicons/icons'
import { useState } from 'react'
import { BarcodeTakenError } from '../api/errors'
import type { CheckType, Item, ItemInput, Location } from '../api/material'
import { futureDateMessage, isFuture, today } from '../today'
import { useBusy } from '../useBusy'
import { Field, SelectField, TextAreaField } from './Field'

interface ItemFormProps {
  item?: Item
  // The places the item can be in; a new item starts in the default one.
  locations: Location[]
  // Offered as "last checked on" dates; left out when editing.
  checkTypes?: CheckType[]
  submitLabel: string
  onSave(input: Omit<ItemInput, 'categoryId'>, lastChecked: Record<string, string>): Promise<void>
}

export default function ItemForm({ item, locations, checkTypes = [], submitLabel, onSave }: ItemFormProps) {
  const [name, setName] = useState(item?.name ?? '')
  const [serial, setSerial] = useState(item?.serial ?? '')
  const [barcode, setBarcode] = useState(item?.barcode ?? '')
  const [manufacturedOn, setManufacturedOn] = useState(item?.manufacturedOn ?? '')
  const [note, setNote] = useState(item?.note ?? '')
  const [locationId, setLocationId] = useState(item?.locationId ?? locations.find((l) => l.isDefault)?.id ?? '')
  const [lastChecked, setLastChecked] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const { busy, once } = useBusy()

  const save = async () => {
    const dates = Object.fromEntries(
      checkTypes.filter((t) => lastChecked[t.id]).map((t) => [t.id, lastChecked[t.id]]),
    )
    if (Object.values(dates).some(isFuture)) {
      setError(futureDateMessage)
      return
    }
    setError(null)
    try {
      await onSave({ name, serial, barcode, manufacturedOn, note, locationId }, dates)
    } catch (err) {
      setError(err instanceof BarcodeTakenError ? 'Code ist bereits vergeben.' : 'Speichern fehlgeschlagen.')
    }
  }

  return (
    <>
      <IonList>
        <Field label="Bezeichnung" value={name} onChange={setName} />
        <Field label="Seriennummer" value={serial} onChange={setSerial} autoCapitalize="off" />
        <Field label="Code" value={barcode} onChange={setBarcode} autoCapitalize="off" />
        <Field label="Hergestellt am" type="date" value={manufacturedOn} onChange={setManufacturedOn} />
        <SelectField label="Standort" value={locationId} onChange={setLocationId}>
          {locations.map((l) => (
            <IonSelectOption key={l.id} value={l.id}>
              {l.name}
            </IonSelectOption>
          ))}
        </SelectField>
        <TextAreaField label="Notiz" value={note} onChange={setNote} />
        {checkTypes.map((t) => (
          <Field
            key={t.id}
            label={`Zuletzt geprüft am (${t.name})`}
            type="date"
            max={today()}
            value={lastChecked[t.id] ?? ''}
            onChange={(date) => setLastChecked((dates) => ({ ...dates, [t.id]: date }))}
          />
        ))}
      </IonList>
      {error && <IonText color="danger">{error}</IonText>}
      <div className="ui-actions">
        <IonButton expand="block" disabled={busy || !name.trim()} onClick={() => once(save)}>
          {!item && <IonIcon slot="start" icon={addOutline} aria-hidden />}
          {submitLabel}
        </IonButton>
      </div>
    </>
  )
}
