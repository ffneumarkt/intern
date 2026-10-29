export const paths = {
  start: '/',
  login: '/login',
  transportDocument: '/befoerderungspapier',
  dueList: '/material',
  category: (id = ':categoryId') => `/material/kategorien/${id}`,
  item: (id = ':itemId') => `/material/geraete/${id}`,
  recordUse: '/material/verwendung',
  recordCheck: (id = ':itemId') => `/material/geraete/${id}/pruefung`,
  label: (id = ':itemId') => `/material/geraete/${id}/etikett`,
  manage: '/material/verwalten',
  settings: '/einstellungen',
}
