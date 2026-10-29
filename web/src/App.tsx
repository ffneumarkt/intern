import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react'
import { IonReactMemoryRouter, IonReactRouter } from '@ionic/react-router'
import { constructOutline, documentTextOutline, homeOutline, settingsOutline } from 'ionicons/icons'
import type { ReactElement, ReactNode } from 'react'
import { Navigate, Route } from 'react-router-dom'
import Page from './components/Page'
import { paths } from './routes'
import { atLeast, SketchSessionProvider, useSketchSession } from './sketch/session'

function RequireUse({ children }: { children: ReactElement }) {
  const { level } = useSketchSession()
  return atLeast(level, 'use') ? children : <Navigate to={paths.login} replace />
}

function Tabs() {
  const { level } = useSketchSession()
  const loggedIn = atLeast(level, 'use')
  const material = (path: string, element: ReactElement) => (
    <Route path={path} element={<RequireUse>{element}</RequireUse>} />
  )
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path={paths.start} element={<Page title="Start" />} />
        <Route path={paths.login} element={<Page title="Anmelden" />} />
        <Route path={paths.transportDocument} element={<Page title="Beförderungspapier" />} />
        {material(paths.dueList, <Page title="Fällig" />)}
        {material(paths.category(), <Page title="Kategorie" back={paths.dueList} />)}
        {material(paths.item(), <Page title="Gerät" back={paths.dueList} />)}
        {material(paths.recordUse, <Page title="Verwendung erfassen" back={paths.dueList} />)}
        {material(paths.recordCheck(), <Page title="Prüfung erfassen" back={paths.dueList} />)}
        {material(paths.label(), <Page title="Etikett" back={paths.dueList} />)}
        {material(paths.manage, <Page title="Verwalten" back={paths.dueList} />)}
        {material(paths.settings, <Page title="Einstellungen" />)}
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        <IonTabButton tab="start" href={paths.start} aria-label="Start">
          <IonIcon icon={homeOutline} aria-hidden />
          <IonLabel>Start</IonLabel>
        </IonTabButton>
        <IonTabButton tab="befoerderungspapier" href={paths.transportDocument} aria-label="Beförderungspapier">
          <IonIcon icon={documentTextOutline} aria-hidden />
          <IonLabel>Beförderungspapier</IonLabel>
        </IonTabButton>
        {loggedIn && (
          <IonTabButton tab="material" href={paths.dueList} aria-label="Material">
            <IonIcon icon={constructOutline} aria-hidden />
            <IonLabel>Material</IonLabel>
          </IonTabButton>
        )}
        {loggedIn && (
          <IonTabButton tab="einstellungen" href={paths.settings} aria-label="Einstellungen">
            <IonIcon icon={settingsOutline} aria-hidden />
            <IonLabel>Einstellungen</IonLabel>
          </IonTabButton>
        )}
      </IonTabBar>
    </IonTabs>
  )
}

function Router({ initialPath, children }: { initialPath?: string; children: ReactNode }) {
  if (initialPath) return <IonReactMemoryRouter initialEntries={[initialPath]}>{children}</IonReactMemoryRouter>
  return <IonReactRouter>{children}</IonReactRouter>
}

export default function App({ initialPath }: { initialPath?: string }) {
  return (
    <IonApp>
      <SketchSessionProvider>
        <Router initialPath={initialPath}>
          <Tabs />
        </Router>
      </SketchSessionProvider>
    </IonApp>
  )
}
