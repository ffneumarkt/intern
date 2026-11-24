import { IonSelectOption, IonText, useIonViewWillEnter, useIonViewWillLeave } from '@ionic/react'
import { useEffect, useRef, useState } from 'react'
import { loadDetector } from '../scan/detector'
import { useCamera } from '../scan/useCamera'
import { CheckboxField, SelectField } from './Field'

const interval = 200

interface Props {
  onCode(code: string): void
  // False stops the camera (a closed modal, a later step of the page).
  active?: boolean
}

// Live camera preview that reports every barcode once while it stays in the frame.
export default function Scanner({ onCode, active = true }: Props) {
  // Ionic keeps a page mounted after leaving it, so the camera follows the view as well.
  const [away, setAway] = useState(false)
  useIonViewWillLeave(() => setAway(true))
  useIonViewWillEnter(() => setAway(false))
  const running = active && !away
  const camera = useCamera(running)
  const report = useRef(onCode)
  useEffect(() => {
    report.current = onCode
  })

  const { ready, error, videoRef } = camera
  useEffect(() => {
    if (!running || !ready || error) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let last: string | null = null
    const pass = async () => {
      let codes: string[] = []
      const video = videoRef.current
      try {
        if (video && video.readyState >= 2) codes = await (await loadDetector()).detect(video)
      } catch {
        // a failed frame is skipped; the next one tries again
      }
      if (stopped) return
      const code = codes[0] ?? null
      if (code && code !== last) {
        navigator.vibrate?.(100)
        report.current(code)
      }
      last = code
      timer = setTimeout(pass, interval)
    }
    void pass()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [running, ready, error, videoRef])

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner-video" playsInline muted aria-label="Kameravorschau" />
      {error && (
        <IonText color="danger" role="status">
          {error}
        </IonText>
      )}
      {camera.devices.length > 1 && (
        <SelectField label="Kamera" value={camera.deviceId ?? ''} onChange={camera.selectDevice}>
          {camera.devices.map((d, i) => (
            <IonSelectOption key={d.deviceId} value={d.deviceId}>
              {d.label || `Kamera ${i + 1}`}
            </IonSelectOption>
          ))}
        </SelectField>
      )}
      {camera.torch.supported && <CheckboxField label="Taschenlampe" checked={camera.torch.on} onChange={camera.torch.toggle} />}
    </div>
  )
}
