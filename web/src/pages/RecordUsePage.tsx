import { IonButton, IonCard, IonCardContent, IonIcon, IonItem, IonLabel, IonList, IonSelectOption, IonText, useIonViewWillEnter } from '@ionic/react'
import { closeCircleOutline } from 'ionicons/icons'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listItems, recordUse, type Item, type UseInput } from '../api/material'
import AssignCode from '../components/AssignCode'
import { Field, SelectField, TextAreaField } from '../components/Field'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import Scanner from '../components/Scanner'
import { findByBarcode, searchItems } from '../material/items'
import { paths } from '../routes'
import { useSession } from '../session'
import { futureDateMessage, isFuture, today } from '../today'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'

// Remembered per account and device, so a second account on the same phone does not get the first one's name.
const recordedByKey = (userId: string | undefined) => `intern.recordedBy:${userId ?? ''}`

function readRecordedBy(userId: string | undefined): string | null {
  try {
    return localStorage.getItem(recordedByKey(userId)) || null
  } catch {
    return null
  }
}

function rememberRecordedBy(userId: string | undefined, name: string) {
  try {
    localStorage.setItem(recordedByKey(userId), name)
  } catch {
    // storage unavailable: the name is typed again next time
  }
}

export default function RecordUsePage() {
  const { canAnywhere, user } = useSession()
  const navigate = useNavigate()
  const resource = useResource(listItems)
  const [scanned, setScanned] = useState<Item[]>([])
  const [code, setCode] = useState('')
  const [unknown, setUnknown] = useState<string | null>(null)
  const [step, setStep] = useState<'scan' | 'form'>('scan')
  const [date, setDate] = useState(today)
  const [kind, setKind] = useState<UseInput['kind']>('operation')
  // What the user typed; until then the name remembered for this account, else the account's own name.
  const [typedRecordedBy, setRecordedBy] = useState<string | null>(null)
  const recordedBy = typedRecordedBy ?? readRecordedBy(user?.id) ?? user?.name ?? ''
  // Ionic keeps the page mounted across logins.
  useEffect(() => setRecordedBy(null), [user?.id])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { busy, once } = useBusy()
  const preselectedId = new URLSearchParams(useLocation().search).get('geraet')
  const items = resource.data

  const add = (item: Item) => setScanned((list) => (list.some((i) => i.id === item.id) ? list : [...list, item]))

  // Ionic keeps the page mounted, possibly past midnight.
  useIonViewWillEnter(() => setDate(today()))

  // Opened from an item's detail page: start with that item in the list.
  useEffect(() => {
    const item = items?.find((i) => i.id === preselectedId)
    if (item) add(item)
  }, [preselectedId, items])

  const pick = (item: Item) => {
    add(item)
    setUnknown(null)
    setCode('')
  }

  // A code from the camera or the manual field: known items join the list, anything else is reported.
  const handleCode = (value: string) => {
    if (!items) return
    const item = findByBarcode(items, value)
    setUnknown(item ? null : value)
    if (item) add(item)
  }

  const submitCode = (e: FormEvent) => {
    e.preventDefault()
    const value = code.trim()
    if (!value) return
    handleCode(value)
    setCode('')
  }

  // Saved items leave the list one by one, so a retry after a failure writes only the rest.
  const save = async () => {
    if (isFuture(date)) {
      setError(futureDateMessage)
      return
    }
    setError(null)
    rememberRecordedBy(user?.id, recordedBy)
    let remaining = scanned
    try {
      for (const item of scanned) {
        await recordUse(item.id, { date, kind, recordedByName: recordedBy, note })
        remaining = remaining.filter((i) => i.id !== item.id)
        setScanned(remaining)
      }
    } catch {
      setError('Speichern fehlgeschlagen.')
      return
    }
    setStep('scan')
    setNote('')
    setKind('operation')
    navigate(paths.dueList)
  }

  return (
    <Page title="Verwendung erfassen" back={paths.dueList}>
      <Loaded resource={resource}>
        {(items) =>
          step === 'scan' ? (
            <>
              <IonCard>
                <IonCardContent>
                  {/* The field stays above the camera preview: on iOS, Ionic's input shim swaps in a cloned input
                      for a field low on the page, which loses focus and stops Enter from submitting. */}
                  <form onSubmit={submitCode}>
                    <Field label="Code manuell eingeben" value={code} autoComplete="off" autoCapitalize="off" onChange={setCode} />
                  </form>
                  <Suggestions suggestions={searchItems(items, code, scanned.map((i) => i.id))} onPick={pick} />
                  <Scanner onCode={handleCode} active={step === 'scan'} />
                </IonCardContent>
              </IonCard>
              {unknown && (
                <IonCard color="warning">
                  <IonCardContent>
                    <IonText>Nicht gefunden: {unknown}</IonText>
                    {canAnywhere('manage') && (
                      <AssignCode code={unknown} items={items} onAssigned={(item) => { add(item); setUnknown(null) }} />
                    )}
                  </IonCardContent>
                </IonCard>
              )}
              <IonList aria-label="Gescannte Geräte">
                {scanned.map((i) => (
                  <IonItem key={i.id} role="listitem">
                    <IonLabel>{i.name}</IonLabel>
                    <IonButton
                      fill="clear"
                      slot="end"
                      aria-label={`${i.name} entfernen`}
                      onClick={() => setScanned((list) => list.filter((x) => x.id !== i.id))}
                    >
                      <IonIcon icon={closeCircleOutline} aria-hidden />
                    </IonButton>
                  </IonItem>
                ))}
              </IonList>
              {scanned.length > 0 && <p className="ui-hint">Weiteres Gerät scannen?</p>}
              <div className="ui-actions">
                <IonButton expand="block" disabled={scanned.length === 0} onClick={() => setStep('form')}>
                  Fertig
                </IonButton>
              </div>
            </>
          ) : (
            <>
              <p className="ui-hint"><strong>{scanned.map((i) => i.name).join(', ')}</strong></p>
              <IonList>
                <Field label="Datum" type="date" max={today()} value={date} onChange={setDate} />
                <SelectField label="Art" value={kind} onChange={(value) => setKind(value as UseInput['kind'])}>
                  <IonSelectOption value="operation">Einsatz</IonSelectOption>
                  <IonSelectOption value="exercise">Übung</IonSelectOption>
                  <IonSelectOption value="other">Sonstiges</IonSelectOption>
                </SelectField>
                <Field label="Erfasst von" value={recordedBy} onChange={setRecordedBy} />
                <TextAreaField label="Notiz" value={note} onChange={setNote} />
              </IonList>
              {error && <IonText color="danger">{error}</IonText>}
              <div className="ui-actions">
                <IonButton expand="block" disabled={busy} onClick={() => once(save)}>
                  Speichern
                </IonButton>
              </div>
            </>
          )
        }
      </Loaded>
    </Page>
  )
}

function Suggestions({ suggestions, onPick }: { suggestions: Item[]; onPick(item: Item): void }) {
  if (suggestions.length === 0) return null
  return (
    <IonList aria-label="Vorschläge" className="suggestions">
      {suggestions.map((i) => (
        <IonItem key={i.id} role="listitem" button detail={false} onClick={() => onPick(i)}>
          <IonLabel>
            {i.name}
            <p>{i.barcode}</p>
          </IonLabel>
        </IonItem>
      ))}
    </IonList>
  )
}
