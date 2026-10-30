import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react'
import { IonReactMemoryRouter, IonReactRouter } from '@ionic/react-router'
import { constructOutline, documentTextOutline, homeOutline, settingsOutline } from 'ionicons/icons'
import type { ReactElement, ReactNode } from 'react'
import { Navigate, Route } from 'react-router-dom'
import CategoryPage from './pages/CategoryPage'
import DueListPage from './pages/DueListPage'
import ItemEditPage from './pages/ItemEditPage'
import ItemPage from './pages/ItemPage'
import LabelPage from './pages/LabelPage'
import LoginPage from './pages/LoginPage'
import ManagePage from './pages/ManagePage'
import RecordCheckPage from './pages/RecordCheckPage'
import RecordUsePage from './pages/RecordUsePage'
import SettingsPage from './pages/SettingsPage'
import StartPage from './pages/StartPage'
import TransportDocumentPage from './pages/TransportDocumentPage'
import { paths } from './routes'
import { SessionProvider, useSession } from './session'

function RequireLogin({ children }: { children: ReactElement }) {
  const { user } = useSession()
  return user ? children : <Navigate to={paths.login} replace />
}

function Tabs() {
  const { user } = useSession()
  const loggedIn = user !== null
  const material = (path: string, element: ReactElement) => (
    <Route path={path} element={<RequireLogin>{element}</RequireLogin>} />
  )
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path={paths.start} element={<StartPage />} />
        <Route path={paths.login} element={<LoginPage />} />
        <Route path={paths.transportDocument} element={<TransportDocumentPage />} />
        {material(paths.dueList, <DueListPage />)}
        {material(paths.category(), <CategoryPage />)}
        {material(paths.item(), <ItemPage />)}
        {material(paths.itemEdit(), <ItemEditPage />)}
        {material(paths.recordUse, <RecordUsePage />)}
        {material(paths.recordCheck(), <RecordCheckPage />)}
        {material(paths.label(), <LabelPage />)}
        {material(paths.manage, <ManagePage />)}
        {material(paths.settings, <SettingsPage />)}
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
      <SessionProvider>
        <Router initialPath={initialPath}>
          <Tabs />
        </Router>
      </SessionProvider>
    </IonApp>
  )
}
