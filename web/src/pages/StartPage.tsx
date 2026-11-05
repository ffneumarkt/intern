import { IonButton, IonCard, IonIcon } from '@ionic/react'
import { chevronForward, constructOutline, documentTextOutline } from 'ionicons/icons'
import Page from '../components/Page'
import { paths } from '../routes'
import { useSession } from '../session'

function Tile({ to, icon, title, subtitle }: { to: string; icon: string; title: string; subtitle: string }) {
  return (
    <IonCard routerLink={to} button className="tile">
      <span className="tile-body">
        <span className="tile-icon">
          <IonIcon icon={icon} aria-hidden="true" />
        </span>
        <span className="tile-text">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </span>
        <IonIcon className="tile-chevron" icon={chevronForward} aria-hidden="true" />
      </span>
    </IonCard>
  )
}

export default function StartPage() {
  const { user } = useSession()
  return (
    <Page title="Start">
      <Tile to={paths.transportDocument} icon={documentTextOutline} title="Beförderungspapier" subtitle="Druckluftflaschen, funktioniert offline" />
      {user ? (
        <Tile to={paths.dueList} icon={constructOutline} title="Material" subtitle="Prüffristen und Verwendungen" />
      ) : (
        <section className="ui-card" aria-label="Anmeldung">
          <h2>Materialverwaltung</h2>
          <p className="ui-hint" style={{ margin: '6px 0 14px' }}>
            Prüffristen, Verwendungen und Erinnerungen für Geräte. Dafür bitte anmelden.
          </p>
          <IonButton expand="block" routerLink={paths.login}>
            Anmelden
          </IonButton>
        </section>
      )}
    </Page>
  )
}
