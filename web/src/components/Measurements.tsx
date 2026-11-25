import { AppButton } from './ui'
import { List, ListHeader } from '@/components/ui/list'
import { useEffect, useRef, useState } from 'react'
import {
  formatMbar,
  leakLimitMbar,
  leakLoss,
  leakOk,
  leakReadingProblem,
  leakSeconds,
  leakStartMbar,
  openingHint,
  parseMbar,
} from '../material/measurements'
import { useCountdown } from '../material/useCountdown'
import { Field } from './Field'
import ListNote from './ListNote'
import { requiredMessage } from './required'

export interface Readings {
  start: number | null
  end: number | null
  opening: number | null
}

// The two readings of the mask test, as on the paper sheet: the Dichtprüfung with a 60 second
// countdown and the Öffnungsdruck of the exhalation valve. Reports the parsed numbers (null while a
// field is empty or not a number); the page decides what they mean for the result.
export default function Measurements({ onChange, showErrors }: { onChange(readings: Readings): void; showErrors?: boolean }) {
  const [startText, setStartText] = useState(formatMbar(leakStartMbar))
  const [endText, setEndText] = useState('')
  const [openingText, setOpeningText] = useState('')
  const countdown = useCountdown(leakSeconds)

  const start = parseMbar(startText)
  const end = parseMbar(endText)
  const opening = parseMbar(openingText)

  const report = useRef(onChange)
  useEffect(() => {
    report.current = onChange
  })
  useEffect(() => {
    report.current({ start, end, opening })
  }, [start, end, opening])

  // What is wrong with a reading, once the user has tried to save: empty, or not a number.
  const problem = (text: string, value: number | null) =>
    !showErrors || value !== null ? undefined : text.trim() === '' ? requiredMessage : 'Bitte eine Zahl eintragen.'

  // A reading no mask could give is refused at once, not only after Speichern.
  const impossible = start !== null && end !== null ? leakReadingProblem(start, end) : null
  const loss = start !== null && end !== null && !impossible ? leakLoss(start, end) : null
  const openingMessage = opening !== null ? openingHint(opening) : null

  return (
    <>
      <List>
        <ListHeader>Dichtprüfung</ListHeader>
        <ListNote>−10 mbar → höchstens {leakLimitMbar} mbar in {leakSeconds} s, trocken</ListNote>
        <Field label="Startdruck (mbar)" value={startText} autoComplete="off" autoCapitalize="off" onChange={setStartText} required error={problem(startText, start)} />
        <div className="ui-countdown">
          {(countdown.running || countdown.done) && (
            <div role="timer" className="ui-countdown-time" data-done={countdown.done}>
              {countdown.remaining} s
            </div>
          )}
          {countdown.done && <ListNote>Zeit abgelaufen: Druck jetzt ablesen.</ListNote>}
          {countdown.running || countdown.done ? (
            <div className="ui-countdown-buttons">
              <AppButton expand="block" fill="outline" onClick={countdown.start}>
                Neu starten
              </AppButton>
              <AppButton expand="block" fill="outline" color="medium" onClick={countdown.reset}>
                Beenden
              </AppButton>
            </div>
          ) : (
            <AppButton expand="block" disabled={start === null} onClick={countdown.start}>
              {leakSeconds} s starten
            </AppButton>
          )}
        </div>
        <Field label={`Druck nach ${leakSeconds} s (mbar)`} value={endText} autoComplete="off" autoCapitalize="off" onChange={setEndText} required error={problem(endText, end) ?? impossible ?? undefined} />
        {loss !== null && (
          <ListNote tone={leakOk(loss) ? 'ok' : 'bad'}>
            {leakOk(loss) ? `Verlust ${formatMbar(loss)} mbar ✓` : `Verlust ${formatMbar(loss)} mbar: mehr als ${leakLimitMbar} mbar`}
          </ListNote>
        )}
      </List>

      <List>
        <ListHeader>Öffnungsdruck Ausatemventil</ListHeader>
        <ListNote>4,2–6,0 mbar bei 10 l/min (EN 137)</ListNote>
        <Field label="Öffnungsdruck (mbar)" value={openingText} autoComplete="off" autoCapitalize="off" onChange={setOpeningText} required error={problem(openingText, opening)} />
        {opening !== null && (
          <ListNote tone={openingMessage === null ? 'ok' : 'bad'}>
            {openingMessage === null
              ? `Öffnungsdruck ${formatMbar(opening)} mbar ✓`
              : `Öffnungsdruck ${formatMbar(opening)} mbar: ${openingMessage}`}
          </ListNote>
        )}
      </List>
    </>
  )
}
