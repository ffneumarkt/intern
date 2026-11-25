import { IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { listCorrections } from '../api/admin'
import { listHistory, listItems, listLocations, retireItem, type Item } from '../api/material'
import DueStateBadge from '../components/DueStateBadge'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { useDialogs } from '../components/useDialogs'
import { locationName } from '../material/locations'
import { paths } from '../routes'
import { useSession } from '../session'
import { useResource } from '../useResource'
import { ActionBar, AppButton, BlockButton, ErrorText } from '../components/ui'

const statusLabel = { active: 'Aktiv', defective: 'Mangel', retired: 'Ausgeschieden' }

export default function ItemPage() {
  const { itemId = '' } = useParams()
  const { can, holds } = useSession()
  const resource = useResource(async () => {
    const [items, history, locations, corrections] = await Promise.all([
      listItems(),
      listHistory(itemId),
      listLocations(),
      // Only holders of the corrections right can read them; a failure here must not hide the item.
      listCorrections(itemId).catch(() => []),
    ])
    return { item: items.find((i) => i.id === itemId), history, locations, corrections }
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
        {({ item, history, locations, corrections }) => {
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
                  <p>Standort: {locationName(locations, item.locationId) ?? '–'}</p>
                  <p>Status: {statusLabel[item.status]}</p>
                  {item.note && <p>Notiz: {item.note}</p>}
                </div>
              </section>
              {failed && <ErrorText>Speichern fehlgeschlagen.</ErrorText>}
              <div className="ui-actionrow">
                {can(item.categoryId, 'manage') && (
                  <AppButton fill="outline" routerLink={paths.itemEdit(item.id)}>
                    Bearbeiten
                  </AppButton>
                )}
                {active && can(item.categoryId, 'check') && (
                  <AppButton color="medium" fill="outline" onClick={() => retire(item)}>
                    Ausscheiden
                  </AppButton>
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
                  <IonItem key={index} routerLink={holds('corrections') ? paths.correction(item.id, h.kind, h.id) : undefined} detail={holds('corrections')}>
                    <IonLabel>
                      <h3>{h.title}</h3>
                      <p>{h.detail}</p>
                    </IonLabel>
                    <IonNote slot="end">{h.date}</IonNote>
                  </IonItem>
                ))}
              </IonList>
              {corrections.length > 0 && (
                <IonList>
                  <IonListHeader>
                    <IonLabel>Korrekturen</IonLabel>
                  </IonListHeader>
                  {corrections.map((c) => (
                    <IonItem key={c.id}>
                      <IonLabel>
                        Korrigiert von {c.adminName}
                        <p>{c.action === 'delete' ? 'Eintrag gelöscht' : 'Eintrag geändert'}</p>
                      </IonLabel>
                      <IonNote slot="end">{c.date}</IonNote>
                    </IonItem>
                  ))}
                </IonList>
              )}
              {active && (
                // The two main actions, one above the other and equally prominent; the check in its own green, the use in the red of the app.
                <ActionBar>
                  {can(item.categoryId, 'check') && (
                    <BlockButton color="check" routerLink={paths.recordCheck(item.id)}>
                      Prüfung erfassen
                    </BlockButton>
                  )}
                  <BlockButton routerLink={paths.recordUseFor(item.id)}>Verwendung erfassen</BlockButton>
                </ActionBar>
              )}
            </>
          )
        }}
      </Loaded>
    </Page>
  )
}
