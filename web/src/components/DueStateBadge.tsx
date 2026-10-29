import { IonBadge } from '@ionic/react'

export type DueState = 'overdue' | 'dueToday' | 'dueSoon' | 'ok'

const badge: Record<DueState, { label: string; color: string }> = {
  overdue: { label: 'Überfällig', color: 'danger' },
  dueToday: { label: 'Heute fällig', color: 'warning' },
  dueSoon: { label: 'Bald fällig', color: 'warning' },
  ok: { label: 'OK', color: 'success' },
}

export const dueStateLabel = (state: DueState) => badge[state].label

export default function DueStateBadge({ state }: { state: DueState }) {
  const { label, color } = badge[state]
  return (
    <IonBadge color={color} className={state === 'dueSoon' ? 'badge-outline' : undefined}>
      {label}
    </IonBadge>
  )
}
