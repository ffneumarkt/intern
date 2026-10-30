import { IonButton, IonList } from '@ionic/react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { listCategories, listItems } from '../api/material'
import ItemRow from '../components/ItemRow'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { paths } from '../routes'
import { useSession } from '../session'
import { useResource } from '../useResource'

const load = async () => {
  const [categories, items] = await Promise.all([listCategories(), listItems()])
  return { categories, items }
}

export default function CategoryPage() {
  const { categoryId = '' } = useParams()
  const { can } = useSession()
  const [showRetired, setShowRetired] = useState(false)
  const resource = useResource(load)
  const category = resource.data?.categories.find((c) => c.id === categoryId)
  return (
    <Page title={category?.name ?? 'Kategorie'} back={paths.dueList}>
      <Loaded resource={resource}>
        {({ items }) => (
          <>
            <IonButton fill="clear" size="small" onClick={() => setShowRetired((v) => !v)}>
              {showRetired ? 'Ausgeschiedene ausblenden' : 'Ausgeschiedene anzeigen'}
            </IonButton>
            {can(categoryId, 'manage') && (
              <IonButton fill="clear" size="small" routerLink={paths.manageCategory(categoryId)}>
                Verwalten
              </IonButton>
            )}
            <IonList>
              {items
                .filter((i) => i.categoryId === categoryId && (showRetired || i.status !== 'retired'))
                .map((i) => (
                  <ItemRow key={i.id} item={i} />
                ))}
            </IonList>
          </>
        )}
      </Loaded>
    </Page>
  )
}
