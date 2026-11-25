import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { listCheckTypes } from '../api/material'
import CheckTypeForm from '../components/CheckTypeForm'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { paths } from '../routes'
import { useSession } from '../session'
import { useResource } from '../useResource'

// One page for a new check type (no id, the category in the address) and for an existing one.
export default function CheckTypeEditPage() {
  const { checkTypeId } = useParams()
  const presetCategory = new URLSearchParams(useLocation().search).get('kategorie')
  const { can } = useSession()
  const navigate = useNavigate()
  const resource = useResource(listCheckTypes)
  return (
    <Page title={checkTypeId ? 'Prüfart bearbeiten' : 'Neue Prüfart'} back={paths.manageCategory(presetCategory ?? '', 'checkTypes')}>
      <Loaded resource={resource}>
        {(checkTypes) => {
          const checkType = checkTypes.find((t) => t.id === checkTypeId)
          const categoryId = checkType?.categoryId ?? presetCategory ?? ''
          if ((checkTypeId && !checkType) || !categoryId || !can(categoryId, 'manage')) return <p>Keine Berechtigung.</p>
          return (
            <CheckTypeForm
              key={checkType?.id ?? 'new'}
              categoryId={categoryId}
              checkType={checkType}
              others={checkTypes.filter((t) => t.categoryId === categoryId)}
              onDone={() => navigate(paths.manageCategory(categoryId, 'checkTypes'))}
            />
          )
        }}
      </Loaded>
    </Page>
  )
}
