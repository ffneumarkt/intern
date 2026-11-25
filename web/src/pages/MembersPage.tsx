import { IonItem, IonLabel, IonList } from '@ionic/react'
import { Plus } from 'lucide-react'
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
              <IonList>
                {members.map((m) => (
                  <IonItem key={m.id} routerLink={paths.adminMember(m.id)} detail>
                    <IonLabel>
                      {m.name}
                      <p>{m.email}</p>
                    </IonLabel>
                    {m.deactivated && (
                      <span className="ui-pill" data-tone="muted" slot="end">
                        Deaktiviert
                      </span>
                    )}
                  </IonItem>
                ))}
              </IonList>
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
