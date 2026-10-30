import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { paths } from '../routes'
import { signInAs, type Level } from '../test/fakeAuth'
import { data, failing } from '../test/fakeMaterial'
import { findIon, ionButton, ionTab } from '../test/ionic'

vi.mock('../api/auth', () => import('../test/fakeAuth'))
vi.mock('../api/material', () => import('../test/fakeMaterial'))

function renderAt(path: string, level: Level) {
  signInAs(level)
  return render(<App initialPath={path} />)
}

const button = ionButton

const offlineNotice = 'Keine Verbindung. Die Materialverwaltung braucht eine Internetverbindung.'

async function scan(code: string) {
  const input = await screen.findByLabelText('Code manuell eingeben')
  fireEvent.change(input, { target: { value: code } })
  fireEvent.submit(input)
}

describe('due list', () => {
  it('groups items by state', async () => {
    renderAt(paths.dueList, 'use')
    const overdue = await screen.findByRole('region', { name: 'Überfällig' })
    expect(within(overdue).getByText('Maske 01')).toBeInTheDocument()
    expect(within(overdue).getByText('Maske 05')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Heute fällig' })).getByText('Maske 02')).toBeInTheDocument()
    const soon = screen.getByRole('region', { name: 'Bald fällig' })
    expect(within(soon).getByText('Maske 03')).toBeInTheDocument()
    expect(within(soon).getByText('LA 01')).toBeInTheDocument()
    expect(screen.queryByText('Maske 04')).not.toBeInTheDocument()
  })
})

describe('loading', () => {
  it('shows the offline notice instead of an empty list', async () => {
    failing.reads = true
    renderAt(paths.dueList, 'use')
    expect(await screen.findByText(offlineNotice)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Überfällig' })).not.toBeInTheDocument()
  })

  it('tells a user without categories why the list is empty', async () => {
    data.categories = []
    data.items = []
    renderAt(paths.dueList, 'use')
    expect(await screen.findByText('Noch keine Kategorie freigegeben.')).toBeInTheDocument()
  })

  it('reloads when coming back to a page', async () => {
    renderAt(paths.dueList, 'use')
    await screen.findByText('Maske 01')
    data.items[0].name = 'Maske Neu'
    fireEvent.click(await findIon(() => ionTab('Start')))
    await screen.findByRole('heading', { name: 'Start' })
    fireEvent.click(ionTab('Material')!)
    expect(await screen.findByText('Maske Neu')).toBeInTheDocument()
  })
})

describe('item', () => {
  it('shows dues and history', async () => {
    renderAt(paths.item('m01'), 'use')
    expect(await screen.findByText('Lebensdauer')).toBeInTheDocument()
    expect(await screen.findByText('Maskenprüfung: bestanden')).toBeInTheDocument()
  })

  it('reports an item the user cannot see', async () => {
    renderAt(paths.item('nope'), 'use')
    expect(await screen.findByRole('heading', { name: 'Gerät nicht gefunden' })).toBeInTheDocument()
  })
})

describe('item actions follow level', () => {
  it('use', async () => {
    renderAt(paths.item('m01'), 'use')
    expect(await findIon(() => ionButton('Verwendung erfassen'))).toBeInTheDocument()
    expect(button('Prüfung erfassen')).not.toBeInTheDocument()
    expect(button('Bearbeiten')).not.toBeInTheDocument()
  })

  it('check', async () => {
    renderAt(paths.item('m01'), 'check')
    expect(await findIon(() => ionButton('Prüfung erfassen'))).toBeInTheDocument()
    expect(button('Ausscheiden')).toBeInTheDocument()
    expect(button('Bearbeiten')).not.toBeInTheDocument()
  })

  it('manage', async () => {
    renderAt(paths.item('m01'), 'manage')
    expect(await findIon(() => ionButton('Bearbeiten'))).toBeInTheDocument()
    expect(button('Etikett drucken')).toBeInTheDocument()
  })
})

describe('record use', () => {
  it('scan loop ignores duplicates and ends in the form', async () => {
    renderAt(paths.recordUse, 'use')
    await scan('M-001')
    await scan('M-001')
    await scan('M-002')
    const list = await screen.findByRole('list', { name: 'Gescannte Geräte' })
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2))
    fireEvent.click(ionButton('Fertig')!)
    expect(await screen.findByLabelText('Erfasst von')).toBeInTheDocument()
  })

  it('unknown code offers assignment only to manage', async () => {
    renderAt(paths.recordUse, 'use')
    await scan('UNKNOWN-1')
    expect(await screen.findByText('Nicht gefunden: UNKNOWN-1')).toBeInTheDocument()
    expect(button('Gerät zuordnen')).not.toBeInTheDocument()
  })

  it('unknown code can be assigned at manage level', async () => {
    renderAt(paths.recordUse, 'manage')
    await scan('UNKNOWN-1')
    expect(await findIon(() => ionButton('Gerät zuordnen'))).toBeInTheDocument()
  })
})

describe('record use from item detail', () => {
  it('opens record use with the item preselected', async () => {
    renderAt(paths.item('m01'), 'use')
    fireEvent.click(await findIon(() => ionButton('Verwendung erfassen')))
    const list = await screen.findByRole('list', { name: 'Gescannte Geräte' })
    await waitFor(() => expect(within(list).getByText('Maske 01')).toBeInTheDocument())
  })

  it('starts with the preselected item in the list', async () => {
    renderAt(paths.recordUseFor('m03'), 'use')
    const list = await screen.findByRole('list', { name: 'Gescannte Geräte' })
    await waitFor(() => expect(within(list).getByText('Maske 03')).toBeInTheDocument())
  })
})

describe('code suggestions', () => {
  it('suggests active items matching the typed code', async () => {
    renderAt(paths.recordUse, 'use')
    const input = await screen.findByLabelText('Code manuell eingeben')
    fireEvent.change(input, { target: { value: 'm-00' } })
    const suggestions = await screen.findByRole('list', { name: 'Vorschläge' })
    for (const n of ['01', '02', '03', '04', '05']) {
      expect(within(suggestions).getByText(`Maske ${n}`)).toBeInTheDocument()
    }
    expect(within(suggestions).queryByText('Maske 06')).not.toBeInTheDocument()
    expect(within(suggestions).queryByText('LA 01')).not.toBeInTheDocument()
  })

  it('adds a suggestion on click and clears the input', async () => {
    renderAt(paths.recordUse, 'use')
    const input = await screen.findByLabelText('Code manuell eingeben')
    fireEvent.change(input, { target: { value: 'M-00' } })
    fireEvent.click(within(await screen.findByRole('list', { name: 'Vorschläge' })).getByText('Maske 03'))
    const list = screen.getByRole('list', { name: 'Gescannte Geräte' })
    await waitFor(() => expect(within(list).getByText('Maske 03')).toBeInTheDocument())
    expect(input).toHaveValue('')
    expect(screen.queryByRole('list', { name: 'Vorschläge' })).not.toBeInTheDocument()
  })

  it('does not suggest items already in the list', async () => {
    renderAt(paths.recordUseFor('m01'), 'use')
    const input = await screen.findByLabelText('Code manuell eingeben')
    fireEvent.change(input, { target: { value: 'M-00' } })
    const suggestions = await screen.findByRole('list', { name: 'Vorschläge' })
    expect(within(suggestions).queryByText('Maske 01')).not.toBeInTheDocument()
  })
})

describe('category', () => {
  it('renders an item with nothing due', async () => {
    renderAt(paths.category('lungenautomaten'), 'use')
    expect(await screen.findByText('LA 02')).toBeInTheDocument()
  })

  it('links to manage only at manage level', async () => {
    renderAt(paths.category('masken'), 'check')
    await screen.findByText('Maske 01')
    expect(button('Verwalten')).not.toBeInTheDocument()
  })

  it('offers manage at manage level', async () => {
    renderAt(paths.category('masken'), 'manage')
    expect(await findIon(() => ionButton('Verwalten'))).toBeInTheDocument()
  })

  it('hides retired items until toggled', async () => {
    renderAt(paths.category('masken'), 'use')
    expect(await screen.findByText('Maske 01')).toBeInTheDocument()
    expect(screen.queryByText('Maske 06')).not.toBeInTheDocument()
    fireEvent.click(await findIon(() => ionButton('Ausgeschiedene anzeigen')))
    expect(await screen.findByText('Maske 06')).toBeInTheDocument()
  })
})
