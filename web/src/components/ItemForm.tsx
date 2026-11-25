import { Plus } from 'lucide-react'
import { List } from '@/components/ui/list'
import { useState } from 'react'
import { BarcodeTakenError } from '../api/errors'
import type { CheckType, Item, ItemInput, Location } from '../api/material'
import { futureDateMessage, isFuture, today } from '../today'
import { useBusy } from '../useBusy'
import { Field, SelectField, TextAreaField } from './Field'
import { showFirstInvalid, requiredMessage } from './required'
import { ActionBar, BlockButton, ErrorText } from './ui'

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
  // Set by the first press of Speichern: only then do the required fields show their error.
  const [tried, setTried] = useState(false)
  const { busy, once } = useBusy()

  const save = async () => {
    if (!name.trim()) {
      setTried(true)
      showFirstInvalid()
      return
    }
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
      <List>
        <Field label="Bezeichnung" value={name} onChange={setName} required error={tried && !name.trim() ? requiredMessage : undefined} />
        <Field label="Seriennummer" value={serial} onChange={setSerial} autoCapitalize="off" />
        <Field label="Code" value={barcode} onChange={setBarcode} autoCapitalize="off" />
        <Field label="Hergestellt am" type="date" value={manufacturedOn} onChange={setManufacturedOn} />
        <SelectField label="Standort" value={locationId} onChange={setLocationId}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
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
      </List>
      {error && <ErrorText>{error}</ErrorText>}
      <ActionBar>
        <BlockButton disabled={busy} onClick={() => once(save)}>
          {!item && <Plus aria-hidden="true" />}
          {submitLabel}
        </BlockButton>
      </ActionBar>
    </>
  )
}
