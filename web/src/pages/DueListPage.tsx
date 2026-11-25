import { List, ListHeader, Row, RowLabel } from '@/components/ui/list'
import { ScanBarcode } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import { Segment, SegmentButton } from '@/components/ui/segment'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { listCategories, listItems, listLocations, type Item } from '../api/material'
import DueStateBadge, { dueStateLabel, type DueState } from '../components/DueStateBadge'
import ItemRow from '../components/ItemRow'
import Loaded from '../components/Loaded'
import { maxLeadDays } from '../components/notificationText'
import { locationName } from '../material/locations'
import { groupTimeline, monthsToReveal, type Entry } from '../material/timeline'
import Page from '../components/Page'
import { paths } from '../routes'
import { addDays, today } from '../today'
import { useResource } from '../useResource'
import { BlockButton, Card, Hint } from '../components/ui'

const groups: DueState[] = ['overdue', 'dueToday', 'dueSoon']

// How many months the timeline shows at first, and how many each press of „Mehr anzeigen“ adds.
const timelineMonths = 12

const load = async () => {
  const [categories, items, locations] = await Promise.all([listCategories(), listItems(), listLocations()])
  return { categories, items, locations }
}

export default function DueListPage() {
  const [category, setCategory] = useState<string | null>(null)
  const [view, setView] = useState<'due' | 'timeline'>('due')
  const [months, setMonths] = useState(timelineMonths)
  const resource = useResource(load)
  const navigate = useNavigate()
  // The filter lives in the URL, so a notification tap on the open list changes it too.
  const param = new URLSearchParams(useLocation().search).get('geraete')
  const only = param ? new Set(param.split(',').filter(Boolean)) : null
  return (
    <Page
      title="Fällig"
      fab={
        <Link to={paths.recordUse} className="app-fab" title="Verwendung erfassen" aria-label="Verwendung erfassen">
          <ScanBarcode aria-hidden="true" />
        </Link>
      }
    >
      <Loaded resource={resource}>
        {({ categories, items, locations }) => {
          if (categories.length === 0) return <p className="ui-empty">Noch keine Kategorie freigegeben.</p>
          const visible = items.filter((i) => i.status !== 'retired' && (!category || i.categoryId === category) && (!only || only.has(i.id)))
          const categoryName = (id: string) => categories.find((c) => c.id === id)?.name
          // A reminder can come weeks before an item is "bald fällig". Such items show up only when the list
          // is filtered by a notification; later due dates, such as after a check, count as done.
          const horizon = addDays(today(), maxLeadDays)
          const upcoming = only ? visible.filter((i) => i.dueState === 'ok' && (i.dues[0]?.date ?? '9999') <= horizon) : []
          // The timeline is of everything: the category chips and the category list belong to the due view.
          const timeline = !only && view === 'timeline'
          return (
            <>
              {!only && (
                <Segment value={view}>
                  <SegmentButton value="due" onClick={() => setView('due')}>
                    Fällig
                  </SegmentButton>
                  <SegmentButton value="timeline" onClick={() => setView('timeline')}>
                    Zeitplan
                  </SegmentButton>
                </Segment>
              )}
              {!timeline && (
                <div className="ui-chips">
                  <Chip outline={category !== null} onClick={() => setCategory(null)}>
                    Alle
                  </Chip>
                  {categories.map((c) => (
                    <Chip key={c.id} outline={category !== c.id} onClick={() => setCategory(c.id)}>
                      {c.name}
                    </Chip>
                  ))}
                </div>
              )}
              {only && (
                <div className="ui-chips">
                  <Chip onClick={() => navigate(paths.dueList, { replace: true })}>Alle anzeigen</Chip>
                </div>
              )}
              {only && upcoming.length === 0 && !visible.some((i) => groups.includes(i.dueState)) && (
                <p className="ui-empty">Alles aus dieser Benachrichtigung ist erledigt.</p>
              )}
              {timeline && <Timeline items={items} months={months} onMore={() => setMonths((m) => monthsToReveal(items, today(), m, timelineMonths))} />}
              {!only && view === 'due' && !visible.some((i) => groups.includes(i.dueState)) && (
                <Card>
                  <Hint center>
                    <strong>Nichts fällig.</strong>
                  </Hint>
                  <BlockButton size="large" routerLink={paths.recordUse}>
                    <ScanBarcode aria-hidden="true" />
                    Verwendung erfassen
                  </BlockButton>
                </Card>
              )}
              {view === 'due' && groups.map((state) => {
                const inGroup = visible.filter((i) => i.dueState === state)
                if (inGroup.length === 0) return null
                return (
                  <section key={state} aria-label={dueStateLabel(state)} data-state={state}>
                    <List>
                      <ListHeader>{dueStateLabel(state)}</ListHeader>
                      {inGroup.map((i) => (
                        <ItemRow key={i.id} item={i} categoryName={categoryName(i.categoryId)} locationName={locationName(locations, i.locationId)} checkAction />
                      ))}
                    </List>
                  </section>
                )
              })}
              {view === 'due' && upcoming.length > 0 && (
                <section aria-label="Demnächst" data-state="upcoming">
                  <List>
                    <ListHeader>Demnächst</ListHeader>
                    {upcoming.map((i) => (
                      <ItemRow key={i.id} item={i} categoryName={categoryName(i.categoryId)} locationName={locationName(locations, i.locationId)} checkAction />
                    ))}
                  </List>
                </section>
              )}
              {!timeline && (
                <List>
                  <ListHeader>Kategorien</ListHeader>
                  {categories.map((c) => (
                    <Row key={c.id} to={paths.category(c.id)} detail>
                      <RowLabel>{c.name}</RowLabel>
                    </Row>
                  ))}
                </List>
              )}
            </>
          )
        }}
      </Loaded>
    </Page>
  )
}

// All due dates of the shown items, what is overdue first and then month by month.
function Timeline({ items, months, onMore }: { items: Item[]; months: number; onMore(): void }) {
  const timeline = groupTimeline(items, today(), months)
  const section = (name: string, entries: Entry[]) => (
    <section key={name} aria-label={`Zeitplan: ${name}`}>
      <List>
        <ListHeader>{name}</ListHeader>
        {entries.map(({ item, due }) => (
          <Row key={`${item.id}-${due.kind}-${due.checkTypeId ?? ''}`} to={paths.item(item.id)} detail>
            <RowLabel>
              <h2>{item.name}</h2>
              <p>
                {due.label} · {due.date}
              </p>
            </RowLabel>
            <DueStateBadge state={due.state} />
          </Row>
        ))}
      </List>
    </section>
  )
  if (timeline.overdue.length === 0 && timeline.months.length === 0 && !timeline.hasMore) {
    return <p className="ui-empty">Keine Fälligkeiten.</p>
  }
  return (
    <>
      {timeline.overdue.length > 0 && section('Überfällig', timeline.overdue)}
      {timeline.months.map((m) => section(m.label, m.entries))}
      {timeline.hasMore && (
        <BlockButton fill="outline" onClick={onMore}>
          Mehr anzeigen
        </BlockButton>
      )}
    </>
  )
}
