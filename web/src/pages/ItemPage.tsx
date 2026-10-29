import { IonButton, IonCard, IonCardContent, IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/react'
import { useParams } from 'react-router-dom'
import DueStateBadge from '../components/DueStateBadge'
import Page from '../components/Page'
import { paths } from '../routes'
import { history, items } from '../sketch/mockData'
import { atLeast, useSketchSession } from '../sketch/session'

const statusLabel = { active: 'Aktiv', defective: 'Mangel', retired: 'Ausgeschieden' }

export default function ItemPage() {
  const { itemId = '' } = useParams()
  const { level } = useSketchSession()
  const item = items.find((i) => i.id === itemId)
  if (!item) return <Page title="Gerät nicht gefunden" back={paths.dueList} />
  return (
    <Page title={item.name} back={paths.category(item.categoryId)}>
      <IonCard>
        <IonCardContent>
          <p>Seriennummer: {item.serial ?? '–'}</p>
          <p>Code: {item.barcode ?? '–'}</p>
          <p>Hergestellt: {item.manufacturedOn ?? '–'}</p>
          <p>Status: {statusLabel[item.status]}</p>
          {item.note && <p>Notiz: {item.note}</p>}
        </IonCardContent>
      </IonCard>
      <div className="ion-margin-bottom">
        <IonButton routerLink={paths.recordUse}>Verwendung erfassen</IonButton>
        {atLeast(level, 'check') && <IonButton routerLink={paths.recordCheck(item.id)}>Prüfung erfassen</IonButton>}
        {atLeast(level, 'check') && <IonButton color="medium" fill="outline">Ausscheiden</IonButton>}
        {atLeast(level, 'manage') && <IonButton fill="outline" routerLink={paths.manage}>Bearbeiten</IonButton>}
        {atLeast(level, 'manage') && <IonButton fill="outline" routerLink={paths.label(item.id)}>Etikett drucken</IonButton>}
      </div>
      <IonList>
        <IonListHeader>
          <IonLabel>Fälligkeiten</IonLabel>
        </IonListHeader>
        {item.dues.map((d) => (
          <IonItem key={d.label}>
            <IonLabel>
              <h3>{d.label}</h3>
              <p>{d.date}</p>
            </IonLabel>
            <DueStateBadge state={d.state} />
          </IonItem>
        ))}
      </IonList>
      <IonList>
        <IonListHeader>
          <IonLabel>Verlauf</IonLabel>
        </IonListHeader>
        {history
          .filter((h) => h.itemId === item.id)
          .map((h) => (
            <IonItem key={`${h.date}-${h.title}`}>
              <IonLabel>
                <h3>{h.title}</h3>
                <p>{h.detail}</p>
              </IonLabel>
              <IonNote slot="end">{h.date}</IonNote>
            </IonItem>
          ))}
      </IonList>
    </Page>
  )
}
