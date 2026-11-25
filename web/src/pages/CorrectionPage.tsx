import { IonList } from '@ionic/react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { correctCheck, correctUse, deleteCheck, deleteUse } from '../api/admin'
import { AdminRefusedError } from '../api/errors'
import { listHistory, type CheckInput, type HistoryEntry, type UseInput } from '../api/material'
import { Field, SelectField, TextAreaField } from '../components/Field'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { requiredMessage, showFirstInvalid } from '../components/required'
import { useDialogs } from '../components/useDialogs'
import { ActionBar, BlockButton, ErrorText, Hint } from '../components/ui'
import { paths } from '../routes'
import { useSession } from '../session'
import { futureDateMessage, isFuture, today } from '../today'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'

// Corrects or deletes one use or check of an item. The old values stay in the record of corrections.
export default function CorrectionPage() {
  const { itemId = '', recordId = '' } = useParams()
  const { holds } = useSession()
  const resource = useResource(() => listHistory(itemId))
  return (
    <Page title="Eintrag korrigieren" back={paths.item(itemId)}>
      {!holds('corrections') ? (
        <p>Keine Berechtigung.</p>
      ) : (
        <Loaded resource={resource}>
          {(history) => {
            const entry = history.find((h) => h.id === recordId)
            if (!entry) return <p>Eintrag nicht gefunden.</p>
            return <CorrectionForm key={entry.id} entry={entry} />
          }}
        </Loaded>
      )}
    </Page>
  )
}

const useKinds: Record<UseInput['kind'], string> = { operation: 'Einsatz', exercise: 'Übung', other: 'Sonstiges' }
const results: Record<CheckInput['result'], string> = { passed: 'Bestanden', defect: 'Mangel', retired: 'Ausgeschieden' }

function CorrectionForm({ entry }: { entry: HistoryEntry }) {
  const navigate = useNavigate()
  const { confirm } = useDialogs()
  const [date, setDate] = useState(entry.date)
  const [kind, setKind] = useState<UseInput['kind']>(entry.use?.kind ?? 'operation')
  const [recordedBy, setRecordedBy] = useState(entry.use?.recordedByName ?? '')
  const [result, setResult] = useState<CheckInput['result']>(entry.check?.result ?? 'passed')
  const [note, setNote] = useState(entry.use?.note ?? entry.check?.note ?? '')
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { busy, once } = useBusy()
  const isUse = entry.kind === 'use'

  const save = () =>
    once(async () => {
      if (!date) {
        setTried(true)
        showFirstInvalid()
        return
      }
      if (isFuture(date)) {
        setError(futureDateMessage)
        return
      }
      setError(null)
      try {
        if (isUse) await correctUse(entry.id, { date, kind, recordedByName: recordedBy, note })
        else await correctCheck(entry.id, { date, result, note })
        navigate(paths.item(entry.itemId))
      } catch {
        setError('Speichern fehlgeschlagen.')
      }
    })

  const remove = async () => {
    if (!(await confirm({ message: `${entry.title} vom ${entry.date} löschen?`, confirmText: 'Löschen', destructive: true }))) return
    setError(null)
    try {
      if (isUse) await deleteUse(entry.id)
      else await deleteCheck(entry.id)
      navigate(paths.item(entry.itemId))
    } catch (err) {
      setError(
        err instanceof AdminRefusedError
          ? 'Dieses Ergebnis bestimmt den Status des Geräts. Bitte das Ergebnis ändern statt den Eintrag zu löschen.'
          : 'Löschen fehlgeschlagen.',
      )
    }
  }

  return (
    <>
      <Hint>
        <strong>{entry.title}</strong>
      </Hint>
      <IonList>
        <Field label="Datum" type="date" max={today()} value={date} onChange={setDate} required error={tried && !date ? requiredMessage : undefined} />
        {isUse ? (
          <>
            <SelectField label="Art" value={kind} onChange={(value) => setKind(value as UseInput['kind'])}>
              {(Object.keys(useKinds) as UseInput['kind'][]).map((k) => (
                <option key={k} value={k}>
                  {useKinds[k]}
                </option>
              ))}
            </SelectField>
            <Field label="Erfasst von" value={recordedBy} onChange={setRecordedBy} />
          </>
        ) : (
          <SelectField label="Ergebnis" value={result} onChange={(value) => setResult(value as CheckInput['result'])}>
            {(Object.keys(results) as CheckInput['result'][]).map((r) => (
              <option key={r} value={r}>
                {results[r]}
              </option>
            ))}
          </SelectField>
        )}
        <TextAreaField label="Notiz" value={note} onChange={setNote} />
      </IonList>
      <ErrorText>{error}</ErrorText>
      <ActionBar>
        <BlockButton disabled={busy} onClick={save}>
          Speichern
        </BlockButton>
        <BlockButton color="danger" fill="clear" onClick={remove}>
          Eintrag löschen
        </BlockButton>
      </ActionBar>
    </>
  )
}
