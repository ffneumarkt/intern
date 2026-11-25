import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, useIonRouter } from '@ionic/react'
import { IonReactMemoryRouter, IonReactRouter } from '@ionic/react-router'
import { constructOutline, documentTextOutline, homeOutline, informationCircleOutline, settingsOutline } from 'ionicons/icons'
import { useEffect, type ReactElement, type ReactNode } from 'react'
import { Route, useLocation } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import CategoriesPage from './pages/CategoriesPage'
import CategoryEditPage from './pages/CategoryEditPage'
import CategoryPage from './pages/CategoryPage'
import CorrectionPage from './pages/CorrectionPage'
import DueListPage from './pages/DueListPage'
import ImprintPage from './pages/ImprintPage'
import InfoPage from './pages/InfoPage'
import CheckTypeEditPage from './pages/CheckTypeEditPage'
import ItemEditPage from './pages/ItemEditPage'
import ItemPage from './pages/ItemPage'
import LoginPage from './pages/LoginPage'
import ManagePage from './pages/ManagePage'
import MemberEditPage from './pages/MemberEditPage'
import MembersPage from './pages/MembersPage'
import PrivacyPage from './pages/PrivacyPage'
import RecordCheckPage from './pages/RecordCheckPage'
import RecordUsePage from './pages/RecordUsePage'
import SettingsPage from './pages/SettingsPage'
import SetupPage from './pages/SetupPage'
import StartPage from './pages/StartPage'
import TransportSettingsPage from './pages/TransportSettingsPage'
import TransportDocumentPage from './pages/TransportDocumentPage'
import { paths, requiresLogin } from './routes'
import { SessionProvider, useSession } from './session'

// Ionic keeps visited pages mounted. If each of them redirected on logout, the stack would see
// several replace navigations at once and the next login could leave the login page visible.
function RequireLogin({ children }: { children: ReactElement }) {
  const { user } = useSession()
  return user ? children : null
}

// The single redirect for a logged-out user on a page that needs a login.
function LoginRedirect() {
  const { user } = useSession()
  const router = useIonRouter()
  const { pathname } = useLocation()
  useEffect(() => {
    if (!user && requiresLogin(pathname)) router.push(paths.login, 'root', 'replace')
  }, [user, pathname, router])
  return null
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
        <Route path={paths.setup} element={<SetupPage />} />
        <Route path={paths.transportDocument} element={<TransportDocumentPage />} />
        <Route path={paths.info} element={<InfoPage />} />
        <Route path={paths.imprint} element={<ImprintPage />} />
        <Route path={paths.privacy} element={<PrivacyPage />} />
        {material(paths.dueList, <DueListPage />)}
        {material(paths.category(), <CategoryPage />)}
        {material(paths.item(), <ItemPage />)}
        {material(paths.itemEdit(), <ItemEditPage />)}
        {material(paths.itemNew(), <ItemEditPage />)}
        {material(paths.checkTypeEdit(), <CheckTypeEditPage />)}
        {material(paths.checkTypeNew(), <CheckTypeEditPage />)}
        {material(paths.recordUse, <RecordUsePage />)}
        {material(paths.recordCheck(), <RecordCheckPage />)}
        {material(paths.manage, <ManagePage />)}
        {material(paths.settings, <SettingsPage />)}
        {material(paths.correction(), <CorrectionPage />)}
        {material(paths.admin, <AdminPage />)}
        {material(paths.adminMembers, <MembersPage />)}
        {material(paths.adminMemberNew, <MemberEditPage />)}
        {material(paths.adminMember(), <MemberEditPage />)}
        {material(paths.adminCategories, <CategoriesPage />)}
        {material(paths.adminCategoryNew, <CategoryEditPage />)}
        {material(paths.adminCategory(), <CategoryEditPage />)}
        {material(paths.adminTransport, <TransportSettingsPage />)}
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
        {!loggedIn && (
          <IonTabButton tab="info" href={paths.info} aria-label="Info">
            <IonIcon icon={informationCircleOutline} aria-hidden />
            <IonLabel>Info</IonLabel>
          </IonTabButton>
        )}
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
          <LoginRedirect />
          <Tabs />
        </Router>
      </SessionProvider>
    </IonApp>
  )
}
