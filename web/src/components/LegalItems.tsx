import { IonIcon, IonItem, IonLabel } from '@ionic/react'
import { documentTextOutline, shieldCheckmarkOutline } from 'ionicons/icons'
import { paths } from '../routes'

// The rows that lead to the legal pages; the Info page and the settings each put them in a list.
export default function LegalItems() {
  return (
    <>
      <IonItem routerLink={paths.imprint} detail>
        <IonIcon slot="start" icon={documentTextOutline} aria-hidden />
        <IonLabel>Impressum</IonLabel>
      </IonItem>
      <IonItem routerLink={paths.privacy} detail>
        <IonIcon slot="start" icon={shieldCheckmarkOutline} aria-hidden />
        <IonLabel>Datenschutz</IonLabel>
      </IonItem>
    </>
  )
}
