import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// A native <select>, styled like the inputs: on a phone the operating system's own picker is the best one.
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'h-10 w-full rounded-md border border-border bg-background px-3 text-base text-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}
