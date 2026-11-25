import { Children, isValidElement, useId, type ReactNode } from 'react'
import { Row } from '@/components/ui/list'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// Form fields as native controls with a label above and the error below. They stay inside the surrounding
// <form> (Enter submits) and password managers fill them. Plain text keeps the browser's capitalisation,
// autocorrect and spellcheck; codes, credentials, dates and numbers turn them off.
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

// The label above, the control, and the error below. A required field gets a red star after its label; an invalid
// control is marked with aria-invalid and described by its error.
function FieldFrame({ label, required, error, children }: { label: string; required?: boolean; error?: string; children(props: ControlProps): ReactNode }) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <Row>
      <div className="w-full py-2">
        <label
          htmlFor={id}
          className={cn('mb-1.5 block text-[13px] font-medium text-muted-foreground', required && "after:ml-0.5 after:text-destructive after:content-['*']")}
        >
          {label}
        </label>
        {children({ id, required, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? errorId : undefined })}
        {error && (
          <p id={errorId} className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </Row>
  )
}

interface ControlProps {
  id: string
  required?: boolean
  'aria-invalid'?: true
  'aria-describedby'?: string
}

export function Field({ label, value, onChange, type = 'text', autoComplete, required, max, autoCapitalize, inputMode, error }: FieldProps) {
  const typingHelp = (autoCapitalize ?? (type === 'text' ? 'sentences' : 'off')) !== 'off'
  return (
    <FieldFrame label={label} required={required} error={error}>
      {(control) => (
        <Input
          {...control}
          type={type}
          value={value}
          autoComplete={autoComplete}
          autoCapitalize={typingHelp ? 'sentences' : 'off'}
          autoCorrect={typingHelp ? 'on' : 'off'}
          spellCheck={typingHelp}
          max={max}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FieldFrame>
  )
}

export function TextAreaField({ label, value, onChange, required, error }: Pick<FieldProps, 'label' | 'value' | 'onChange' | 'required' | 'error'>) {
  return (
    <FieldFrame label={label} required={required} error={error}>
      {(control) => <Textarea {...control} autoCapitalize="sentences" spellCheck value={value} onChange={(e) => onChange(e.target.value)} />}
    </FieldFrame>
  )
}

// A switch with its label on the left. The aria-label names the switch itself.
export function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange(checked: boolean): void }) {
  return (
    <Row>
      <div className="flex w-full items-center justify-between py-2">
        <span>{label}</span>
        <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
      </div>
    </Row>
  )
}

// Children are <option>s. A value that is not among them shows no selection (a blank option).
export function SelectField({ label, value, onChange, required, error, children }: Pick<FieldProps, 'label' | 'value' | 'onChange' | 'required' | 'error'> & { children: ReactNode }) {
  const known = Children.toArray(children).some((c) => isValidElement(c) && String((c.props as { value?: unknown }).value) === value)
  return (
    <FieldFrame label={label} required={required} error={error}>
      {(control) => (
        <NativeSelect {...control} value={known ? value : ''} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled hidden />
          {children}
        </NativeSelect>
      )}
    </FieldFrame>
  )
}
