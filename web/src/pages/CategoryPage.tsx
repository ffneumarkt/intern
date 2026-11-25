import { IonList } from '@ionic/react'
import { AppButton } from '../components/ui'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { listCategories, listItems, listLocations } from '../api/material'
import ItemRow from '../components/ItemRow'
import LocationFilter from '../components/LocationFilter'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { inLocation, locationName } from '../material/locations'
import { paths } from '../routes'
import { useSession } from '../session'
import { useResource } from '../useResource'

const load = async () => {
  const [categories, items, locations] = await Promise.all([listCategories(), listItems(), listLocations()])
  return { categories, items, locations }
}

export default function CategoryPage() {
  const { categoryId = '' } = useParams()
  const { can } = useSession()
  const [showRetired, setShowRetired] = useState(false)
  const [location, setLocation] = useState<string | null>(null)
  const resource = useResource(load)
  const category = resource.data?.categories.find((c) => c.id === categoryId)
  return (
    <Page title={category?.name ?? 'Kategorie'} back={paths.dueList}>
      <Loaded resource={resource}>
        {({ items, locations }) => {
          const shown = inLocation(
            items.filter((i) => i.categoryId === categoryId && (showRetired || i.status !== 'retired')),
            location,
          )
          return (
            <>
              <div className="ui-actionrow">
                <AppButton fill="outline" size="small" onClick={() => setShowRetired((v) => !v)}>
                  {showRetired ? 'Ausgeschiedene ausblenden' : 'Ausgeschiedene anzeigen'}
                </AppButton>
                {can(categoryId, 'manage') && (
                  <AppButton fill="outline" size="small" routerLink={paths.manageCategory(categoryId)}>
                    Verwalten
                  </AppButton>
                )}
              </div>
              <LocationFilter locations={locations} value={location} onChange={setLocation} />
              {location !== null && shown.length === 0 && <p className="ui-empty">Nichts in diesem Standort.</p>}
              <IonList>
                {shown.map((i) => (
                  <ItemRow key={i.id} item={i} locationName={locationName(locations, i.locationId)} />
                ))}
              </IonList>
            </>
          )
        }}
      </Loaded>
    </Page>
  )
}
