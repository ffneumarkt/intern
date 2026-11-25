import { BlockButton } from '../components/ui'
import { CircleAlert, CircleCheck, FileText, Minus, Plus, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { List } from '@/components/ui/list'
import { useState } from 'react'
import { Field, SelectField } from '../components/Field'
import type { TransportSettings } from '../api/transport'
import { useBusy } from '../useBusy'
import {
  buildTrips,
  formatTenths,
  MAX_FIELD_LENGTH,
  parseCount,
  resolveParty,
  totalTenths,
  validate,
  type Address,
  type FieldKey,
  type FormState,
  type Party,
  type PartyChoice,
  type TransportConfig,
} from './calc'
import { FORM_URL } from './formLayout'
import { readLastCount, saveLastCount } from './lastCount'
import './transportDocument.css'

const emptyAddress: Address = { name: '', street: '', postalCode: '', town: '' }

const addressFieldLabels: Record<keyof Address, string> = {
  name: 'Name',
  street: 'Straße und Hausnummer',
  postalCode: 'PLZ',
  town: 'Ort',
}

const pad = (value: number) => `${value}`.padStart(2, '0')

const fileName = (date: Date) =>
  `Befoerderungspapier_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}.pdf`

const documentTitle = (date: Date) =>
  `Beförderungspapier ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`

// How much of the points limit a trip uses. The bar turns amber near the limit and red above it.
function Gauge({ count, config }: { count: number | null; config: TransportConfig }) {
  const tenths = count === null ? 0 : totalTenths(count, config.cylinder)
  const share = tenths / (config.pointsLimit * 10)
  const level = share > 1 ? 'over' : share > 0.8 ? 'high' : 'ok'
  return (
    <div className="td-gauge" aria-live="polite">
      <p className="td-gauge-text">
        <span>{count ? `${count} Flaschen à ${config.cylinder.label} l = ${formatTenths(tenths)} l` : 'Keine Flaschen'}</span>
        <span>
          <strong>{formatTenths(tenths)}</strong> von {config.pointsLimit} Punkten
        </span>
      </p>
      <div className="td-gauge-track" role="meter" aria-label="Punkte" aria-valuemin={0} aria-valuemax={config.pointsLimit} aria-valuenow={tenths / 10}>
        <div className="td-gauge-fill" data-level={level} style={{ width: `${Math.min(share, 1) * 100}%` }} />
      </div>
    </div>
  )
}

interface PartyFieldsProps {
  role: 'sender' | 'recipient'
  label: string
  suffix: string
  party: Party
  onChange(party: Party): void
  options: { value: PartyChoice; label: string }[]
  fieldErrors: Partial<Record<FieldKey, string>>
}

// The choice, and the address fields when "Andere Adresse" is chosen. A field's message appears once
// it has text, so empty fields do not start out red; the list of messages below the form covers them.
function PartyFields({ role, label, suffix, party, onChange, options, fieldErrors }: PartyFieldsProps) {
  return (
    <>
      <SelectField label={label} value={party.choice} onChange={(choice) => onChange({ ...party, choice: choice as PartyChoice })}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      {party.choice === 'other' &&
        (Object.keys(addressFieldLabels) as (keyof Address)[]).map((field) => (
          <Field
            key={field}
            label={`${addressFieldLabels[field]} (${suffix})`}
            value={party.other[field]}
            error={party.other[field] ? fieldErrors[`${role}.${field}`] : undefined}
            onChange={(value) => onChange({ ...party, other: { ...party.other, [field]: value.slice(0, MAX_FIELD_LENGTH + 20) } })}
          />
        ))}
    </>
  )
}

export default function TransportDocumentForm({ settings }: { settings: TransportSettings }) {
  const { config, checklist, stationLabel } = settings
  const [outboundCount, setOutboundCount] = useState(readLastCount)
  const [returnCountOverride, setReturnCountOverride] = useState<string | null>(null)
  const [sender, setSender] = useState<Party>({ choice: 'station', other: emptyAddress })
  const [recipient, setRecipient] = useState<Party>({ choice: config.fillingStation ? 'fillingStation' : 'other', other: emptyAddress })
  const { busy, once } = useBusy()
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const state: FormState = { outboundCount, returnCount: returnCountOverride ?? outboundCount, sender, recipient }
  const result = validate(state, config)

  const options: { value: PartyChoice; label: string }[] = [
    { value: 'station', label: stationLabel },
    ...(config.fillingStation ? [{ value: 'fillingStation' as const, label: config.fillingStation.name }] : []),
    { value: 'other', label: 'Andere Adresse' },
  ]

  const stop = (party: Party) => {
    const address = resolveParty(party, config)
    const name = address?.name.trim()
    return { name: name || '–', details: address ? [address.street.trim(), `${address.postalCode} ${address.town}`.trim()].filter(Boolean).join(', ') : '' }
  }
  const from = stop(sender)
  const to = stop(recipient)
  const step = (by: number) => setOutboundCount(String(Math.max(0, (parseCount(outboundCount) ?? 0) + by)))

  const open = () =>
    once(async () => {
      // The tab must be opened synchronously in the click handler, otherwise popup blockers interfere.
      const tab = window.open('', '_blank')
      setDownloadError(null)
      try {
        // pdf-lib is loaded only when a PDF is actually requested.
        const { fillForm } = await import('./fillForm')
        const response = await fetch(FORM_URL)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const now = new Date()
        const bytes = await fillForm(await response.arrayBuffer(), buildTrips(state, config), documentTitle(now))
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
        if (tab) {
          tab.location.href = url
        } else {
          // Popup blocked: fall back to a download.
          const link = document.createElement('a')
          link.href = url
          link.download = fileName(now)
          link.click()
        }
        saveLastCount(parseCount(outboundCount) ?? 0)
        // Kept alive long enough for the tab to load and print the PDF.
        setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
      } catch (error) {
        tab?.close()
        setDownloadError(
          error instanceof Error && error.name === 'AddressTooLongError'
            ? 'Eine Adresse ist zu lang für das Formular. Bitte kürzen.'
            : 'PDF konnte nicht erstellt werden. Bitte Verbindung prüfen und erneut versuchen.',
        )
      }
    })

  const errors = [...result.formErrors, ...(Object.keys(result.fieldErrors).length > 0 ? ['Adressfelder prüfen.'] : [])]

  return (
    <form
      className="td"
      onSubmit={(event) => {
        event.preventDefault()
        if (result.valid) void open()
      }}
      noValidate
    >
      <section className="ui-card" aria-label="Fahrt">
        <div className="td-route-head">
          <h2>Fahrt</h2>
          <span className="ui-pill">
            <Repeat aria-hidden="true" />
            Hin und zurück
          </span>
        </div>
        <ol className="td-route" aria-label="Route">
          {[from, to].map((place, index) => (
            <li className="td-stop" key={index}>
              <div>
                <strong>{place.name}</strong>
                {place.details && <span>{place.details}</span>}
              </div>
            </li>
          ))}
        </ol>

        <div className="td-count">
          <div className="td-stepper">
            <Button type="button" variant="ghost" className="td-step" aria-label="Eine Flasche weniger" disabled={(parseCount(outboundCount) ?? 0) === 0} onClick={() => step(-1)}>
              <Minus aria-hidden="true" />
            </Button>
            <label className="td-count-field">
              <span className="td-count-label">{`Anzahl Flaschen à ${config.cylinder.label} l`}</span>
              <Input
                className="td-count-input"
                type="number"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={outboundCount}
                onChange={(e) => setOutboundCount(e.target.value)}
              />
            </label>
            <Button type="button" variant="ghost" className="td-step" aria-label="Eine Flasche mehr" onClick={() => step(1)}>
              <Plus aria-hidden="true" />
            </Button>
          </div>
          <Gauge count={parseCount(outboundCount)} config={config} />
        </div>
      </section>

      <details className="td-details">
        <summary>Abweichende Route</summary>
        <div>
            <List>
              <PartyFields role="sender" label="Absender" suffix="Absender" party={sender} onChange={setSender} options={options} fieldErrors={result.fieldErrors} />
              <PartyFields role="recipient" label="Empfänger" suffix="Empfänger" party={recipient} onChange={setRecipient} options={options} fieldErrors={result.fieldErrors} />
              <Field label="Anzahl Flaschen zurück" type="number" inputMode="numeric" autoComplete="off" value={state.returnCount} onChange={setReturnCountOverride} />
            </List>
            <p className="td-return-total">{returnSummary(parseCount(state.returnCount), config)}</p>
            <p className="td-hint ion-color-medium">Die Rückfahrt übernimmt die Anzahl der Hinfahrt, bis sie geändert wird. 0, wenn keine Flaschen zurückkommen.</p>
        </div>
      </details>

      {errors.length > 0 && (
        <div className="ui-problems" aria-live="polite">
          <CircleAlert aria-hidden="true" />
          <ul>
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      {downloadError && (
        <div className="ui-problems" role="alert">
          <CircleAlert aria-hidden="true" />
          <p style={{ margin: 0 }}>{downloadError}</p>
        </div>
      )}

      <section className="ui-card" aria-label="Vor der Fahrt">
        <h2 className="td-checklist-title">Vor der Fahrt</h2>
        <ul className="td-checklist">
          {checklist.map((item) => (
            <li key={item}>
              <CircleCheck aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="ui-hint">
        Dieses Werkzeug ist ein Hilfsmittel. Die Verantwortung für die ordnungsgemäße Beförderung bleibt beim Feuerwehrkommandanten. Grundlage: OÖ LFV Formular 1.5.016 und ÖBFV-Richtlinie KS-19. Nicht für Einsatz- und
        Übungsfahrten (ADR 1.1.3.1 d) und nicht für Flaschen in fixen Halterungen der Normbeladung.
      </p>

      <div className="ui-actions">
        <BlockButton type="submit" disabled={!result.valid || busy}>
          <FileText aria-hidden="true" />
          {busy ? 'PDF wird erstellt …' : 'PDF öffnen'}
        </BlockButton>
      </div>
    </form>
  )
}

function returnSummary(count: number | null, config: TransportConfig): string {
  if (count === null) return 'Anzahl der Rückfahrt eingeben.'
  if (count === 0) return 'Keine Flaschen auf der Rückfahrt.'
  return `Rückfahrt: ${count} Flaschen à ${config.cylinder.label} l = ${formatTenths(totalTenths(count, config.cylinder))} Punkte (max. ${config.pointsLimit})`
}
