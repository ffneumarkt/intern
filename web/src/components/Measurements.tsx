import { IonButton, IonLabel, IonList, IonListHeader } from '@ionic/react'
import { useEffect, useRef, useState } from 'react'
import {
  formatMbar,
  leakLimitMbar,
  leakLoss,
  leakOk,
  leakSeconds,
  leakStartMbar,
  openingHint,
  parseMbar,
} from '../material/measurements'
import { useCountdown } from '../material/useCountdown'
import { Field } from './Field'

export interface Readings {
  start: number | null
  end: number | null
  opening: number | null
}

// The two readings of the mask test, as on the paper sheet: the Dichtprüfung with a 60 second
// countdown and the Öffnungsdruck of the exhalation valve. Reports the parsed numbers (null while a
// field is empty or not a number); the page decides what they mean for the result.
export default function Measurements({ onChange }: { onChange(readings: Readings): void }) {
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

  const loss = start !== null && end !== null ? leakLoss(start, end) : null
  const openingMessage = opening !== null ? openingHint(opening) : null

  return (
    <>
      <IonList>
        <IonListHeader>
          <IonLabel>Dichtprüfung</IonLabel>
        </IonListHeader>
        <p className="ui-hint">−10 mbar → höchstens {leakLimitMbar} mbar in {leakSeconds} s, trocken</p>
        <Field label="Startdruck (mbar)" value={startText} autoComplete="off" autoCapitalize="off" onChange={setStartText} />
        <div className="ui-countdown">
          {(countdown.running || countdown.done) && (
            <div role="timer" className="ui-countdown-time" data-done={countdown.done}>
              {countdown.remaining} s
            </div>
          )}
          {countdown.done && <p className="ui-hint">Zeit abgelaufen: Druck jetzt ablesen.</p>}
          <IonButton
            expand="block"
            fill={countdown.running || countdown.done ? 'outline' : 'solid'}
            disabled={!countdown.running && !countdown.done && start === null}
            onClick={countdown.start}
          >
            {countdown.running || countdown.done ? 'Neu starten' : `${leakSeconds} s starten`}
          </IonButton>
        </div>
        <Field label={`Druck nach ${leakSeconds} s (mbar)`} value={endText} autoComplete="off" autoCapitalize="off" onChange={setEndText} />
        {loss !== null && (
          <p className="ui-measure" data-ok={leakOk(loss)}>
            {leakOk(loss) ? `Verlust ${formatMbar(loss)} mbar ✓` : `Verlust ${formatMbar(loss)} mbar: mehr als ${leakLimitMbar} mbar`}
          </p>
        )}
      </IonList>

      <IonList>
        <IonListHeader>
          <IonLabel>Öffnungsdruck Ausatemventil</IonLabel>
        </IonListHeader>
        <p className="ui-hint">4,2–6,0 mbar bei 10 l/min (EN 137)</p>
        <Field label="Öffnungsdruck (mbar)" value={openingText} autoComplete="off" autoCapitalize="off" onChange={setOpeningText} />
        {opening !== null && (
          <p className="ui-measure" data-ok={openingMessage === null}>
            {openingMessage === null
              ? `Öffnungsdruck ${formatMbar(opening)} mbar ✓`
              : `Öffnungsdruck ${formatMbar(opening)} mbar: ${openingMessage}`}
          </p>
        )}
      </IonList>
    </>
  )
}
