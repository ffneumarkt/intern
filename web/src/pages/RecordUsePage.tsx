import { IonButton, IonCard, IonCardContent, IonIcon, IonItem, IonLabel, IonList, IonSelectOption, IonText, useIonViewWillEnter } from '@ionic/react'
import { closeCircleOutline } from 'ionicons/icons'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listItems, recordUse, type Item, type UseInput } from '../api/material'
import { Field, SelectField, TextAreaField } from '../components/Field'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { paths } from '../routes'
import { useSession } from '../session'
import { futureDateMessage, isFuture, today } from '../today'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'

const recordedByKey = 'intern.recordedBy'

function readRecordedBy(): string {
  try {
    return localStorage.getItem(recordedByKey) ?? ''
  } catch {
    return ''
  }
}

function rememberRecordedBy(name: string) {
  try {
    localStorage.setItem(recordedByKey, name)
  } catch {
    // storage unavailable: the name is typed again next time
  }
}

const findByBarcode = (items: Item[], code: string) => items.find((i) => i.status !== 'retired' && i.barcode === code)

// Live suggestions while typing a code: active items whose code or name contains the text.
function searchItems(items: Item[], text: string, excludeIds: string[]) {
  const q = text.trim().toLowerCase()
  if (!q) return []
  return items.filter(
    (i) =>
      i.status !== 'retired' &&
      !excludeIds.includes(i.id) &&
      (i.barcode?.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)),
  )
}

export default function RecordUsePage() {
  const { canAnywhere } = useSession()
  const navigate = useNavigate()
  const resource = useResource(listItems)
  const [scanned, setScanned] = useState<Item[]>([])
  const [code, setCode] = useState('')
  const [unknown, setUnknown] = useState<string | null>(null)
  const [step, setStep] = useState<'scan' | 'form'>('scan')
  const [date, setDate] = useState(today)
  const [kind, setKind] = useState<UseInput['kind']>('operation')
  const [recordedBy, setRecordedBy] = useState(readRecordedBy)
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

  const submitCode = (e: FormEvent) => {
    e.preventDefault()
    const value = code.trim()
    if (!value || !items) return
    const item = findByBarcode(items, value)
    setUnknown(item ? null : value)
    if (item) add(item)
    setCode('')
  }

  // Saved items leave the list one by one, so a retry after a failure writes only the rest.
  const save = async () => {
    if (isFuture(date)) {
      setError(futureDateMessage)
      return
    }
    setError(null)
    rememberRecordedBy(recordedBy)
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
                  <form onSubmit={submitCode}>
                    <Field label="Code manuell eingeben" value={code} autoComplete="off" autoCapitalize="off" onChange={setCode} />
                  </form>
                  <Suggestions suggestions={searchItems(items, code, scanned.map((i) => i.id))} onPick={pick} />
                </IonCardContent>
              </IonCard>
              {unknown && (
                <IonCard color="warning">
                  <IonCardContent>
                    <IonText>Nicht gefunden: {unknown}</IonText>
                    {canAnywhere('manage') && (
                      <IonButton size="small" fill="outline" routerLink={paths.manage}>
                        Gerät zuordnen
                      </IonButton>
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
              {scanned.length > 0 && <p>Weiteres Gerät scannen?</p>}
              <IonButton expand="block" disabled={scanned.length === 0} onClick={() => setStep('form')}>
                Fertig
              </IonButton>
            </>
          ) : (
            <>
              <p>{scanned.map((i) => i.name).join(', ')}</p>
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
              <IonButton expand="block" disabled={busy} onClick={() => once(save)}>
                Speichern
              </IonButton>
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
