import { IonLabel, IonSegment, IonSegmentButton, IonToolbar } from '@ionic/react'
import { useSketchSession, type SketchLevel } from './session'

const labels: Record<SketchLevel, string> = {
  public: 'Öffentlich',
  use: 'Verwendung',
  check: 'Prüfung',
  manage: 'Verwaltung',
}

export default function ViewAsBar() {
  const { level, setLevel } = useSketchSession()
  return (
    <IonToolbar color="light" className="view-as">
      <IonLabel slot="start" className="ion-padding-start">
        Ansicht als
      </IonLabel>
      <IonSegment value={level} scrollable>
        {(Object.keys(labels) as SketchLevel[]).map((l) => (
          <IonSegmentButton key={l} value={l} onClick={() => setLevel(l)} aria-label={labels[l]}>
            <IonLabel>{labels[l]}</IonLabel>
          </IonSegmentButton>
        ))}
      </IonSegment>
    </IonToolbar>
  )
}
