import { ClientResponseError } from 'pocketbase'
import type { Area, Level } from './auth'
import { pb } from './client'
import { AdminRefusedError } from './errors'
import type { UseInput, CheckInput } from './material'

export type { Area }

// What each area is called, in the order of the admin overview.
export const areaLabels: Record<Area, string> = {
  members: 'Mitglieder',
  categories: 'Kategorien',
  transport: 'Beförderungspapier',
  corrections: 'Korrekturen',
}
export const allAreas = Object.keys(areaLabels) as Area[]

export interface Member {
  id: string
  name: string
  email: string
  deactivated: boolean
  areas: Area[]
}

// A setup link as the server issued it: the token goes into the link, nowhere else.
export interface Issued {
  id?: string
  token: string
  expires: string
}

export interface MemberPermission {
  id: string
  userId: string
  categoryId: string
  level: Level
}

export interface Right {
  id: string
  userId: string
  area: Area
}

export interface CategoryInput {
  name: string
  maxServiceLifeYears?: number
}

export interface Correction {
  id: string
  adminName: string
  date: string
  action: 'edit' | 'delete'
  collection: 'uses' | 'checks'
}

// A 400 is the server saying no on purpose; everything else is a failure to reach it.
async function refused<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (err) {
    if (err instanceof ClientResponseError && err.status === 400) throw new AdminRefusedError(err.message)
    throw err
  }
}

const send = <T>(path: string, method: string, body?: object) => refused(() => pb.send<T>(path, { method, body }))

export const listMembers = () => send<Member[]>('/api/admin/members', 'GET')
export const createMember = (name: string, email: string) => send<Issued>('/api/admin/members', 'POST', { name, email })
export const updateMember = (id: string, patch: { name?: string; email?: string; deactivated?: boolean }) =>
  send<unknown>(`/api/admin/members/${id}`, 'PATCH', patch)
export const issueSetupLink = (id: string) => send<Issued>(`/api/admin/members/${id}/setup-link`, 'POST')

export async function listPermissions(): Promise<MemberPermission[]> {
  const rows = await pb.collection('permissions').getFullList()
  return rows.map((r) => ({ id: r.id, userId: r.user, categoryId: r.category, level: r.level as Level }))
}

// null removes the permission.
export async function setPermission(userId: string, categoryId: string, existing: MemberPermission | undefined, level: Level | null) {
  await refused(async () => {
    if (!level) {
      if (existing) await pb.collection('permissions').delete(existing.id)
    } else if (existing) await pb.collection('permissions').update(existing.id, { level })
    else await pb.collection('permissions').create({ user: userId, category: categoryId, level })
  })
}

export async function listRights(): Promise<Right[]> {
  const rows = await pb.collection('admin_rights').getFullList()
  return rows.map((r) => ({ id: r.id, userId: r.user, area: r.area as Area }))
}

export const grantArea = (userId: string, area: Area) =>
  refused(() => pb.collection('admin_rights').create({ user: userId, area }))
export const revokeArea = (rightId: string) => refused(() => pb.collection('admin_rights').delete(rightId))

const categoryBody = (input: CategoryInput) => ({ name: input.name, max_service_life_years: input.maxServiceLifeYears ?? null })
export const createCategory = (input: CategoryInput) => refused(() => pb.collection('categories').create(categoryBody(input)))
export const updateCategory = (id: string, input: CategoryInput) =>
  refused(() => pb.collection('categories').update(id, categoryBody(input)))
export const deleteCategory = (id: string) => refused(() => pb.collection('categories').delete(id))

export const correctUse = (id: string, patch: { date?: string; kind?: UseInput['kind']; recordedByName?: string; note?: string }) =>
  send<unknown>(`/api/admin/uses/${id}`, 'PATCH', patch)
export const deleteUse = (id: string) => send<unknown>(`/api/admin/uses/${id}`, 'DELETE')
export const correctCheck = (id: string, patch: { date?: string; result?: CheckInput['result']; note?: string }) =>
  send<unknown>(`/api/admin/checks/${id}`, 'PATCH', patch)
export const deleteCheck = (id: string) => send<unknown>(`/api/admin/checks/${id}`, 'DELETE')

// Only holders of the corrections right can read these; for everyone else the list is empty.
export async function listCorrections(itemId: string): Promise<Correction[]> {
  const rows = await pb.collection('corrections').getFullList({
    filter: pb.filter('item = {:itemId}', { itemId }),
    expand: 'admin',
    sort: '-created',
  })
  return rows.map((r) => ({
    id: r.id,
    adminName: r.expand?.admin?.name ?? '',
    date: String(r.created).slice(0, 10),
    action: r.action,
    collection: r.collection,
  }))
}
