import { describe, expect, it } from 'vitest'
import { paths } from '../routes'
import { backLabel } from './backLabel'

describe('backLabel', () => {
  it('names the page the back button leads to', () => {
    expect(backLabel(paths.dueList)).toBe('Fällig')
    expect(backLabel(paths.manageCategory('c1', 'checkTypes'))).toBe('Verwalten')
    expect(backLabel(paths.item('m01'))).toBe('Gerät')
    expect(backLabel(paths.admin)).toBe('Verwaltung')
  })
  it('says Zurück for a page it does not know', () => {
    expect(backLabel('/irgendwo')).toBe('Zurück')
  })
})
