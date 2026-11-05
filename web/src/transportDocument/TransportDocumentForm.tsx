import { IonAccordion, IonAccordionGroup, IonButton, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonSelectOption, IonText } from '@ionic/react'
import { useState } from 'react'
import { Field, SelectField } from '../components/Field'
import type { TransportSettings } from '../api/transport'
import { useBusy } from '../useBusy'
import {
  buildTrips,
  formatAddressLine,
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

function TripTotal({ count, config }: { count: number | null; config: TransportConfig }) {
  if (count === null || count === 0) return null
  const tenths = totalTenths(count, config.cylinder)
  return (
    <p aria-live="polite">
      {count} Flaschen à {config.cylinder.label} l = {formatTenths(tenths)} l = <strong>{formatTenths(tenths)} Punkte</strong> (max. {config.pointsLimit})
    </p>
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
          <IonSelectOption key={option.value} value={option.value}>
            {option.label}
          </IonSelectOption>
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

  const describe = (party: Party) => {
    const address = resolveParty(party, config)
    return address ? formatAddressLine(address) || '–' : '–'
  }

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
      onSubmit={(event) => {
        event.preventDefault()
        if (result.valid) void open()
      }}
      noValidate
    >
      <p>
        {describe(sender)} → {describe(recipient)} und zurück
      </p>
      <IonList>
        <Field label={`Anzahl Flaschen à ${config.cylinder.label} l`} type="number" inputMode="numeric" autoComplete="off" value={outboundCount} onChange={setOutboundCount} />
      </IonList>
      <TripTotal count={parseCount(outboundCount)} config={config} />

      <IonAccordionGroup>
        <IonAccordion value="route">
          <IonItem slot="header">
            <IonLabel>Abweichende Route</IonLabel>
          </IonItem>
          <IonList slot="content">
            <PartyFields role="sender" label="Absender" suffix="Absender" party={sender} onChange={setSender} options={options} fieldErrors={result.fieldErrors} />
            <PartyFields role="recipient" label="Empfänger" suffix="Empfänger" party={recipient} onChange={setRecipient} options={options} fieldErrors={result.fieldErrors} />
            <Field
              label="Anzahl Flaschen zurück"
              type="number"
              inputMode="numeric"
              autoComplete="off"
              value={state.returnCount}
              onChange={setReturnCountOverride}
            />
            <IonNote className="ion-padding">Übernimmt die Anzahl der Hinfahrt, bis sie geändert wird. 0, wenn keine Flaschen zurückkommen.</IonNote>
          </IonList>
        </IonAccordion>
      </IonAccordionGroup>
      <TripTotal count={parseCount(state.returnCount)} config={config} />

      {errors.length > 0 && (
        <IonText color="danger" aria-live="polite">
          <ul>
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </IonText>
      )}
      {downloadError && (
        <IonText color="danger" role="alert">
          <p>{downloadError}</p>
        </IonText>
      )}
      <IonButton expand="block" type="submit" disabled={!result.valid || busy}>
        {busy ? 'PDF wird erstellt …' : 'PDF öffnen'}
      </IonButton>

      <IonList lines="none">
        <IonListHeader>Vor der Fahrt</IonListHeader>
        {checklist.map((item) => (
          <IonItem key={item}>
            <IonLabel className="ion-text-wrap">{item}</IonLabel>
          </IonItem>
        ))}
      </IonList>
      <IonNote className="ion-padding">
        Dieses Werkzeug ist ein Hilfsmittel. Die Verantwortung für die ordnungsgemäße Beförderung bleibt beim Feuerwehrkommandanten. Grundlage: OÖ LFV Formular 1.5.016 und ÖBFV-Richtlinie KS-19. Nicht für Einsatz- und
        Übungsfahrten (ADR 1.1.3.1 d) und nicht für Flaschen in fixen Halterungen der Normbeladung.
      </IonNote>
    </form>
  )
}
