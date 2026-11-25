import { Plus } from 'lucide-react'
import { List, Row, RowLabel } from '@/components/ui/list'
import { listMembers } from '../api/admin'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { ActionBar, BlockButton } from '../components/ui'
import { paths } from '../routes'
import { useSession } from '../session'
import { useResource } from '../useResource'

export default function MembersPage() {
  const { holds } = useSession()
  const resource = useResource(listMembers)
  return (
    <Page title="Mitglieder" back={paths.admin}>
      {!holds('members') ? (
        <p>Keine Berechtigung.</p>
      ) : (
        <Loaded resource={resource}>
          {(members) => (
            <>
              <List>
                {members.map((m) => (
                  <Row key={m.id} to={paths.adminMember(m.id)} detail>
                    <RowLabel>
                      {m.name}
                      <p>{m.email}</p>
                    </RowLabel>
                    {m.deactivated && (
                      <span className="ui-pill" data-tone="muted" slot="end">
                        Deaktiviert
                      </span>
                    )}
                  </Row>
                ))}
              </List>
              <ActionBar>
                <BlockButton routerLink={paths.adminMemberNew}>
                  <Plus aria-hidden="true" />
                  Neues Mitglied
                </BlockButton>
              </ActionBar>
            </>
          )}
        </Loaded>
      )}
    </Page>
  )
}
