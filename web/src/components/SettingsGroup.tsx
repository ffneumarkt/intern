import type { ReactNode } from 'react'
import { ListHeader, Note } from '@/components/ui/list'

// A message about the last action in a group: `status` for success, `alert` for a failure.
export interface Message {
  text: string
  role: 'status' | 'alert'
}

// The small header above an inset group, as in the iOS settings.
export function SettingsHeader({ children }: { children: ReactNode }) {
  return (
    <ListHeader className="settings-header">{children}</ListHeader>
  )
}

// The explanation under an inset group, followed by the message of the group's last action. Both
// live regions are always there, empty until a message comes: screen readers often skip a region
// that is inserted together with its text.
export function SettingsFooter({ text, message }: { text?: string; message?: Message | null }) {
  const note = (role: Message['role']) =>
    message?.role === role && <Note className={role === 'alert' ? 'text-destructive' : 'text-check'}>{message.text}</Note>
  return (
    <div className="settings-footer">
      {text && <Note>{text}</Note>}
      <div role="status">{note('status')}</div>
      <div role="alert">{note('alert')}</div>
    </div>
  )
}
