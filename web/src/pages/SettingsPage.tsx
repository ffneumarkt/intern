import { IonButton, IonCard, IonCardContent, IonChip, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonToggle } from '@ionic/react'
import { addOutline, keyOutline } from 'ionicons/icons'
import Page from '../components/Page'
import { categories } from '../sketch/mockData'

const timings = [14, 3, 0]

export default function SettingsPage() {
  return (
    <Page title="Einstellungen">
      <IonList>
        <IonListHeader>
          <IonLabel>Benachrichtigungen</IonLabel>
        </IonListHeader>
        {categories.map((c) => (
          <IonItem key={c.id}>
            <IonLabel>
              <h3>{c.name}</h3>
              <div>
                {timings.map((d) => (
                  <IonChip key={d}>{d === 0 ? 'am Tag' : `${d} Tage vorher`}</IonChip>
                ))}
              </div>
              <IonToggle checked>Wöchentlich bei Überfälligkeit</IonToggle>
            </IonLabel>
          </IonItem>
        ))}
      </IonList>
      <IonButton expand="block">Push auf diesem Gerät aktivieren</IonButton>
      <IonCard color="light">
        <IonCardContent>
          iPhone/iPad: Push funktioniert nur, wenn die App zum Home-Bildschirm hinzugefügt wurde (Teilen → „Zum
          Home-Bildschirm“).
        </IonCardContent>
      </IonCard>
      <IonList>
        <IonListHeader>
          <IonLabel>Passkeys</IonLabel>
        </IonListHeader>
        <IonItem>
          <IonIcon slot="start" icon={keyOutline} aria-hidden />
          <IonLabel>
            iPhone
            <p>angelegt am 2026-10-29</p>
          </IonLabel>
        </IonItem>
      </IonList>
      <IonButton expand="block" fill="outline">
        <IonIcon slot="start" icon={addOutline} aria-hidden />
        Passkey hinzufügen
      </IonButton>
      <IonButton expand="block" color="medium" fill="clear">
        Abmelden
      </IonButton>
    </Page>
  )
}
