import { IonCard } from '@ionic/react'
import { ChevronRight, FileText, Wrench, type LucideIcon } from 'lucide-react'
import Page from '../components/Page'
import { paths } from '../routes'
import { useSession } from '../session'
import { BlockButton, Hint } from '../components/ui'

function Tile({ to, icon: Icon, title, subtitle }: { to: string; icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <IonCard routerLink={to} button className="tile">
      <span className="tile-body">
        <span className="tile-icon">
          <Icon aria-hidden="true" />
        </span>
        <span className="tile-text">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </span>
        <ChevronRight className="tile-chevron" aria-hidden="true" />
      </span>
    </IonCard>
  )
}

export default function StartPage() {
  const { user } = useSession()
  return (
    <Page title="Start">
      <Tile to={paths.transportDocument} icon={FileText} title="Beförderungspapier" subtitle="Druckluftflaschen, funktioniert offline" />
      {user ? (
        <Tile to={paths.dueList} icon={Wrench} title="Material" subtitle="Prüffristen und Verwendungen" />
      ) : (
        <section className="ui-card" aria-label="Anmeldung">
          <h2>Materialverwaltung</h2>
          <Hint style={{ margin: '6px 0 14px' }}>
            Prüffristen, Verwendungen und Erinnerungen für Geräte. Dafür bitte anmelden.
          </Hint>
          <BlockButton routerLink={paths.login}>
            Anmelden
          </BlockButton>
        </section>
      )}
    </Page>
  )
}
