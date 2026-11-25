import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 justify-center gap-2 rounded-xl text-[17px] font-semibold whitespace-nowrap transition-opacity outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary active:opacity-60 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        // A disabled button is solid grey, not see-through: it sits over the content in the sticky action bar.
        default: 'bg-primary-fill text-primary-foreground disabled:bg-disabled disabled:text-disabled-foreground',
        // Prüfung erfassen: the green of the OK badges, next to the red use action.
        check: 'bg-check text-check-foreground disabled:bg-disabled disabled:text-disabled-foreground',
        destructive: 'bg-destructive text-primary-foreground disabled:bg-disabled disabled:text-disabled-foreground',
        // iOS "tinted" button: the tint at low opacity behind the text.
        outline: 'bg-primary/10 text-primary disabled:bg-fill disabled:text-disabled-foreground',
        ghost: 'bg-transparent text-primary disabled:text-disabled-foreground',
      },
      size: {
        default: 'h-11 px-4',
        sm: 'h-8 rounded-lg px-3 text-[15px]',
        lg: 'h-[50px] px-6',
        icon: 'size-11',
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
