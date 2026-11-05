export type DueState = 'overdue' | 'dueToday' | 'dueSoon' | 'ok'

const states: Record<DueState, { label: string; tone: 'danger' | 'warn' | 'ok' }> = {
  overdue: { label: 'Überfällig', tone: 'danger' },
  dueToday: { label: 'Heute fällig', tone: 'warn' },
  dueSoon: { label: 'Bald fällig', tone: 'warn' },
  ok: { label: 'OK', tone: 'ok' },
}

export const dueStateLabel = (state: DueState) => states[state].label

export default function DueStateBadge({ state }: { state: DueState }) {
  const { label, tone } = states[state]
  return (
    <span className="ui-pill" data-tone={tone} slot="end">
      {label}
    </span>
  )
}
