import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { today } from '../today'
import { paths } from '../routes'
import { levelsFailing, signInAs, type Level } from '../test/fakeAuth'
import { calls, data, failing } from '../test/fakeMaterial'
import { findIon, ionButton, ionTab } from '../test/ionic'

vi.mock('../api/auth', () => import('../test/fakeAuth'))
vi.mock('../api/material', () => import('../test/fakeMaterial'))
vi.mock('../api/passkeys', () => import('../test/fakePasskeys'))

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
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt(paths.item('m01'), 'check')
    fireEvent.click(await findIon(() => ionButton('Ausscheiden')))
    await waitFor(() => expect(calls.retired).toEqual(['m01']))
    expect(window.confirm).toHaveBeenCalledWith('Maske 01 ausscheiden?')
  })

  it('does nothing when dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt(paths.item('m01'), 'check')
    fireEvent.click(await findIon(() => ionButton('Ausscheiden')))
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
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt(paths.itemEdit('m02'), 'manage')
    fireEvent.click(await findIon(() => ionButton('Gerät löschen')))
    await waitFor(() => expect(calls.deletedItems).toEqual(['m02']))
    expect(window.confirm).toHaveBeenCalledWith('Maske 02 löschen?')
    expect(await screen.findByRole('heading', { name: 'Atemschutzmasken' })).toBeInTheDocument()
  })

  it('keeps an item when deletion is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt(paths.itemEdit('m02'), 'manage')
    fireEvent.click(await findIon(() => ionButton('Gerät löschen')))
    expect(calls.deletedItems).toEqual([])
  })

  it('offers no deletion once an item has history', async () => {
    renderAt(paths.itemEdit('m01'), 'manage')
    expect(await screen.findByText(historyNotice)).toBeInTheDocument()
    expect(button('Gerät löschen')).not.toBeInTheDocument()
  })

  it('explains when the server refuses because history appeared meanwhile', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    failing.deleteItem = true
    renderAt(paths.itemEdit('m02'), 'manage')
    fireEvent.click(await findIon(() => ionButton('Gerät löschen')))
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
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    failing.deleteCheckType = true
    renderAt(paths.manage, 'manage')
    await openCheckTypes()
    fireEvent.click(screen.getByText('Maskenprüfung'))
    fireEvent.click(await findIon(() => ionButton('Prüfart löschen')))
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
