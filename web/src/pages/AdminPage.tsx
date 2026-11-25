import { FileText, FolderOpen, Users } from 'lucide-react'
import { List, Row, RowLabel } from '@/components/ui/list'
import Page from '../components/Page'
import { Hint } from '../components/ui'
import { paths } from '../routes'
import { useSession } from '../session'

// What an admin may do, one row per area the user holds.
export default function AdminPage() {
  const { areas, holds } = useSession()
  return (
    <Page title="Verwaltung" back={paths.settings}>
      {areas.length === 0 ? (
        <p>Keine Berechtigung.</p>
      ) : (
        <List>
          {holds('members') && (
            <Row to={paths.adminMembers} detail>
              <Users aria-hidden="true" />
              <RowLabel>
                Mitglieder
                <p>Konten, Berechtigungen und Einrichtungslinks</p>
              </RowLabel>
            </Row>
          )}
          {holds('categories') && (
            <Row to={paths.adminCategories} detail>
              <FolderOpen aria-hidden="true" />
              <RowLabel>
                Kategorien
                <p>Anlegen, umbenennen, löschen</p>
              </RowLabel>
            </Row>
          )}
          {holds('transport') && (
            <Row to={paths.adminTransport} detail>
              <FileText aria-hidden="true" />
              <RowLabel>
                Beförderungspapier
                <p>Station, Flasche, Abfüllstation, Checkliste</p>
              </RowLabel>
            </Row>
          )}
        </List>
      )}
      {holds('corrections') && <Hint>Korrekturen: im Verlauf eines Geräts auf einen Eintrag tippen.</Hint>}
    </Page>
  )
}
