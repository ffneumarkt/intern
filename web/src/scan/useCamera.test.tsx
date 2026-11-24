import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { installCamera, removeCamera } from '../test/fakeCamera'
import { useCamera } from './useCamera'

describe('useCamera', () => {
  it('asks for the rear camera first', async () => {
    const { getUserMedia } = installCamera()
    const { result } = renderHook(() => useCamera(true))
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' } })
  })

  it('uses the remembered camera and remembers a new choice', async () => {
    localStorage.setItem('intern.camera', 'front')
    const { getUserMedia } = installCamera({ devices: [{ deviceId: 'front', label: 'a' }, { deviceId: 'back', label: 'b' }] })
    const { result } = renderHook(() => useCamera(true))
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(getUserMedia).toHaveBeenCalledWith({ video: { deviceId: { exact: 'front' } } })
    expect(result.current.devices).toHaveLength(2)
    act(() => result.current.selectDevice('back'))
    expect(localStorage.getItem('intern.camera')).toBe('back')
    await waitFor(() => expect(getUserMedia).toHaveBeenLastCalledWith({ video: { deviceId: { exact: 'back' } } }))
  })

  it('falls back to the rear camera when the remembered one is gone', async () => {
    localStorage.setItem('intern.camera', 'gone')
    const { getUserMedia } = installCamera()
    getUserMedia.mockRejectedValueOnce(new DOMException('x', 'OverconstrainedError'))
    const { result } = renderHook(() => useCamera(true))
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(getUserMedia).toHaveBeenLastCalledWith({ video: { facingMode: 'environment' } })
    expect(localStorage.getItem('intern.camera')).toBeNull()
  })

  it.each([
    ['NotAllowedError', 'Kamerazugriff verweigert'],
    ['NotFoundError', 'Keine Kamera gefunden'],
    ['AbortError', 'Kamera nicht verfügbar'],
  ])('explains %s', async (failWith, message) => {
    installCamera({ failWith })
    const { result } = renderHook(() => useCamera(true))
    await waitFor(() => expect(result.current.error).toBe(message))
    expect(result.current.ready).toBe(false)
  })

  it('explains a missing mediaDevices', async () => {
    removeCamera()
    const { result } = renderHook(() => useCamera(true))
    await waitFor(() => expect(result.current.error).toBe('Kamera nicht verfügbar'))
  })

  it('stops the tracks when inactive and on unmount', async () => {
    const { track } = installCamera()
    const { result, rerender, unmount } = renderHook(({ on }) => useCamera(on), { initialProps: { on: true } })
    await waitFor(() => expect(result.current.ready).toBe(true))
    rerender({ on: false })
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(result.current.ready).toBe(false)
    rerender({ on: true })
    await waitFor(() => expect(result.current.ready).toBe(true))
    unmount()
    expect(track.stop).toHaveBeenCalledTimes(2)
  })

  it('offers the torch only where the track supports it', async () => {
    installCamera({ torch: false })
    const plain = renderHook(() => useCamera(true))
    await waitFor(() => expect(plain.result.current.ready).toBe(true))
    expect(plain.result.current.torch.supported).toBe(false)
    plain.unmount()

    const { track } = installCamera({ torch: true })
    const lit = renderHook(() => useCamera(true))
    await waitFor(() => expect(lit.result.current.torch.supported).toBe(true))
    await act(async () => lit.result.current.torch.toggle())
    expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] })
    expect(lit.result.current.torch.on).toBe(true)
  })
})
