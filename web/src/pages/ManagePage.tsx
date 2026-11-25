import { IonItem, IonLabel, IonList, IonListHeader } from '@ionic/react'
import { Plus } from 'lucide-react'
import { Segment, SegmentButton } from '@/components/ui/segment'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LocationInUseError, LocationNameTakenError } from '../api/errors'
import {
  createLocation,
  deleteLocation,
  listCategories,
  listCheckTypes,
  listItems,
  listLocations,
  updateLocation,
  type CheckType,
  type Item,
  type Location,
} from '../api/material'
import { Field, SelectField } from '../components/Field'
import { showFirstInvalid, requiredMessage } from '../components/required'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { useDialogs } from '../components/useDialogs'
import { manageTabParam, paths, type ManageTab } from '../routes'
import { useSession } from '../session'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'
import { ActionBar, BlockButton, ErrorText } from '../components/ui'

const load = async () => {
  const [categories, items, checkTypes, locations] = await Promise.all([listCategories(), listItems(), listCheckTypes(), listLocations()])
  return { categories, items, checkTypes, locations }
}

export default function ManagePage() {
  const { can } = useSession()
  const navigate = useNavigate()
  // Category and tab live in the address, so coming back from an edit page lands on the same list.
  const query = new URLSearchParams(useLocation().search)
  const preset = query.get('kategorie')
  const tab = (Object.keys(manageTabParam) as ManageTab[]).find((t) => manageTabParam[t] === query.get('tab')) ?? 'items'
  const resource = useResource(load)
  return (
    <Page title="Verwalten" back={paths.dueList}>
      <Loaded resource={resource}>
        {({ categories, items, checkTypes, locations }) => {
          const manageable = categories.filter((c) => can(c.id, 'manage'))
          if (manageable.length === 0) return <p>Keine Berechtigung.</p>
          const categoryId = manageable.find((c) => c.id === preset)?.id ?? manageable[0].id
          const types = checkTypes.filter((t) => t.categoryId === categoryId)
          const show = (category: string, next: ManageTab) => navigate(paths.manageCategory(category, next), { replace: true })
          return (
            <>
              {/* The locations belong to no category. */}
              {tab !== 'locations' && (
                <IonList>
                  <SelectField label="Kategorie" value={categoryId} onChange={(id) => show(id, tab)}>
                    {manageable.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectField>
                </IonList>
              )}
              <Segment value={tab}>
                <SegmentButton value="items" onClick={() => show(categoryId, 'items')}>
                  Geräte
                </SegmentButton>
                <SegmentButton value="checkTypes" onClick={() => show(categoryId, 'checkTypes')}>
                  Prüfarten
                </SegmentButton>
                <SegmentButton value="locations" onClick={() => show(categoryId, 'locations')}>
                  Standorte
                </SegmentButton>
              </Segment>
              {tab === 'items' ? (
                <ItemsTab categoryId={categoryId} items={items.filter((i) => i.categoryId === categoryId)} />
              ) : tab === 'checkTypes' ? (
                <CheckTypesTab categoryId={categoryId} checkTypes={types} />
              ) : (
                <LocationsTab locations={locations} onChange={resource.reload} />
              )}
            </>
          )
        }}
      </Loaded>
    </Page>
  )
}

// A list; a click opens the edit page, the button the page for a new entry.
function ItemsTab({ categoryId, items }: { categoryId: string; items: Item[] }) {
  return (
    <>
      <IonList>
        {items.map((i) => (
          <IonItem key={i.id} routerLink={paths.itemEdit(i.id)}>
            <IonLabel>{i.name}</IonLabel>
          </IonItem>
        ))}
      </IonList>
      <ActionBar>
        <BlockButton routerLink={paths.itemNew(categoryId)}>
          <Plus aria-hidden="true" />
          Neues Gerät
        </BlockButton>
      </ActionBar>
    </>
  )
}

function CheckTypesTab({ categoryId, checkTypes }: { categoryId: string; checkTypes: CheckType[] }) {
  const describe = (t: CheckType) =>
    [
      t.isDefault && 'Standard',
      t.intervalMonths && `alle ${t.intervalMonths} Monate`,
      t.afterUse && 'nach Verwendung',
      t.alsoSatisfies.length > 0 &&
        `gilt auch als ${t.alsoSatisfies.map((id) => checkTypes.find((c) => c.id === id)?.name).join(', ')}`,
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <>
      <IonList>
        {checkTypes.map((t) => (
          <IonItem key={t.id} routerLink={paths.checkTypeEdit(t.id)} detail={false}>
            <IonLabel>
              {t.name}
              <p>{describe(t)}</p>
            </IonLabel>
          </IonItem>
        ))}
      </IonList>
      <ActionBar>
        <BlockButton routerLink={paths.checkTypeNew(categoryId)}>
          <Plus aria-hidden="true" />
          Neue Prüfart
        </BlockButton>
      </ActionBar>
    </>
  )
}

function LocationsTab({ locations, onChange }: { locations: Location[]; onChange(): void }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = locations.find((l) => l.id === editingId)

  const done = () => {
    setEditingId(null)
    onChange()
  }

  return (
    <>
      <IonList>
        {locations.map((l) => (
          <IonItem key={l.id} button detail={false} onClick={() => setEditingId(l.id)}>
            <IonLabel>
              {l.name}
              {l.isDefault && <p>Standard</p>}
            </IonLabel>
          </IonItem>
        ))}
      </IonList>
      <LocationForm key={editingId ?? 'new'} location={editing} onDone={done} />
    </>
  )
}

function LocationForm({ location, onDone }: { location?: Location; onDone(): void }) {
  const [name, setName] = useState(location?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const { busy, once } = useBusy()
  const { confirm } = useDialogs()

  const save = async () => {
    if (!name.trim()) {
      setTried(true)
      showFirstInvalid()
      return
    }
    setError(null)
    try {
      if (location) await updateLocation(location.id, name.trim())
      else await createLocation(name.trim())
      onDone()
    } catch (err) {
      setError(err instanceof LocationNameTakenError ? 'Name ist bereits vergeben.' : 'Speichern fehlgeschlagen.')
    }
  }

  const remove = async (target: Location) => {
    if (!(await confirm({ message: `${target.name} löschen?`, confirmText: 'Löschen', destructive: true }))) return
    setError(null)
    try {
      await deleteLocation(target.id)
      onDone()
    } catch (err) {
      setError(
        err instanceof LocationInUseError
          ? 'Standort wird noch verwendet und kann nicht gelöscht werden.'
          : 'Löschen fehlgeschlagen.',
      )
    }
  }

  return (
    <>
      <IonList>
        <IonListHeader>
          <IonLabel>{location ? 'Standort bearbeiten' : 'Neuer Standort'}</IonLabel>
        </IonListHeader>
        <Field label="Name" value={name} onChange={setName} required error={tried && !name.trim() ? requiredMessage : undefined} />
      </IonList>
      <ErrorText>{error}</ErrorText>
      <ActionBar>
        <BlockButton disabled={busy} onClick={() => once(save)}>
          {!location && <Plus aria-hidden="true" />}
          {location ? 'Speichern' : 'Standort anlegen'}
        </BlockButton>
        {location && !location.isDefault && (
          <BlockButton color="danger" fill="clear" onClick={() => remove(location)}>
            Standort löschen
          </BlockButton>
        )}
      </ActionBar>
    </>
  )
}
