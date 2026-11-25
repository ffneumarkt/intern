import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { Area } from '../api/auth'
import { paths } from '../routes'
import { adminState } from '../test/fakeAdmin'
import { signInAs } from '../test/fakeAuth'
import { data } from '../test/fakeMaterial'
import { transportState } from '../test/fakeTransport'
import { alertButton, choose, findIon, ionButton, ionItem, ionSelect, ionToggle, setToggle, typeInto } from '../test/ionic'

vi.mock('../api/admin', () => import('../test/fakeAdmin'))
vi.mock('../api/auth', () => import('../test/fakeAuth'))
vi.mock('../api/material', () => import('../test/fakeMaterial'))
vi.mock('../api/notifications', () => import('../test/fakeNotifications'))
vi.mock('../api/passkeys', () => import('../test/fakePasskeys'))
vi.mock('../api/push', () => import('../test/fakePush'))
vi.mock('../api/transport', () => import('../test/fakeTransport'))

const allAreas: Area[] = ['members', 'categories', 'transport', 'corrections']

function openAs(path: string, areas: Area[] = allAreas) {
  signInAs('manage', undefined, areas)
  return render(<App initialPath={path} />)
}
const set = (label: string, value: string) => typeInto(screen.getByLabelText(label), value)

describe('entry to the admin area', () => {
  it('shows Verwaltung in Einstellungen only to someone with an admin area', async () => {
    openAs(paths.settings, [])
    await screen.findByText('Einstellungen', { selector: 'h1' })
    expect(ionItem('Verwaltung')).toBeNull()
    cleanup()
    openAs(paths.settings, ['transport'])
    expect(await findIon(() => ionItem('Verwaltung'))).toBeInTheDocument()
  })

  it('lists only the areas the user holds', async () => {
    openAs(paths.admin, ['categories'])
    await findIon(() => ionItem('Kategorien'))
    expect(ionItem('Mitglieder')).toBeNull()
    expect(ionItem('Beförderungspapier')).toBeNull()
  })

  it('refuses every admin page without its area', async () => {
    for (const path of [paths.admin, paths.adminMembers, paths.adminMemberNew, paths.adminMember('hans'), paths.adminCategories, paths.adminCategoryNew, paths.adminTransport, paths.correction('m01', 'use', 'use1')]) {
      openAs(path, [])
      expect(await screen.findByText('Keine Berechtigung.'), path).toBeInTheDocument()
      cleanup()
    }
    openAs(paths.adminMembers, ['categories'])
    expect(await screen.findByText('Keine Berechtigung.')).toBeInTheDocument()
  })
})

describe('members', () => {
  it('lists the members with their email and a button for a new one', async () => {
    openAs(paths.adminMembers)
    expect(await findIon(() => ionItem('Hans Huber'))).toHaveTextContent('hans@example.com')
    fireEvent.click(await findIon(() => ionButton('Neues Mitglied')))
    expect(await screen.findByLabelText('E-Mail')).toBeInTheDocument()
  })

  it('creates a member and shows the setup link once', async () => {
    openAs(paths.adminMemberNew)
    await screen.findByLabelText('Name')
    fireEvent.click(await findIon(() => ionButton('Mitglied anlegen')))
    await waitFor(() => expect(screen.getAllByText('Bitte ausfüllen.').length).toBeGreaterThan(0))
    expect(adminState.calls.created).toEqual([])
    set('Name', 'Neu Mitglied')
    set('E-Mail', 'neu@example.com')
    fireEvent.click(ionButton('Mitglied anlegen')!)
    const link = await screen.findByTestId('setup-link')
    expect(link.textContent).toBe(`${window.location.origin}/einrichtung#neuer-token`)
    expect(adminState.calls.created).toEqual([{ name: 'Neu Mitglied', email: 'neu@example.com' }])
    fireEvent.click(ionButton('Fertig')!)
    expect(await findIon(() => ionItem('Neu Mitglied'))).toBeInTheDocument()
  })

  it('shows what the member may do and changes it at once', async () => {
    openAs(paths.adminMember('anna'))
    const level = await findIon(() => ionSelect('Atemschutzmasken'))
    expect(level).toHaveValue('use')
    choose(level, 'check')
    await waitFor(() => expect(adminState.calls.levels).toEqual([{ userId: 'anna', categoryId: 'masken', level: 'check' }]))
    choose(ionSelect('Lungenautomaten')!, 'manage')
    await waitFor(() => expect(adminState.calls.levels).toHaveLength(2))
    choose(ionSelect('Lungenautomaten')!, 'none')
    await waitFor(() => expect(adminState.calls.levels[2]).toEqual({ userId: 'anna', categoryId: 'lungenautomaten', level: null }))
  })

  it('grants and revokes an admin area', async () => {
    openAs(paths.adminMember('anna'))
    const toggle = await findIon(() => ionToggle('Kategorien'))
    setToggle(toggle, true)
    await waitFor(() => expect(adminState.calls.granted).toEqual([{ userId: 'anna', area: 'categories' }]))
    setToggle(await findIon(() => ionToggle('Kategorien')), false)
    await waitFor(() => expect(adminState.calls.revoked).toHaveLength(1))
  })

  it('says why the last members holder cannot lose the right', async () => {
    openAs(paths.adminMember('hans'))
    const toggle = await findIon(() => ionToggle('Mitglieder'))
    adminState.refuse = true
    setToggle(toggle, false)
    expect(await screen.findByText('Nicht möglich: Der letzte Verwalter der Mitglieder muss bleiben.')).toBeInTheDocument()
  })

  it('issues a new setup link', async () => {
    openAs(paths.adminMember('anna'))
    fireEvent.click(await findIon(() => ionButton('Neuer Einrichtungslink')))
    expect((await screen.findByTestId('setup-link')).textContent).toContain('/einrichtung#neuer-token')
    expect(adminState.calls.links).toEqual(['anna'])
  })

  it('explains that a member with rights needs deactivating before a link', async () => {
    openAs(paths.adminMember('hans'))
    const button = await findIon(() => ionButton('Neuer Einrichtungslink'))
    adminState.refuse = true
    fireEvent.click(button)
    expect(await screen.findByText(/zuerst deaktivieren/)).toBeInTheDocument()
  })

  it('deactivates after confirmation', async () => {
    openAs(paths.adminMember('anna'))
    fireEvent.click(await findIon(() => ionButton('Deaktivieren')))
    expect(await screen.findByText(/Anna Aigner deaktivieren/)).toBeInTheDocument()
    fireEvent.click(await findIon(() => alertButton('Deaktivieren')))
    await waitFor(() => expect(adminState.calls.patched).toEqual([{ id: 'anna', patch: { deactivated: true } }]))
  })

  it('saves a changed name and email', async () => {
    openAs(paths.adminMember('anna'))
    await screen.findByLabelText('Name')
    set('Name', 'Anna Neu')
    fireEvent.click(ionButton('Speichern')!)
    await waitFor(() => expect(adminState.calls.patched).toEqual([{ id: 'anna', patch: { name: 'Anna Neu', email: 'anna@example.com' } }]))
    expect(await screen.findByText('Gespeichert.')).toBeInTheDocument()
  })
})

describe('categories', () => {
  it('creates a category and lists it', async () => {
    openAs(paths.adminCategories)
    fireEvent.click(await findIon(() => ionButton('Neue Kategorie')))
    await screen.findByLabelText('Name')
    fireEvent.click(await findIon(() => ionButton('Kategorie anlegen')))
    await waitFor(() => expect(screen.getAllByText('Bitte ausfüllen.').length).toBeGreaterThan(0))
    set('Name', 'Schläuche')
    set('Höchste Lebensdauer in Jahren', '10')
    fireEvent.click(ionButton('Kategorie anlegen')!)
    expect(await findIon(() => ionItem('Schläuche'))).toHaveTextContent('Lebensdauer 10 Jahre')
    expect(adminState.calls.categories).toEqual([{ create: { name: 'Schläuche', maxServiceLifeYears: 10 } }])
  })

  it('renames a category', async () => {
    openAs(paths.adminCategory('masken'))
    expect(await screen.findByLabelText('Name')).toHaveValue('Atemschutzmasken')
    set('Name', 'Masken')
    fireEvent.click(ionButton('Speichern')!)
    expect(await findIon(() => ionItem('Masken'))).toBeInTheDocument()
  })

  it('explains that a category with devices cannot be deleted, and deletes an empty one', async () => {
    openAs(paths.adminCategory('masken'))
    fireEvent.click(await findIon(() => ionButton('Kategorie löschen')))
    fireEvent.click(await findIon(() => alertButton('Löschen')))
    expect(await screen.findByText('Kategorie hat noch Geräte und kann nicht gelöscht werden.')).toBeInTheDocument()
    cleanup()
    data.categories = [...data.categories, { id: 'leer', name: 'Leer' }]
    openAs(paths.adminCategory('leer'))
    fireEvent.click(await findIon(() => ionButton('Kategorie löschen')))
    fireEvent.click(await findIon(() => alertButton('Löschen')))
    await waitFor(() => expect(adminState.calls.deletedCategories).toEqual(['leer']))
  })
})

describe('Beförderungspapier settings', () => {
  it('saves a changed station name and the checklist', async () => {
    openAs(paths.adminTransport)
    expect(await screen.findByLabelText('Name der Station')).toHaveValue('FF Neumarkt')
    set('Name der Station', 'FF Neumarkt Mitte')
    set('Eine Zeile pro Punkt', 'Eins\n\nZwei')
    fireEvent.click(ionButton('Speichern')!)
    await waitFor(() => expect(transportState.saved).toHaveLength(1))
    expect(transportState.saved[0].config.station.name).toBe('FF Neumarkt Mitte')
    expect(transportState.saved[0].checklist).toEqual(['Eins', 'Zwei'])
    expect(await screen.findByText('Gespeichert.')).toBeInTheDocument()
  })

  it('refuses an empty station name', async () => {
    openAs(paths.adminTransport)
    await screen.findByLabelText('Name der Station')
    set('Name der Station', '')
    fireEvent.click(ionButton('Speichern')!)
    await waitFor(() => expect(screen.getAllByText('Bitte ausfüllen.').length).toBeGreaterThan(0))
    expect(transportState.saved).toEqual([])
  })

  it('has no abfüllstation when its name is empty', async () => {
    openAs(paths.adminTransport)
    await screen.findByLabelText('Name der Abfüllstation')
    set('Name der Abfüllstation', '')
    fireEvent.click(ionButton('Speichern')!)
    await waitFor(() => expect(transportState.saved).toHaveLength(1))
    expect(transportState.saved[0].config.fillingStation).toBeNull()
  })
})

describe('corrections', () => {
  it('opens a history entry for a holder and corrects a use', async () => {
    openAs(paths.item('m01'))
    fireEvent.click(await findIon(() => ionItem('Einsatz')))
    expect(await screen.findByLabelText('Erfasst von')).toHaveValue('Stationsrechner')
    set('Notiz', 'Brand Mehrfamilienhaus')
    fireEvent.click(ionButton('Speichern')!)
    await waitFor(() =>
      expect(adminState.calls.usePatches).toEqual([
        { id: 'use1', patch: { date: '2026-10-21', kind: 'operation', recordedByName: 'Stationsrechner', note: 'Brand Mehrfamilienhaus' } },
      ]),
    )
    expect(await screen.findByRole('heading', { name: 'Maske 01' })).toBeInTheDocument()
  })

  it('corrects a check result', async () => {
    openAs(paths.correction('m01', 'check', 'check1'))
    const result = await findIon(() => ionSelect('Ergebnis'))
    expect(result).toHaveValue('passed')
    choose(result, 'defect')
    fireEvent.click(ionButton('Speichern')!)
    await waitFor(() => expect(adminState.calls.checkPatches).toEqual([{ id: 'check1', patch: { date: '2025-11-03', result: 'defect', note: '' } }]))
  })

  it('deletes an entry after confirmation', async () => {
    openAs(paths.correction('m01', 'use', 'use1'))
    fireEvent.click(await findIon(() => ionButton('Eintrag löschen')))
    fireEvent.click(await findIon(() => alertButton('Löschen')))
    await waitFor(() => expect(adminState.calls.deletedUses).toEqual(['use1']))
  })

  it('explains why a check that decides the status cannot be deleted', async () => {
    openAs(paths.correction('m01', 'check', 'check1'))
    const remove = await findIon(() => ionButton('Eintrag löschen'))
    adminState.refuse = true
    fireEvent.click(remove)
    fireEvent.click(await findIon(() => alertButton('Löschen')))
    expect(await screen.findByText(/bestimmt den Status des Geräts/)).toBeInTheDocument()
  })

  it('lists earlier corrections below the history', async () => {
    adminState.corrections = [{ id: 'c1', adminName: 'Hans Huber', date: '2026-11-20', action: 'edit', collection: 'uses' }]
    openAs(paths.item('m01'))
    expect(await findIon(() => ionItem('Korrigiert von Hans Huber'))).toHaveTextContent('Eintrag geändert')
  })

  it('does not turn history rows into links for someone without the right', async () => {
    openAs(paths.item('m01'), [])
    const row = await findIon(() => ionItem('Einsatz'))
    expect(row.getAttribute('href')).toBeNull()
    expect(ionItem('Korrigiert von')).toBeNull()
  })
})
