import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        // Prüfung erfassen: the green of the OK badges, next to the red use action.
        check: 'bg-check text-check-foreground hover:bg-check/90',
        destructive: 'bg-destructive text-primary-foreground hover:bg-destructive/90',
        outline: 'border border-primary bg-transparent text-primary hover:bg-primary/10',
        ghost: 'bg-transparent text-primary hover:bg-primary/10',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button'
  return <Component data-slot="button" data-variant={variant ?? 'default'} data-size={size ?? 'default'} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
