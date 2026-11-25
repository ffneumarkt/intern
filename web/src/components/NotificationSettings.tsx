import { Bell } from 'lucide-react'
import { List, Row, RowLabel } from '@/components/ui/list'
import { Chip } from '@/components/ui/chip'
import { Switch } from '@/components/ui/switch'
import { useRef, useState } from 'react'
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
  type QuietTime,
} from '../api/notifications'
import { enablePush, disablePush, pushAvailable, pushEnabled, pushSupport, sendTestPush } from '../api/push'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'
import Loaded from './Loaded'
import { dayChips, quietSummary, summarize, toggleDay } from './notificationText'
import { SettingsFooter, SettingsHeader, type Message } from './SettingsGroup'

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

type LoadedAll = Awaited<ReturnType<typeof loadAll>>
type Group = 'push' | 'reminders' | 'quiet'
// A switch's state on screen: the user's pending choice, else the server's.
type Shown = (key: string, server: boolean) => boolean

const sameTimes = 'Von und Bis dürfen nicht gleich sein.'

export default function NotificationSettings() {
  const resource = useResource(loadAll)
  return <Loaded resource={resource}>{(data) => <Content data={data} reload={resource.reload} />}</Loaded>
}

function Content({ data, reload }: { data: LoadedAll; reload(): void }) {
  const [message, setMessage] = useState<(Message & { group: Group }) | null>(null)
  // The last entered times, kept while quiet time is off so turning it on again restores them.
  const [from, setFrom] = useState(data.quiet.from || defaultQuietTime.from)
  const [until, setUntil] = useState(data.quiet.until || defaultQuietTime.until)
  // Each load puts the inputs back to the server's times (after a failed save too), unless quiet
  // time is off there: then the entered times stay for switching it on again.
  const [synced, setSynced] = useState(data)
  if (synced !== data) {
    setSynced(data)
    if (data.quiet.from && data.quiet.until) {
      setFrom(data.quiet.from)
      setUntil(data.quiet.until)
    }
  }
  // Times entered while another save runs; saved right after it.
  const queuedQuiet = useRef<QuietTime | null>(null)
  const { busy, once } = useBusy()
  // What the user just chose, shown while it saves. It belongs to one load: the reload after each
  // change replaces it with what the server has, so a failed save flips the switch back.
  const [chosen, setChosen] = useState<{ data: LoadedAll; values: Record<string, boolean> }>({ data, values: {} })
  const values = chosen.data === data ? chosen.values : {}
  const shown: Shown = (key, server) => values[key] ?? server
  const choose = (key: string, value: boolean) => setChosen({ data, values: { ...values, [key]: value } })
  const quietOn = data.quiet.from !== '' && data.quiet.until !== ''

  const say = (group: Group, text: string, role: Message['role']) => setMessage({ group, text, role })
  const messageFor = (group: Group) => (message?.group === group ? message : null)

  const attempt = async (group: Group, action: () => Promise<void>) => {
    try {
      await action()
    } catch (err) {
      say(group, err instanceof PushDeniedError ? 'Benachrichtigungen sind im Browser blockiert.' : 'Speichern fehlgeschlagen.', 'alert')
    }
  }

  // One save at a time. Reloads after success and failure alike, so a switch the user flipped never
  // keeps a state the server does not have.
  const change = (group: Group, action: () => Promise<void>) =>
    once(async () => {
      setMessage(null)
      await attempt(group, action)
      for (let quiet = queuedQuiet.current; quiet !== null; quiet = queuedQuiet.current) {
        queuedQuiet.current = null
        await attempt('quiet', () => saveQuietTime(quiet))
      }
      reload()
    })

  const saveQuiet = (quiet: QuietTime) => {
    if (quiet.from === quiet.until) {
      say('quiet', sameTimes, 'alert')
      return false
    }
    queuedQuiet.current = quiet
    void change('quiet', async () => {})
    return true
  }

  const switchQuiet = (on: boolean) => {
    if (!on) {
      choose('quiet', false)
      void change('quiet', () => saveQuietTime({ from: '', until: '' }))
      return
    }
    // The last entered times; an incomplete one falls back to the default.
    const quiet = { from: from || defaultQuietTime.from, until: until || defaultQuietTime.until }
    setFrom(quiet.from)
    setUntil(quiet.until)
    // A refused switch re-renders with the server's state, which flips it back.
    if (saveQuiet(quiet)) choose('quiet', true)
  }

  const changeTime = (quiet: QuietTime) => {
    setFrom(quiet.from)
    setUntil(quiet.until)
    // An incomplete time input reports an empty value.
    if (!quiet.from || !quiet.until) return
    // No shortcut for "same as loaded": a save may be pending, so the loaded times can be stale.
    // Saving the same times again is harmless.
    saveQuiet(quiet)
  }

  const test = () =>
    once(async () => {
      setMessage(null)
      try {
        const n = await sendTestPush()
        say('push', n === 0 ? 'Kein Gerät erreicht.' : `Testnachricht an ${n} ${n === 1 ? 'Gerät' : 'Geräte'} gesendet.`, 'status')
      } catch (err) {
        say('push', err instanceof TooManyAttemptsError ? tooManyAttemptsMessage : 'Testnachricht fehlgeschlagen.', 'alert')
      }
    })

  return (
    <>
      <Push
        push={data.push}
        busy={busy}
        shown={shown}
        message={messageFor('push')}
        change={(on) => {
          choose('push', on)
          void change('push', on ? enablePush : disablePush)
        }}
        test={() => void test()}
      />
      <SettingsHeader>Erinnerungen</SettingsHeader>
      {data.categories.length === 0 && <SettingsFooter text="Noch keine Kategorie freigegeben, daher keine Erinnerungen." />}
      {data.categories.length > 0 && (
        <>
          <List inset>
            {data.categories.map((category) => (
              <Category
                key={category.id}
                name={category.name}
                id={category.id}
                setting={data.settings.find((s) => s.categoryId === category.id)}
                busy={busy}
                shown={shown}
                choose={choose}
                enable={() => void change('reminders', () => enableCategory(category.id))}
                disable={(setting) => void change('reminders', () => disableCategory(setting.id))}
                update={(setting, update) => void change('reminders', () => updateSetting(setting.id, update))}
              />
            ))}
          </List>
          <SettingsFooter text="Neue Fälligkeiten werden sofort gemeldet, wenn „Am Tag“ gewählt ist." message={messageFor('reminders')} />
        </>
      )}
      <SettingsHeader>Ruhezeit</SettingsHeader>
      <List inset>
        <Row>
          <RowLabel>
            Nicht stören
            <p className="settings-summary">{quietSummary(data.quiet)}</p>
          </RowLabel>
          <Switch
            slot="end"
            aria-label="Nicht stören"
            checked={shown('quiet', quietOn)}
            disabled={busy}
            onCheckedChange={switchQuiet}
          />
        </Row>
        {quietOn && (
          <>
            <TimeItem label="Von" value={from} onChange={(value) => changeTime({ from: value, until })} />
            <TimeItem label="Bis" value={until} onChange={(value) => changeTime({ from, until: value })} />
          </>
        )}
      </List>
      <SettingsFooter text="In dieser Zeit kommen keine Push-Nachrichten." message={messageFor('quiet')} />
    </>
  )
}

function Push({
  push,
  busy,
  shown,
  message,
  change,
  test,
}: {
  push: LoadedAll['push']
  busy: boolean
  shown: Shown
  message: Message | null
  change(on: boolean): void
  test(): void
}) {
  const footer =
    push.support === 'needsInstall'
      ? 'Für Push-Nachrichten die App zum Home-Bildschirm hinzufügen: Teilen-Symbol antippen, „Zum Home-Bildschirm hinzufügen“ wählen und die App von dort öffnen.'
      : push.support === 'unsupported'
        ? 'Dieser Browser unterstützt keine Push-Nachrichten.'
        : !push.available
          ? 'Push ist auf diesem Server nicht eingerichtet.'
          : push.enabled
            ? 'Dieses Gerät bekommt Erinnerungen, auch wenn die App geschlossen ist.'
            : 'Ohne Push auf diesem Gerät kommen keine Nachrichten an.'
  const on = push.available && push.enabled
  return (
    <>
      <SettingsHeader>Dieses Gerät</SettingsHeader>
      <List inset>
        <Row>
          <Bell aria-hidden="true" />
          <RowLabel>
            Push-Nachrichten
            <p className="settings-summary">{on ? 'Aktiv auf diesem Gerät' : 'Aus'}</p>
          </RowLabel>
          <Switch
            slot="end"
            aria-label="Push-Nachrichten"
            checked={shown('push', on)}
            disabled={busy || !push.available}
            onCheckedChange={change}
          />
        </Row>
        {on && (
          <Row detail={false} disabled={busy} onClick={test}>
            <RowLabel className="text-primary">Testnachricht senden</RowLabel>
          </Row>
        )}
      </List>
      <SettingsFooter text={footer} message={message} />
    </>
  )
}

function Category({
  name,
  id,
  setting,
  busy,
  shown,
  choose,
  enable,
  disable,
  update,
}: {
  name: string
  id: string
  setting: NotificationSetting | undefined
  busy: boolean
  shown: Shown
  choose(key: string, value: boolean): void
  enable(): void
  disable(setting: NotificationSetting): void
  update(setting: NotificationSetting, update: { timings?: number[]; weeklyOverdue?: boolean }): void
}) {
  return (
    <>
      {/* While on, the category and its detail rows read as one block, closed by a full line. */}
      <Row lines={setting ? 'none' : undefined}>
        <RowLabel>
          {name}
          <p className="settings-summary">{setting ? summarize(setting.timings, setting.weeklyOverdue) : 'Aus'}</p>
        </RowLabel>
        <Switch
          slot="end"
          aria-label={name}
          checked={shown(`category:${id}`, setting !== undefined)}
          disabled={busy}
          onCheckedChange={(checked) => {
            choose(`category:${id}`, checked)
            if (checked) enable()
            else if (setting) disable(setting)
          }}
        />
      </Row>
      {setting && (
        <>
          <Row className="settings-detail">
            <RowLabel>
              Erinnerung vor Fälligkeit
              <div className="day-chips">
                {dayChips.map(({ days, label }) => {
                  const key = `day:${setting.id}:${days}`
                  const active = shown(key, setting.timings.includes(days))
                  const toggle = () => {
                    if (busy) return
                    choose(key, !active)
                    update(setting, { timings: toggleDay(setting.timings, days) })
                  }
                  return (
                    <Chip key={days} outline={!active} disabled={busy} aria-pressed={active ? 'true' : 'false'} onClick={toggle}>
                      {label}
                    </Chip>
                  )
                })}
              </div>
            </RowLabel>
          </Row>
          <Row className="settings-detail">
            <RowLabel>Wöchentlich bei Überfälligem</RowLabel>
            <Switch
              slot="end"
              aria-label="Wöchentlich bei Überfälligem"
              checked={shown(`weekly:${setting.id}`, setting.weeklyOverdue)}
              disabled={busy}
              onCheckedChange={(checked) => {
                choose(`weekly:${setting.id}`, checked)
                update(setting, { weeklyOverdue: checked })
              }}
            />
          </Row>
        </>
      )}
    </>
  )
}

function TimeItem({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return (
    <Row>
      <RowLabel>{label}</RowLabel>
      <input slot="end" className="time-input" type="time" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </Row>
  )
}
