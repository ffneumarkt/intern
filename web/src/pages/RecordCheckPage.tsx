import { IonButton, IonInput, IonItem, IonList, IonSelect, IonSelectOption, IonTextarea } from '@ionic/react'
import { useParams } from 'react-router-dom'
import Page from '../components/Page'
import { paths } from '../routes'
import { checkTypes, items } from '../sketch/mockData'

export default function RecordCheckPage() {
  const { itemId = '' } = useParams()
  const item = items.find((i) => i.id === itemId)
  const types = checkTypes.filter((t) => t.categoryId === item?.categoryId)
  return (
    <Page title="Prüfung erfassen" back={paths.item(itemId)}>
      <p>{item?.name}</p>
      <IonList>
        <IonItem>
          <IonSelect label="Prüfart" labelPlacement="stacked" value={types[0]?.id} interface="popover">
            {types.map((t) => (
              <IonSelectOption key={t.id} value={t.id}>
                {t.name}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonInput label="Datum" labelPlacement="stacked" type="date" value="2026-10-29" />
        </IonItem>
        <IonItem>
          <IonSelect label="Ergebnis" labelPlacement="stacked" value="passed" interface="popover">
            <IonSelectOption value="passed">Bestanden</IonSelectOption>
            <IonSelectOption value="defect">Mangel</IonSelectOption>
            <IonSelectOption value="retired">Ausgeschieden</IonSelectOption>
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonTextarea label="Notiz" labelPlacement="stacked" />
        </IonItem>
      </IonList>
      <IonButton expand="block" routerLink={paths.item(itemId)}>
        Speichern
      </IonButton>
    </Page>
  )
}
