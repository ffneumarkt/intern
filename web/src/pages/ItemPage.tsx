import { IonButton, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonText } from '@ionic/react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { listHistory, listItems, retireItem, type Item } from '../api/material'
import DueStateBadge from '../components/DueStateBadge'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { useDialogs } from '../components/useDialogs'
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
  const [failed, setFailed] = useState(false)
  const { confirm } = useDialogs()
  const item = resource.data?.item

  const retire = async (target: Item) => {
    if (!(await confirm({ message: `${target.name} ausscheiden?`, confirmText: 'Ausscheiden', destructive: true }))) return
    setFailed(false)
    try {
      await retireItem(target.id)
      resource.reload()
    } catch {
      setFailed(true)
    }
  }

  const title = !resource.data || item ? (item?.name ?? 'Gerät') : 'Gerät nicht gefunden'
  return (
    <Page title={title} back={item ? paths.category(item.categoryId) : paths.dueList}>
      <Loaded resource={resource}>
        {({ item, history }) => {
          if (!item) return null
          const active = item.status !== 'retired'
          return (
            <>
              <section className="ui-card" aria-label="Angaben">
                <div className="item-head">
                  <p className="item-name">{item.name}</p>
                  <DueStateBadge state={item.dueState} />
                </div>
                <div className="item-facts">
                  <p>Seriennummer: {item.serial ?? '–'}</p>
                  <p>Code: {item.barcode ?? '–'}</p>
                  <p>Hergestellt: {item.manufacturedOn ?? '–'}</p>
                  <p>Status: {statusLabel[item.status]}</p>
                  {item.note && <p>Notiz: {item.note}</p>}
                </div>
              </section>
              {failed && <IonText color="danger">Speichern fehlgeschlagen.</IonText>}
              <div className="ui-actionrow">
                {active && can(item.categoryId, 'check') && (
                  <IonButton fill="outline" routerLink={paths.recordCheck(item.id)}>
                    Prüfung erfassen
                  </IonButton>
                )}
                {can(item.categoryId, 'manage') && (
                  <IonButton fill="outline" routerLink={paths.itemEdit(item.id)}>
                    Bearbeiten
                  </IonButton>
                )}
                {active && can(item.categoryId, 'check') && (
                  <IonButton color="medium" fill="outline" onClick={() => retire(item)}>
                    Ausscheiden
                  </IonButton>
                )}
              </div>
              <IonList>
                <IonListHeader>
                  <IonLabel>Fälligkeiten</IonLabel>
                </IonListHeader>
                {item.dues.map((d) => (
                  <IonItem key={`${d.kind}-${d.checkTypeId}`}>
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
                {history.map((h, index) => (
                  <IonItem key={index}>
                    <IonLabel>
                      <h3>{h.title}</h3>
                      <p>{h.detail}</p>
                    </IonLabel>
                    <IonNote slot="end">{h.date}</IonNote>
                  </IonItem>
                ))}
              </IonList>
              {active && (
                <div className="ui-actions">
                  <IonButton expand="block" routerLink={paths.recordUseFor(item.id)}>
                    Verwendung erfassen
                  </IonButton>
                </div>
              )}
            </>
          )
        }}
      </Loaded>
    </Page>
  )
}
