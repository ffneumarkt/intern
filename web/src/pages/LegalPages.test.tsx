import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { paths } from '../routes'
import { signInAs } from '../test/fakeAuth'
import { findIon, ionItem, ionTab } from '../test/ionic'

vi.mock('../api/auth', () => import('../test/fakeAuth'))
vi.mock('../api/material', () => import('../test/fakeMaterial'))
vi.mock('../api/notifications', () => import('../test/fakeNotifications'))
vi.mock('../api/passkeys', () => import('../test/fakePasskeys'))
vi.mock('../api/push', () => import('../test/fakePush'))
vi.mock('../api/transport', () => import('../test/fakeTransport'))

const page = (name: string) => screen.findByRole('heading', { name, level: 1 })

describe('Info tab', () => {
  it('is in the tab bar of anonymous users only', async () => {
    signInAs(null)
    const { unmount } = render(<App initialPath={paths.start} />)
    await findIon(() => ionTab('Info'))
    unmount()
    signInAs('use')
    render(<App initialPath={paths.start} />)
    await findIon(() => ionTab('Material'))
    expect(ionTab('Info')).toBeNull()
  })

  it('opens a page with the Impressum and the Datenschutzerklärung', async () => {
    signInAs(null)
    render(<App initialPath={paths.start} />)
    fireEvent.click(await findIon(() => ionTab('Info')))
    await page('Info')
    expect(await findIon(() => ionItem('Impressum'))).toBeInTheDocument()
    fireEvent.click(ionItem('Datenschutz')!)
    expect(await page('Datenschutzerklärung')).toBeInTheDocument()
  })
})

describe('Impressum', () => {
  it('names who is responsible and how to reach them, without a login', async () => {
    signInAs(null)
    render(<App initialPath={paths.imprint} />)
    await page('Impressum')
    expect(screen.getAllByText(/Rainer Stroblmair/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Edlwies 3/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '02121@fr.ooelfv.at' })).toHaveAttribute('href', 'mailto:02121@fr.ooelfv.at')
    expect(screen.getByRole('link', { name: '+43 664 101 80 06' })).toHaveAttribute('href', 'tel:+436641018006')
    expect(screen.getByText('Haftungsausschluss')).toBeInTheDocument()
  })
})

describe('Datenschutzerklärung', () => {
  it('explains what the app stores, without a login', async () => {
    signInAs(null)
    render(<App initialPath={paths.privacy} />)
    await page('Datenschutzerklärung')
    for (const topic of ['Verantwortlicher', 'Beförderungspapier', 'Mitgliederbereich', 'Push-Nachrichten', 'Lokaler Speicher', 'Ihre Rechte als Betroffener']) {
      expect(screen.getByRole('heading', { name: topic, level: 2 })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Impressum' })).toBeInTheDocument()
  })
})

describe('Einstellungen', () => {
  it('has a group Rechtliches with both pages', async () => {
    signInAs('use')
    render(<App initialPath={paths.settings} />)
    const group = await screen.findByText('Rechtliches')
    expect(group).toBeInTheDocument()
    fireEvent.click(await findIon(() => ionItem('Impressum')))
    expect(await page('Impressum')).toBeInTheDocument()
  })

  it('opens the Datenschutzerklärung from there', async () => {
    signInAs('use')
    render(<App initialPath={paths.settings} />)
    fireEvent.click(await findIon(() => ionItem('Datenschutz')))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Datenschutzerklärung', level: 1 })).toBeInTheDocument())
    expect(within(document.body).getAllByText('Datenschutzerklärung').length).toBeGreaterThan(0)
  })
})
