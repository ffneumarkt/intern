import { pb } from './client'

export interface NotificationSetting {
  id: string
  categoryId: string
  timings: number[]
  weeklyOverdue: boolean
}

// Empty strings mean off.
export interface QuietTime {
  from: string
  until: string
}

export const defaultQuietTime: QuietTime = { from: '22:00', until: '07:00' }
export const defaultTimings = [14, 3, 0]

const userId = () => pb.authStore.record?.id

export async function listNotificationSettings(): Promise<NotificationSetting[]> {
  const records = await pb.collection('notification_settings').getFullList()
  return records.map((r) => ({
    id: r.id,
    categoryId: r.category,
    timings: Array.isArray(r.timings) ? r.timings : [],
    weeklyOverdue: Boolean(r.weekly_overdue),
  }))
}

export async function enableCategory(categoryId: string): Promise<void> {
  await pb.collection('notification_settings').create({
    user: userId(),
    category: categoryId,
    timings: defaultTimings,
    weekly_overdue: true,
  })
}

export async function updateSetting(id: string, change: { timings?: number[]; weeklyOverdue?: boolean }): Promise<void> {
  const body: Record<string, unknown> = {}
  if (change.timings !== undefined) body.timings = change.timings
  if (change.weeklyOverdue !== undefined) body.weekly_overdue = change.weeklyOverdue
  await pb.collection('notification_settings').update(id, body)
}

export async function disableCategory(id: string): Promise<void> {
  await pb.collection('notification_settings').delete(id)
}

async function preferencesRow() {
  const records = await pb.collection('notification_preferences').getFullList()
  return records[0]
}

export async function loadQuietTime(): Promise<QuietTime> {
  const row = await preferencesRow()
  return row ? { from: row.quiet_from, until: row.quiet_until } : defaultQuietTime
}

export async function saveQuietTime(quiet: QuietTime): Promise<void> {
  const row = await preferencesRow()
  const fields = { quiet_from: quiet.from, quiet_until: quiet.until }
  if (row) await pb.collection('notification_preferences').update(row.id, fields)
  else await pb.collection('notification_preferences').create({ user: userId(), ...fields })
}
