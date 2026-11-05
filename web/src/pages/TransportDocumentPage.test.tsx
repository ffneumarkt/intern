import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { paths } from '../routes'
import { signInAs } from '../test/fakeAuth'
import { transportState } from '../test/fakeTransport'
import { choose, findIon, ionButton, ionSelect, selectedText, typeInto } from '../test/ionic'
import type { Trip } from '../transportDocument/calc'

vi.mock('../api/auth', () => import('../test/fakeAuth'))
vi.mock('../api/notifications', () => import('../test/fakeNotifications'))
vi.mock('../api/passkeys', () => import('../test/fakePasskeys'))
vi.mock('../api/push', () => import('../test/fakePush'))
vi.mock('../api/transport', () => import('../test/fakeTransport'))

const fillForm = vi.fn<(form: ArrayBuffer, trips: Trip[], title: string) => Promise<Uint8Array>>()
vi.mock('../transportDocument/fillForm', () => ({
  fillForm: (form: ArrayBuffer, trips: Trip[], title: string) => fillForm(form, trips, title),
}))

const countLabel = 'Anzahl Flaschen à 6,8 l'
const openLabel = 'PDF öffnen'
const station = { name: 'FF Neumarkt', street: 'Edlwies 3', postalCode: '4212', town: 'Neumarkt im Mühlkreis' }
const fillingStation = { name: 'FF Grünbach', street: 'Freiwaldstraße 15', postalCode: '4264', town: 'Grünbach bei Freistadt' }

let tab: { location: { href: string }; close: ReturnType<typeof vi.fn> }

beforeEach(() => {
  fillForm.mockReset().mockResolvedValue(new Uint8Array([1, 2, 3]))
  tab = { location: { href: '' }, close: vi.fn() }
  vi.stubGlobal('open', vi.fn(() => tab))
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([9]))))
  URL.createObjectURL = vi.fn(() => 'blob:pdf')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => vi.unstubAllGlobals())

async function renderPage() {
  render(<App initialPath={paths.transportDocument} />)
  return screen.findByLabelText(countLabel)
}

const openButton = () => ionButton(openLabel)!
const enabled = () => !openButton().hasAttribute('disabled') && (openButton() as HTMLButtonElement).disabled !== true

describe('Beförderungspapier', () => {
  it('needs only the count and one tap for the usual trip', async () => {
    const count = await renderPage()
    expect(enabled()).toBe(false)
    typeInto(count, '4')
    await waitFor(() => expect(enabled()).toBe(true))
    fireEvent.click(openButton())
    await waitFor(() => expect(tab.location.href).toBe('blob:pdf'))
    expect(window.open).toHaveBeenCalledWith('', '_blank')
    expect(fillForm.mock.calls[0][1]).toEqual([
      { sender: station, recipient: fillingStation, count: 4, tenths: 272 },
      { sender: fillingStation, recipient: station, count: 4, tenths: 272 },
    ])
    expect(fillForm.mock.calls[0][2]).toMatch(/^Beförderungspapier \d\d\.\d\d\.\d{4} \d\d:\d\d$/)
  })

  it('prefills the count of the last document', async () => {
    const count = await renderPage()
    typeInto(count, '5')
    await waitFor(() => expect(enabled()).toBe(true))
    fireEvent.click(openButton())
    await waitFor(() => expect(tab.location.href).toBe('blob:pdf'))
    expect(localStorage.getItem('transportDocument.lastCount')).toBe('5')

    document.body.innerHTML = ''
    const again = await renderPage()
    expect((again as HTMLInputElement).value).toBe('5')
    expect(enabled()).toBe(true)
  })

  it('does not remember a count that was never opened', async () => {
    typeInto(await renderPage(), '4')
    expect(localStorage.getItem('transportDocument.lastCount')).toBeNull()
  })

  it('shows the total and the points limit', async () => {
    typeInto(await renderPage(), '4')
    await waitFor(() =>
      expect(screen.getAllByText((_, el) => el?.tagName === 'P' && el.textContent === '4 Flaschen à 6,8 l = 27,2 l = 27,2 Punkte (max. 1000)')).not.toHaveLength(0),
    )
  })

  it('blocks a count above the points limit', async () => {
    typeInto(await renderPage(), '200')
    expect(await screen.findByText(/Hinfahrt/, { selector: 'li' })).toBeInTheDocument()
    expect(enabled()).toBe(false)
  })

  it('lists the checklist', async () => {
    await renderPage()
    expect(await screen.findByText('Schutzkappen montiert')).toBeInTheDocument()
    expect(screen.getByText('Restdruck vorhanden')).toBeInTheDocument()
  })

  it('has the return trip follow the count until it is changed', async () => {
    const count = await renderPage()
    typeInto(count, '4')
    const back = await screen.findByLabelText('Anzahl Flaschen zurück')
    await waitFor(() => expect((back as HTMLInputElement).value).toBe('4'))
    typeInto(back, '3')
    typeInto(count, '6')
    await waitFor(() => expect(enabled()).toBe(true))
    fireEvent.click(openButton())
    await waitFor(() => expect(fillForm).toHaveBeenCalled())
    expect(fillForm.mock.calls[0][1].map((t) => t.count)).toEqual([6, 3])
  })

  it('leaves out the return trip with no cylinders coming back', async () => {
    const count = await renderPage()
    typeInto(count, '4')
    typeInto(await screen.findByLabelText('Anzahl Flaschen zurück'), '0')
    await waitFor(() => expect(enabled()).toBe(true))
    fireEvent.click(openButton())
    await waitFor(() => expect(fillForm).toHaveBeenCalled())
    expect(fillForm.mock.calls[0][1]).toHaveLength(1)
  })

  it('takes another address for the recipient', async () => {
    typeInto(await renderPage(), '2')
    const recipient = await findIon(() => ionSelect('Empfänger'))
    expect(selectedText(recipient)).toBe('FF Grünbach')
    choose(recipient, 'other')
    await waitFor(() => expect(enabled()).toBe(false))
    typeInto(await screen.findByLabelText('Name (Empfänger)'), 'Werkstatt Linz')
    typeInto(screen.getByLabelText('Straße und Hausnummer (Empfänger)'), 'Teststraße 1')
    typeInto(screen.getByLabelText('PLZ (Empfänger)'), '4020')
    typeInto(screen.getByLabelText('Ort (Empfänger)'), 'Linz')
    await waitFor(() => expect(enabled()).toBe(true))
    fireEvent.click(openButton())
    await waitFor(() => expect(fillForm).toHaveBeenCalled())
    expect(fillForm.mock.calls[0][1][0].recipient).toEqual({ name: 'Werkstatt Linz', street: 'Teststraße 1', postalCode: '4020', town: 'Linz' })
  })

  it('refuses the same sender and recipient', async () => {
    typeInto(await renderPage(), '2')
    choose(await findIon(() => ionSelect('Empfänger')), 'station')
    expect(await screen.findByText('Absender und Empfänger müssen verschieden sein.')).toBeInTheDocument()
    expect(enabled()).toBe(false)
  })

  it('falls back to a download when the tab is blocked', async () => {
    vi.stubGlobal('open', vi.fn(() => null))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    typeInto(await renderPage(), '4')
    await waitFor(() => expect(enabled()).toBe(true))
    fireEvent.click(openButton())
    await waitFor(() => expect(click).toHaveBeenCalled())
    click.mockRestore()
  })

  it('says so and closes the tab when the PDF cannot be made', async () => {
    fillForm.mockRejectedValue(new Error('boom'))
    typeInto(await renderPage(), '4')
    await waitFor(() => expect(enabled()).toBe(true))
    fireEvent.click(openButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF konnte nicht erstellt werden.')
    expect(tab.close).toHaveBeenCalled()
  })

  it('asks to shorten an address that does not fit', async () => {
    const error = new Error('too long')
    error.name = 'AddressTooLongError'
    fillForm.mockRejectedValue(error)
    typeInto(await renderPage(), '4')
    await waitFor(() => expect(enabled()).toBe(true))
    fireEvent.click(openButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Eine Adresse ist zu lang')
  })

  it('works without a login', async () => {
    signInAs(null)
    expect(await renderPage()).toBeInTheDocument()
  })

  it('asks for the recipient address when no Füllstelle is configured', async () => {
    transportState.settings.config.fillingStation = null
    typeInto(await renderPage(), '2')
    const recipient = await findIon(() => ionSelect('Empfänger'))
    expect(selectedText(recipient)).toBe('Andere Adresse')
    expect(await screen.findByText('Adressfelder prüfen.')).toBeInTheDocument()
    expect(enabled()).toBe(false)
  })

  it('shows a hint instead of the form when the settings never loaded', async () => {
    transportState.failing = true
    render(<App initialPath={paths.transportDocument} />)
    expect(await screen.findByText(/Einstellungen konnten nicht geladen werden/)).toBeInTheDocument()
    expect(screen.queryByLabelText(countLabel)).not.toBeInTheDocument()
  })
})
