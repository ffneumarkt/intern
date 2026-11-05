import { IonItem, IonLabel } from '@ionic/react'
import type { Item } from '../api/material'
import { paths } from '../routes'
import DueStateBadge from './DueStateBadge'

export default function ItemRow({ item, categoryName }: { item: Item; categoryName?: string }) {
  const next = item.dues.find((d) => d.state === item.dueState)
  const retired = item.status === 'retired'
  return (
    <IonItem routerLink={paths.item(item.id)} detail className="item-row" data-state={retired ? 'retired' : item.dueState}>
      <IonLabel>
        <h2>{item.name}</h2>
        <p>
          {categoryName ? `${categoryName} · ` : ''}
          {retired ? 'Ausgeschieden' : next ? `${next.label}: ${next.date}` : ''}
          {item.status === 'defective' ? ' · Mangel' : ''}
        </p>
      </IonLabel>
      {retired ? (
        <span className="ui-pill" data-tone="muted" slot="end">
          Ausgeschieden
        </span>
      ) : (
        <DueStateBadge state={item.dueState} />
      )}
    </IonItem>
  )
}
