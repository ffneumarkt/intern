import { IonButton, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonSegment, IonSegmentButton } from '@ionic/react'
import { addOutline } from 'ionicons/icons'
import { useState } from 'react'
import Page from '../components/Page'
import { paths } from '../routes'
import { categories, checkTypes, items } from '../sketch/mockData'

export default function ManagePage() {
  const [tab, setTab] = useState<'items' | 'checkTypes'>('items')
  return (
    <Page title="Verwalten" back={paths.dueList}>
      <IonSegment value={tab}>
        <IonSegmentButton value="items" onClick={() => setTab('items')}>
          <IonLabel>Geräte</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="checkTypes" onClick={() => setTab('checkTypes')}>
          <IonLabel>Prüfarten</IonLabel>
        </IonSegmentButton>
      </IonSegment>
      {tab === 'items' ? (
        <>
          <IonList>
            {items.map((i) => (
              <IonItem key={i.id} routerLink={paths.item(i.id)}>
                <IonLabel>
                  {i.name}
                  <p>{categories.find((c) => c.id === i.categoryId)?.name}</p>
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
          <IonList>
            <IonListHeader>
              <IonLabel>Neues Gerät</IonLabel>
            </IonListHeader>
            <IonItem>
              <IonInput label="Bezeichnung" labelPlacement="stacked" />
            </IonItem>
            <IonItem>
              <IonInput label="Seriennummer" labelPlacement="stacked" />
            </IonItem>
            <IonItem>
              <IonInput label="Code" labelPlacement="stacked" />
            </IonItem>
            <IonItem>
              <IonInput label="Hergestellt am" labelPlacement="stacked" type="date" />
            </IonItem>
            {checkTypes
              .filter((t) => t.categoryId === 'masken')
              .map((t) => (
                <IonItem key={t.id}>
                  <IonInput label={`Zuletzt geprüft am (${t.name})`} labelPlacement="stacked" type="date" />
                </IonItem>
              ))}
          </IonList>
          <IonButton expand="block">
            <IonIcon slot="start" icon={addOutline} aria-hidden />
            Gerät anlegen
          </IonButton>
        </>
      ) : (
        <>
          <IonList>
            {checkTypes.map((t) => (
              <IonItem key={t.id}>
                <IonLabel>
                  {t.name}
                  <p>
                    {[
                      t.intervalMonths && `alle ${t.intervalMonths} Monate`,
                      t.afterUse && 'nach Verwendung',
                      t.alsoSatisfies.length > 0 &&
                        `gilt auch als ${t.alsoSatisfies.map((id) => checkTypes.find((c) => c.id === id)?.name).join(', ')}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
          <IonButton expand="block">
            <IonIcon slot="start" icon={addOutline} aria-hidden />
            Prüfart anlegen
          </IonButton>
        </>
      )}
    </Page>
  )
}
