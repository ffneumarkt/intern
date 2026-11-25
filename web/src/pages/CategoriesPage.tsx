import { IonItem, IonLabel, IonList } from '@ionic/react'
import { Plus } from 'lucide-react'
import { listCategories } from '../api/material'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { ActionBar, BlockButton } from '../components/ui'
import { paths } from '../routes'
import { useSession } from '../session'
import { useResource } from '../useResource'

export default function CategoriesPage() {
  const { holds } = useSession()
  const resource = useResource(listCategories)
  return (
    <Page title="Kategorien" back={paths.admin}>
      {!holds('categories') ? (
        <p>Keine Berechtigung.</p>
      ) : (
        <Loaded resource={resource}>
          {(categories) => (
            <>
              <IonList>
                {categories.map((c) => (
                  <IonItem key={c.id} routerLink={paths.adminCategory(c.id)} detail>
                    <IonLabel>
                      {c.name}
                      {c.maxServiceLifeYears && <p>Lebensdauer {c.maxServiceLifeYears} Jahre</p>}
                    </IonLabel>
                  </IonItem>
                ))}
              </IonList>
              <ActionBar>
                <BlockButton routerLink={paths.adminCategoryNew}>
                  <Plus aria-hidden="true" />
                  Neue Kategorie
                </BlockButton>
              </ActionBar>
            </>
          )}
        </Loaded>
      )}
    </Page>
  )
}
