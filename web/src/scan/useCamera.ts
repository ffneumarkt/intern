import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const storageKey = 'intern.camera'

function readChoice(): string | null {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function writeChoice(id: string | null) {
  try {
    if (id) localStorage.setItem(storageKey, id)
    else localStorage.removeItem(storageKey)
  } catch {
    // storage unavailable: the choice is made again next time
  }
}

function explain(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError') return 'Kamerazugriff verweigert'
  if (name === 'NotFoundError') return 'Keine Kamera gefunden'
  return 'Kamera nicht verfügbar'
}

export interface Camera {
  videoRef: RefObject<HTMLVideoElement | null>
  // True once the stream is attached to the video.
  ready: boolean
  devices: MediaDeviceInfo[]
  deviceId: string | null
  selectDevice(id: string): void
  torch: { supported: boolean; on: boolean; toggle(): void }
  error: string | null
}

// Runs the camera while `active`; the tracks stop as soon as it is not (Ionic keeps pages mounted).
export function useCamera(active: boolean): Camera {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [choice, setChoice] = useState(readChoice)
  const [current, setCurrent] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let stream: MediaStream | null = null
    const stop = () => stream?.getTracks().forEach((t) => t.stop())
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Kamera nicht verfügbar')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: choice ? { deviceId: { exact: choice } } : { facingMode: 'environment' },
        })
        if (cancelled) return stop()
        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        setCurrent(track.getSettings().deviceId ?? choice)
        setTorchSupported(Boolean((track.getCapabilities?.() as { torch?: boolean } | undefined)?.torch))
        setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'))
        if (cancelled) return stop()
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play?.().catch(() => undefined)
        }
        setError(null)
        setReady(true)
      } catch (err) {
        stop()
        if (cancelled) return
        if (choice && err instanceof DOMException && err.name === 'OverconstrainedError') {
          // The remembered camera is gone: forget it and take the rear camera.
          writeChoice(null)
          setChoice(null)
          return
        }
        setError(explain(err))
      }
    })()
    return () => {
      cancelled = true
      stop()
      trackRef.current = null
      setReady(false)
      setTorchSupported(false)
      setTorchOn(false)
    }
  }, [active, choice])

  const selectDevice = useCallback((id: string) => {
    writeChoice(id)
    setChoice(id)
  }, [])

  const toggleTorch = useCallback(() => {
    const next = !torchOn
    trackRef.current
      ?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => undefined)
  }, [torchOn])

  return { videoRef, ready, devices, deviceId: current, selectDevice, torch: { supported: torchSupported, on: torchOn, toggle: toggleTorch }, error }
}
