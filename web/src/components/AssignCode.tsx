import { useState } from 'react'
import { List, Row, RowLabel } from '@/components/ui/list'
import { assignBarcode, type Item } from '../api/material'
import { BarcodeTakenError } from '../api/errors'
import { Field } from './Field'
import { AppButton, ErrorText } from './ui'

interface Props {
  code: string
  items: Item[]
  onAssigned(item: Item): void
}

// Lets a manage user put a scanned code that no item has yet onto an item. Items without a code come first.
export default function AssignCode({ code, items, onAssigned }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const q = text.trim().toLowerCase()
  const candidates = items
    .filter((i) => i.status !== 'retired' && (!q || i.name.toLowerCase().includes(q) || i.barcode?.toLowerCase().includes(q)))
    .sort((a, b) => Number(!!a.barcode) - Number(!!b.barcode))

  const assign = async (item: Item) => {
    setError(null)
    try {
      await assignBarcode(item.id, code)
    } catch (err) {
      setError(err instanceof BarcodeTakenError ? 'Code ist bereits vergeben.' : 'Speichern fehlgeschlagen.')
      return
    }
    setOpen(false)
    setText('')
    onAssigned({ ...item, barcode: code })
  }

  if (!open) {
    return (
      <AppButton size="small" fill="outline" onClick={() => setOpen(true)}>
        Gerät zuordnen
      </AppButton>
    )
  }
  return (
    <div>
      <Field label="Gerät suchen" value={text} autoComplete="off" onChange={setText} />
      {error && <ErrorText>{error}</ErrorText>}
      <List role="list" aria-label="Geräte" className="suggestions">
        {candidates.map((i) => (
          <Row key={i.id} role="listitem" detail={false} onClick={() => assign(i)}>
            <RowLabel>
              {i.name}
              <p>{i.barcode ?? 'ohne Code'}</p>
            </RowLabel>
          </Row>
        ))}
      </List>
    </div>
  )
}
