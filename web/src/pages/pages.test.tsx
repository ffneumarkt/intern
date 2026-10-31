import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { today } from '../today'
import { paths } from '../routes'
import { levelsFailing, signInAs, type Level } from '../test/fakeAuth'
import { calls, data, failing } from '../test/fakeMaterial'
import { alertButton, findIon, ionButton, ionChip, ionItem, ionTab, ionToggle } from '../test/ionic'
import { notificationState } from '../test/fakeNotifications'
import { pushState } from '../test/fakePush'

vi.mock('../api/auth', () => import('../test/fakeAuth'))
vi.mock('../api/material', () => import('../test/fakeMaterial'))
vi.mock('../api/notifications', () => import('../test/fakeNotifications'))
vi.mock('../api/passkeys', () => import('../test/fakePasskeys'))
vi.mock('../api/push', () => import('../test/fakePush'))

function renderAt(path: string, level: Level) {
  signInAs(level)
  return render(<App initialPath={path} />)
}

const button = ionButton

const historyNotice = 'Gerät hat einen Verlauf und kann nicht gelöscht, nur ausgeschieden werden.'
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

  it('limits the list to the items of a notification', async () => {
    renderAt(paths.dueListOf(['m01', 'm02']), 'use')
    const overdue = await screen.findByRole('region', { name: 'Überfällig' })
    expect(within(overdue).getByText('Maske 01')).toBeInTheDocument()
    expect(screen.getByText('Maske 02')).toBeInTheDocument()
    expect(screen.queryByText('Maske 03')).not.toBeInTheDocument()
    expect(screen.queryByText('Maske 05')).not.toBeInTheDocument()
    expect(screen.queryByText('LA 01')).not.toBeInTheDocument()
  })

  it('shows everything after Alle anzeigen', async () => {
    renderAt(paths.dueListOf(['m01']), 'use')
    await screen.findByText('Maske 01')
    expect(screen.queryByText('Maske 03')).not.toBeInTheDocument()
    fireEvent.click(await findIon(() => ionChip('Alle anzeigen')))
    expect(await screen.findByText('Maske 03')).toBeInTheDocument()
    expect(ionChip('Alle anzeigen')).not.toBeInTheDocument()
  })

  it('says when the items of a notification are done', async () => {
    renderAt(paths.dueListOf(['m04']), 'use')
    expect(await screen.findByText('Alles aus dieser Benachrichtigung ist erledigt.')).toBeInTheDocument()
    expect(ionChip('Alle anzeigen')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Überfällig' })).not.toBeInTheDocument()
  })

  it('ignores unknown ids', async () => {
    renderAt(paths.dueListOf(['m01', 'gibt-es-nicht']), 'use')
    expect(await screen.findByText('Maske 01')).toBeInTheDocument()
    expect(screen.queryByText('Maske 02')).not.toBeInTheDocument()
    expect(screen.queryByText('Alles aus dieser Benachrichtigung ist erledigt.')).not.toBeInTheDocument()
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

  it('recovers when the connection returns', async () => {
    failing.reads = true
    renderAt(paths.dueList, 'use')
    await screen.findByText(offlineNotice)
    failing.reads = false
    window.dispatchEvent(new Event('online'))
    expect(await screen.findByText('Maske 01')).toBeInTheDocument()
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

  it('recovers its actions after permissions failed to load at start', async () => {
    signInAs('check')
    levelsFailing.value = true
    render(<App initialPath={paths.dueList} />)
    await screen.findByText('Maske 01')
    fireEvent.click(await findIon(() => ionTab('Start')))
    await screen.findByRole('heading', { name: 'Start' })
    levelsFailing.value = false
    fireEvent.click(ionTab('Material')!)
    fireEvent.click(await screen.findByText('Maske 01'))
    expect(await findIon(() => ionButton('Prüfung erfassen'))).toBeInTheDocument()
  })

  it('keeps known permissions when reloading them fails', async () => {
    renderAt(paths.dueList, 'check')
    await screen.findByText('Maske 01')
    levelsFailing.value = true
    fireEvent.click(await screen.findByText('Maske 01'))
    expect(await findIon(() => ionButton('Prüfung erfassen'))).toBeInTheDocument()
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

describe('saving a use', () => {
  async function scanAndOpenForm(...codes: string[]) {
    for (const code of codes) await scan(code)
    const list = await screen.findByRole('list', { name: 'Gescannte Geräte' })
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(codes.length))
    fireEvent.click(ionButton('Fertig')!)
    await screen.findByLabelText('Erfasst von')
  }

  it('saves one use per item with the form values', async () => {
    renderAt(paths.recordUse, 'use')
    await scanAndOpenForm('M-001', 'M-002')
    fireEvent.change(screen.getByLabelText('Art'), { target: { value: 'exercise' } })
    fireEvent.change(screen.getByLabelText('Erfasst von'), { target: { value: 'Anna' } })
    fireEvent.change(screen.getByLabelText('Notiz'), { target: { value: 'Atemschutzübung' } })
    fireEvent.click(ionButton('Speichern')!)
    await screen.findByRole('heading', { name: 'Fällig' })
    const input = { date: today(), kind: 'exercise', recordedByName: 'Anna', note: 'Atemschutzübung' }
    expect(calls.uses).toEqual([
      { itemId: 'm01', input },
      { itemId: 'm02', input },
    ])
  })

  it('writes once on a double tap', async () => {
    renderAt(paths.recordUse, 'use')
    await scanAndOpenForm('M-001', 'M-002')
    fireEvent.click(ionButton('Speichern')!)
    fireEvent.click(ionButton('Speichern')!)
    await screen.findByRole('heading', { name: 'Fällig' })
    expect(calls.uses.map((u) => u.itemId)).toEqual(['m01', 'm02'])
  })

  it('refuses a future date', async () => {
    renderAt(paths.recordUse, 'use')
    await scanAndOpenForm('M-001')
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2062-01-01' } })
    fireEvent.click(ionButton('Speichern')!)
    expect(await screen.findByText('Datum darf nicht in der Zukunft liegen.')).toBeInTheDocument()
    expect(calls.uses).toEqual([])
  })

  it('remembers who recorded on this device', async () => {
    localStorage.setItem('intern.recordedBy', 'Anna')
    renderAt(paths.recordUse, 'use')
    await scanAndOpenForm('M-001')
    expect(screen.getByLabelText('Erfasst von')).toHaveValue('Anna')
    fireEvent.change(screen.getByLabelText('Erfasst von'), { target: { value: 'Berta' } })
    fireEvent.click(ionButton('Speichern')!)
    await waitFor(() => expect(localStorage.getItem('intern.recordedBy')).toBe('Berta'))
  })

  it('keeps only the unsaved items after a failure, so a retry writes each once', async () => {
    failing.useFor.add('m02')
    renderAt(paths.recordUse, 'use')
    await scanAndOpenForm('M-001', 'M-002', 'M-003')
    fireEvent.click(ionButton('Speichern')!)
    expect(await screen.findByText('Speichern fehlgeschlagen.')).toBeInTheDocument()
    expect(screen.getByText('Maske 02, Maske 03')).toBeInTheDocument()

    failing.useFor.clear()
    fireEvent.click(ionButton('Speichern')!)
    await screen.findByRole('heading', { name: 'Fällig' })
    expect(calls.uses.map((u) => u.itemId)).toEqual(['m01', 'm02', 'm03'])
  })

  it('does not find a retired item by its code', async () => {
    renderAt(paths.recordUse, 'use')
    await scan('M-006')
    expect(await screen.findByText('Nicht gefunden: M-006')).toBeInTheDocument()
  })
})

describe('recording a check', () => {
  it('offers only the check types of the item', async () => {
    renderAt(paths.recordCheck('l01'), 'check')
    const select = await screen.findByLabelText('Prüfart')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Jahresprüfung'])
  })

  it('preselects the default check type of the category', async () => {
    data.checkTypes = data.checkTypes.map((t) => ({ ...t, isDefault: t.id === 'fuenfjahr' }))
    renderAt(paths.recordCheck('m01'), 'check')
    expect(await screen.findByLabelText('Prüfart')).toHaveValue('fuenfjahr')
  })

  it('ignores the default of another category', async () => {
    data.checkTypes = data.checkTypes.map((t) => ({ ...t, isDefault: t.id === 'la-jahr' }))
    renderAt(paths.recordCheck('m01'), 'check')
    expect(await screen.findByLabelText('Prüfart')).toHaveValue('maskenpruefung')
  })

  it('falls back to the first check type without a default', async () => {
    renderAt(paths.recordCheck('m01'), 'check')
    expect(await screen.findByLabelText('Prüfart')).toHaveValue('maskenpruefung')
  })

  it('still lets the user pick another type than the default', async () => {
    data.checkTypes = data.checkTypes.map((t) => ({ ...t, isDefault: t.id === 'fuenfjahr' }))
    renderAt(paths.recordCheck('m01'), 'check')
    fireEvent.change(await screen.findByLabelText('Prüfart'), { target: { value: 'maskenpruefung' } })
    expect(screen.getByLabelText('Prüfart')).toHaveValue('maskenpruefung')
  })

  it('saves and shows the entry on the item page', async () => {
    renderAt(paths.recordCheck('m01'), 'check')
    fireEvent.change(await screen.findByLabelText('Prüfart'), { target: { value: 'fuenfjahr' } })
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2026-10-20' } })
    fireEvent.change(screen.getByLabelText('Ergebnis'), { target: { value: 'defect' } })
    fireEvent.change(screen.getByLabelText('Notiz'), { target: { value: 'Riss' } })
    fireEvent.click(ionButton('Speichern')!)
    expect(await screen.findByText('5-Jahres-Prüfung: Mangel')).toBeInTheDocument()
    expect(calls.checks).toEqual([
      { itemId: 'm01', input: { checkTypeId: 'fuenfjahr', date: '2026-10-20', result: 'defect', note: 'Riss' } },
    ])
  })

  it('writes once on a double tap', async () => {
    renderAt(paths.recordCheck('m01'), 'check')
    await screen.findByLabelText('Prüfart')
    fireEvent.click(ionButton('Speichern')!)
    fireEvent.click(ionButton('Speichern')!)
    await waitFor(() => expect(calls.checks.length).toBeGreaterThan(0))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(calls.checks).toHaveLength(1)
  })

  it('refuses a future date', async () => {
    renderAt(paths.recordCheck('m01'), 'check')
    fireEvent.change(await screen.findByLabelText('Datum'), { target: { value: '2062-01-01' } })
    fireEvent.click(ionButton('Speichern')!)
    expect(await screen.findByText('Datum darf nicht in der Zukunft liegen.')).toBeInTheDocument()
    expect(calls.checks).toEqual([])
  })

  it('defaults to today and a pass', async () => {
    renderAt(paths.recordCheck('m01'), 'check')
    expect(await screen.findByLabelText('Datum')).toHaveValue(today())
    expect(screen.getByLabelText('Ergebnis')).toHaveValue('passed')
  })

  it('reports a failed save', async () => {
    renderAt(paths.recordCheck('m01'), 'check')
    await screen.findByLabelText('Prüfart')
    failing.check = true
    fireEvent.click(ionButton('Speichern')!)
    expect(await screen.findByText('Speichern fehlgeschlagen.')).toBeInTheDocument()
  })
})

describe('retiring', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('retires after confirmation', async () => {
    renderAt(paths.item('m01'), 'check')
    fireEvent.click(await findIon(() => ionButton('Ausscheiden')))
    expect(await screen.findByText('Maske 01 ausscheiden?')).toBeInTheDocument()
    fireEvent.click(await findIon(() => alertButton('Ausscheiden')))
    await waitFor(() => expect(calls.retired).toEqual(['m01']))
  })

  it('does nothing when dismissed', async () => {
    renderAt(paths.item('m01'), 'check')
    fireEvent.click(await findIon(() => ionButton('Ausscheiden')))
    fireEvent.click(await findIon(() => alertButton('Abbrechen')))
    await waitFor(() => expect(document.querySelector('ion-alert')).not.toBeInTheDocument())
    expect(calls.retired).toEqual([])
  })

  it('offers nothing on an item already retired', async () => {
    renderAt(paths.item('m06'), 'manage')
    await findIon(() => ionButton('Bearbeiten'))
    expect(button('Ausscheiden')).not.toBeInTheDocument()
    expect(button('Prüfung erfassen')).not.toBeInTheDocument()
    expect(button('Verwendung erfassen')).not.toBeInTheDocument()
  })
})

describe('manage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const lastChecked = (type: string) => screen.findByLabelText(`Zuletzt geprüft am (${type})`)
  const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
  const openCheckTypes = async () => {
    fireEvent.click(await screen.findByText('Prüfarten'))
    await findIon(() => ionButton('Prüfart anlegen'))
  }

  it('lists only categories at manage level', async () => {
    signInAs('use', { masken: 'manage', lungenautomaten: 'use' })
    render(<App initialPath={paths.manage} />)
    const select = await screen.findByLabelText('Kategorie')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Atemschutzmasken'])
  })

  it('preselects the category from the link', async () => {
    renderAt(paths.manageCategory('lungenautomaten'), 'manage')
    expect(await screen.findByLabelText('Kategorie')).toHaveValue('lungenautomaten')
    expect(await lastChecked('Jahresprüfung')).toBeInTheDocument()
  })

  it('refuses a user without manage anywhere', async () => {
    renderAt(paths.manage, 'check')
    expect(await screen.findByText('Keine Berechtigung.')).toBeInTheDocument()
  })

  it('creates an item with last checked dates of the selected category', async () => {
    renderAt(paths.manage, 'manage')
    fireEvent.change(await lastChecked('Maskenprüfung'), { target: { value: '2026-01-15' } })
    expect(screen.queryByLabelText('Zuletzt geprüft am (Jahresprüfung)')).not.toBeInTheDocument()
    set('Bezeichnung', 'Maske 07')
    set('Seriennummer', 'DR-07')
    set('Code', 'M-007')
    set('Hergestellt am', '2026-02-01')
    fireEvent.click(ionButton('Gerät anlegen')!)
    expect(await screen.findByRole('heading', { name: 'Maske 07' })).toBeInTheDocument()
    expect(calls.createdItems).toEqual([
      {
        input: { categoryId: 'masken', name: 'Maske 07', serial: 'DR-07', barcode: 'M-007', manufacturedOn: '2026-02-01', note: '' },
        lastChecked: { maskenpruefung: '2026-01-15' },
      },
    ])
  })

  it('creates one item on a double tap', async () => {
    renderAt(paths.manage, 'manage')
    await lastChecked('Maskenprüfung')
    set('Bezeichnung', 'Maske 07')
    fireEvent.click(ionButton('Gerät anlegen')!)
    fireEvent.click(ionButton('Gerät anlegen')!)
    await screen.findByRole('heading', { name: 'Maske 07' })
    expect(calls.createdItems).toHaveLength(1)
  })

  it('refuses a future last checked date', async () => {
    renderAt(paths.manage, 'manage')
    fireEvent.change(await lastChecked('Maskenprüfung'), { target: { value: '2062-01-01' } })
    set('Bezeichnung', 'Maske 07')
    fireEvent.click(ionButton('Gerät anlegen')!)
    expect(await screen.findByText('Datum darf nicht in der Zukunft liegen.')).toBeInTheDocument()
    expect(calls.createdItems).toEqual([])
  })

  it('explains a duplicate code and keeps the form', async () => {
    failing.barcode = true
    renderAt(paths.manage, 'manage')
    await lastChecked('Maskenprüfung')
    set('Bezeichnung', 'Maske 07')
    fireEvent.click(ionButton('Gerät anlegen')!)
    expect(await screen.findByText('Code ist bereits vergeben.')).toBeInTheDocument()
    expect(screen.getByLabelText('Bezeichnung')).toHaveValue('Maske 07')
  })

  it('clears the form when the item exists but a check failed, so a retry cannot duplicate it', async () => {
    failing.initialChecks = true
    renderAt(paths.manage, 'manage')
    await lastChecked('Maskenprüfung')
    set('Bezeichnung', 'Maske 07')
    fireEvent.click(ionButton('Gerät anlegen')!)
    expect(await screen.findByText('Gerät angelegt, aber nicht alle Prüfungen gespeichert.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Bezeichnung')).toHaveValue(''))
  })

  it('edits an item from its page', async () => {
    renderAt(paths.item('m01'), 'manage')
    fireEvent.click(await findIon(() => ionButton('Bearbeiten')))
    const name = await screen.findByLabelText('Bezeichnung')
    expect(name).toHaveValue('Maske 01')
    expect(screen.getByLabelText('Code')).toHaveValue('M-001')
    fireEvent.change(name, { target: { value: 'Maske 1' } })
    fireEvent.click(ionButton('Speichern')!)
    await waitFor(() => expect(calls.updatedItems).toHaveLength(1))
    expect(calls.updatedItems[0]).toEqual({
      itemId: 'm01',
      input: { name: 'Maske 1', serial: 'DR-4711-01', barcode: 'M-001', manufacturedOn: '2016-03-01', note: '' },
    })
  })

  it('offers no editing below manage', async () => {
    renderAt(paths.itemEdit('m01'), 'check')
    expect(await screen.findByText('Keine Berechtigung.')).toBeInTheDocument()
  })

  it('deletes an item without history after confirmation', async () => {
    renderAt(paths.itemEdit('m02'), 'manage')
    fireEvent.click(await findIon(() => ionButton('Gerät löschen')))
    expect(await screen.findByText('Maske 02 löschen?')).toBeInTheDocument()
    fireEvent.click(await findIon(() => alertButton('Löschen')))
    await waitFor(() => expect(calls.deletedItems).toEqual(['m02']))
    expect(await screen.findByRole('heading', { name: 'Atemschutzmasken' })).toBeInTheDocument()
  })

  it('keeps an item when deletion is dismissed', async () => {
    renderAt(paths.itemEdit('m02'), 'manage')
    fireEvent.click(await findIon(() => ionButton('Gerät löschen')))
    fireEvent.click(await findIon(() => alertButton('Abbrechen')))
    await waitFor(() => expect(document.querySelector('ion-alert')).not.toBeInTheDocument())
    expect(calls.deletedItems).toEqual([])
  })

  it('offers no deletion once an item has history', async () => {
    renderAt(paths.itemEdit('m01'), 'manage')
    expect(await screen.findByText(historyNotice)).toBeInTheDocument()
    expect(button('Gerät löschen')).not.toBeInTheDocument()
  })

  it('explains when the server refuses because history appeared meanwhile', async () => {
    failing.deleteItem = true
    renderAt(paths.itemEdit('m02'), 'manage')
    fireEvent.click(await findIon(() => ionButton('Gerät löschen')))
    fireEvent.click(await findIon(() => alertButton('Löschen')))
    expect(await screen.findByText(historyNotice)).toBeInTheDocument()
    expect(calls.deletedItems).toEqual([])
  })

  it('requires a trigger for a check type', async () => {
    renderAt(paths.manage, 'manage')
    await openCheckTypes()
    set('Name', 'Sichtprüfung')
    fireEvent.click(ionButton('Prüfart anlegen')!)
    expect(await screen.findByText('Intervall oder „nach Verwendung“ angeben.')).toBeInTheDocument()
    expect(calls.createdCheckTypes).toEqual([])
  })

  it('creates one check type on a double tap', async () => {
    renderAt(paths.manage, 'manage')
    await openCheckTypes()
    set('Name', 'Sichtprüfung')
    set('Intervall in Monaten', '6')
    fireEvent.click(ionButton('Prüfart anlegen')!)
    fireEvent.click(ionButton('Prüfart anlegen')!)
    await waitFor(() => expect(calls.createdCheckTypes.length).toBeGreaterThan(0))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(calls.createdCheckTypes).toHaveLength(1)
  })

  it('creates a check type', async () => {
    renderAt(paths.manage, 'manage')
    await openCheckTypes()
    set('Name', 'Sichtprüfung')
    set('Intervall in Monaten', '6')
    fireEvent.click(screen.getByLabelText('nach Verwendung'))
    fireEvent.click(screen.getByLabelText('gilt auch als Maskenprüfung'))
    fireEvent.click(screen.getByLabelText('Standardprüfung'))
    fireEvent.click(ionButton('Prüfart anlegen')!)
    await waitFor(() => expect(calls.createdCheckTypes).toHaveLength(1))
    expect(calls.createdCheckTypes[0]).toEqual({
      categoryId: 'masken',
      name: 'Sichtprüfung',
      intervalMonths: 6,
      afterUse: true,
      isDefault: true,
      alsoSatisfies: ['maskenpruefung'],
    })
  })

  it('edits a check type, offering only others of its category', async () => {
    renderAt(paths.manage, 'manage')
    await openCheckTypes()
    fireEvent.click(screen.getByText('Maskenprüfung'))
    expect(await screen.findByLabelText('Name')).toHaveValue('Maskenprüfung')
    expect(screen.queryByLabelText('gilt auch als Maskenprüfung')).not.toBeInTheDocument()
    expect(screen.getByLabelText('gilt auch als 5-Jahres-Prüfung')).toBeInTheDocument()
    expect(screen.queryByLabelText('gilt auch als Jahresprüfung')).not.toBeInTheDocument()
    set('Intervall in Monaten', '24')
    fireEvent.click(ionButton('Speichern')!)
    await waitFor(() => expect(calls.updatedCheckTypes).toHaveLength(1))
    expect(calls.updatedCheckTypes[0].input.intervalMonths).toBe(24)
  })

  it('shows and changes the default of a check type', async () => {
    data.checkTypes = data.checkTypes.map((t) => ({ ...t, isDefault: t.id === 'maskenpruefung' }))
    renderAt(paths.manage, 'manage')
    await openCheckTypes()
    expect(screen.getByText('Standard · alle 12 Monate · nach Verwendung')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Maskenprüfung'))
    const checkbox = await screen.findByLabelText('Standardprüfung')
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    fireEvent.click(ionButton('Speichern')!)
    await waitFor(() => expect(calls.updatedCheckTypes).toHaveLength(1))
    expect(calls.updatedCheckTypes[0].input.isDefault).toBe(false)
  })

  it('explains why a used check type cannot be deleted', async () => {
    failing.deleteCheckType = true
    renderAt(paths.manage, 'manage')
    await openCheckTypes()
    fireEvent.click(screen.getByText('Maskenprüfung'))
    fireEvent.click(await findIon(() => ionButton('Prüfart löschen')))
    fireEvent.click(await findIon(() => alertButton('Löschen')))
    expect(await screen.findByText('Prüfart wird noch verwendet und kann nicht gelöscht werden.')).toBeInTheDocument()
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

// Ionic switches are driven by clicking the ion-toggle host; vite.config.ts makes their properties
// and events work under vitest. Real-browser behaviour is covered by `make e2e`.
describe('notification settings', () => {
  const open = async () => {
    renderAt(paths.settings, 'use')
    await screen.findByText('Erinnerungen')
  }
  const chipActive = (text: string) => ionChip(text)!.getAttribute('aria-pressed') === 'true'
  const secondLine = (label: string) => ionItem(label)!.querySelector('p')!.textContent
  const checked = (label: string) => (ionToggle(label) as HTMLInputElement).checked
  const flip = async (label: string) => fireEvent.click(await findIon(() => ionToggle(label)))
  const enabled = { id: 'n1', categoryId: 'masken', timings: [14, 3, 0], weeklyOverdue: true }
  // Every group has empty live regions from the start; the message goes into the matching one.
  const announced = (role: 'alert' | 'status') =>
    waitFor(() => {
      const region = screen.getAllByRole(role).find((el) => el.textContent?.trim())
      if (!region) throw new Error(`no ${role} with text`)
      return region
    })

  it('has empty live regions before any action', async () => {
    await open()
    await findIon(() => ionItem('Nicht stören'))
    const statuses = screen.getAllByRole('status')
    const alerts = screen.getAllByRole('alert')
    expect(statuses.length).toBeGreaterThanOrEqual(3)
    expect(alerts.length).toBeGreaterThanOrEqual(3)
    expect([...statuses, ...alerts].every((el) => el.textContent === '')).toBe(true)
  })

  it('lists each permitted category with a switch, off without a setting', async () => {
    await open()
    await findIon(() => ionItem('Atemschutzmasken'))
    expect(secondLine('Atemschutzmasken')).toBe('Aus')
    expect(secondLine('Lungenautomaten')).toBe('Aus')
    expect(checked('Atemschutzmasken')).toBe(false)
    expect(checked('Lungenautomaten')).toBe(false)
    expect(ionChip('14')).toBeNull()
    expect(ionItem('Wöchentlich bei Überfälligem')).toBeNull()
  })

  it('says why there are no reminders without a permitted category', async () => {
    data.categories = []
    await open()
    expect(await screen.findByText('Noch keine Kategorie freigegeben, daher keine Erinnerungen.')).toBeInTheDocument()
    expect(ionItem('Atemschutzmasken')).toBeNull()
    expect(await findIon(() => ionToggle('Nicht stören'))).not.toBeNull()
  })

  it('summarizes a category that is on and shows its reminders', async () => {
    notificationState.settings = [enabled]
    await open()
    await findIon(() => ionChip('14'))
    expect(secondLine('Atemschutzmasken')).toBe('14, 3 Tage vorher · Am Tag · wöchentlich')
    expect(secondLine('Lungenautomaten')).toBe('Aus')
    expect(ionItem('Erinnerung vor Fälligkeit')).not.toBeNull()
    expect(['14', '7', '3', '1', 'Am Tag'].map(chipActive)).toEqual([true, false, true, false, true])
    expect(checked('Atemschutzmasken')).toBe(true)
    expect(checked('Wöchentlich bei Überfälligem')).toBe(true)
    expect(document.querySelectorAll('ion-chip')).toHaveLength(5)
  })

  it('turning a category on creates its setting with chips', async () => {
    await open()
    await flip('Atemschutzmasken')
    await findIon(() => ionChip('14'))
    expect(['14', '7', '3', '1', 'Am Tag'].map(chipActive)).toEqual([true, false, true, false, true])
    expect(notificationState.settings).toEqual([{ id: 'n1', categoryId: 'masken', timings: [14, 3, 0], weeklyOverdue: true }])
    expect(checked('Atemschutzmasken')).toBe(true)
    expect(secondLine('Atemschutzmasken')).toBe('14, 3 Tage vorher · Am Tag · wöchentlich')
  })

  it('turning a category off deletes the setting', async () => {
    notificationState.settings = [enabled]
    await open()
    await waitFor(() => expect(checked('Atemschutzmasken')).toBe(true))
    await flip('Atemschutzmasken')
    await waitFor(() => expect(notificationState.settings).toEqual([]))
    await waitFor(() => expect(ionChip('14')).toBeNull())
    expect(checked('Atemschutzmasken')).toBe(false)
    expect(secondLine('Atemschutzmasken')).toBe('Aus')
  })

  it('switching the weekly reminder saves it', async () => {
    notificationState.settings = [enabled]
    await open()
    await flip('Wöchentlich bei Überfälligem')
    await waitFor(() => expect(notificationState.settings[0].weeklyOverdue).toBe(false))
    await waitFor(() => expect(secondLine('Atemschutzmasken')).toBe('14, 3 Tage vorher · Am Tag'))
    expect(checked('Wöchentlich bei Überfälligem')).toBe(false)
  })

  it('flips a switch back when its save fails', async () => {
    await open()
    notificationState.failingSaves = true
    await flip('Atemschutzmasken')
    expect(await announced('alert')).toHaveTextContent('Speichern fehlgeschlagen.')
    await waitFor(() => expect(checked('Atemschutzmasken')).toBe(false))
    expect(notificationState.settings).toEqual([])
    expect(secondLine('Atemschutzmasken')).toBe('Aus')
    expect(ionChip('14')).toBeNull()
  })

  it('toggling a chip saves the timings', async () => {
    notificationState.settings = [enabled]
    await open()
    fireEvent.click(await findIon(() => ionChip('7')))
    await waitFor(() => expect(notificationState.settings[0].timings).toEqual([14, 7, 3, 0]))
    await waitFor(() => expect(secondLine('Atemschutzmasken')).toBe('14, 7, 3 Tage vorher · Am Tag · wöchentlich'))
    fireEvent.click(ionChip('14')!)
    await waitFor(() => expect(notificationState.settings[0].timings).toEqual([7, 3, 0]))
  })

  it('offers the chips as toggle buttons that work with the keyboard', async () => {
    notificationState.settings = [enabled]
    await open()
    const chip = await screen.findByRole('button', { name: '7', pressed: false })
    expect(chip).toHaveAttribute('tabindex', '0')
    fireEvent.keyDown(chip, { key: 'Enter' })
    await waitFor(() => expect(notificationState.settings[0].timings).toEqual([14, 7, 3, 0]))
    fireEvent.keyDown(await screen.findByRole('button', { name: '14', pressed: true }), { key: ' ' })
    await waitFor(() => expect(notificationState.settings[0].timings).toEqual([7, 3, 0]))
  })

  it('keeps timings outside the chips when a chip is toggled', async () => {
    notificationState.settings = [{ ...enabled, timings: [30, 3] }]
    await open()
    fireEvent.click(await findIon(() => ionChip('1')))
    await waitFor(() => expect(notificationState.settings[0].timings).toEqual([30, 3, 1]))
  })

  it('shows a failed save and goes back to what the server has', async () => {
    notificationState.settings = [enabled]
    await open()
    notificationState.failingSaves = true
    fireEvent.click(await findIon(() => ionChip('7')))
    expect(await announced('alert')).toHaveTextContent('Speichern fehlgeschlagen.')
    await waitFor(() => expect(chipActive('7')).toBe(false))
    expect(notificationState.settings[0].timings).toEqual([14, 3, 0])
    expect(secondLine('Atemschutzmasken')).toBe('14, 3 Tage vorher · Am Tag · wöchentlich')
  })

  it('shows the default quiet time before anything is saved', async () => {
    await open()
    await findIon(() => ionItem('Nicht stören'))
    expect(secondLine('Nicht stören')).toBe('22:00 bis 07:00')
    expect(checked('Nicht stören')).toBe(true)
    expect(screen.getByLabelText('Von')).toHaveValue('22:00')
    expect(screen.getByLabelText('Bis')).toHaveValue('07:00')
    expect(ionButton('Ruhezeit speichern')).toBeNull()
  })

  it('shows no times while quiet time is off', async () => {
    notificationState.quiet = { from: '', until: '' }
    await open()
    await findIon(() => ionItem('Nicht stören'))
    expect(secondLine('Nicht stören')).toBe('Aus')
    expect(checked('Nicht stören')).toBe(false)
    expect(screen.queryByLabelText('Von')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Bis')).not.toBeInTheDocument()
  })

  it('turning quiet time off saves empty times', async () => {
    await open()
    await screen.findByLabelText('Von')
    await flip('Nicht stören')
    await waitFor(() => expect(notificationState.savedQuiet).toEqual([{ from: '', until: '' }]))
    await waitFor(() => expect(screen.queryByLabelText('Von')).not.toBeInTheDocument())
    expect(secondLine('Nicht stören')).toBe('Aus')
    expect(checked('Nicht stören')).toBe(false)
  })

  it('restores the entered times when quiet time is turned on again', async () => {
    await open()
    fireEvent.change(await screen.findByLabelText('Von'), { target: { value: '21:30' } })
    await waitFor(() => expect(secondLine('Nicht stören')).toBe('21:30 bis 07:00'))
    await flip('Nicht stören')
    await waitFor(() => expect(secondLine('Nicht stören')).toBe('Aus'))
    await flip('Nicht stören')
    await waitFor(() => expect(secondLine('Nicht stören')).toBe('21:30 bis 07:00'))
    expect(notificationState.savedQuiet.at(-1)).toEqual({ from: '21:30', until: '07:00' })
    expect(screen.getByLabelText('Von')).toHaveValue('21:30')
    expect(checked('Nicht stören')).toBe(true)
  })

  it('saves a changed quiet time right away', async () => {
    await open()
    fireEvent.change(await screen.findByLabelText('Von'), { target: { value: '21:30' } })
    await waitFor(() => expect(notificationState.savedQuiet).toEqual([{ from: '21:30', until: '07:00' }]))
    await waitFor(() => expect(secondLine('Nicht stören')).toBe('21:30 bis 07:00'))
    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '06:00' } })
    await waitFor(() => expect(notificationState.savedQuiet).toHaveLength(2))
    expect(notificationState.savedQuiet[1]).toEqual({ from: '21:30', until: '06:00' })
  })

  it('puts the times back to the saved ones after a failed save', async () => {
    await open()
    notificationState.failingSaves = true
    fireEvent.change(await screen.findByLabelText('Von'), { target: { value: '21:30' } })
    expect(await announced('alert')).toHaveTextContent('Speichern fehlgeschlagen.')
    await waitFor(() => expect(screen.getByLabelText('Von')).toHaveValue('22:00'))
    expect(secondLine('Nicht stören')).toBe('22:00 bis 07:00')
  })

  it('saves a time changed back while the first save is pending', async () => {
    notificationState.quiet = { from: '22:00', until: '07:00' }
    let release = () => {}
    notificationState.quietGate = new Promise<void>((resolve) => (release = resolve))
    await open()
    fireEvent.change(await screen.findByLabelText('Von'), { target: { value: '23:00' } })
    fireEvent.change(screen.getByLabelText('Von'), { target: { value: '22:00' } })
    release()
    await waitFor(() => expect(notificationState.savedQuiet.at(-1)).toEqual({ from: '22:00', until: '07:00' }))
    await waitFor(() => expect(secondLine('Nicht stören')).toBe('22:00 bis 07:00'))
    expect(notificationState.quiet).toEqual({ from: '22:00', until: '07:00' })
    expect(screen.getByLabelText('Von')).toHaveValue('22:00')
  })

  it('saves nothing while a time is incomplete', async () => {
    await open()
    fireEvent.change(await screen.findByLabelText('Von'), { target: { value: '' } })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(notificationState.savedQuiet).toEqual([])
  })

  it('rejects equal times', async () => {
    await open()
    fireEvent.change(await screen.findByLabelText('Bis'), { target: { value: '22:00' } })
    expect(await announced('alert')).toHaveTextContent('Von und Bis dürfen nicht gleich sein.')
    expect(notificationState.savedQuiet).toEqual([])
    expect(screen.getByLabelText('Bis')).toHaveValue('22:00')
  })

  it('shows the install guide on iOS', async () => {
    pushState.support = 'needsInstall'
    await open()
    expect(await screen.findByText(/Zum Home-Bildschirm hinzufügen/)).toBeInTheDocument()
    expect(secondLine('Push-Nachrichten')).toBe('Aus')
    expect((ionToggle('Push-Nachrichten') as HTMLInputElement).disabled).toBe(true)
    expect(ionItem('Testnachricht senden')).toBeNull()
  })

  it('says when push is not set up', async () => {
    pushState.available = false
    await open()
    expect(await screen.findByText('Push ist auf diesem Server nicht eingerichtet.')).toBeInTheDocument()
    expect(secondLine('Push-Nachrichten')).toBe('Aus')
  })

  it('explains push that is off', async () => {
    await open()
    expect(await screen.findByText('Ohne Push auf diesem Gerät kommen keine Nachrichten an.')).toBeInTheDocument()
    expect(secondLine('Push-Nachrichten')).toBe('Aus')
    expect(checked('Push-Nachrichten')).toBe(false)
    expect(ionItem('Testnachricht senden')).toBeNull()
  })

  it('enables push on this device', async () => {
    await open()
    await flip('Push-Nachrichten')
    await waitFor(() => expect(pushState.calls).toContain('enablePush'))
    await waitFor(() => expect(secondLine('Push-Nachrichten')).toBe('Aktiv auf diesem Gerät'))
    expect(checked('Push-Nachrichten')).toBe(true)
    expect(ionItem('Testnachricht senden')).not.toBeNull()
  })

  it('says when permission was refused', async () => {
    pushState.denied = true
    await open()
    await flip('Push-Nachrichten')
    expect(await announced('alert')).toHaveTextContent('Benachrichtigungen sind im Browser blockiert.')
    await waitFor(() => expect(checked('Push-Nachrichten')).toBe(false))
    expect(secondLine('Push-Nachrichten')).toBe('Aus')
    expect(ionItem('Testnachricht senden')).toBeNull()
  })

  it('offers the test push when push is on', async () => {
    pushState.enabled = true
    await open()
    await findIon(() => ionItem('Testnachricht senden'))
    expect(secondLine('Push-Nachrichten')).toBe('Aktiv auf diesem Gerät')
    expect(screen.getByText('Dieses Gerät bekommt Erinnerungen, auch wenn die App geschlossen ist.')).toBeInTheDocument()
  })

  it('sends a test push', async () => {
    pushState.enabled = true
    await open()
    fireEvent.click(await findIon(() => ionItem('Testnachricht senden')))
    expect(await announced('status')).toHaveTextContent('Testnachricht an 1 Gerät gesendet.')
  })

  it('reports the rate limit of the test push', async () => {
    pushState.enabled = true
    pushState.tooMany = true
    await open()
    fireEvent.click(await findIon(() => ionItem('Testnachricht senden')))
    expect(await announced('alert')).toHaveTextContent('Zu viele Versuche. Bitte eine Minute warten.')
  })
})
