// A stand-in for navigator.mediaDevices and the media element, which jsdom lacks.
import { vi } from 'vitest'

interface Options {
  devices?: { deviceId: string; label: string }[]
  torch?: boolean
  // The DOMException name getUserMedia fails with.
  failWith?: string
}

export function installCamera({ devices = [{ deviceId: 'back', label: 'Rückkamera' }], torch = false, failWith }: Options = {}) {
  const track = {
    stop: vi.fn(),
    getCapabilities: () => (torch ? { torch: true } : {}),
    getSettings: () => ({ deviceId: devices[0]?.deviceId }),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
  }
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] }
  const getUserMedia = vi.fn(async (_constraints: MediaStreamConstraints) => {
    if (failWith) throw new DOMException('camera', failWith)
    return stream
  })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia, enumerateDevices: vi.fn(async () => devices.map((d) => ({ ...d, kind: 'videoinput' }))) },
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 4 })
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  return { track, getUserMedia }
}

export function removeCamera() {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
}
