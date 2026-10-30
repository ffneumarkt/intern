import { IonButton, IonCard, IonCardContent, IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/react'
import { useParams } from 'react-router-dom'
import { listHistory, listItems } from '../api/material'
import DueStateBadge from '../components/DueStateBadge'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { paths } from '../routes'
import { useSession } from '../session'
import { useResource } from '../useResource'

const statusLabel = { active: 'Aktiv', defective: 'Mangel', retired: 'Ausgeschieden' }

export default function ItemPage() {
  const { itemId = '' } = useParams()
  const { can } = useSession()
  const resource = useResource(async () => {
    const [items, history] = await Promise.all([listItems(), listHistory(itemId)])
    return { item: items.find((i) => i.id === itemId), history }
  })
  const item = resource.data?.item
  const title = !resource.data || item ? (item?.name ?? 'Gerät') : 'Gerät nicht gefunden'
  return (
    <Page title={title} back={item ? paths.category(item.categoryId) : paths.dueList}>
      <Loaded resource={resource}>
        {({ item, history }) =>
          item && (
            <>
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
                <IonButton routerLink={paths.recordUseFor(item.id)}>Verwendung erfassen</IonButton>
                {can(item.categoryId, 'check') && <IonButton routerLink={paths.recordCheck(item.id)}>Prüfung erfassen</IonButton>}
                {can(item.categoryId, 'check') && <IonButton color="medium" fill="outline">Ausscheiden</IonButton>}
                {can(item.categoryId, 'manage') && <IonButton fill="outline" routerLink={paths.manage}>Bearbeiten</IonButton>}
                {can(item.categoryId, 'manage') && <IonButton fill="outline" routerLink={paths.label(item.id)}>Etikett drucken</IonButton>}
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
                {history.map((h) => (
                  <IonItem key={`${h.date}-${h.title}`}>
                    <IonLabel>
                      <h3>{h.title}</h3>
                      <p>{h.detail}</p>
                    </IonLabel>
                    <IonNote slot="end">{h.date}</IonNote>
                  </IonItem>
                ))}
              </IonList>
            </>
          )
        }
      </Loaded>
    </Page>
  )
}
