import { ChevronsUpDown } from 'lucide-react'
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
  // A box of its own with the label above, for a field that is a search or entry on its own rather than a form row.
  boxed?: boolean
}

// The label above, the control, and the error below. A required field gets a red star after its label; an invalid
// control is marked with aria-invalid and described by its error.
function FieldFrame({ label, required, error, stacked, children }: { label: string; required?: boolean; error?: string; stacked?: boolean; children(props: ControlProps): ReactNode }) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <Row>
      <div className="w-full py-1">
        {/* As in an iOS form: the label on the left, the value on the right; long text gets its own lines. */}
        <div className={stacked ? undefined : 'flex items-center gap-3'}>
          <label
            htmlFor={id}
            className={cn(
              stacked ? 'mb-1 block pt-2 text-[13px] text-muted-foreground' : 'w-[40%] shrink-0 py-2 text-[17px] leading-snug',
              required && "after:ml-0.5 after:text-destructive after:content-['*']",
            )}
          >
            {label}
          </label>
          <div className={stacked ? undefined : 'min-w-0 flex-1'}>
            {children({ id, required, className: stacked ? undefined : inline, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? errorId : undefined })}
          </div>
        </div>
        {error && (
          <p id={errorId} className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </Row>
  )
}

// A control inside a form row: no box of its own, the value right-aligned.
const inline = 'h-11 rounded-none border-0 bg-transparent px-0 text-right'

interface ControlProps {
  id: string
  className?: string
  required?: boolean
  'aria-invalid'?: true
  'aria-describedby'?: string
}

export function Field({ label, value, onChange, type = 'text', autoComplete, required, max, autoCapitalize, inputMode, error, boxed }: FieldProps) {
  const typingHelp = (autoCapitalize ?? (type === 'text' ? 'sentences' : 'off')) !== 'off'
  return (
    <FieldFrame label={label} required={required} error={error} stacked={boxed}>
      {(control) => (
        <Input
          {...control}
          type={type}
          placeholder={type === 'date' ? undefined : boxed ? 'Eingeben' : required ? 'Erforderlich' : undefined}
          className={boxed ? 'border-border bg-muted' : control.className}
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
    <FieldFrame label={label} required={required} error={error} stacked>
      {(control) => <Textarea {...control} className="bg-muted" autoCapitalize="sentences" spellCheck value={value} onChange={(e) => onChange(e.target.value)} />}
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
        <div className="relative">
          <NativeSelect {...control} className={cn(control.className, 'appearance-none pr-6 text-right text-muted-foreground [text-align-last:right]')} value={known ? value : ''} onChange={(e) => onChange(e.target.value)}>
            <option value="" disabled hidden />
            {children}
          </NativeSelect>
          <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
    </FieldFrame>
  )
}
