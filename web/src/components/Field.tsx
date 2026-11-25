import { IonInput, IonItem, IonSelect, IonTextarea } from '@ionic/react'
import type { ReactNode } from 'react'
import { Switch } from '@/components/ui/switch'

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
  inputMode?: 'numeric'
  // Shown under the field in red.
  error?: string
}

// A required field gets a red star after its label (theme/ui.css); one with an error is drawn invalid.
const fieldClass = (required?: boolean, error?: string) =>
  [required && 'ui-required', error && 'ion-invalid ion-touched'].filter(Boolean).join(' ') || undefined

export function Field({ label, value, onChange, type = 'text', autoComplete, required, max, autoCapitalize, inputMode, error }: FieldProps) {
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
        inputmode={inputMode}
        errorText={error}
        className={fieldClass(required, error)}
        onIonInput={(e) => onChange(e.detail.value ?? '')}
      />
    </IonItem>
  )
}

export function TextAreaField({ label, value, onChange, required, error }: Pick<FieldProps, 'label' | 'value' | 'onChange' | 'required' | 'error'>) {
  return (
    <IonItem>
      <IonTextarea
        label={label}
        labelPlacement="stacked"
        autoGrow
        autocapitalize="sentences"
        spellcheck
        value={value}
        required={required}
        errorText={error}
        className={fieldClass(required, error)}
        onIonInput={(e) => onChange(e.detail.value ?? '')}
      />
    </IonItem>
  )
}

// A switch with its label on the left. The aria-label names the switch itself.
export function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange(checked: boolean): void }) {
  return (
    <IonItem>
      <div className="flex w-full items-center justify-between py-2">
        <span>{label}</span>
        <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
      </div>
    </IonItem>
  )
}

// Children are IonSelectOptions. A value that is not among them shows no selection. A popover takes
// one tap, is anchored at the field and marks the current value.
export function SelectField({ label, value, onChange, required, error, children }: Pick<FieldProps, 'label' | 'value' | 'onChange' | 'required' | 'error'> & { children: ReactNode }) {
  return (
    <IonItem>
      <IonSelect
        label={label}
        labelPlacement="stacked"
        interface="popover"
        value={value}
        errorText={error}
        className={fieldClass(required, error)}
        onIonChange={(e) => onChange(e.detail.value ?? '')}
      >
        {children}
      </IonSelect>
    </IonItem>
  )
}
