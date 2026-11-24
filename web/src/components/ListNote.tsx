import { IonItem, IonLabel } from '@ionic/react'
import type { ReactNode } from 'react'

// A line of explanation or feedback inside a list. It is an Ionic item, so it takes its padding from
// the list like the header and the fields do; a bare <p> would sit at its own offset.
export default function ListNote({ children, tone }: { children: ReactNode; tone?: 'ok' | 'bad' }) {
  return (
    <IonItem lines="none" className="ui-list-note" data-tone={tone}>
      {/* The text sits in a span: bare text directly in an ion-label is moved around by Ionic's slot handling. */}
      <IonLabel className="ion-text-wrap">
        <span>{children}</span>
      </IonLabel>
    </IonItem>
  )
}
