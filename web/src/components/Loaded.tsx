import { IonText } from '@ionic/react'
import type { ReactNode } from 'react'
import type { Resource } from '../useResource'

// The material tool needs a connection: on failure it says so instead of showing old or no data.
export default function Loaded<T>({ resource, children }: { resource: Resource<T>; children(data: T): ReactNode }) {
  if (resource.error) {
    // Padded, since a grouped page (Einstellungen) has none of its own.
    return (
      <div className="ion-padding">
        <IonText color="danger">Keine Verbindung. Die Materialverwaltung braucht eine Internetverbindung.</IonText>
      </div>
    )
  }
  if (resource.data === undefined) return null
  return <>{children(resource.data)}</>
}
