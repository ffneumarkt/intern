import { IonList, IonSelectOption, useIonRouter, useIonViewWillEnter, useIonViewWillLeave } from '@ionic/react'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { listCheckTypes, listItems, listLocations, recordCheck, type CheckInput } from '../api/material'
import { Field, SelectField, TextAreaField } from '../components/Field'
import Loaded from '../components/Loaded'
import Measurements, { type Readings } from '../components/Measurements'
import { focusFirstInvalid } from '../components/required'
import Page from '../components/Page'
import { leakReadingProblem, measurementsPass } from '../material/measurements'
import { paths } from '../routes'
import { futureDateMessage, isFuture, today } from '../today'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'
import { ActionBar, BlockButton, ErrorText, Hint } from '../components/ui'

const load = async () => {
  const [items, checkTypes, locations] = await Promise.all([listItems(), listCheckTypes(), listLocations()])
  return { items, checkTypes, locations }
}

export default function RecordCheckPage() {
  const { itemId = '' } = useParams()
  const navigate = useNavigate()
  const ionRouter = useIonRouter()
  // Opened from a row of the due list: back and saving return there (with its filter), not to the item page.
  const fromList = new URLSearchParams(useLocation().search).get('von') === 'liste'
  const resource = useResource(load)
  const [selectedType, setSelectedType] = useState('')
  const [date, setDate] = useState(today)
  const [result, setResult] = useState<CheckInput['result']>('passed')
  const [note, setNote] = useState('')
  // True once the user has picked a result, so the readings stop suggesting one.
  const [resultPicked, setResultPicked] = useState(false)
  // The truck picked after a passed check; null means the default location.
  const [locationId, setLocationId] = useState<string | null>(null)
  const [readings, setReadings] = useState<Readings>({ start: null, end: null, opening: null })
  // A new key starts the readings (fields, countdown) over.
  const [readingsKey, setReadingsKey] = useState(0)
  // Set by a Speichern with readings missing: only then do the empty ones show their error.
  const [triedSave, setTriedSave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { busy, once } = useBusy()

  // Ionic keeps the page mounted, possibly past midnight.
  useIonViewWillEnter(() => setDate(today()))
  // Ionic keeps the page mounted: leaving stops the countdown and clears the readings.
  useIonViewWillLeave(() => {
    setReadingsKey((k) => k + 1)
    setTriedSave(false)
  })

  return (
    <Page title="Prüfung erfassen" back={fromList ? paths.dueList : paths.item(itemId)}>
      <Loaded resource={resource}>
        {({ items, checkTypes, locations }) => {
          const item = items.find((i) => i.id === itemId)
          const types = checkTypes.filter((t) => t.categoryId === item?.categoryId)
          const checkTypeId = selectedType || (types.find((t) => t.isDefault) ?? types[0])?.id || ''
          const measured = types.find((t) => t.id === checkTypeId)?.measurements ?? false
          // With readings the result is suggested from them until the user picks one.
          const passes = measured ? measurementsPass(readings.start, readings.end, readings.opening) : null
          const shownResult: CheckInput['result'] = !resultPicked && passes !== null ? (passes ? 'passed' : 'defect') : result
          // After a passed check the item is in the workshop, or on the truck that is picked. With a defect it stays where it is.
          const chosenLocation = locationId ?? locations.find((l) => l.isDefault)?.id ?? ''

          const save = async () => {
            if (isFuture(date)) {
              setError(futureDateMessage)
              return
            }
            if (measured && (readings.start === null || readings.end === null || readings.opening === null)) {
              setTriedSave(true)
              setError('Bitte alle Messwerte eintragen.')
              focusFirstInvalid()
              return
            }
            // A reading no mask could give (the pressure further from 0 after 60 s than at the start).
            if (measured && readings.start !== null && readings.end !== null && leakReadingProblem(readings.start, readings.end)) {
              setTriedSave(true)
              setError('Bitte die Messwerte prüfen.')
              focusFirstInvalid()
              return
            }
            setError(null)
            try {
              await recordCheck(itemId, {
                checkTypeId,
                date,
                result: shownResult,
                ...(shownResult === 'passed' && chosenLocation && { locationId: chosenLocation }),
                note,
                ...(measured && {
                  leakStartMbar: readings.start ?? undefined,
                  leakEndMbar: readings.end ?? undefined,
                  openingPressureMbar: readings.opening ?? undefined,
                }),
              })
              setNote('')
              setResult('passed')
              setResultPicked(false)
              setLocationId(null)
              setReadingsKey((k) => k + 1)
              setTriedSave(false)
              if (!fromList) navigate(paths.item(itemId))
              else if (ionRouter.canGoBack()) ionRouter.goBack()
              else navigate(paths.dueList)
            } catch {
              setError('Speichern fehlgeschlagen.')
            }
          }

          return (
            <>
              <Hint><strong>{item?.name}</strong></Hint>
              <IonList>
                <SelectField label="Prüfart" value={checkTypeId} onChange={setSelectedType}>
                  {types.map((t) => (
                    <IonSelectOption key={t.id} value={t.id}>
                      {t.name}
                    </IonSelectOption>
                  ))}
                </SelectField>
                <Field label="Datum" type="date" max={today()} value={date} onChange={setDate} />
              </IonList>
              {measured && <Measurements key={`${checkTypeId}:${readingsKey}`} onChange={setReadings} showErrors={triedSave} />}
              <IonList>
                <SelectField
                  label="Ergebnis"
                  value={shownResult}
                  onChange={(value) => {
                    setResult(value as CheckInput['result'])
                    setResultPicked(true)
                  }}
                >
                  <IonSelectOption value="passed">Bestanden</IonSelectOption>
                  <IonSelectOption value="defect">Mangel</IonSelectOption>
                  <IonSelectOption value="retired">Ausgeschieden</IonSelectOption>
                </SelectField>
                {shownResult === 'passed' && (
                  <SelectField label="Standort" value={chosenLocation} onChange={setLocationId}>
                    {locations.map((l) => (
                      <IonSelectOption key={l.id} value={l.id}>
                        {l.name}
                      </IonSelectOption>
                    ))}
                  </SelectField>
                )}
                <TextAreaField label="Notiz" value={note} onChange={setNote} />
              </IonList>
              {error && <ErrorText>{error}</ErrorText>}
              <ActionBar>
                <BlockButton disabled={busy} onClick={() => once(save)}>
                  Speichern
                </BlockButton>
              </ActionBar>
            </>
          )
        }}
      </Loaded>
    </Page>
  )
}
