import { IonSelectOption } from '@ionic/react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { choose, findIon, ionSelect, selectedText, setToggle, typeInto } from '../test/ionic'
import { CheckboxField, Field, SelectField, TextAreaField } from './Field'

describe('Field', () => {
  it('labels the inner input, passes type, autocomplete, required and max, and reports typing', async () => {
    const onChange = vi.fn()
    render(<Field label="E-Mail" type="email" autoComplete="username" value="a@b.at" onChange={onChange} required max="9" />)
    const input = await screen.findByLabelText('E-Mail')
    expect(input.tagName).toBe('INPUT')
    expect(input.closest('ion-input')).not.toBeNull()
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('autocomplete', 'username')
    expect(input).toBeRequired()
    expect(input).toHaveAttribute('max', '9')
    expect(input).toHaveValue('a@b.at')
    typeInto(input, 'c@d.at')
    expect(onChange).toHaveBeenLastCalledWith('c@d.at')
  })

  it('follows its controlled value', async () => {
    function Controlled() {
      const [value, setValue] = useState('alt')
      return (
        <>
          <Field label="Name" value={value} onChange={setValue} />
          <button onClick={() => setValue('vom Server')}>reset</button>
        </>
      )
    }
    render(<Controlled />)
    const input = await screen.findByLabelText('Name')
    typeInto(input, 'neu')
    expect(input).toHaveValue('neu')
    fireEvent.click(screen.getByText('reset'))
    await waitFor(() => expect(input).toHaveValue('vom Server'))
  })
})

describe('TextAreaField', () => {
  it('labels the inner textarea and reports typing', async () => {
    const onChange = vi.fn()
    render(<TextAreaField label="Notiz" value="alt" onChange={onChange} />)
    const textarea = await screen.findByLabelText('Notiz')
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea.closest('ion-textarea')).not.toBeNull()
    expect(textarea).toHaveValue('alt')
    typeInto(textarea, 'Riss')
    expect(onChange).toHaveBeenLastCalledWith('Riss')
  })
})

describe('SelectField', () => {
  function Controlled({ initial = 'b' }: { initial?: string }) {
    const [value, setValue] = useState(initial)
    return (
      <SelectField label="Art" value={value} onChange={setValue}>
        <IonSelectOption value="a">Alpha</IonSelectOption>
        <IonSelectOption value="b">Beta</IonSelectOption>
      </SelectField>
    )
  }

  it('shows the label and the chosen option, and choosing changes it', async () => {
    render(<Controlled />)
    const select = await findIon(() => ionSelect('Art'))
    expect(select).toHaveValue('b')
    await waitFor(() => expect(selectedText(select)).toBe('Beta'))
    choose(select, 'a')
    expect(select).toHaveValue('a')
    await waitFor(() => expect(selectedText(select)).toBe('Alpha'))
  })

  it('opens the default alert interface with a German cancel button', async () => {
    render(<Controlled />)
    const select = (await findIon(() => ionSelect('Art'))) as HTMLIonSelectElement
    expect(select.interface).toBe('alert')
    expect(select.cancelText).toBe('Abbrechen')
  })

  it('shows no selection for a value that is not among the options', async () => {
    render(<Controlled initial="geloescht" />)
    const select = await findIon(() => ionSelect('Art'))
    expect(selectedText(select)).toBe('')
    choose(select, 'b')
    await waitFor(() => expect(selectedText(select)).toBe('Beta'))
  })
})

describe('CheckboxField', () => {
  it('is a labelled toggle whose checked state follows its prop, and a click reports the new state', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<CheckboxField label="nach Verwendung" checked={false} onChange={onChange} />)
    const toggle = await screen.findByLabelText('nach Verwendung')
    expect(toggle.tagName).toBe('ION-TOGGLE')
    expect(toggle).toHaveTextContent('nach Verwendung')
    expect(toggle).not.toBeChecked()
    rerender(<CheckboxField label="nach Verwendung" checked onChange={onChange} />)
    await waitFor(() => expect(toggle).toBeChecked())
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenLastCalledWith(false)
    rerender(<CheckboxField label="nach Verwendung" checked={false} onChange={onChange} />)
    setToggle(toggle, false)
    expect(onChange).toHaveBeenCalledTimes(1)
    setToggle(toggle, true)
    expect(onChange).toHaveBeenLastCalledWith(true)
  })
})
