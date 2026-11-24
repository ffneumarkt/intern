import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ItemHasHistoryError } from '../api/errors'
import { deleteItem, listHistory, listItems, listLocations, updateItem, type Item } from '../api/material'
import ItemForm from '../components/ItemForm'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { useDialogs } from '../components/useDialogs'
import { paths } from '../routes'
import { useSession } from '../session'
import { useResource } from '../useResource'
import { BlockButton, ErrorText } from '../components/ui'

const historyNotice = 'Gerät hat einen Verlauf und kann nicht gelöscht, nur ausgeschieden werden.'

export default function ItemEditPage() {
  const { itemId = '' } = useParams()
  const { can } = useSession()
  const navigate = useNavigate()
  const resource = useResource(async () => {
    const [items, history, locations] = await Promise.all([listItems(), listHistory(itemId), listLocations()])
    return { items, locations, hasHistory: history.length > 0 }
  })
  const [error, setError] = useState<string | null>(null)
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
    <Page title="Gerät bearbeiten" back={paths.item(itemId)}>
      <Loaded resource={resource}>
        {({ items, locations, hasHistory }) => {
          const item = items.find((i) => i.id === itemId)
          if (!item || !can(item.categoryId, 'manage')) return <p>Keine Berechtigung.</p>
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
