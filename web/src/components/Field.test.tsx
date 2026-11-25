import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { choose, ionSelect, selectedText, setToggle, typeInto } from '../test/ionic'
import { CheckboxField, Field, SelectField, TextAreaField } from './Field'

describe('Field', () => {
  it('labels the input, passes type, autocomplete, required and max, and reports typing', () => {
    const onChange = vi.fn()
    render(<Field label="E-Mail" type="email" autoComplete="username" value="a@b.at" onChange={onChange} required max="9" />)
    const input = screen.getByLabelText('E-Mail')
    expect(input.tagName).toBe('INPUT')
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
    input.getAttribute('spellcheck'),
  ]

  it('capitalises, corrects and spellchecks plain text by default', () => {
    render(<Field label="Bezeichnung" value="" onChange={() => {}} />)
    expect(typingHints(screen.getByLabelText('Bezeichnung'))).toEqual(['sentences', 'on', 'true'])
  })

  it('turns the typing help off for code-like text', () => {
    render(<Field label="Code" value="" onChange={() => {}} autoCapitalize="off" />)
    expect(typingHints(screen.getByLabelText('Code'))).toEqual(['off', 'off', 'false'])
  })

  it.each(['email', 'password', 'date', 'number'])('turns the typing help off for type %s', (type) => {
    render(<Field label="Feld" type={type} value="" onChange={() => {}} />)
    expect(typingHints(screen.getByLabelText('Feld'))).toEqual(['off', 'off', 'false'])
  })

  it('follows its controlled value', () => {
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
    const input = screen.getByLabelText('Name')
    typeInto(input, 'neu')
    expect(input).toHaveValue('neu')
    fireEvent.click(screen.getByText('reset'))
    expect(input).toHaveValue('vom Server')
  })

  it('keeps two fields with the same label apart', () => {
    render(
      <>
        <Field label="Name" value="eins" onChange={() => {}} />
        <Field label="Name" value="zwei" onChange={() => {}} />
      </>,
    )
    expect(screen.getAllByLabelText('Name').map((i) => (i as HTMLInputElement).value)).toEqual(['eins', 'zwei'])
  })
})

describe('TextAreaField', () => {
  it('labels the textarea and reports typing', () => {
    const onChange = vi.fn()
    render(<TextAreaField label="Notiz" value="alt" onChange={onChange} />)
    const textarea = screen.getByLabelText('Notiz')
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea).toHaveValue('alt')
    typeInto(textarea, 'Riss')
    expect(onChange).toHaveBeenLastCalledWith('Riss')
  })

  it('capitalises and spellchecks like a native textarea', () => {
    render(<TextAreaField label="Notiz" value="" onChange={() => {}} />)
    const textarea = screen.getByLabelText('Notiz')
    expect(textarea).toHaveAttribute('autocapitalize', 'sentences')
    expect(textarea).toHaveAttribute('spellcheck', 'true')
  })
})

describe('SelectField', () => {
  function Controlled({ initial = 'b' }: { initial?: string }) {
    const [value, setValue] = useState(initial)
    return (
      <SelectField label="Art" value={value} onChange={setValue}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </SelectField>
    )
  }

  it('is a native select with its label, showing the chosen option, and choosing changes it', () => {
    render(<Controlled />)
    const select = ionSelect('Art')!
    expect(select.tagName).toBe('SELECT')
    expect(select).toHaveValue('b')
    expect(selectedText(select)).toBe('Beta')
    choose(select, 'a')
    expect(select).toHaveValue('a')
    expect(selectedText(select)).toBe('Alpha')
  })

  it('is found by its label like any control', () => {
    render(<Controlled />)
    expect(screen.getByLabelText('Art')).toBe(ionSelect('Art'))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Alpha', 'Beta'])
  })

  it('shows no selection for a value that is not among the options', () => {
    render(<Controlled initial="geloescht" />)
    const select = ionSelect('Art')!
    expect(selectedText(select)).toBe('')
    choose(select, 'b')
    expect(selectedText(select)).toBe('Beta')
  })
})

describe('CheckboxField', () => {
  it('is a labelled switch whose checked state follows its prop, and a click reports the new state', () => {
    const onChange = vi.fn()
    const { rerender } = render(<CheckboxField label="nach Verwendung" checked={false} onChange={onChange} />)
    const toggle = screen.getByRole('switch', { name: 'nach Verwendung' })
    expect(toggle).not.toBeChecked()
    rerender(<CheckboxField label="nach Verwendung" checked onChange={onChange} />)
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenLastCalledWith(false)
    rerender(<CheckboxField label="nach Verwendung" checked={false} onChange={onChange} />)
    setToggle(toggle, false)
    expect(onChange).toHaveBeenCalledTimes(1)
    setToggle(toggle, true)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith(true)
  })
})

describe('required fields', () => {
  it('marks a required field and leaves the others alone', () => {
    render(
      <>
        <Field label="Bezeichnung" value="" onChange={() => {}} required />
        <Field label="Seriennummer" value="" onChange={() => {}} />
      </>,
    )
    expect(screen.getByLabelText('Bezeichnung')).toBeRequired()
    expect(screen.getByLabelText('Seriennummer')).not.toBeRequired()
  })

  it('does not change the label text, so fields are still found by it', () => {
    render(<Field label="Bezeichnung" value="" onChange={() => {}} required />)
    expect(screen.getByLabelText('Bezeichnung')).toBeInTheDocument()
    expect(screen.queryByText('*')).toBeNull()
  })

  it('marks a required select and textarea the same way', () => {
    render(
      <>
        <SelectField label="Prüfart" value="" onChange={() => {}} required>
          <option value="a">A</option>
        </SelectField>
        <TextAreaField label="Notiz" value="" onChange={() => {}} required />
      </>,
    )
    expect(screen.getByLabelText('Prüfart')).toBeRequired()
    expect(screen.getByLabelText('Notiz')).toBeRequired()
  })
})

describe('field errors', () => {
  it('shows a message under an input and marks it invalid', () => {
    render(<Field label="Bezeichnung" value="" onChange={() => {}} required error="Bitte ausfüllen." />)
    const input = screen.getByLabelText('Bezeichnung')
    expect(input).toBeInvalid()
    expect(input).toHaveAccessibleDescription('Bitte ausfüllen.')
    expect(screen.getByText('Bitte ausfüllen.')).toBeInTheDocument()
  })

  it('does the same for a select and a textarea', () => {
    render(
      <>
        <SelectField label="Prüfart" value="" onChange={() => {}} error="Bitte ausfüllen.">
          <option value="a">A</option>
        </SelectField>
        <TextAreaField label="Notiz" value="" onChange={() => {}} error="Bitte ausfüllen." />
      </>,
    )
    for (const label of ['Prüfart', 'Notiz']) {
      const control = screen.getByLabelText(label)
      expect(control).toBeInvalid()
      expect(control).toHaveAccessibleDescription('Bitte ausfüllen.')
    }
  })

  it('has no error state without a message', () => {
    render(<Field label="Bezeichnung" value="" onChange={() => {}} required />)
    expect(screen.getByLabelText('Bezeichnung')).not.toHaveAttribute('aria-invalid')
  })
})
