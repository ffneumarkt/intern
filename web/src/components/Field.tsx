import { IonInput, IonItem, IonSelect, IonTextarea, IonToggle } from '@ionic/react'
import type { ReactNode } from 'react'

// Form fields as Ionic controls. IonInput and IonTextarea render their native input in the light
// DOM, so it stays inside the surrounding <form> (Enter submits) and password managers fill it.
// Ionic turns capitalisation, autocorrect and spellcheck off by default; the fields restore the
// browser defaults for plain text and keep them off for codes, credentials, dates and numbers.
interface FieldProps {
  label: string
  value: string
  onChange(value: string): void
  type?: string
  autoComplete?: string
  required?: boolean
  max?: string
  // 'off' for code-like text (codes, serial numbers): no capitalisation, autocorrect or spellcheck.
  autoCapitalize?: 'sentences' | 'off'
}

export function Field({ label, value, onChange, type = 'text', autoComplete, required, max, autoCapitalize }: FieldProps) {
  const typingHelp = (autoCapitalize ?? (type === 'text' ? 'sentences' : 'off')) !== 'off'
  return (
    <IonItem>
      <IonInput
        label={label}
        labelPlacement="stacked"
        type={type as HTMLIonInputElement['type']}
        value={value}
        autocomplete={autoComplete as HTMLIonInputElement['autocomplete']}
        autocapitalize={typingHelp ? 'sentences' : 'off'}
        autocorrect={typingHelp}
        spellcheck={typingHelp}
        required={required}
        max={max}
        onIonInput={(e) => onChange(e.detail.value ?? '')}
      />
    </IonItem>
  )
}

export function TextAreaField({ label, value, onChange }: Pick<FieldProps, 'label' | 'value' | 'onChange'>) {
  return (
    <IonItem>
      <IonTextarea
        label={label}
        labelPlacement="stacked"
        autoGrow
        autocapitalize="sentences"
        spellcheck
        value={value}
        onIonInput={(e) => onChange(e.detail.value ?? '')}
      />
    </IonItem>
  )
}

// The aria-label names the toggle itself: Ionic labels it through an element in its shadow DOM.
export function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange(checked: boolean): void }) {
  return (
    <IonItem>
      <IonToggle justify="space-between" aria-label={label} checked={checked} onIonChange={(e) => onChange(e.detail.checked)}>
        {label}
      </IonToggle>
    </IonItem>
  )
}

// Children are IonSelectOptions. A value that is not among them shows no selection. A popover takes
// one tap, is anchored at the field and marks the current value.
export function SelectField({ label, value, onChange, children }: Pick<FieldProps, 'label' | 'value' | 'onChange'> & { children: ReactNode }) {
  return (
    <IonItem>
      <IonSelect
        label={label}
        labelPlacement="stacked"
        interface="popover"
        value={value}
        onIonChange={(e) => onChange(e.detail.value ?? '')}
      >
        {children}
      </IonSelect>
    </IonItem>
  )
}
