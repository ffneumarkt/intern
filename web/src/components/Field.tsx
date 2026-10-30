import { IonItem } from '@ionic/react'
import type { ReactNode } from 'react'

// Form fields are native inputs: password managers fill them and tests can drive them (jsdom does
// not run Ionic's inputs).
interface FieldProps {
  label: string
  value: string
  onChange(value: string): void
  type?: string
  autoComplete?: string
  required?: boolean
}

export function Field({ label, value, onChange, type = 'text', autoComplete, required }: FieldProps) {
  return (
    <IonItem>
      <label className="stacked-label">
        {label}
        <input
          className="code-input"
          type={type}
          value={value}
          autoComplete={autoComplete}
          required={required}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </IonItem>
  )
}

export function TextAreaField({ label, value, onChange }: Pick<FieldProps, 'label' | 'value' | 'onChange'>) {
  return (
    <IonItem>
      <label className="stacked-label">
        {label}
        <textarea className="code-input" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </IonItem>
  )
}

export function SelectField({ label, value, onChange, children }: Pick<FieldProps, 'label' | 'value' | 'onChange'> & { children: ReactNode }) {
  return (
    <IonItem>
      <label className="stacked-label">
        {label}
        <select className="code-input" value={value} onChange={(e) => onChange(e.target.value)}>
          {children}
        </select>
      </label>
    </IonItem>
  )
}
