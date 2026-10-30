import { ClientResponseError } from 'pocketbase'
import { pb } from './client'
import { explainRateLimit } from './errors'

export type Level = 'use' | 'check' | 'manage'

export interface User {
  id: string
  name: string
  email: string
}

export function currentUser(): User | null {
  const record = pb.authStore.record
  if (!pb.authStore.isValid || !record) return null
  return { id: record.id, name: record.name, email: record.email }
}

export function onAuthChange(listener: () => void): () => void {
  return pb.authStore.onChange(listener)
}

export async function login(email: string, password: string): Promise<void> {
  try {
    await pb.collection('users').authWithPassword(email, password)
  } catch (err) {
    throw explainRateLimit(err)
  }
}

export function logout(): void {
  pb.authStore.clear()
}

// Only the server can end a session here: the app must stay logged in without a connection.
export async function refresh(): Promise<void> {
  if (!pb.authStore.isValid) return
  try {
    await pb.collection('users').authRefresh()
  } catch (err) {
    const rejected = err instanceof ClientResponseError && [401, 403, 404].includes(err.status)
    if (rejected) pb.authStore.clear()
  }
}

export async function listLevels(): Promise<Record<string, Level>> {
  const user = currentUser()
  if (!user) return {}
  const permissions = await pb.collection('permissions').getFullList({
    filter: pb.filter('user = {:user}', { user: user.id }),
  })
  return Object.fromEntries(permissions.map((p) => [p.category, p.level as Level]))
}
