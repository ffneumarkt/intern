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

  // The browser defaults of the old native fields: plain text is capitalised, corrected and
  // spellchecked; codes, credentials, dates and numbers are not.
  const typingHints = (input: HTMLElement) => [
    input.getAttribute('autocapitalize'),
    input.getAttribute('autocorrect'),
    // jsdom has no spellcheck property, so Stencil sets an attribute: present for true, absent for false.
    input.hasAttribute('spellcheck'),
  ]

  it('capitalises, corrects and spellchecks plain text by default', async () => {
    render(<Field label="Bezeichnung" value="" onChange={() => {}} />)
    expect(typingHints(await screen.findByLabelText('Bezeichnung'))).toEqual(['sentences', 'on', true])
  })

  it('turns the typing help off for code-like text', async () => {
    render(<Field label="Code" value="" onChange={() => {}} autoCapitalize="off" />)
    expect(typingHints(await screen.findByLabelText('Code'))).toEqual(['off', 'off', false])
  })

  it.each(['email', 'password', 'date', 'number'])('turns the typing help off for type %s', async (type) => {
    render(<Field label="Feld" type={type} value="" onChange={() => {}} />)
    expect(typingHints(await screen.findByLabelText('Feld'))).toEqual(['off', 'off', false])
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

  it('capitalises and spellchecks like a native textarea', async () => {
    render(<TextAreaField label="Notiz" value="" onChange={() => {}} />)
    const textarea = await screen.findByLabelText('Notiz')
    expect(textarea).toHaveAttribute('autocapitalize', 'sentences')
    expect(textarea).toHaveAttribute('spellcheck')
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

  it('opens a popover: one tap, anchored at the field', async () => {
    render(<Controlled />)
    const select = (await findIon(() => ionSelect('Art'))) as HTMLIonSelectElement
    expect(select.interface).toBe('popover')
  })

  it('reports an empty value as an empty string, not "undefined"', async () => {
    const onChange = vi.fn()
    render(
      <SelectField label="Art" value="a" onChange={onChange}>
        <IonSelectOption value="a">Alpha</IonSelectOption>
      </SelectField>,
    )
    const select = await findIon(() => ionSelect('Art'))
    fireEvent(select, new CustomEvent('ionChange', { detail: { value: undefined } }))
    expect(onChange).toHaveBeenLastCalledWith('')
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
    const toggle = await screen.findByRole('switch', { name: 'nach Verwendung' })
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

describe('required fields', () => {
  it('marks a required field so the label gets a red star, and leaves the others alone', async () => {
    render(
      <>
        <Field label="Bezeichnung" value="" onChange={() => {}} required />
        <Field label="Seriennummer" value="" onChange={() => {}} />
      </>,
    )
    expect((await screen.findByLabelText('Bezeichnung')).closest('ion-input')).toHaveClass('ui-required')
    expect(screen.getByLabelText('Seriennummer').closest('ion-input')).not.toHaveClass('ui-required')
  })

  it('does not change the label text, so fields are still found by it', async () => {
    render(<Field label="Bezeichnung" value="" onChange={() => {}} required />)
    expect(await screen.findByLabelText('Bezeichnung')).toBeInTheDocument()
    expect(screen.queryByText('*')).toBeNull()
  })

  it('marks a required select and textarea the same way', async () => {
    render(
      <>
        <SelectField label="Prüfart" value="" onChange={() => {}} required>
          <IonSelectOption value="a">A</IonSelectOption>
        </SelectField>
        <TextAreaField label="Notiz" value="" onChange={() => {}} required />
      </>,
    )
    expect((await findIon(() => ionSelect('Prüfart')))).toHaveClass('ui-required')
    expect(screen.getByLabelText('Notiz').closest('ion-textarea')).toHaveClass('ui-required')
  })
})

describe('field errors', () => {
  it('shows a message under an input and marks it invalid', async () => {
    render(<Field label="Bezeichnung" value="" onChange={() => {}} required error="Bitte ausfüllen." />)
    const wrapper = (await screen.findByLabelText('Bezeichnung')).closest('ion-input')!
    expect(wrapper).toHaveClass('ion-invalid', 'ion-touched')
    expect(wrapper).toHaveProperty('errorText', 'Bitte ausfüllen.')
  })

  it('does the same for a select and a textarea', async () => {
    render(
      <>
        <SelectField label="Prüfart" value="" onChange={() => {}} error="Bitte ausfüllen.">
          <IonSelectOption value="a">A</IonSelectOption>
        </SelectField>
        <TextAreaField label="Notiz" value="" onChange={() => {}} error="Bitte ausfüllen." />
      </>,
    )
    const select = await findIon(() => ionSelect('Prüfart'))
    expect(select).toHaveClass('ion-invalid', 'ion-touched')
    expect(select).toHaveProperty('errorText', 'Bitte ausfüllen.')
    const area = screen.getByLabelText('Notiz').closest('ion-textarea')!
    expect(area).toHaveClass('ion-invalid', 'ion-touched')
    expect(area).toHaveProperty('errorText', 'Bitte ausfüllen.')
  })

  it('has no error state without a message', async () => {
    render(<Field label="Bezeichnung" value="" onChange={() => {}} required />)
    expect((await screen.findByLabelText('Bezeichnung')).closest('ion-input')).not.toHaveClass('ion-invalid')
  })
})
