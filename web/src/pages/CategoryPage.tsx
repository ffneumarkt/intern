import { IonButton, IonList } from '@ionic/react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import ItemRow from '../components/ItemRow'
import Page from '../components/Page'
import { paths } from '../routes'
import { categories, items } from '../sketch/mockData'

export default function CategoryPage() {
  const { categoryId } = useParams()
  const [showRetired, setShowRetired] = useState(false)
  const category = categories.find((c) => c.id === categoryId)
  const inCategory = items.filter((i) => i.categoryId === categoryId && (showRetired || i.status !== 'retired'))
  return (
    <Page title={category?.name ?? 'Kategorie'} back={paths.dueList}>
      <IonButton fill="clear" size="small" onClick={() => setShowRetired((v) => !v)}>
        {showRetired ? 'Ausgeschiedene ausblenden' : 'Ausgeschiedene anzeigen'}
      </IonButton>
      <IonList>
        {inCategory.map((i) => (
          <ItemRow key={i.id} item={i} />
        ))}
      </IonList>
    </Page>
  )
}
