// In-memory stand-in for api/notifications. Tests set `notificationState`; setup.ts resets it.
import { defaultQuietTime, defaultTimings, type NotificationSetting, type QuietTime } from '../api/notifications'

export { defaultQuietTime, defaultTimings }
export type { NotificationSetting, QuietTime }

const fresh = () => ({
  settings: [] as NotificationSetting[],
  quiet: null as QuietTime | null,
  failing: false,
  // Only writes fail; loading still works.
  failingSaves: false,
  savedQuiet: [] as QuietTime[],
})

export let notificationState = fresh()

export function resetNotifications() {
  notificationState = fresh()
}

function check() {
  if (notificationState.failing) throw new TypeError('Failed to fetch')
}

function checkSave() {
  check()
  if (notificationState.failingSaves) throw new TypeError('Failed to fetch')
}

export async function listNotificationSettings() {
  check()
  return notificationState.settings
}

export async function enableCategory(categoryId: string) {
  checkSave()
  notificationState.settings = [
    ...notificationState.settings,
    { id: `n${notificationState.settings.length + 1}`, categoryId, timings: defaultTimings, weeklyOverdue: true },
  ]
}

export async function updateSetting(id: string, change: { timings?: number[]; weeklyOverdue?: boolean }) {
  checkSave()
  notificationState.settings = notificationState.settings.map((s) => (s.id === id ? { ...s, ...change } : s))
}

export async function disableCategory(id: string) {
  checkSave()
  notificationState.settings = notificationState.settings.filter((s) => s.id !== id)
}

export async function loadQuietTime() {
  check()
  return notificationState.quiet ?? defaultQuietTime
}

export async function saveQuietTime(quiet: QuietTime) {
  checkSave()
  notificationState.quiet = quiet
  notificationState.savedQuiet.push(quiet)
}
