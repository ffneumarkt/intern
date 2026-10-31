import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonSegment, IonSegmentButton, IonText } from '@ionic/react'
import { addOutline } from 'ionicons/icons'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckTypeInUseError, ItemPartlySavedError } from '../api/errors'
import {
  createCheckType,
  createItem,
  deleteCheckType,
  listCategories,
  listCheckTypes,
  listItems,
  updateCheckType,
  type CheckType,
  type Item,
  type ItemInput,
} from '../api/material'
import { CheckboxField, Field, SelectField } from '../components/Field'
import ItemForm from '../components/ItemForm'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { useDialogs } from '../components/useDialogs'
import { paths } from '../routes'
import { useSession } from '../session'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'

const load = async () => {
  const [categories, items, checkTypes] = await Promise.all([listCategories(), listItems(), listCheckTypes()])
  return { categories, items, checkTypes }
}

export default function ManagePage() {
  const { can } = useSession()
  const preset = new URLSearchParams(useLocation().search).get('kategorie')
  const [chosen, setChosen] = useState<string | null>(null)
  const [tab, setTab] = useState<'items' | 'checkTypes'>('items')
  const resource = useResource(load)
  return (
    <Page title="Verwalten" back={paths.dueList}>
      <Loaded resource={resource}>
        {({ categories, items, checkTypes }) => {
          const manageable = categories.filter((c) => can(c.id, 'manage'))
          if (manageable.length === 0) return <p>Keine Berechtigung.</p>
          const categoryId = [chosen, preset].find((id) => manageable.some((c) => c.id === id)) ?? manageable[0].id
          const types = checkTypes.filter((t) => t.categoryId === categoryId)
          return (
            <>
              <IonList>
                <SelectField label="Kategorie" value={categoryId} onChange={setChosen}>
                  {manageable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectField>
              </IonList>
              <IonSegment value={tab}>
                <IonSegmentButton value="items" onClick={() => setTab('items')}>
                  <IonLabel>Geräte</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="checkTypes" onClick={() => setTab('checkTypes')}>
                  <IonLabel>Prüfarten</IonLabel>
                </IonSegmentButton>
              </IonSegment>
              {tab === 'items' ? (
                <ItemsTab
                  key={categoryId}
                  categoryId={categoryId}
                  items={items.filter((i) => i.categoryId === categoryId)}
                  checkTypes={types}
                  onChange={resource.reload}
                />
              ) : (
                <CheckTypesTab key={categoryId} categoryId={categoryId} checkTypes={types} onChange={resource.reload} />
              )}
            </>
          )
        }}
      </Loaded>
    </Page>
  )
}

interface ItemsTabProps {
  categoryId: string
  items: Item[]
  checkTypes: CheckType[]
  onChange(): void
}

function ItemsTab({ categoryId, items, checkTypes, onChange }: ItemsTabProps) {
  const navigate = useNavigate()
  const [formKey, setFormKey] = useState(0)
  const [partlySaved, setPartlySaved] = useState(false)

  const save = async (input: Omit<ItemInput, 'categoryId'>, lastChecked: Record<string, string>) => {
    setPartlySaved(false)
    try {
      const id = await createItem({ ...input, categoryId }, lastChecked)
      setFormKey((key) => key + 1)
      navigate(paths.item(id))
    } catch (err) {
      if (!(err instanceof ItemPartlySavedError)) throw err
      // The item exists: a second attempt would fail on its barcode, so the form is cleared.
      setFormKey((key) => key + 1)
      setPartlySaved(true)
      onChange()
    }
  }

  return (
    <>
      <IonList>
        {items.map((i) => (
          <IonItem key={i.id} routerLink={paths.item(i.id)}>
            <IonLabel>{i.name}</IonLabel>
          </IonItem>
        ))}
      </IonList>
      <IonListHeader>
        <IonLabel>Neues Gerät</IonLabel>
      </IonListHeader>
      {partlySaved && <IonText color="warning">Gerät angelegt, aber nicht alle Prüfungen gespeichert.</IonText>}
      <ItemForm key={formKey} checkTypes={checkTypes} submitLabel="Gerät anlegen" onSave={save} />
    </>
  )
}

interface CheckTypesTabProps {
  categoryId: string
  checkTypes: CheckType[]
  onChange(): void
}

function CheckTypesTab({ categoryId, checkTypes, onChange }: CheckTypesTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = checkTypes.find((t) => t.id === editingId)

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

  const done = () => {
    setEditingId(null)
    onChange()
  }

  return (
    <>
      <IonList>
        {checkTypes.map((t) => (
          <IonItem key={t.id} button detail={false} onClick={() => setEditingId(t.id)}>
            <IonLabel>
              {t.name}
              <p>{describe(t)}</p>
            </IonLabel>
          </IonItem>
        ))}
      </IonList>
      <CheckTypeForm key={editingId ?? 'new'} categoryId={categoryId} checkType={editing} others={checkTypes} onDone={done} />
    </>
  )
}

interface CheckTypeFormProps {
  categoryId: string
  checkType?: CheckType
  others: CheckType[]
  onDone(): void
}

function CheckTypeForm({ categoryId, checkType, others, onDone }: CheckTypeFormProps) {
  const [name, setName] = useState(checkType?.name ?? '')
  const [months, setMonths] = useState(checkType?.intervalMonths ? String(checkType.intervalMonths) : '')
  const [afterUse, setAfterUse] = useState(checkType?.afterUse ?? false)
  const [isDefault, setIsDefault] = useState(checkType?.isDefault ?? false)
  const [alsoSatisfies, setAlsoSatisfies] = useState(checkType?.alsoSatisfies ?? [])
  const [error, setError] = useState<string | null>(null)
  const { busy, once } = useBusy()
  const { confirm } = useDialogs()

  const save = async () => {
    const intervalMonths = Number(months) || 0
    if (!intervalMonths && !afterUse) {
      setError('Intervall oder „nach Verwendung“ angeben.')
      return
    }
    setError(null)
    const input = { name, intervalMonths, afterUse, isDefault, alsoSatisfies }
    try {
      if (checkType) await updateCheckType(checkType.id, input)
      else await createCheckType({ ...input, categoryId })
      onDone()
    } catch {
      setError('Speichern fehlgeschlagen.')
    }
  }

  const remove = async (target: CheckType) => {
    if (!(await confirm({ message: `${target.name} löschen?`, confirmText: 'Löschen', destructive: true }))) return
    setError(null)
    try {
      await deleteCheckType(target.id)
      onDone()
    } catch (err) {
      setError(
        err instanceof CheckTypeInUseError
          ? 'Prüfart wird noch verwendet und kann nicht gelöscht werden.'
          : 'Löschen fehlgeschlagen.',
      )
    }
  }

  return (
    <>
      <IonList>
        <IonListHeader>
          <IonLabel>{checkType ? 'Prüfart bearbeiten' : 'Neue Prüfart'}</IonLabel>
        </IonListHeader>
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Intervall in Monaten" type="number" value={months} onChange={setMonths} />
        <CheckboxField label="nach Verwendung" checked={afterUse} onChange={setAfterUse} />
        <CheckboxField label="Standardprüfung" checked={isDefault} onChange={setIsDefault} />
        {others
          .filter((t) => t.id !== checkType?.id)
          .map((t) => (
            <CheckboxField
              key={t.id}
              label={`gilt auch als ${t.name}`}
              checked={alsoSatisfies.includes(t.id)}
              onChange={(checked) =>
                setAlsoSatisfies((ids) => (checked ? [...ids, t.id] : ids.filter((id) => id !== t.id)))
              }
            />
          ))}
      </IonList>
      {error && <IonText color="danger">{error}</IonText>}
      <IonButton expand="block" disabled={busy || !name.trim()} onClick={() => once(save)}>
        {!checkType && <IonIcon slot="start" icon={addOutline} aria-hidden />}
        {checkType ? 'Speichern' : 'Prüfart anlegen'}
      </IonButton>
      {checkType && (
        <IonButton expand="block" color="danger" fill="clear" onClick={() => remove(checkType)}>
          Prüfart löschen
        </IonButton>
      )}
    </>
  )
}
