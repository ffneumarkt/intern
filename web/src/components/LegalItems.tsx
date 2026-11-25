import { IonItem, IonLabel } from '@ionic/react'
import { FileText, ShieldCheck } from 'lucide-react'
import { paths } from '../routes'

// The rows that lead to the legal pages; the Info page and the settings each put them in a list.
export default function LegalItems() {
  return (
    <>
      <IonItem routerLink={paths.imprint} detail>
        <FileText aria-hidden="true" />
        <IonLabel>Impressum</IonLabel>
      </IonItem>
      <IonItem routerLink={paths.privacy} detail>
        <ShieldCheck aria-hidden="true" />
        <IonLabel>Datenschutz</IonLabel>
      </IonItem>
    </>
  )
}
