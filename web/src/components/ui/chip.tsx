import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// A pill-shaped toggle or filter. Filled when `outline` is off. A native button, so Enter and Space work.
export function Chip({ outline, className, ...props }: ComponentProps<'button'> & { outline?: boolean }) {
  return (
    <button
      type="button"
      data-slot="chip"
      data-outline={outline ? 'true' : undefined}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50',
        outline ? 'border-border bg-transparent text-foreground' : 'border-primary bg-primary text-primary-foreground',
        className,
      )}
      {...props}
    />
  )
}
