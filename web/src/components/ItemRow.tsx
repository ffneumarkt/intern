import { IonItem, IonLabel, IonNote } from '@ionic/react'
import type { Item } from '../api/material'
import { paths } from '../routes'
import DueStateBadge from './DueStateBadge'

export default function ItemRow({ item, categoryName }: { item: Item; categoryName?: string }) {
  const next = item.dues.find((d) => d.state === item.dueState)
  return (
    <IonItem routerLink={paths.item(item.id)} detail>
      <IonLabel>
        <h2>{item.name}</h2>
        <p>
          {categoryName ? `${categoryName} · ` : ''}
          {item.status === 'retired' ? 'Ausgeschieden' : next ? `${next.label}: ${next.date}` : ''}
          {item.status === 'defective' ? ' · Mangel' : ''}
        </p>
      </IonLabel>
      {item.status === 'retired' ? <IonNote slot="end">Ausgeschieden</IonNote> : <DueStateBadge state={item.dueState} />}
    </IonItem>
  )
}
