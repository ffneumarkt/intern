import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountdown } from './useCountdown'

const release = vi.fn().mockResolvedValue(undefined)
const request = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  release.mockClear()
  request.mockReset().mockResolvedValue({ release })
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
  navigator.vibrate = vi.fn(() => true)
})

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined })
})

const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

describe('useCountdown', () => {
  it('is idle until started', () => {
    const { result } = renderHook(() => useCountdown(60))
    expect(result.current).toMatchObject({ remaining: 60, running: false, done: false })
  })

  it('counts down whole seconds, rounding up', async () => {
    const { result } = renderHook(() => useCountdown(60))
    act(() => result.current.start())
    expect(result.current.running).toBe(true)
    await tick(1500)
    expect(result.current.remaining).toBe(59)
    await tick(57_900)
    expect(result.current.remaining).toBe(1)
    expect(result.current.done).toBe(false)
  })

  it('is done at zero, vibrates once and lets the screen sleep again', async () => {
    const { result } = renderHook(() => useCountdown(60))
    act(() => result.current.start())
    await tick(60_000)
    expect(result.current).toMatchObject({ remaining: 0, running: false, done: true })
    await tick(5000)
    expect(navigator.vibrate).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('keeps true time when the timers were throttled', async () => {
    const { result } = renderHook(() => useCountdown(60))
    act(() => result.current.start())
    // A background tab fires one late tick instead of many.
    await act(async () => {
      vi.setSystemTime(Date.now() + 70_000)
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(result.current.done).toBe(true)
  })

  it('asks to keep the screen awake while running', async () => {
    const { result } = renderHook(() => useCountdown(60))
    act(() => result.current.start())
    await tick(10)
    expect(request).toHaveBeenCalledWith('screen')
  })

  it('works without wake lock or vibration support', async () => {
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined })
    // @ts-expect-error simulating a browser without vibration
    navigator.vibrate = undefined
    const { result } = renderHook(() => useCountdown(3))
    act(() => result.current.start())
    await tick(3000)
    expect(result.current.done).toBe(true)
  })

  it('resets to idle and releases the screen', async () => {
    const { result } = renderHook(() => useCountdown(60))
    act(() => result.current.start())
    await tick(5000)
    act(() => result.current.reset())
    await tick(10)
    expect(result.current).toMatchObject({ remaining: 60, running: false, done: false })
    expect(release).toHaveBeenCalledTimes(1)
    await tick(60_000)
    expect(result.current.done).toBe(false)
  })

  it('starts over when started again', async () => {
    const { result } = renderHook(() => useCountdown(60))
    act(() => result.current.start())
    await tick(30_000)
    act(() => result.current.start())
    expect(result.current.remaining).toBe(60)
  })

  it('stops with the component', async () => {
    const { result, unmount } = renderHook(() => useCountdown(60))
    act(() => result.current.start())
    await tick(10)
    unmount()
    expect(release).toHaveBeenCalledTimes(1)
  })
})
