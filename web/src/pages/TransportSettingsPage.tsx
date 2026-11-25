import { useState } from 'react'
import { List, ListHeader } from '@/components/ui/list'
import { loadTransportSettings, updateTransportSettings, type TransportSettings } from '../api/transport'
import { Field, TextAreaField } from '../components/Field'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { requiredMessage, showFirstInvalid } from '../components/required'
import { ActionBar, BlockButton, ErrorText, Hint } from '../components/ui'
import { paths } from '../routes'
import { useSession } from '../session'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'

export default function TransportSettingsPage() {
  const { holds } = useSession()
  const resource = useResource(loadTransportSettings)
  return (
    <Page title="Beförderungspapier" back={paths.admin}>
      {!holds('transport') ? (
        <p>Keine Berechtigung.</p>
      ) : (
        <Loaded resource={resource}>{(settings) => <SettingsForm key={JSON.stringify(settings)} settings={settings} />}</Loaded>
      )}
    </Page>
  )
}

function SettingsForm({ settings }: { settings: TransportSettings }) {
  const { config } = settings
  const filling = config.fillingStation
  const [station, setStation] = useState(config.station)
  const [label, setLabel] = useState(config.cylinder.label)
  const [tenths, setTenths] = useState(String(config.cylinder.litresTenths))
  const [limit, setLimit] = useState(String(config.pointsLimit))
  const [fill, setFill] = useState(filling ?? { name: '', street: '', postalCode: '', town: '' })
  const [checklist, setChecklist] = useState(settings.checklist.join('\n'))
  const [tried, setTried] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { busy, once } = useBusy()

  const missing = !station.name.trim() || !label.trim() || !Number(tenths) || !Number(limit)

  const save = () =>
    once(async () => {
      if (missing) {
        setTried(true)
        showFirstInvalid()
        return
      }
      setError(null)
      setSaved(false)
      try {
        await updateTransportSettings({
          stationLabel: station.name.trim(),
          checklist: checklist.split('\n').map((l) => l.trim()).filter(Boolean),
          config: {
            cylinder: { label: label.trim(), litresTenths: Number(tenths) },
            pointsLimit: Number(limit),
            station: { ...station, name: station.name.trim() },
            fillingStation: fill.name.trim() ? { ...fill, name: fill.name.trim() } : null,
          },
        })
        setSaved(true)
      } catch {
        setError('Speichern fehlgeschlagen.')
      }
    })

  return (
    <>
      <List>
        <ListHeader>Station</ListHeader>
        <Field label="Name der Station" value={station.name} onChange={(name) => setStation({ ...station, name })} required error={tried && !station.name.trim() ? requiredMessage : undefined} />
        <Field label="Straße" value={station.street} onChange={(street) => setStation({ ...station, street })} />
        <Field label="Postleitzahl" value={station.postalCode} inputMode="numeric" autoCapitalize="off" onChange={(postalCode) => setStation({ ...station, postalCode })} />
        <Field label="Ort" value={station.town} onChange={(town) => setStation({ ...station, town })} />
      </List>
      <List>
        <ListHeader>Flasche</ListHeader>
        <Field label="Bezeichnung der Flasche" value={label} onChange={setLabel} required error={tried && !label.trim() ? requiredMessage : undefined} />
        <Field label="Volumen in Zehntelliter" type="number" inputMode="numeric" value={tenths} onChange={setTenths} required error={tried && !Number(tenths) ? requiredMessage : undefined} />
        <Field label="Punktegrenze" type="number" inputMode="numeric" value={limit} onChange={setLimit} required error={tried && !Number(limit) ? requiredMessage : undefined} />
      </List>
      <List>
        <ListHeader>Abfüllstation</ListHeader>
        <Field label="Name der Abfüllstation" value={fill.name} onChange={(name) => setFill({ ...fill, name })} />
        <Field label="Straße der Abfüllstation" value={fill.street} onChange={(street) => setFill({ ...fill, street })} />
        <Field label="Postleitzahl der Abfüllstation" value={fill.postalCode} inputMode="numeric" autoCapitalize="off" onChange={(postalCode) => setFill({ ...fill, postalCode })} />
        <Field label="Ort der Abfüllstation" value={fill.town} onChange={(town) => setFill({ ...fill, town })} />
      </List>
      <Hint>Ohne Namen ist keine Abfüllstation hinterlegt.</Hint>
      <List>
        <ListHeader>Checkliste</ListHeader>
        <TextAreaField label="Eine Zeile pro Punkt" value={checklist} onChange={setChecklist} />
      </List>
      {saved && <Hint>Gespeichert.</Hint>}
      <ErrorText>{error}</ErrorText>
      <ActionBar>
        <BlockButton disabled={busy} onClick={save}>
          Speichern
        </BlockButton>
      </ActionBar>
    </>
  )
}
