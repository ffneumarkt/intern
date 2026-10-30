// In-memory stand-in for api/auth. The password 'richtig' logs in with the level of signInAs.
import type { Level, User } from '../api/auth'

export type { Level, User }

const everyCategory = ['masken', 'lungenautomaten']

const testUser: User = { id: 'u1', name: 'Test Benutzer', email: 'test@example.com' }

let user: User | null = null
let levels: Record<string, Level> = {}
let loginLevels: Record<string, Level> = {}
export const levelsFailing = { value: false }
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((listener) => listener())

const spread = (level: Level): Record<string, Level> =>
  Object.fromEntries(everyCategory.map((id) => [id, level]))

// null = logged out; level applies to every category unless levels names them per category.
export function signInAs(level: Level | null, perCategory?: Record<string, Level>): void {
  user = level ? testUser : null
  levels = perCategory ?? (level ? spread(level) : {})
  loginLevels = spread('use')
  levelsFailing.value = false
}

// Logged out, with what a successful login will grant.
export function signOutWithLogin(level: Level): void {
  signInAs(null)
  loginLevels = spread(level)
}

export const currentUser = () => user

export function onAuthChange(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function login(_email: string, password: string) {
  if (password !== 'richtig') throw new Error('Failed to authenticate.')
  user = testUser
  levels = loginLevels
  notify()
}

export function logout() {
  user = null
  levels = {}
  notify()
}

export async function refresh() {}

export async function listLevels() {
  if (levelsFailing.value) throw new TypeError('Failed to fetch')
  return levels
}
