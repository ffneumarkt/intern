export const paths = {
  start: '/',
  login: '/login',
  transportDocument: '/befoerderungspapier',
  dueList: '/material',
  category: (id = ':categoryId') => `/material/kategorien/${id}`,
  item: (id = ':itemId') => `/material/geraete/${id}`,
  recordUse: '/material/verwendung',
  recordUseFor: (itemId: string) => `/material/verwendung?geraet=${itemId}`,
  recordCheck: (id = ':itemId') => `/material/geraete/${id}/pruefung`,
  label: (id = ':itemId') => `/material/geraete/${id}/etikett`,
  manage: '/material/verwalten',
  manageCategory: (categoryId: string) => `/material/verwalten?kategorie=${categoryId}`,
  itemEdit: (id = ':itemId') => `/material/geraete/${id}/bearbeiten`,
  settings: '/einstellungen',
}

// Everything under the material tool and the settings need a login.
export const requiresLogin = (pathname: string) =>
  pathname === paths.dueList || pathname.startsWith(`${paths.dueList}/`) || pathname === paths.settings
