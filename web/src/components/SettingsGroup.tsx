import { IonLabel, IonListHeader, IonNote } from '@ionic/react'
import type { ReactNode } from 'react'

// A message about the last action in a group: `status` for success, `alert` for a failure.
export interface Message {
  text: string
  role: 'status' | 'alert'
}

// The small header above an inset group, as in the iOS settings.
export function SettingsHeader({ children }: { children: ReactNode }) {
  return (
    <IonListHeader className="settings-header">
      <IonLabel>{children}</IonLabel>
    </IonListHeader>
  )
}

// The explanation under an inset group, followed by the message of the group's last action.
export function SettingsFooter({ text, message }: { text?: string; message?: Message | null }) {
  if (!text && !message) return null
  return (
    <div className="settings-footer">
      {text && <IonNote>{text}</IonNote>}
      {message && (
        <IonNote role={message.role} color={message.role === 'alert' ? 'danger' : 'success'}>
          {message.text}
        </IonNote>
      )}
    </div>
  )
}
