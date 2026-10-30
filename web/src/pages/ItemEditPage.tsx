import { IonButton, IonText } from '@ionic/react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ItemHasHistoryError } from '../api/errors'
import { deleteItem, listHistory, listItems, updateItem, type Item } from '../api/material'
import ItemForm from '../components/ItemForm'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { paths } from '../routes'
import { useSession } from '../session'
import { useResource } from '../useResource'

const historyNotice = 'Gerät hat einen Verlauf und kann nicht gelöscht, nur ausgeschieden werden.'

export default function ItemEditPage() {
  const { itemId = '' } = useParams()
  const { can } = useSession()
  const navigate = useNavigate()
  const resource = useResource(async () => {
    const [items, history] = await Promise.all([listItems(), listHistory(itemId)])
    return { items, hasHistory: history.length > 0 }
  })
  const [error, setError] = useState<string | null>(null)

  const remove = async (item: Item) => {
    if (!window.confirm(`${item.name} löschen?`)) return
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
        {({ items, hasHistory }) => {
          const item = items.find((i) => i.id === itemId)
          if (!item || !can(item.categoryId, 'manage')) return <p>Keine Berechtigung.</p>
          return (
            <>
              <ItemForm
                key={JSON.stringify(item)}
                item={item}
                submitLabel="Speichern"
                onSave={async (input) => {
                  await updateItem(item.id, input)
                  navigate(paths.item(item.id))
                }}
              />
              {error && <IonText color="danger">{error}</IonText>}
              {hasHistory ? (
                !error && <p>{historyNotice}</p>
              ) : (
                <IonButton expand="block" color="danger" fill="clear" onClick={() => remove(item)}>
                  Gerät löschen
                </IonButton>
              )}
            </>
          )
        }}
      </Loaded>
    </Page>
  )
}
