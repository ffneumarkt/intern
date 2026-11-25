import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ItemHasHistoryError, ItemPartlySavedError } from '../api/errors'
import { createItem, deleteItem, listCheckTypes, listHistory, listItems, listLocations, updateItem, type Item, type ItemInput } from '../api/material'
import ItemForm from '../components/ItemForm'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { useDialogs } from '../components/useDialogs'
import { paths } from '../routes'
import { useSession } from '../session'
import { useResource } from '../useResource'
import { BlockButton, ErrorText, Hint, NoAccess } from '../components/ui'

const historyNotice = 'Gerät hat einen Verlauf und kann nicht gelöscht, nur ausgeschieden werden.'

// One page for a new item (no id, the category in the address) and for an existing one.
export default function ItemEditPage() {
  const { itemId = '' } = useParams()
  const presetCategory = new URLSearchParams(useLocation().search).get('kategorie') ?? ''
  const { can } = useSession()
  const navigate = useNavigate()
  const resource = useResource(async () => {
    const [items, history, locations, checkTypes] = await Promise.all([
      listItems(),
      itemId ? listHistory(itemId) : Promise.resolve([]),
      listLocations(),
      listCheckTypes(),
    ])
    return { items, locations, checkTypes, hasHistory: history.length > 0 }
  })
  const [error, setError] = useState<string | null>(null)
  // A new item was saved but not all of its first checks; the form starts over so a retry cannot duplicate it.
  const [partlySaved, setPartlySaved] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const { confirm } = useDialogs()

  const remove = async (item: Item) => {
    if (!(await confirm({ message: `${item.name} löschen?`, confirmText: 'Löschen', destructive: true }))) return
    setError(null)
    try {
      await deleteItem(item.id)
      navigate(paths.category(item.categoryId))
    } catch (err) {
      setError(err instanceof ItemHasHistoryError ? historyNotice : 'Löschen fehlgeschlagen.')
    }
  }

  return (
    <Page
      title={itemId ? 'Gerät bearbeiten' : 'Neues Gerät'}
      back={itemId ? paths.item(itemId) : paths.manageCategory(presetCategory)}
    >
      <Loaded resource={resource}>
        {({ items, locations, checkTypes, hasHistory }) => {
          const item = items.find((i) => i.id === itemId)
          if (!itemId) {
            if (!presetCategory) return <NoAccess>Keine Kategorie gewählt.</NoAccess>
            if (!can(presetCategory, 'manage')) return <NoAccess />
            const save = async (input: Omit<ItemInput, 'categoryId'>, lastChecked: Record<string, string>) => {
              setPartlySaved(false)
              try {
                const id = await createItem({ ...input, categoryId: presetCategory }, lastChecked)
                setFormKey((key) => key + 1)
                navigate(paths.item(id))
              } catch (err) {
                if (!(err instanceof ItemPartlySavedError)) throw err
                setFormKey((key) => key + 1)
                setPartlySaved(true)
              }
            }
            return (
              <>
                {partlySaved && <Hint>Gerät angelegt, aber nicht alle Prüfungen gespeichert.</Hint>}
                <ItemForm
                  key={formKey}
                  locations={locations}
                  checkTypes={checkTypes.filter((t) => t.categoryId === presetCategory)}
                  submitLabel="Gerät anlegen"
                  onSave={save}
                />
              </>
            )
          }
          if (!item || !can(item.categoryId, 'manage')) return <NoAccess />
          return (
            <>
              <ItemForm
                key={JSON.stringify(item)}
                item={item}
                locations={locations}
                submitLabel="Speichern"
                onSave={async (input) => {
                  await updateItem(item.id, input)
                  navigate(paths.item(item.id))
                }}
              />
              {error && <ErrorText>{error}</ErrorText>}
              {hasHistory ? (
                !error && <p>{historyNotice}</p>
              ) : (
                <BlockButton color="danger" fill="clear" onClick={() => remove(item)}>
                  Gerät löschen
                </BlockButton>
              )}
            </>
          )
        }}
      </Loaded>
    </Page>
  )
}
