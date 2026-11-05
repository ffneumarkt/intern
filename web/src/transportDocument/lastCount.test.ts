import { afterEach, describe, expect, it, vi } from 'vitest'
import { readLastCount, saveLastCount } from './lastCount'

afterEach(() => vi.restoreAllMocks())

describe('last count', () => {
  it('starts empty', () => {
    expect(readLastCount()).toBe('')
  })

  it('remembers the count of the last document', () => {
    saveLastCount(4)
    expect(readLastCount()).toBe('4')
  })

  it('ignores a stored value that is not a count', () => {
    localStorage.setItem('transportDocument.lastCount', 'abc')
    expect(readLastCount()).toBe('')
  })

  it('works without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readLastCount()).toBe('')
    expect(() => saveLastCount(3)).not.toThrow()
  })
})
