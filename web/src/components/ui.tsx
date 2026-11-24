import { IonButton, IonCard, IonCardContent, IonText } from '@ionic/react'
import type { ComponentProps, CSSProperties, ReactNode } from 'react'

// The building blocks the pages share, each defined once: the look lives in theme/ui.css, the markup
// here. A page uses these instead of writing the Ionic element and its classes again.

// A message in danger colour. Renders nothing for an empty message, so a page can pass its error state
// straight in: <ErrorText>{error}</ErrorText>. `role` makes it announced ("status" or "alert").
export function ErrorText({ children, role }: { children?: ReactNode; role?: 'status' | 'alert' }) {
  if (!children) return null
  return (
    <IonText color="danger" role={role}>
      {children}
    </IonText>
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

// A white card around some content; `tone` colours it as a warning.
export function Card({ children, tone }: { children: ReactNode; tone?: 'warning' }) {
  return (
    <IonCard color={tone}>
      <IonCardContent>{children}</IonCardContent>
    </IonCard>
  )
}

// A button as wide as its container, which is what every action on a phone wants.
export function BlockButton(props: ComponentProps<typeof IonButton>) {
  return <IonButton expand="block" {...props} />
}
