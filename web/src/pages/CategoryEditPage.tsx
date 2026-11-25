import { useState } from 'react'
import { List } from '@/components/ui/list'
import { useNavigate, useParams } from 'react-router-dom'
import { createCategory, deleteCategory, updateCategory } from '../api/admin'
import { AdminRefusedError } from '../api/errors'
import { listCategories, type Category } from '../api/material'
import { Field } from '../components/Field'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { requiredMessage, showFirstInvalid } from '../components/required'
import { useDialogs } from '../components/useDialogs'
import { ActionBar, BlockButton, ErrorText } from '../components/ui'
import { paths } from '../routes'
import { useSession } from '../session'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'

// One page for a new category (no id) and for an existing one.
export default function CategoryEditPage() {
  const { categoryId } = useParams()
  const { holds } = useSession()
  const resource = useResource(listCategories)
  return (
    <Page title={categoryId ? 'Kategorie bearbeiten' : 'Neue Kategorie'} back={paths.adminCategories}>
      {!holds('categories') ? (
        <p>Keine Berechtigung.</p>
      ) : (
        <Loaded resource={resource}>
          {(categories) => {
            const category = categories.find((c) => c.id === categoryId)
            if (categoryId && !category) return <p>Kategorie nicht gefunden.</p>
            return <CategoryForm key={category?.id ?? 'new'} category={category} />
          }}
        </Loaded>
      )}
    </Page>
  )
}

function CategoryForm({ category }: { category?: Category }) {
  const navigate = useNavigate()
  const { confirm } = useDialogs()
  const [name, setName] = useState(category?.name ?? '')
  const [years, setYears] = useState(category?.maxServiceLifeYears ? String(category.maxServiceLifeYears) : '')
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { busy, once } = useBusy()

  const save = () =>
    once(async () => {
      if (!name.trim()) {
        setTried(true)
        showFirstInvalid()
        return
      }
      setError(null)
      const input = { name: name.trim(), maxServiceLifeYears: Number(years) || undefined }
      try {
        if (category) await updateCategory(category.id, input)
        else await createCategory(input)
        navigate(paths.adminCategories)
      } catch {
        setError('Speichern fehlgeschlagen.')
      }
    })

  const remove = async () => {
    if (!category || !(await confirm({ message: `${category.name} löschen?`, confirmText: 'Löschen', destructive: true }))) return
    setError(null)
    try {
      await deleteCategory(category.id)
      navigate(paths.adminCategories)
    } catch (err) {
      setError(err instanceof AdminRefusedError ? 'Kategorie hat noch Geräte und kann nicht gelöscht werden.' : 'Löschen fehlgeschlagen.')
    }
  }

  return (
    <>
      <List>
        <Field label="Name" value={name} onChange={setName} required error={tried && !name.trim() ? requiredMessage : undefined} />
        <Field label="Höchste Lebensdauer in Jahren" type="number" inputMode="numeric" value={years} onChange={setYears} />
      </List>
      <ErrorText>{error}</ErrorText>
      <ActionBar>
        <BlockButton disabled={busy} onClick={save}>
          {category ? 'Speichern' : 'Kategorie anlegen'}
        </BlockButton>
        {category && (
          <BlockButton color="danger" fill="clear" onClick={remove}>
            Kategorie löschen
          </BlockButton>
        )}
      </ActionBar>
    </>
  )
}
