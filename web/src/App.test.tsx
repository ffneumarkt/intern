import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { paths } from './routes'
import { findIon, ionTab } from './test/ionic'

function renderAt(path: string, level?: string) {
  if (level) localStorage.setItem('sketch.level', level)
  return render(<App initialPath={path} />)
}

const tab = ionTab
const findTab = (name: string) => findIon(() => ionTab(name))

describe('App shell', () => {
  it('shows public tabs only', async () => {
    renderAt(paths.start, 'public')
    expect(await findTab('Start')).toBeInTheDocument()
    expect(tab('Beförderungspapier')).toBeInTheDocument()
    expect(tab('Material')).not.toBeInTheDocument()
    expect(tab('Einstellungen')).not.toBeInTheDocument()
  })

  it('shows material tabs for use level', async () => {
    renderAt(paths.start, 'use')
    expect(await findTab('Material')).toBeInTheDocument()
    expect(tab('Start')).toBeInTheDocument()
    expect(tab('Beförderungspapier')).toBeInTheDocument()
    expect(tab('Einstellungen')).toBeInTheDocument()
  })

  it('redirects material to login when public', async () => {
    renderAt(paths.dueList, 'public')
    expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeInTheDocument()
  })

  it('view as switcher changes level', async () => {
    renderAt(paths.start, 'public')
    await userEvent.click(await screen.findByLabelText('Verwaltung'))
    expect(localStorage.getItem('sketch.level')).toBe('manage')
    expect(await findTab('Material')).toBeInTheDocument()
  })
})

describe('sketch level from url', () => {
  it('uses ?ansicht= over stored level', async () => {
    localStorage.setItem('sketch.level', 'public')
    window.history.replaceState(null, '', '/?ansicht=use')
    render(<App initialPath={paths.start} />)
    expect(await findTab('Material')).toBeInTheDocument()
    window.history.replaceState(null, '', '/')
  })
})
