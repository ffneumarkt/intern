import { useCallback, useRef } from 'react'
import { useIonAlert } from '@ionic/react'

export interface ConfirmOptions {
  header?: string
  message: string
  confirmText: string
  destructive?: boolean
}

export interface PromptOptions {
  header: string
  label: string
  value: string
  confirmText: string
}

// Confirm and prompt dialogs as IonAlerts. Only the confirm button acts; Abbrechen, the backdrop
// and Escape resolve false/null. One dialog at a time: a call while another is open answers
// false/null at once and never opens a second alert. An alert that cannot be created answers
// false/null as well.
export function useDialogs() {
  const [present] = useIonAlert()
  const open = useRef(false)

  const ask = useCallback(
    <T,>(config: Parameters<typeof present>[0], cancelled: T, confirmed: (data: unknown) => T) =>
      new Promise<T>((resolve) => {
        if (open.current) return resolve(cancelled)
        open.current = true
        let answer = cancelled
        present({
          ...config,
          onDidDismiss: () => {
            open.current = false
            resolve(answer)
          },
          buttons: [
            { text: 'Abbrechen', role: 'cancel' },
            {
              text: (config.buttons?.[0] as { text: string }).text,
              role: (config.buttons?.[0] as { role?: string }).role,
              handler: (data: unknown) => {
                answer = confirmed(data)
              },
            },
          ],
        }).catch(() => {
          open.current = false
          resolve(cancelled)
        })
      }),
    [present],
  )

  const confirm = useCallback(
    ({ header, message, confirmText, destructive }: ConfirmOptions) =>
      ask<boolean>(
        { header, message, buttons: [{ text: confirmText, role: destructive ? 'destructive' : undefined }] },
        false,
        () => true,
      ),
    [ask],
  )

  const prompt = useCallback(
    ({ header, label, value, confirmText }: PromptOptions) =>
      ask<string | null>(
        {
          header,
          inputs: [{ name: 'value', type: 'text', label, value, attributes: { 'aria-label': label } }],
          buttons: [{ text: confirmText }],
        },
        null,
        (data) => (data as { value?: string } | undefined)?.value?.trim() || null,
      ),
    [ask],
  )

  return { confirm, prompt }
}
