import { Lock } from 'lucide-react'
import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// The building blocks the pages share, each defined once: the look lives in theme/ui.css, the markup
// here. A page uses these instead of writing the Ionic element and its classes again.

// A message in danger colour. Renders nothing for an empty message, so a page can pass its error state
// straight in: <ErrorText>{error}</ErrorText>. `role` makes it announced ("status" or "alert").
export function ErrorText({ children, role }: { children?: ReactNode; role?: 'status' | 'alert' }) {
  if (!children) return null
  return (
    <p role={role} className="mb-4 block rounded-[14px] bg-destructive/10 px-3.5 py-3 text-[0.9375rem] leading-snug text-destructive">
      {children}
    </p>
  )
}

// The bar at the bottom of a page, kept in view while the page scrolls, around its buttons.
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="ui-actions">{children}</div>
}

// A muted line of explanation above or below a form. Inside a list, use ListNote.
export function Hint({ children, center, style }: { children: ReactNode; center?: boolean; style?: CSSProperties }) {
  return (
    <p className={center ? 'ui-hint ui-hint--center' : 'ui-hint'} style={style}>
      {children}
    </p>
  )
}

// The page of someone who may not see it, or who came without what it needs.
export function NoAccess({ children = 'Keine Berechtigung.' }: { children?: ReactNode }) {
  return (
    <div className="ui-noaccess" role="status">
      <Lock aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}

// A white card around some content; `tone` colours it as a warning.
export function Card({ children, tone }: { children: ReactNode; tone?: 'warning' }) {
  return (
    <div
      className={cn(
        'mb-4 rounded-xl p-4',
        tone === 'warning' ? 'border border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100' : 'bg-background text-foreground',
      )}
    >
      {children}
    </div>
  )
}

interface AppButtonProps extends Omit<ComponentProps<'button'>, 'color'> {
  fill?: 'solid' | 'outline' | 'clear'
  color?: 'check' | 'danger' | 'medium'
  size?: 'small' | 'large'
  // 'block' makes the button as wide as its container.
  expand?: 'block'
  // Renders a link that looks like a button.
  routerLink?: string
}

// The app's button: what a page asks for (fill, colour, size) mapped to the shadcn Button. A routerLink makes it a
// link, which keeps Ctrl-click and the address visible.
export function AppButton({ fill = 'solid', color, size, expand, routerLink, className, type = 'button', children, ...props }: AppButtonProps) {
  const variant =
    fill === 'outline'
      ? 'outline'
      : fill === 'clear'
        ? 'ghost'
        : color === 'check'
          ? 'check'
          : color === 'danger'
            ? 'destructive'
            : 'default'
  const tone =
    color === 'danger' && fill === 'clear'
      ? 'bg-transparent text-destructive'
      : color === 'danger' && fill !== 'solid'
        ? 'bg-destructive/10 text-destructive'
      : color === 'medium' && fill !== 'solid'
        ? 'bg-muted-foreground/10 text-muted-foreground'
        : undefined
  const classes = cn(expand === 'block' && 'w-full', tone, className)
  const sized = size === 'small' ? 'sm' : size === 'large' ? 'lg' : 'default'
  if (routerLink) {
    return (
      <Button asChild variant={variant} size={sized} className={classes}>
        <Link to={routerLink} {...(props as ComponentProps<'a'>)}>
          {children}
        </Link>
      </Button>
    )
  }
  return (
    <Button type={type} variant={variant} size={sized} className={classes} {...props}>
      {children}
    </Button>
  )
}

// A button as wide as its container, which is what every action on a phone wants.
export function BlockButton(props: AppButtonProps) {
  return <AppButton expand="block" {...props} />
}
