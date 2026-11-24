import { IonChip, IonFab, IonFabButton, IonIcon, IonItem, IonLabel, IonList, IonListHeader } from '@ionic/react'
import { barcodeOutline } from 'ionicons/icons'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listCategories, listItems } from '../api/material'
import { dueStateLabel, type DueState } from '../components/DueStateBadge'
import ItemRow from '../components/ItemRow'
import Loaded from '../components/Loaded'
import { maxLeadDays } from '../components/notificationText'
import Page from '../components/Page'
import { paths } from '../routes'
import { addDays, today } from '../today'
import { useResource } from '../useResource'

const groups: DueState[] = ['overdue', 'dueToday', 'dueSoon']

const load = async () => {
  const [categories, items] = await Promise.all([listCategories(), listItems()])
  return { categories, items }
}

export default function DueListPage() {
  const [category, setCategory] = useState<string | null>(null)
  const resource = useResource(load)
  const navigate = useNavigate()
  // The filter lives in the URL, so a notification tap on the open list changes it too.
  const param = new URLSearchParams(useLocation().search).get('geraete')
  const only = param ? new Set(param.split(',').filter(Boolean)) : null
  return (
    <Page
      title="Fällig"
      fab={
        <IonFab slot="fixed" vertical="bottom" horizontal="end">
          <IonFabButton routerLink={paths.recordUse} title="Verwendung erfassen">
            <IonIcon icon={barcodeOutline} aria-hidden />
          </IonFabButton>
        </IonFab>
      }
    >
      <Loaded resource={resource}>
        {({ categories, items }) => {
          if (categories.length === 0) return <p className="ui-empty">Noch keine Kategorie freigegeben.</p>
          const visible = items.filter((i) => i.status !== 'retired' && (!category || i.categoryId === category) && (!only || only.has(i.id)))
          const categoryName = (id: string) => categories.find((c) => c.id === id)?.name
          // A reminder can come weeks before an item is "bald fällig". Such items show up only when the list
          // is filtered by a notification; later due dates, such as after a check, count as done.
          const horizon = addDays(today(), maxLeadDays)
          const upcoming = only ? visible.filter((i) => i.dueState === 'ok' && (i.dues[0]?.date ?? '9999') <= horizon) : []
          return (
            <>
              <div className="ui-chips">
                <IonChip outline={category !== null} onClick={() => setCategory(null)}>
                  Alle
                </IonChip>
                {categories.map((c) => (
                  <IonChip key={c.id} outline={category !== c.id} onClick={() => setCategory(c.id)}>
                    {c.name}
                  </IonChip>
                ))}
              </div>
              {only && (
                <div className="ui-chips">
                  <IonChip onClick={() => navigate(paths.dueList, { replace: true })}>Alle anzeigen</IonChip>
                </div>
              )}
              {only && upcoming.length === 0 && !visible.some((i) => groups.includes(i.dueState)) && (
                <p className="ui-empty">Alles aus dieser Benachrichtigung ist erledigt.</p>
              )}
              {groups.map((state) => {
                const inGroup = visible.filter((i) => i.dueState === state)
                if (inGroup.length === 0) return null
                return (
                  <section key={state} aria-label={dueStateLabel(state)} data-state={state}>
                    <IonList>
                      <IonListHeader>
                        <IonLabel>{dueStateLabel(state)}</IonLabel>
                      </IonListHeader>
                      {inGroup.map((i) => (
                        <ItemRow key={i.id} item={i} categoryName={categoryName(i.categoryId)} checkAction />
                      ))}
                    </IonList>
                  </section>
                )
              })}
              {upcoming.length > 0 && (
                <section aria-label="Demnächst" data-state="upcoming">
                  <IonList>
                    <IonListHeader>
                      <IonLabel>Demnächst</IonLabel>
                    </IonListHeader>
                    {upcoming.map((i) => (
                      <ItemRow key={i.id} item={i} categoryName={categoryName(i.categoryId)} checkAction />
                    ))}
                  </IonList>
                </section>
              )}
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
    </Page>
  )
}
