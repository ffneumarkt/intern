import { IonChip, IonFab, IonFabButton, IonIcon, IonItem, IonLabel, IonList, IonListHeader } from '@ionic/react'
import { barcodeOutline } from 'ionicons/icons'
import { useState } from 'react'
import { listCategories, listItems } from '../api/material'
import { dueStateLabel, type DueState } from '../components/DueStateBadge'
import ItemRow from '../components/ItemRow'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { paths } from '../routes'
import { useResource } from '../useResource'

const groups: DueState[] = ['overdue', 'dueToday', 'dueSoon']

const load = async () => {
  const [categories, items] = await Promise.all([listCategories(), listItems()])
  return { categories, items }
}

export default function DueListPage() {
  const [category, setCategory] = useState<string | null>(null)
  const resource = useResource(load)
  return (
    <Page title="Fällig">
      <Loaded resource={resource}>
        {({ categories, items }) => {
          if (categories.length === 0) return <p>Noch keine Kategorie freigegeben.</p>
          const visible = items.filter((i) => i.status !== 'retired' && (!category || i.categoryId === category))
          const categoryName = (id: string) => categories.find((c) => c.id === id)?.name
          return (
            <>
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
                        <ItemRow key={i.id} item={i} categoryName={categoryName(i.categoryId)} />
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
            </>
          )
        }}
      </Loaded>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton routerLink={paths.recordUse} title="Verwendung erfassen">
          <IonIcon icon={barcodeOutline} aria-hidden />
        </IonFabButton>
      </IonFab>
    </Page>
  )
}
