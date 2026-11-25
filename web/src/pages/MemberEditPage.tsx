import { IonList, IonListHeader, IonLabel } from '@ionic/react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  allAreas,
  areaLabels,
  createMember,
  grantArea,
  issueSetupLink,
  listMembers,
  listPermissions,
  listRights,
  revokeArea,
  setPermission,
  updateMember,
  type Area,
  type Issued,
  type Member,
} from '../api/admin'
import type { Level } from '../api/auth'
import { AdminRefusedError } from '../api/errors'
import { listCategories } from '../api/material'
import { CheckboxField, Field, SelectField } from '../components/Field'
import Loaded from '../components/Loaded'
import Page from '../components/Page'
import { requiredMessage, showFirstInvalid } from '../components/required'
import SetupLinkPanel from '../components/SetupLinkPanel'
import { useDialogs } from '../components/useDialogs'
import { ActionBar, BlockButton, ErrorText, Hint } from '../components/ui'
import { paths } from '../routes'
import { useSession } from '../session'
import { useBusy } from '../useBusy'
import { useResource } from '../useResource'

const load = async () => {
  const [members, permissions, rights, categories] = await Promise.all([listMembers(), listPermissions(), listRights(), listCategories()])
  return { members, permissions, rights, categories }
}

const levelLabels: Record<Level | 'none', string> = { none: 'Keine', use: 'Verwendung', check: 'Prüfung', manage: 'Verwaltung' }

// One page for a new member (no id) and for an existing one.
export default function MemberEditPage() {
  const { memberId } = useParams()
  const { holds } = useSession()
  const navigate = useNavigate()
  const resource = useResource(load)
  const [issued, setIssued] = useState<{ token: string; name: string } | null>(null)
  return (
    <Page title={memberId ? 'Mitglied' : 'Neues Mitglied'} back={paths.adminMembers}>
      {!holds('members') ? (
        <p>Keine Berechtigung.</p>
      ) : (
        <Loaded resource={resource}>
          {(data) => {
            const member = data.members.find((m) => m.id === memberId)
            if (memberId && !member) return <p>Mitglied nicht gefunden.</p>
            if (issued) return <SetupLinkPanel {...issued} onDone={() => (memberId ? setIssued(null) : navigate(paths.adminMembers))} />
            return member ? (
              <MemberDetails key={member.id} member={member} data={data} onChange={resource.reload} onIssued={(token) => setIssued({ token, name: member.name })} />
            ) : (
              <NewMember onIssued={(token, name) => setIssued({ token, name })} />
            )
          }}
        </Loaded>
      )}
    </Page>
  )
}

function useIdentity(member: Member | undefined, save: (name: string, email: string) => Promise<void>) {
  const [name, setName] = useState(member?.name ?? '')
  const [email, setEmail] = useState(member?.email ?? '')
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { busy, once } = useBusy()
  const submit = () =>
    once(async () => {
      if (!name.trim() || !email.trim()) {
        setTried(true)
        showFirstInvalid()
        return
      }
      setError(null)
      try {
        await save(name.trim(), email.trim())
      } catch (err) {
        setError(err instanceof AdminRefusedError ? 'Nicht möglich. Ist die E-Mail-Adresse gültig und noch frei?' : 'Speichern fehlgeschlagen.')
      }
    })
  const fields = (
    <>
      <IonList>
        <Field label="Name" value={name} onChange={setName} required error={tried && !name.trim() ? requiredMessage : undefined} />
        <Field label="E-Mail" type="email" autoComplete="off" autoCapitalize="off" value={email} onChange={setEmail} required error={tried && !email.trim() ? requiredMessage : undefined} />
      </IonList>
      <ErrorText>{error}</ErrorText>
    </>
  )
  return { fields, submit, busy }
}

function NewMember({ onIssued }: { onIssued(token: string, name: string): void }) {
  const { fields, submit, busy } = useIdentity(undefined, async (name, email) => {
    const issued: Issued = await createMember(name, email)
    onIssued(issued.token, name)
  })
  return (
    <>
      {fields}
      <ActionBar>
        <BlockButton disabled={busy} onClick={submit}>
          Mitglied anlegen
        </BlockButton>
      </ActionBar>
    </>
  )
}

interface DetailsProps {
  member: Member
  data: { permissions: Awaited<ReturnType<typeof listPermissions>>; rights: Awaited<ReturnType<typeof listRights>>; categories: Awaited<ReturnType<typeof listCategories>> }
  onChange(): void
  onIssued(token: string): void
}

function MemberDetails({ member, data, onChange, onIssued }: DetailsProps) {
  const { confirm } = useDialogs()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const { fields, submit, busy } = useIdentity(member, async (name, email) => {
    await updateMember(member.id, { name, email })
    setSaved(true)
    onChange()
  })

  // Runs a change on the server and reloads; a refusal gets its own sentence.
  const change = async (action: () => Promise<unknown>, refusal: string) => {
    setError(null)
    setSaved(false)
    try {
      await action()
      onChange()
    } catch (err) {
      setError(err instanceof AdminRefusedError ? refusal : 'Speichern fehlgeschlagen.')
    }
  }

  const link = () =>
    change(async () => onIssued((await issueSetupLink(member.id)).token), 'Mitglieder mit Rechten zuerst deaktivieren, dann gibt es einen Link.')

  const toggleActive = async () => {
    const deactivate = !member.deactivated
    const message = deactivate ? `${member.name} deaktivieren? Die Anmeldung wird sofort gesperrt.` : `${member.name} wieder aktivieren?`
    if (!(await confirm({ message, confirmText: deactivate ? 'Deaktivieren' : 'Aktivieren', destructive: deactivate }))) return
    await change(() => updateMember(member.id, { deactivated: deactivate }), 'Nicht möglich: Der letzte Verwalter der Mitglieder muss bleiben.')
  }

  const levelOf = (categoryId: string) => data.permissions.find((p) => p.userId === member.id && p.categoryId === categoryId)
  const rightOf = (area: Area) => data.rights.find((r) => r.userId === member.id && r.area === area)

  return (
    <>
      {fields}
      {saved && <Hint>Gespeichert.</Hint>}
      <BlockButton disabled={busy} onClick={submit}>
        Speichern
      </BlockButton>
      <ErrorText>{error}</ErrorText>
      <IonList>
        <IonListHeader>
          <IonLabel>Berechtigungen</IonLabel>
        </IonListHeader>
        {data.categories.map((c) => (
          <SelectField
            key={c.id}
            label={c.name}
            value={levelOf(c.id)?.level ?? 'none'}
            onChange={(value) =>
              change(() => setPermission(member.id, c.id, levelOf(c.id), value === 'none' ? null : (value as Level)), 'Nicht möglich.')
            }
          >
            {(Object.keys(levelLabels) as (Level | 'none')[]).map((level) => (
              <option key={level} value={level}>
                {levelLabels[level]}
              </option>
            ))}
          </SelectField>
        ))}
      </IonList>
      <IonList>
        <IonListHeader>
          <IonLabel>Verwaltung in der App</IonLabel>
        </IonListHeader>
        {allAreas.map((area) => (
          <CheckboxField
            key={area}
            label={areaLabels[area]}
            checked={rightOf(area) !== undefined}
            onChange={(on) => {
              const right = rightOf(area)
              if (on === (right !== undefined)) return
              void change(
                () => (on ? grantArea(member.id, area) : revokeArea(right!.id)),
                'Nicht möglich: Der letzte Verwalter der Mitglieder muss bleiben.',
              )
            }}
          />
        ))}
      </IonList>
      <Hint>Wer Mitglieder verwalten darf, kann sich selbst jedes Recht geben.</Hint>
      <BlockButton fill="outline" onClick={link}>
        Neuer Einrichtungslink
      </BlockButton>
      <BlockButton color={member.deactivated ? undefined : 'danger'} fill="clear" onClick={toggleActive}>
        {member.deactivated ? 'Wieder aktivieren' : 'Deaktivieren'}
      </BlockButton>
    </>
  )
}
