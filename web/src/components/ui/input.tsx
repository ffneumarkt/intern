import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full rounded-md border border-border bg-background px-3 text-base text-foreground outline-offset-2 placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}
