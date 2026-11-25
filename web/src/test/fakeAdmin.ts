// In-memory stand-in for api/admin. Tests change `adminState`; setup.ts resets it.
import { AdminRefusedError } from '../api/errors'
import type { Area, Correction, Issued, Member, MemberPermission, Right } from '../api/admin'
import type { Level } from '../api/auth'
import { data } from './fakeMaterial'

export { allAreas, areaLabels } from '../api/admin'
export type { Area, Correction, Issued, Member, MemberPermission, Right }
export type { CategoryInput } from '../api/admin'

const fresh = () => ({
  members: [
    { id: 'hans', name: 'Hans Huber', email: 'hans@example.com', deactivated: false, areas: ['members'] as Area[] },
    { id: 'anna', name: 'Anna Aigner', email: 'anna@example.com', deactivated: false, areas: [] as Area[] },
  ] as Member[],
  permissions: [{ id: 'p1', userId: 'anna', categoryId: 'masken', level: 'use' }] as MemberPermission[],
  rights: [{ id: 'r1', userId: 'hans', area: 'members' }] as Right[],
  corrections: [] as Correction[],
  calls: { created: [] as { name: string; email: string }[], patched: [] as { id: string; patch: object }[], links: [] as string[],
    levels: [] as { userId: string; categoryId: string; level: Level | null }[], granted: [] as { userId: string; area: Area }[],
    revoked: [] as string[], categories: [] as object[], deletedCategories: [] as string[],
    usePatches: [] as { id: string; patch: object }[], checkPatches: [] as { id: string; patch: object }[], deletedUses: [] as string[], deletedChecks: [] as string[] },
  // What the server refuses next.
  refuse: false,
  failing: false,
  nextToken: 'neuer-token',
})

export let adminState = fresh()

export function resetAdmin() {
  adminState = fresh()
}

function guard() {
  if (adminState.failing) throw new TypeError('Failed to fetch')
  if (adminState.refuse) throw new AdminRefusedError('refused')
}

const copy = <T,>(value: T): T => structuredClone(value)

export async function listMembers() {
  guard()
  return copy(adminState.members)
}

export async function createMember(name: string, email: string): Promise<Issued> {
  guard()
  adminState.calls.created.push({ name, email })
  const id = `m${adminState.members.length + 1}`
  adminState.members.push({ id, name, email, deactivated: false, areas: [] })
  return { id, token: adminState.nextToken, expires: '2026-11-26T10:00:00Z' }
}

export async function updateMember(id: string, patch: { name?: string; email?: string; deactivated?: boolean }) {
  guard()
  adminState.calls.patched.push({ id, patch })
  adminState.members = adminState.members.map((m) => (m.id === id ? { ...m, ...patch } : m))
}

export async function issueSetupLink(id: string): Promise<Issued> {
  guard()
  adminState.calls.links.push(id)
  return { token: adminState.nextToken, expires: '2026-11-26T10:00:00Z' }
}

export async function listPermissions() {
  guard()
  return copy(adminState.permissions)
}

export async function setPermission(userId: string, categoryId: string, existing: MemberPermission | undefined, level: Level | null) {
  guard()
  adminState.calls.levels.push({ userId, categoryId, level })
  adminState.permissions = adminState.permissions.filter((p) => p.id !== existing?.id)
  if (level) adminState.permissions.push({ id: existing?.id ?? `p${adminState.permissions.length + 10}`, userId, categoryId, level })
}

export async function listRights() {
  guard()
  return copy(adminState.rights)
}

export async function grantArea(userId: string, area: Area) {
  guard()
  adminState.calls.granted.push({ userId, area })
  adminState.rights.push({ id: `r${adminState.rights.length + 10}`, userId, area })
}

export async function revokeArea(rightId: string) {
  guard()
  adminState.calls.revoked.push(rightId)
  adminState.rights = adminState.rights.filter((r) => r.id !== rightId)
}

export async function createCategory(input: { name: string; maxServiceLifeYears?: number }) {
  guard()
  adminState.calls.categories.push({ create: input })
  data.categories = [...data.categories, { id: `k${data.categories.length + 1}`, ...input }]
}

export async function updateCategory(id: string, input: { name: string; maxServiceLifeYears?: number }) {
  guard()
  adminState.calls.categories.push({ update: id, input })
  data.categories = data.categories.map((c) => (c.id === id ? { ...c, ...input } : c))
}

export async function deleteCategory(id: string) {
  guard()
  if (data.items.some((i) => i.categoryId === id)) throw new AdminRefusedError('in use')
  adminState.calls.deletedCategories.push(id)
  data.categories = data.categories.filter((c) => c.id !== id)
}

export async function correctUse(id: string, patch: object) {
  guard()
  adminState.calls.usePatches.push({ id, patch })
}
export async function deleteUse(id: string) {
  guard()
  adminState.calls.deletedUses.push(id)
  data.history = data.history.filter((h) => h.id !== id)
}
export async function correctCheck(id: string, patch: object) {
  guard()
  adminState.calls.checkPatches.push({ id, patch })
}
export async function deleteCheck(id: string) {
  guard()
  adminState.calls.deletedChecks.push(id)
  data.history = data.history.filter((h) => h.id !== id)
}

export async function listCorrections(_itemId: string) {
  guard()
  return copy(adminState.corrections)
}
