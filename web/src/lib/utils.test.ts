import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('joins class names and drops what is falsy', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c')
  })

  it('lets the later Tailwind class win over the earlier one', () => {
    expect(cn('bg-primary px-4', 'bg-muted')).toBe('px-4 bg-muted')
  })
})
