import { IonText } from '@ionic/react'
import type { ReactNode } from 'react'
import type { Resource } from '../useResource'

// The material tool needs a connection: on failure it says so instead of showing old or no data.
export default function Loaded<T>({ resource, children }: { resource: Resource<T>; children(data: T): ReactNode }) {
  if (resource.error) {
    return <IonText color="danger">Keine Verbindung. Die Materialverwaltung braucht eine Internetverbindung.</IonText>
  }
  if (resource.data === undefined) return null
  return <>{children(resource.data)}</>
}
