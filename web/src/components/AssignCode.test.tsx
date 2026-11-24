import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { calls, data, failing } from '../test/fakeMaterial'
import { findIon, ionButton, ionItem, typeInto } from '../test/ionic'
import AssignCode from './AssignCode'

vi.mock('../api/material', () => import('../test/fakeMaterial'))

async function open() {
  const onAssigned = vi.fn()
  render(<AssignCode code="NEW-1" items={data.items} onAssigned={onAssigned} />)
  fireEvent.click(await findIon(() => ionButton('Gerät zuordnen')))
  return onAssigned
}

describe('AssignCode', () => {
  it('lists items without a code before items with one', async () => {
    await open()
    const rows = [...document.querySelectorAll('ion-item')].map((el) => el.textContent?.trim() ?? '')
    expect(rows.findIndex((t) => t.startsWith('LA 02'))).toBeLessThan(rows.findIndex((t) => t.startsWith('Maske 01')))
  })

  it('saves the code on the picked item and reports it', async () => {
    const onAssigned = await open()
    fireEvent.click(await findIon(() => ionItem('Maske 01')))
    await waitFor(() => expect(onAssigned).toHaveBeenCalled())
    expect(calls.assigned).toEqual([{ itemId: 'm01', barcode: 'NEW-1' }])
    expect(onAssigned.mock.calls[0][0]).toMatchObject({ id: 'm01', barcode: 'NEW-1' })
  })

  it('narrows the list by the typed text', async () => {
    await open()
    typeInto(await screen.findByLabelText('Gerät suchen'), 'LA 01')
    expect(ionItem('Maske 01')).toBeNull()
    expect(ionItem('LA 01')).not.toBeNull()
  })

  it('shows the taken-code message and does not report', async () => {
    failing.barcode = true
    const onAssigned = await open()
    fireEvent.click(await findIon(() => ionItem('Maske 01')))
    expect(await screen.findByText('Code ist bereits vergeben.')).toBeInTheDocument()
    expect(onAssigned).not.toHaveBeenCalled()
  })
})
