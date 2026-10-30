import { IonButton, IonText } from '@ionic/react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteItem, listItems, updateItem, type Item } from '../api/material'
import ItemForm from '../components/ItemForm'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { paths } from '../routes'
import { useSession } from '../session'
import { useResource } from '../useResource'

export default function ItemEditPage() {
  const { itemId = '' } = useParams()
  const { can } = useSession()
  const navigate = useNavigate()
  const resource = useResource(listItems)
  const [failed, setFailed] = useState(false)

  const remove = async (item: Item) => {
    if (!window.confirm(`${item.name} löschen?`)) return
    setFailed(false)
    try {
      await deleteItem(item.id)
      navigate(paths.category(item.categoryId))
    } catch {
      setFailed(true)
    }
  }

  return (
    <Page title="Gerät bearbeiten" back={paths.item(itemId)}>
      <Loaded resource={resource}>
        {(items) => {
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
              {failed && <IonText color="danger">Löschen fehlgeschlagen.</IonText>}
              <IonButton expand="block" color="danger" fill="clear" onClick={() => remove(item)}>
                Gerät löschen
              </IonButton>
            </>
          )
        }}
      </Loaded>
    </Page>
  )
}
