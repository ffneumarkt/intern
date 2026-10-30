import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
  IonToggle,
} from '@ionic/react'
import { cameraOutline, closeCircleOutline } from 'ionicons/icons'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import Page from '../components/Page'
import { paths } from '../routes'
import { findByBarcode, items, searchItems, type Item } from '../sketch/mockData'
import { useSession } from '../session'

export default function RecordUsePage() {
  const { canAnywhere } = useSession()
  const [scanned, setScanned] = useState<Item[]>([])
  const [code, setCode] = useState('')
  const [unknown, setUnknown] = useState<string | null>(null)
  const [step, setStep] = useState<'scan' | 'form'>('scan')
  const preselectedId = new URLSearchParams(useLocation().search).get('geraet')

  const add = (item: Item) => setScanned((list) => (list.some((i) => i.id === item.id) ? list : [...list, item]))

  // Opened from an item's detail page: start with that item in the list.
  useEffect(() => {
    const item = items.find((i) => i.id === preselectedId)
    if (item) add(item)
  }, [preselectedId])

  const suggestions = searchItems(code, scanned.map((i) => i.id))

  const pick = (item: Item) => {
    add(item)
    setUnknown(null)
    setCode('')
  }

  const submitCode = (e: FormEvent) => {
    e.preventDefault()
    const value = code.trim()
    if (!value) return
    const item = findByBarcode(value)
    setUnknown(item ? null : value)
    if (item) add(item)
    setCode('')
  }

  return (
    <Page title="Verwendung erfassen" back={paths.dueList}>
      {step === 'scan' ? (
        <>
          <IonCard>
            <div className="scanner-placeholder" aria-hidden>
              <IonIcon icon={cameraOutline} />
              <span>Kamerabild</span>
            </div>
            <IonCardContent>
              <IonSelect label="Kamera" value="back" interface="popover">
                <IonSelectOption value="back">Rückkamera</IonSelectOption>
                <IonSelectOption value="front">Frontkamera</IonSelectOption>
              </IonSelect>
              <IonToggle>Taschenlampe</IonToggle>
              <form onSubmit={submitCode}>
                <label>
                  Code manuell eingeben
                  <input
                    className="code-input"
                    value={code}
                    autoComplete="off"
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
              </form>
              {suggestions.length > 0 && (
                <IonList aria-label="Vorschläge" className="suggestions">
                  {suggestions.map((i) => (
                    <IonItem key={i.id} role="listitem" button detail={false} onClick={() => pick(i)}>
                      <IonLabel>
                        {i.name}
                        <p>{i.barcode}</p>
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              )}
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
        <form>
          <p>{scanned.map((i) => i.name).join(', ')}</p>
          <IonList>
            <IonItem>
              <IonInput label="Datum" labelPlacement="stacked" type="date" value="2026-10-29" />
            </IonItem>
            <IonItem>
              <IonSelect label="Art" labelPlacement="stacked" value="operation" interface="popover">
                <IonSelectOption value="operation">Einsatz</IonSelectOption>
                <IonSelectOption value="exercise">Übung</IonSelectOption>
                <IonSelectOption value="other">Sonstiges</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <label className="stacked-label">
                Erfasst von
                <input className="code-input" defaultValue="" />
              </label>
            </IonItem>
            <IonItem>
              <IonTextarea label="Notiz" labelPlacement="stacked" />
            </IonItem>
          </IonList>
          <IonButton expand="block" routerLink={paths.dueList}>
            Speichern
          </IonButton>
        </form>
      )}
    </Page>
  )
}
