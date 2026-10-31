import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react'
import type { ReactNode } from 'react'

// Common page frame: toolbar with title (and back button), content. `grouped` is for pages of inset
// lists, as in the iOS settings: a grey background and no padding, the lists bring their own margins.
export default function Page({ title, back, grouped, children }: { title: string; back?: string; grouped?: boolean; children?: ReactNode }) {
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
      <IonContent className={grouped ? undefined : 'ion-padding'} color={grouped ? 'light' : undefined}>
        <h1 className="page-heading">{title}</h1>
        {children}
      </IonContent>
    </IonPage>
  )
}
