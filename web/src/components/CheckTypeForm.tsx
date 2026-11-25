import { Plus } from 'lucide-react'
import { List } from '@/components/ui/list'
import { useState } from 'react'
import { CheckTypeInUseError } from '../api/errors'
import { createCheckType, deleteCheckType, updateCheckType, type CheckType } from '../api/material'
import { useBusy } from '../useBusy'
import { CheckboxField, Field } from './Field'
import { requiredMessage, showFirstInvalid } from './required'
import { useDialogs } from './useDialogs'
import { ActionBar, BlockButton, ErrorText } from './ui'

interface CheckTypeFormProps {
  categoryId: string
  checkType?: CheckType
  others: CheckType[]
  onDone(): void
}

export default function CheckTypeForm({ categoryId, checkType, others, onDone }: CheckTypeFormProps) {
  const [name, setName] = useState(checkType?.name ?? '')
  const [months, setMonths] = useState(checkType?.intervalMonths ? String(checkType.intervalMonths) : '')
  const [afterUse, setAfterUse] = useState(checkType?.afterUse ?? false)
  const [isDefault, setIsDefault] = useState(checkType?.isDefault ?? false)
  const [measurements, setMeasurements] = useState(checkType?.measurements ?? false)
  const [alsoSatisfies, setAlsoSatisfies] = useState(checkType?.alsoSatisfies ?? [])
  const [error, setError] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const { busy, once } = useBusy()
  const { confirm } = useDialogs()

  const save = async () => {
    if (!name.trim()) {
      setTried(true)
      showFirstInvalid()
      return
    }
    const intervalMonths = Number(months) || 0
    if (!intervalMonths && !afterUse) {
      setError('Intervall oder „nach Verwendung“ angeben.')
      return
    }
    setError(null)
    const input = { name, intervalMonths, afterUse, isDefault, measurements, alsoSatisfies }
    try {
      if (checkType) await updateCheckType(checkType.id, input)
      else await createCheckType({ ...input, categoryId })
      onDone()
    } catch {
      setError('Speichern fehlgeschlagen.')
    }
  }

  const remove = async (target: CheckType) => {
    if (!(await confirm({ message: `${target.name} löschen?`, confirmText: 'Löschen', destructive: true }))) return
    setError(null)
    try {
      await deleteCheckType(target.id)
      onDone()
    } catch (err) {
      setError(
        err instanceof CheckTypeInUseError
          ? 'Prüfart wird noch verwendet und kann nicht gelöscht werden.'
          : 'Löschen fehlgeschlagen.',
      )
    }
  }

  return (
    <>
      <List>
        <Field label="Name" value={name} onChange={setName} required error={tried && !name.trim() ? requiredMessage : undefined} />
        <Field label="Intervall in Monaten" type="number" value={months} onChange={setMonths} />
        <CheckboxField label="nach Verwendung" checked={afterUse} onChange={setAfterUse} />
        <CheckboxField label="Standardprüfung" checked={isDefault} onChange={setIsDefault} />
        <CheckboxField label="Messwerte erfassen" checked={measurements} onChange={setMeasurements} />
        {others
          .filter((t) => t.id !== checkType?.id)
          .map((t) => (
            <CheckboxField
              key={t.id}
              label={`gilt auch als ${t.name}`}
              checked={alsoSatisfies.includes(t.id)}
              onChange={(checked) =>
                setAlsoSatisfies((ids) => (checked ? [...ids, t.id] : ids.filter((id) => id !== t.id)))
              }
            />
          ))}
      </List>
      {error && <ErrorText>{error}</ErrorText>}
      <ActionBar>
        <BlockButton disabled={busy} onClick={() => once(save)}>
          {!checkType && <Plus aria-hidden="true" />}
          {checkType ? 'Speichern' : 'Prüfart anlegen'}
        </BlockButton>
        {checkType && (
          <BlockButton color="danger" fill="clear" onClick={() => remove(checkType)}>
            Prüfart löschen
          </BlockButton>
        )}
      </ActionBar>
    </>
  )
}
