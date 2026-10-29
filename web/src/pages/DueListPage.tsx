import { IonChip, IonFab, IonFabButton, IonIcon, IonItem, IonLabel, IonList, IonListHeader } from '@ionic/react'
import { barcodeOutline } from 'ionicons/icons'
import { useState } from 'react'
import { dueStateLabel, type DueState } from '../components/DueStateBadge'
import ItemRow from '../components/ItemRow'
import Page from '../components/Page'
import { paths } from '../routes'
import { categories, items } from '../sketch/mockData'

const groups: DueState[] = ['overdue', 'dueToday', 'dueSoon']

export default function DueListPage() {
  const [category, setCategory] = useState<string | null>(null)
  const visible = items.filter((i) => i.status !== 'retired' && (!category || i.categoryId === category))
  return (
    <Page title="Fällig">
      <div>
        <IonChip outline={category !== null} onClick={() => setCategory(null)}>
          Alle
        </IonChip>
        {categories.map((c) => (
          <IonChip key={c.id} outline={category !== c.id} onClick={() => setCategory(c.id)}>
            {c.name}
          </IonChip>
        ))}
      </div>
      {groups.map((state) => {
        const inGroup = visible.filter((i) => i.dueState === state)
        if (inGroup.length === 0) return null
        return (
          <section key={state} aria-label={dueStateLabel(state)}>
            <IonList>
              <IonListHeader>
                <IonLabel>{dueStateLabel(state)}</IonLabel>
              </IonListHeader>
              {inGroup.map((i) => (
                <ItemRow key={i.id} item={i} showCategory />
              ))}
            </IonList>
          </section>
        )
      })}
      <IonList>
        <IonListHeader>
          <IonLabel>Kategorien</IonLabel>
        </IonListHeader>
        {categories.map((c) => (
          <IonItem key={c.id} routerLink={paths.category(c.id)} detail>
            <IonLabel>{c.name}</IonLabel>
          </IonItem>
        ))}
      </IonList>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton routerLink={paths.recordUse} title="Verwendung erfassen">
          <IonIcon icon={barcodeOutline} aria-hidden />
        </IonFabButton>
      </IonFab>
    </Page>
  )
}
