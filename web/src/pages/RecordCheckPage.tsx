import { IonButton, IonList, IonText, useIonViewWillEnter } from '@ionic/react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listCheckTypes, listItems, recordCheck, type CheckInput } from '../api/material'
import { Field, SelectField, TextAreaField } from '../components/Field'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { paths } from '../routes'
import { futureDateMessage, isFuture, today } from '../today'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'

const load = async () => {
  const [items, checkTypes] = await Promise.all([listItems(), listCheckTypes()])
  return { items, checkTypes }
}

export default function RecordCheckPage() {
  const { itemId = '' } = useParams()
  const navigate = useNavigate()
  const resource = useResource(load)
  const [selectedType, setSelectedType] = useState('')
  const [date, setDate] = useState(today)
  const [result, setResult] = useState<CheckInput['result']>('passed')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { busy, once } = useBusy()

  // Ionic keeps the page mounted, possibly past midnight.
  useIonViewWillEnter(() => setDate(today()))

  return (
    <Page title="Prüfung erfassen" back={paths.item(itemId)}>
      <Loaded resource={resource}>
        {({ items, checkTypes }) => {
          const item = items.find((i) => i.id === itemId)
          const types = checkTypes.filter((t) => t.categoryId === item?.categoryId)
          const checkTypeId = selectedType || (types.find((t) => t.isDefault) ?? types[0])?.id || ''

          const save = async () => {
            if (isFuture(date)) {
              setError(futureDateMessage)
              return
            }
            setError(null)
            try {
              await recordCheck(itemId, { checkTypeId, date, result, note })
              setNote('')
              setResult('passed')
              navigate(paths.item(itemId))
            } catch {
              setError('Speichern fehlgeschlagen.')
            }
          }

          return (
            <>
              <p>{item?.name}</p>
              <IonList>
                <SelectField label="Prüfart" value={checkTypeId} onChange={setSelectedType}>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </SelectField>
                <Field label="Datum" type="date" max={today()} value={date} onChange={setDate} />
                <SelectField label="Ergebnis" value={result} onChange={(value) => setResult(value as CheckInput['result'])}>
                  <option value="passed">Bestanden</option>
                  <option value="defect">Mangel</option>
                  <option value="retired">Ausgeschieden</option>
                </SelectField>
                <TextAreaField label="Notiz" value={note} onChange={setNote} />
              </IonList>
              {error && <IonText color="danger">{error}</IonText>}
              <IonButton expand="block" disabled={busy} onClick={() => once(save)}>
                Speichern
              </IonButton>
            </>
          )
        }}
      </Loaded>
    </Page>
  )
}
