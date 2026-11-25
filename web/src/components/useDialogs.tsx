import { cn } from '@/lib/utils'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'

export interface ConfirmOptions {
  header?: string
  message: string
  confirmText: string
  destructive?: boolean
}

export interface PromptOptions {
  header: string
  label: string
  value: string
  confirmText: string
}

type Pending =
  | { kind: 'confirm'; options: ConfirmOptions; resolve(answer: boolean): void }
  | { kind: 'prompt'; options: PromptOptions; resolve(answer: string | null): void }

interface Dialogs {
  confirm(options: ConfirmOptions): Promise<boolean>
  prompt(options: PromptOptions): Promise<string | null>
}

const DialogContext = createContext<Dialogs | null>(null)

// Confirm and prompt dialogs, as Radix alert dialogs. Only the confirm button acts; Abbrechen and Escape
// resolve false/null. One dialog at a time: a call while another is open answers false/null at once and never
// opens a second dialog.
export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const open = useRef(false)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        if (open.current) return resolve(false)
        open.current = true
        setPending({ kind: 'confirm', options, resolve })
      }),
    [],
  )

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        if (open.current) return resolve(null)
        open.current = true
        setPending({ kind: 'prompt', options, resolve })
      }),
    [],
  )

  const dialogs = useMemo(() => ({ confirm, prompt }), [confirm, prompt])

  return (
    <DialogContext.Provider value={dialogs}>
      {children}
      {pending && (
        <DialogView
          key={pending.kind + (pending.kind === 'prompt' ? pending.options.header : pending.options.message)}
          pending={pending}
          onClosed={() => {
            open.current = false
            setPending(null)
          }}
        />
      )}
    </DialogContext.Provider>
  )
}

function DialogView({ pending, onClosed }: { pending: Pending; onClosed(): void }) {
  const [text, setText] = useState(pending.kind === 'prompt' ? pending.options.value : '')
  const answered = useRef(false)

  // Resolves once, whichever way the dialog closes first.
  const answer = (confirmed: boolean) => {
    if (answered.current) return
    answered.current = true
    if (pending.kind === 'confirm') pending.resolve(confirmed)
    else pending.resolve(confirmed ? text.trim() || null : null)
    onClosed()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    answer(true)
  }

  const { options } = pending
  const confirmText = options.confirmText
  const destructive = pending.kind === 'confirm' && pending.options.destructive
  const header = options.header

  return (
    <AlertDialog open onOpenChange={(isOpen) => !isOpen && answer(false)}>
      <AlertDialogContent>
        <form onSubmit={submit} className="grid">
          {/* Every dialog has a name for screen readers; without a header it is the question. */}
          <AlertDialogTitle className={header ? undefined : 'sr-only'}>{header ?? 'Bitte bestätigen'}</AlertDialogTitle>
          {pending.kind === 'confirm' ? (
            <AlertDialogDescription className="px-4 pb-4 text-center">{pending.options.message}</AlertDialogDescription>
          ) : (
            <>
              <AlertDialogDescription className="sr-only">{pending.options.label}</AlertDialogDescription>
              <label className="grid gap-1 px-4 pb-4 text-[13px]">
                {pending.options.label}
                <Input value={text} onChange={(e) => setText(e.target.value)} aria-label={pending.options.label} autoFocus />
              </label>
            </>
          )}
          <div className="flex border-t border-border">
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" className="h-11 flex-1 rounded-none rounded-bl-[14px] bg-transparent font-normal">
                Abbrechen
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="submit"
                variant={destructive ? 'destructive' : 'default'}
                className={cn('h-11 flex-1 rounded-none rounded-br-[14px] border-l border-border bg-transparent', destructive ? 'text-destructive' : 'text-primary')}
                onClick={() => answer(true)}
              >
                {confirmText}
              </Button>
            </AlertDialogAction>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function useDialogs(): Dialogs {
  const dialogs = useContext(DialogContext)
  if (!dialogs) throw new Error('useDialogs needs a DialogProvider')
  return dialogs
}
