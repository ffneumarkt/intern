const key = 'transportDocument.lastCount'

// The count of the last document, so the usual trip needs no typing. Storage can be blocked or
// cleared (private windows), so the page works without it.
export function readLastCount(): string {
  try {
    const value = localStorage.getItem(key) ?? ''
    return /^\d+$/.test(value) ? value : ''
  } catch {
    return ''
  }
}

export function saveLastCount(count: number): void {
  try {
    localStorage.setItem(key, String(count))
  } catch {
    // Not remembering is fine.
  }
}
