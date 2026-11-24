import { IonButton, IonItem, IonLabel } from '@ionic/react'
import { useNavigate } from 'react-router-dom'
import type { Item } from '../api/material'
import { paths } from '../routes'
import { useSession } from '../session'
import DueStateBadge from './DueStateBadge'

// `checkAction` adds a „Prüfen“ button that opens the check form of the item directly, for those who may check it.
export default function ItemRow({ item, categoryName, checkAction }: { item: Item; categoryName?: string; checkAction?: boolean }) {
  const { can } = useSession()
  const navigate = useNavigate()
  const next = item.dues.find((d) => d.state === item.dueState)
  const retired = item.status === 'retired'
  const canCheck = checkAction && !retired && can(item.categoryId, 'check')
  return (
    <IonItem routerLink={paths.item(item.id)} detail className="item-row" data-state={retired ? 'retired' : item.dueState}>
      <IonLabel>
        <h2>{item.name}</h2>
        <p>
          {categoryName ? `${categoryName} · ` : ''}
          {retired ? 'Ausgeschieden' : next ? `${next.label}: ${next.date}` : ''}
          {item.status === 'defective' ? ' · Mangel' : ''}
        </p>
        {canCheck && (
          <IonButton
            size="small"
            fill="outline"
            className="item-row-check"
            onClick={(e) => {
              // The rest of the row opens the item page; this button must not.
              e.preventDefault()
              e.stopPropagation()
              navigate(paths.recordCheckFromList(item.id))
            }}
          >
            Prüfen
          </IonButton>
        )}
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
