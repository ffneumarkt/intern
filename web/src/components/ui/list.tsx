import { ChevronRight } from 'lucide-react'
import type { ComponentProps, MouseEventHandler } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

// A group of rows. `inset` makes it a rounded card on the page, as in the iOS settings.
export function List({ inset, className, ...props }: ComponentProps<'div'> & { inset?: boolean }) {
  return (
    <div
      data-slot="list"
      className={cn('bg-background [&>[data-slot=row]:last-child]:border-b-0', inset && 'mx-4 my-3 overflow-hidden rounded-xl', className)}
      {...props}
    />
  )
}

// A small header above a list.
export function ListHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="list-header" className={cn('px-4 pt-4 pb-2 text-base font-bold text-foreground', className)} {...props} />
}

type RowProps = Omit<ComponentProps<'div'>, 'onClick'> & {
  // A link row: the row is the link.
  to?: string
  // A button row.
  onClick?: MouseEventHandler<HTMLElement>
  disabled?: boolean
  // A chevron at the end: the row leads somewhere.
  detail?: boolean
  // 'none' leaves out the line below the row.
  lines?: 'none' | 'full'
}

// One row of a list: a link with `to`, a button with `onClick`, otherwise plain. Children with slot="start" come
// first, children with slot="end" (a badge, a switch, a note) go to the right edge.
export function Row({ to, onClick, disabled, detail, lines, className, children, ...props }: RowProps) {
  const classes = cn(
    'flex min-h-12 w-full items-center gap-3 border-b border-border/70 bg-background px-4 py-2 text-left text-foreground no-underline [&>[slot=end]]:ml-auto [&>[slot=start]]:order-first',
    lines === 'none' && 'border-b-0',
    (to || onClick) && 'outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-primary',
    className,
  )
  const content = (
    <>
      {children}
      {detail && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  )
  if (to) {
    return (
      <Link to={to} data-slot="row" className={classes} {...(props as ComponentProps<'a'>)}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" data-slot="row" className={cn(classes, 'disabled:opacity-50')} onClick={onClick} disabled={disabled} {...(props as ComponentProps<'button'>)}>
        {content}
      </button>
    )
  }
  return (
    <div data-slot="row" className={classes} {...props}>
      {content}
    </div>
  )
}

// The text of a row: a title, with lines of detail (<p>) in muted type below.
export function RowLabel({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="row-label"
      className={cn('min-w-0 flex-1 [&_h2]:text-base [&_h2]:font-medium [&_h3]:text-sm [&_h3]:font-semibold [&_p]:text-sm [&_p]:text-muted-foreground', className)}
      {...props}
    />
  )
}

// A small muted text, for a date or a hint.
export function Note({ className, ...props }: ComponentProps<'span'>) {
  return <span data-slot="note" className={cn('text-sm text-muted-foreground', className)} {...props} />
}
