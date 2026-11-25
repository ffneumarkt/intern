import { paths } from '../routes'

const exact: Record<string, string> = {
  [paths.start]: 'Start',
  [paths.dueList]: 'Fällig',
  [paths.settings]: 'Einstellungen',
  [paths.admin]: 'Verwaltung',
  [paths.adminMembers]: 'Mitglieder',
  [paths.adminCategories]: 'Kategorien',
  [paths.manage]: 'Verwalten',
  [paths.info]: 'Info',
}

// The text next to the back chevron, as in iOS: the title of the page it leads to. Unknown pages say „Zurück“.
export function backLabel(path: string): string {
  const pathname = path.split('?')[0]
  if (exact[pathname]) return exact[pathname]
  if (/^\/material\/geraete\/[^/]+$/.test(pathname)) return 'Gerät'
  if (/^\/material\/kategorien\/[^/]+$/.test(pathname)) return 'Kategorie'
  return 'Zurück'
}
