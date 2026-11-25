// The tabs of the Verwalten page and how they appear in the address.
export type ManageTab = 'items' | 'checkTypes' | 'locations'
export const manageTabParam: Record<ManageTab, string> = { items: 'geraete', checkTypes: 'pruefarten', locations: 'standorte' }

export const paths = {
  start: '/',
  login: '/login',
  // Opened with the setup link; the token is in the fragment (#token), which never reaches a server.
  setup: '/einrichtung',
  transportDocument: '/befoerderungspapier',
  dueList: '/material',
  dueListOf: (ids: string[]) => `/material?geraete=${ids.join(',')}`,
  category: (id = ':categoryId') => `/material/kategorien/${id}`,
  item: (id = ':itemId') => `/material/geraete/${id}`,
  recordUse: '/material/verwendung',
  recordUseFor: (itemId: string) => `/material/verwendung?geraet=${itemId}`,
  recordCheck: (id = ':itemId') => `/material/geraete/${id}/pruefung`,
  // Opened from a row of the due list: back and saving lead to the list, not to the item page.
  recordCheckFromList: (id: string) => `/material/geraete/${id}/pruefung?von=liste`,
  manage: '/material/verwalten',
  manageCategory: (categoryId: string, tab: ManageTab = 'items') =>
    `/material/verwalten?kategorie=${categoryId}${tab === 'items' ? '' : `&tab=${manageTabParam[tab]}`}`,
  itemEdit: (id = ':itemId') => `/material/geraete/${id}/bearbeiten`,
  // The new-item and new-check-type pages are the edit pages without an id; the category comes as a query value.
  itemNew: (categoryId?: string) => `/material/verwalten/geraete/neu${categoryId ? `?kategorie=${categoryId}` : ''}`,
  checkTypeNew: (categoryId?: string) => `/material/verwalten/pruefarten/neu${categoryId ? `?kategorie=${categoryId}` : ''}`,
  checkTypeEdit: (id = ':checkTypeId') => `/material/verwalten/pruefart/${id}`,
  settings: '/einstellungen',
  admin: '/verwaltung',
  adminMembers: '/verwaltung/mitglieder',
  adminMemberNew: '/verwaltung/mitglieder/neu',
  adminMember: (id = ':memberId') => `/verwaltung/mitglied/${id}`,
  adminCategories: '/verwaltung/kategorien',
  adminCategoryNew: '/verwaltung/kategorien/neu',
  adminCategory: (id = ':categoryId') => `/verwaltung/kategorie/${id}`,
  adminTransport: '/verwaltung/befoerderungspapier',
  // Correct or delete one use or check of an item (kind: 'use' | 'check').
  correction: (itemId = ':itemId', kind = ':kind', recordId = ':recordId') => `/material/geraete/${itemId}/korrektur/${kind}/${recordId}`,
  info: '/info',
  imprint: '/info/impressum',
  privacy: '/info/datenschutz',
}

// Everything under the material tool and the settings need a login.
export const requiresLogin = (pathname: string) =>
  pathname === paths.dueList || pathname.startsWith(`${paths.dueList}/`) || pathname === paths.settings || pathname === paths.admin || pathname.startsWith(`${paths.admin}/`)
