import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadDetector } from '../scan/detector'
import { installCamera } from '../test/fakeCamera'
import Scanner from './Scanner'

vi.mock('../scan/detector', () => ({ loadDetector: vi.fn() }))

// Scripted detections: one entry per pass, then empty passes.
function script(...passes: string[][]) {
  const queue = [...passes]
  vi.mocked(loadDetector).mockResolvedValue({ detect: async () => queue.shift() ?? [] })
}

const pass = () => act(async () => { await vi.advanceTimersByTimeAsync(250) })

beforeEach(() => {
  vi.useFakeTimers()
  navigator.vibrate = vi.fn(() => true)
})

afterEach(() => {
  vi.useRealTimers()
})

async function start(props: Partial<Parameters<typeof Scanner>[0]> = {}) {
  const onCode = vi.fn()
  const view = render(<Scanner onCode={onCode} {...props} />)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  return { onCode, ...view }
}

describe('Scanner', () => {
  it('reports a code held in front of the camera once, and vibrates', async () => {
    installCamera()
    script(['A-1'], ['A-1'], ['A-1'])
    const { onCode } = await start()
    await pass(); await pass(); await pass()
    expect(onCode).toHaveBeenCalledTimes(1)
    expect(onCode).toHaveBeenCalledWith('A-1')
    expect(navigator.vibrate).toHaveBeenCalledTimes(1)
  })

  it('reports a different code, and the same code after it left the frame', async () => {
    installCamera()
    script(['A-1'], ['B-2'], [], ['B-2'])
    const { onCode } = await start()
    for (let i = 0; i < 4; i++) await pass()
    expect(onCode.mock.calls.map((c) => c[0])).toEqual(['A-1', 'B-2', 'B-2'])
  })

  it('shows a camera picker only with more than one camera', async () => {
    installCamera({ devices: [{ deviceId: 'a', label: 'Vorne' }, { deviceId: 'b', label: 'Hinten' }] })
    script()
    await start()
    expect(document.querySelector('select')).not.toBeNull()
  })

  it('offers the camera picker as a compact select, not as a full-width form field', async () => {
    installCamera({ devices: [{ deviceId: 'a', label: 'Vorne' }, { deviceId: 'b', label: 'Hinten' }] })
    script()
    await start()
    const picker = document.querySelector('.scanner select')!
    expect(picker).toHaveClass('scanner-camera')
    expect(picker.closest('[data-slot="row"]')).toBeNull()
  })

  it('has no picker with a single camera', async () => {
    installCamera()
    script()
    await start()
    expect(document.querySelector('select')).toBeNull()
  })

  it('shows the camera error as a status and stops detecting', async () => {
    installCamera({ failWith: 'NotAllowedError' })
    script(['A-1'])
    const { onCode } = await start()
    await pass()
    expect(screen.getByRole('status')).toHaveTextContent('Kamerazugriff verweigert')
    expect(onCode).not.toHaveBeenCalled()
  })

  it('does not scan while inactive', async () => {
    const { getUserMedia } = installCamera()
    script(['A-1'])
    const { onCode } = await start({ active: false })
    await pass()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(onCode).not.toHaveBeenCalled()
  })
})
