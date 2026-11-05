import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react'
import type { ReactNode } from 'react'

// Common page frame: toolbar with title (and back button), then the content on the grey page in a
// centred column (see theme/ui.css). `grouped` is for pages of inset lists, as in the iOS settings:
// the column has no side padding, the lists bring their own margins.
// `fab` is a floating button (an IonFab with slot="fixed"); it has to be a direct child of the content.
export default function Page({ title, back, grouped, fab, children }: { title: string; back?: string; grouped?: boolean; fab?: ReactNode; children?: ReactNode }) {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          {back && (
            <IonButtons slot="start">
              <IonBackButton defaultHref={back} text="" />
            </IonButtons>
          )}
          <IonTitle>{title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent color="light">
        {fab}
        <div className={grouped ? 'ui-page ui-page--flat' : 'ui-page'}>
          <h1 className="page-heading">{title}</h1>
          {children}
        </div>
      </IonContent>
    </IonPage>
  )
}
