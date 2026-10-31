import { IonButton, IonChip, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonText } from '@ionic/react'
import { useState } from 'react'
import { PushDeniedError, TooManyAttemptsError, tooManyAttemptsMessage } from '../api/errors'
import { listCategories } from '../api/material'
import {
  defaultQuietTime,
  disableCategory,
  enableCategory,
  listNotificationSettings,
  loadQuietTime,
  saveQuietTime,
  updateSetting,
  type NotificationSetting,
} from '../api/notifications'
import { enablePush, disablePush, pushAvailable, pushEnabled, pushSupport, sendTestPush } from '../api/push'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'
import { CheckboxField, Field } from './Field'
import Loaded from './Loaded'

// Days before the due date; 0 is the day itself.
const chips = [
  { days: 14, label: '14' },
  { days: 7, label: '7' },
  { days: 3, label: '3' },
  { days: 1, label: '1' },
  { days: 0, label: 'Am Tag' },
]

async function loadAll() {
  const support = pushSupport()
  const available = support === 'ready' ? await pushAvailable() : false
  const [categories, settings, quiet, enabled] = await Promise.all([
    listCategories(),
    listNotificationSettings(),
    loadQuietTime(),
    available ? pushEnabled() : false,
  ])
  return { categories, settings, quiet, push: { support, available, enabled } }
}

type Loadedall = Awaited<ReturnType<typeof loadAll>>

export default function NotificationSettings() {
  const resource = useResource(loadAll)
  return (
    <IonList>
      <IonListHeader>
        <IonLabel>Benachrichtigungen</IonLabel>
      </IonListHeader>
      <Loaded resource={resource}>{(data) => <Content data={data} reload={resource.reload} />}</Loaded>
    </IonList>
  )
}

function Content({ data, reload }: { data: Loadedall; reload(): void }) {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [from, setFrom] = useState(data.quiet.from || defaultQuietTime.from)
  const [until, setUntil] = useState(data.quiet.until || defaultQuietTime.until)
  const { busy, once } = useBusy()
  const quietOn = data.quiet.from !== '' && data.quiet.until !== ''

  const change = async (action: () => Promise<void>) => {
    setError(null)
    setMessage(null)
    try {
      await action()
      reload()
    } catch (err) {
      setError(err instanceof PushDeniedError ? 'Benachrichtigungen sind im Browser blockiert.' : 'Speichern fehlgeschlagen.')
    }
  }

  const toggleChip = (setting: NotificationSetting, days: number) => {
    // Values outside the chips (set in the admin UI) stay.
    const timings = setting.timings.includes(days) ? setting.timings.filter((d) => d !== days) : [...setting.timings, days]
    void change(() => updateSetting(setting.id, { timings: timings.sort((a, b) => b - a) }))
  }

  const saveQuiet = (quiet: { from: string; until: string }) => {
    if (quiet.from !== '' && quiet.from === quiet.until) {
      setError('Von und Bis dürfen nicht gleich sein.')
      return
    }
    void change(() => saveQuietTime(quiet))
  }

  const test = async () => {
    setError(null)
    setMessage(null)
    try {
      const n = await sendTestPush()
      setMessage(n === 0 ? 'Kein Gerät erreicht.' : `Testnachricht an ${n} ${n === 1 ? 'Gerät' : 'Geräte'} gesendet.`)
    } catch (err) {
      setError(err instanceof TooManyAttemptsError ? tooManyAttemptsMessage : 'Testnachricht fehlgeschlagen.')
    }
  }

  return (
    <>
      {data.categories.map((category) => {
        const setting = data.settings.find((s) => s.categoryId === category.id)
        return (
          <div key={category.id}>
            <CheckboxField
              label={category.name}
              checked={setting !== undefined}
              onChange={(on) => void change(() => (setting && !on ? disableCategory(setting.id) : !setting && on ? enableCategory(category.id) : Promise.resolve()))}
            />
            {setting && (
              <IonItem>
                <IonLabel className="ion-text-wrap">
                  <p>Erinnerung (Tage vorher)</p>
                  {chips.map(({ days, label }) => {
                    const active = setting.timings.includes(days)
                    return (
                      <IonChip key={days} outline={!active} aria-pressed={active ? 'true' : 'false'} onClick={() => toggleChip(setting, days)}>
                        {label}
                      </IonChip>
                    )
                  })}
                  <CheckboxField
                    label="Wöchentlich an Überfälliges erinnern"
                    checked={setting.weeklyOverdue}
                    onChange={(on) => void change(() => updateSetting(setting.id, { weeklyOverdue: on }))}
                  />
                </IonLabel>
              </IonItem>
            )}
          </div>
        )
      })}
      <CheckboxField
        label="Ruhezeit"
        checked={quietOn}
        onChange={(on) => (on ? saveQuiet({ from, until }) : void change(() => saveQuietTime({ from: '', until: '' })))}
      />
      {quietOn && (
        <>
          <Field label="Von" type="time" value={from} onChange={setFrom} />
          <Field label="Bis" type="time" value={until} onChange={setUntil} />
          <IonButton expand="block" fill="outline" disabled={busy || !from || !until} onClick={() => once(async () => saveQuiet({ from, until }))}>
            Ruhezeit speichern
          </IonButton>
        </>
      )}
      <Push push={data.push} change={change} test={test} busy={busy} />
      {message && <IonText color="success">{message}</IonText>}
      {error && <IonText color="danger">{error}</IonText>}
    </>
  )
}

function Push({
  push,
  change,
  test,
  busy,
}: {
  push: Loadedall['push']
  change(action: () => Promise<void>): Promise<void>
  test(): Promise<void>
  busy: boolean
}) {
  if (push.support === 'needsInstall') {
    return (
      <IonNote className="ion-margin-vertical" style={{ display: 'block' }}>
        Für Push-Nachrichten die App zum Home-Bildschirm hinzufügen: Teilen-Symbol antippen, „Zum Home-Bildschirm hinzufügen“ wählen und die App von dort öffnen.
      </IonNote>
    )
  }
  if (push.support === 'unsupported') {
    return <IonNote>Dieser Browser unterstützt keine Push-Nachrichten.</IonNote>
  }
  if (!push.available) return <IonNote>Push ist auf diesem Server nicht eingerichtet.</IonNote>
  return (
    <>
      <CheckboxField
        label="Push auf diesem Gerät"
        checked={push.enabled}
        onChange={(on) => void change(on ? enablePush : disablePush)}
      />
      {push.enabled && (
        <IonButton expand="block" fill="outline" disabled={busy} onClick={() => void test()}>
          Testnachricht senden
        </IonButton>
      )}
    </>
  )
}
