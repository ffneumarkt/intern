import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { paths } from './routes'

function renderAt(path: string, level?: string) {
  if (level) localStorage.setItem('sketch.level', level)
  return render(<App initialPath={path} />)
}

// Ionic moves aria attributes into the shadow DOM, so tabs are found by their visible label.
const tab = (name: string) =>
  [...document.querySelectorAll('ion-tab-button')].find((b) => b.textContent?.trim() === name) ?? null
const findTab = (name: string) => waitFor(() => {
  const t = tab(name)
  if (!t) throw new Error(`tab ${name} not found`)
  return t
})

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
