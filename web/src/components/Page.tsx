import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react'
import type { ReactNode } from 'react'
import ViewAsBar from '../sketch/ViewAsBar'

// Common page frame: toolbar with title (and back button), sketch bar, content.
export default function Page({ title, back, children }: { title: string; back?: string; children?: ReactNode }) {
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
        <ViewAsBar />
      </IonHeader>
      <IonContent className="ion-padding">
        <h1 className="page-heading">{title}</h1>
        {children}
      </IonContent>
    </IonPage>
  )
}
