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
import { useState, type FormEvent } from 'react'
import Page from '../components/Page'
import { paths } from '../routes'
import { findByBarcode, type Item } from '../sketch/mockData'
import { atLeast, useSketchSession } from '../sketch/session'

export default function RecordUsePage() {
  const { level } = useSketchSession()
  const [scanned, setScanned] = useState<Item[]>([])
  const [code, setCode] = useState('')
  const [unknown, setUnknown] = useState<string | null>(null)
  const [step, setStep] = useState<'scan' | 'form'>('scan')

  const submitCode = (e: FormEvent) => {
    e.preventDefault()
    const value = code.trim()
    if (!value) return
    const item = findByBarcode(value)
    setUnknown(item ? null : value)
    if (item) setScanned((list) => (list.some((i) => i.id === item.id) ? list : [...list, item]))
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
                  <input className="code-input" value={code} onChange={(e) => setCode(e.target.value)} />
                </label>
              </form>
            </IonCardContent>
          </IonCard>
          {unknown && (
            <IonCard color="warning">
              <IonCardContent>
                <IonText>Nicht gefunden: {unknown}</IonText>
                {atLeast(level, 'manage') && (
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
