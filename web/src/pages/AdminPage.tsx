import { IonItem, IonLabel, IonList } from '@ionic/react'
import { FileText, FolderOpen, Users } from 'lucide-react'
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
        <IonList>
          {holds('members') && (
            <IonItem routerLink={paths.adminMembers} detail>
              <Users aria-hidden="true" />
              <IonLabel>
                Mitglieder
                <p>Konten, Berechtigungen und Einrichtungslinks</p>
              </IonLabel>
            </IonItem>
          )}
          {holds('categories') && (
            <IonItem routerLink={paths.adminCategories} detail>
              <FolderOpen aria-hidden="true" />
              <IonLabel>
                Kategorien
                <p>Anlegen, umbenennen, löschen</p>
              </IonLabel>
            </IonItem>
          )}
          {holds('transport') && (
            <IonItem routerLink={paths.adminTransport} detail>
              <FileText aria-hidden="true" />
              <IonLabel>
                Beförderungspapier
                <p>Station, Flasche, Abfüllstation, Checkliste</p>
              </IonLabel>
            </IonItem>
          )}
        </IonList>
      )}
      {holds('corrections') && <Hint>Korrekturen: im Verlauf eines Geräts auf einen Eintrag tippen.</Hint>}
    </Page>
  )
}
