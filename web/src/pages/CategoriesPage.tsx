import { Plus } from 'lucide-react'
import { List, Row, RowLabel } from '@/components/ui/list'
import { listCategories } from '../api/material'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { ActionBar, BlockButton } from '../components/ui'
import { paths } from '../routes'
import { useSession } from '../session'
import { useResource } from '../useResource'

export default function CategoriesPage() {
  const { holds } = useSession()
  const resource = useResource(listCategories)
  return (
    <Page title="Kategorien" back={paths.admin}>
      {!holds('categories') ? (
        <p>Keine Berechtigung.</p>
      ) : (
        <Loaded resource={resource}>
          {(categories) => (
            <>
              <List>
                {categories.map((c) => (
                  <Row key={c.id} to={paths.adminCategory(c.id)} detail>
                    <RowLabel>
                      {c.name}
                      {c.maxServiceLifeYears && <p>Lebensdauer {c.maxServiceLifeYears} Jahre</p>}
                    </RowLabel>
                  </Row>
                ))}
              </List>
              <ActionBar>
                <BlockButton routerLink={paths.adminCategoryNew}>
                  <Plus aria-hidden="true" />
                  Neue Kategorie
                </BlockButton>
              </ActionBar>
            </>
          )}
        </Loaded>
      )}
    </Page>
  )
}
