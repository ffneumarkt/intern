import { FileText, GearSix, House, Info, Wrench, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { BrowserRouter, Link, MemoryRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
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
import { DialogProvider } from './components/useDialogs'
import { useSwipeBack } from './components/useSwipeBack'
import { paths, requiresLogin } from './routes'
import { SessionProvider, useSession } from './session'

// Pages render nothing without a login; the redirect itself happens once, in LoginRedirect.
function RequireLogin({ children }: { children: ReactElement }) {
  const { user } = useSession()
  return user ? children : null
}

// The single redirect for a logged-out user on a page that needs a login.
function LoginRedirect() {
  const { user } = useSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if (!user && requiresLogin(pathname)) navigate(paths.login, { replace: true })
  }, [user, pathname, navigate])
  return null
}

interface Tab {
  // Shown under the symbol; `label` names the link where it differs.
  name: string
  label?: string
  to: string
  icon: PhosphorIcon
  // Whether the tab covers the page at this address.
  covers(pathname: string): boolean
}

const startTab: Tab = { name: 'Start', to: paths.start, icon: House, covers: (p) => p === paths.start || p === paths.login || p === paths.setup }
const documentTab: Tab = { name: 'ADR', label: 'ADR Beförderungspapier', to: paths.transportDocument, icon: FileText, covers: (p) => p === paths.transportDocument }
const infoTab: Tab = { name: 'Info', to: paths.info, icon: Info, covers: (p) => p === paths.info || p.startsWith(`${paths.info}/`) }
const materialTab: Tab = { name: 'Material', to: paths.dueList, icon: Wrench, covers: (p) => p === paths.dueList || p.startsWith(`${paths.dueList}/`) }
const settingsTab: Tab = { name: 'Einstellungen', to: paths.settings, icon: GearSix, covers: (p) => p === paths.settings || p === paths.admin || p.startsWith(`${paths.admin}/`) }

function TabBar() {
  const { user } = useSession()
  const { pathname } = useLocation()
  const tabs = user ? [startTab, documentTab, materialTab, settingsTab] : [startTab, documentTab, infoTab]
  return (
    <nav className="app-tabs" aria-label="Hauptmenü">
      {tabs.map(({ name, label, to, icon: Icon, covers }) => {
        const active = covers(pathname)
        return (
          <Link key={to} to={to} data-slot="tab" aria-label={label ?? name} aria-current={active ? 'page' : undefined}>
            {/* iOS shows the selected tab with the filled symbol. */}
            <Icon aria-hidden="true" weight={active ? 'fill' : 'regular'} />
            <span>{name}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function Shell() {
  const material = (path: string, element: ReactElement) => <Route path={path} element={<RequireLogin>{element}</RequireLogin>} />
  const view = useRef<HTMLDivElement>(null)
  // While a field has the focus the keyboard covers half the screen: the tab bar steps aside.
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const isField = (el: EventTarget | null) => el instanceof HTMLElement && el.matches('input:not([type=checkbox]):not([type=radio]), textarea, select')
    // Showing the bar again on blur must wait: a tap on a button blurs the field first, and a bar that reappears at
    // once would move the button from under the finger before the tap ends.
    let timer: ReturnType<typeof setTimeout> | undefined
    const on = (e: FocusEvent) => {
      clearTimeout(timer)
      setTyping(isField(e.target))
    }
    const off = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setTyping(false), 400)
    }
    document.addEventListener('focusin', on)
    document.addEventListener('focusout', off)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('focusin', on)
      document.removeEventListener('focusout', off)
    }
  }, [])
  const { pathname, key } = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  // Going deeper slides the page in from the right, going back from the left; the tab roots just appear.
  const roots: string[] = [paths.start, paths.transportDocument, paths.info, paths.dueList, paths.settings]
  const motion = key === 'default' || roots.includes(pathname) ? '' : navigationType === 'PUSH' ? 'push' : navigationType === 'POP' ? 'pop' : ''
  useSwipeBack(view, () => navigate(-1), key !== 'default')
  // A page change starts at the top, as a new page does.
  useEffect(() => {
    if (view.current) view.current.scrollTop = 0
  }, [pathname])
  return (
    <div className="app-shell" data-typing={typing}>
      <div className="app-view" ref={view} data-motion={motion}>
        <Routes>
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
        </Routes>
      </div>
      <TabBar />
    </div>
  )
}

function Router({ initialPath, children }: { initialPath?: string; children: ReactNode }) {
  if (initialPath) return <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
  return <BrowserRouter>{children}</BrowserRouter>
}

export default function App({ initialPath }: { initialPath?: string }) {
  return (
    <SessionProvider>
      <DialogProvider>
        <Router initialPath={initialPath}>
          <LoginRedirect />
          <Shell />
        </Router>
      </DialogProvider>
    </SessionProvider>
  )
}
