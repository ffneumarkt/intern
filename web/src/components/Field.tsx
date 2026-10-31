import { IonInput, IonItem, IonSelect, IonTextarea, IonToggle } from '@ionic/react'
import type { ReactNode } from 'react'

// Form fields as Ionic controls. IonInput and IonTextarea render their native input in the light
// DOM, so it stays inside the surrounding <form> (Enter submits) and password managers fill it.
interface FieldProps {
  label: string
  value: string
  onChange(value: string): void
  type?: string
  autoComplete?: string
  required?: boolean
  max?: string
}

export function Field({ label, value, onChange, type = 'text', autoComplete, required, max }: FieldProps) {
  return (
    <IonItem>
      <IonInput
        label={label}
        labelPlacement="stacked"
        type={type as HTMLIonInputElement['type']}
        value={value}
        autocomplete={autoComplete as HTMLIonInputElement['autocomplete']}
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

// Children are IonSelectOptions. A value that is not among them shows no selection. Ionic's default
// alert interface, with the cancel button in German.
export function SelectField({ label, value, onChange, children }: Pick<FieldProps, 'label' | 'value' | 'onChange'> & { children: ReactNode }) {
  return (
    <IonItem>
      <IonSelect
        label={label}
        labelPlacement="stacked"
        cancelText="Abbrechen"
        value={value}
        onIonChange={(e) => onChange(String(e.detail.value))}
      >
        {children}
      </IonSelect>
    </IonItem>
  )
}
