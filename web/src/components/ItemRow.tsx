import { IonItem, IonLabel, IonNote } from '@ionic/react'
import { paths } from '../routes'
import { categories, type Item } from '../sketch/mockData'
import DueStateBadge from './DueStateBadge'

export default function ItemRow({ item, showCategory }: { item: Item; showCategory?: boolean }) {
  const next = item.dues.find((d) => d.state === item.dueState)
  const category = categories.find((c) => c.id === item.categoryId)
  return (
    <IonItem routerLink={paths.item(item.id)} detail>
      <IonLabel>
        <h2>{item.name}</h2>
        <p>
          {showCategory && category ? `${category.name} · ` : ''}
          {item.status === 'retired' ? 'Ausgeschieden' : next ? `${next.label}: ${next.date}` : ''}
          {item.status === 'defective' ? ' · Mangel' : ''}
        </p>
      </IonLabel>
      {item.status === 'retired' ? <IonNote slot="end">Ausgeschieden</IonNote> : <DueStateBadge state={item.dueState} />}
    </IonItem>
  )
}
