import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full rounded-md border border-transparent bg-muted px-3 text-[17px] text-foreground outline-offset-2 placeholder:text-placeholder focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}
