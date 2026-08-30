'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, ChevronDown, ChevronUp, Users, Shield, KeyRound, Archive, RotateCcw, Copy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { AppSelect } from '@/components/shared/AppSelect'
import { useApps } from '@/lib/use-apps'
import {
  ROLE_LABELS,
  PERMISSION_GROUPS,
  GROUP_LABELS,
  VIEW_ONLY_SET,
  permissionLabel,
  filterPermissionKeys,
  type PermissionKey,
  type RoleDefinition,
} from '@/lib/permissions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Membership { appSlug: string; role: string; permissions?: string | null }
interface User {
  id: number
  email: string
  name: string
  role: string
  deletedAt?: string | null
  memberships: Membership[]
}

function buildAppRoleOptions(roleDefs: RoleDefinition[]) {
  return [
    { value: '', label: 'No access', description: undefined as string | undefined },
    ...roleDefs.map(r => ({ value: r.name, label: r.label, description: r.description })),
    { value: 'custom', label: 'Custom', description: 'Hand-picked permissions from the catalog below.' },
  ]
}

function roleLabel(roleDefs: RoleDefinition[], name: string): string {
  if (name === 'custom') return 'Custom'
  return roleDefs.find(r => r.name === name)?.label ?? name
}

const GLOBAL_ROLE_OPTIONS = [
  { value: 'member', label: 'Member', description: 'App access via memberships' },
  { value: 'admin',  label: 'Admin',  description: 'Full access to all apps' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RolePill({ role }: { role: string }) {
  const cls: Record<string, string> = {
    admin:  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    member: 'bg-blue-100  text-blue-700  border-blue-200  dark:bg-blue-900/30  dark:text-blue-400  dark:border-blue-800',
  }
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${cls[role] ?? cls.member}`}>
      {role}
    </span>
  )
}

function AppRolePill({ role, roleDefs }: { role: string; roleDefs: RoleDefinition[] }) {
  const cls: Record<string, string> = {
    qa:        'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    developer: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    custom:    'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
  }
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${cls[role] ?? 'bg-muted text-muted-foreground border-border'}`}>
      {roleLabel(roleDefs, role)}
    </span>
  )
}

// ─── Membership editor ────────────────────────────────────────────────────────

interface AppRoleState { role: string; permissions: PermissionKey[] }

function parseMembershipPermissions(m: Membership): PermissionKey[] {
  if (m.role !== 'custom' || !m.permissions) return []
  try {
    const parsed = JSON.parse(m.permissions)
    return filterPermissionKeys(parsed)
  } catch {
    return []
  }
}

function PermissionPicker({
  selected,
  onChange,
  roleDefs,
}: {
  selected: PermissionKey[]
  onChange: (keys: PermissionKey[]) => void
  roleDefs: RoleDefinition[]
}) {
  const set = new Set(selected)

  function toggle(key: PermissionKey) {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(Array.from(next))
  }

  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {roleDefs.map(r => (
          <Button
            key={r.name}
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onChange([...r.permissions])}
          >
            {r.label} preset
          </Button>
        ))}
        <Button type="button" variant="outline" size="xs" onClick={() => onChange([...VIEW_ONLY_SET])}>
          View only
        </Button>
        <Button type="button" variant="outline" size="xs" onClick={() => onChange([])}>
          Clear
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(PERMISSION_GROUPS) as (keyof typeof PERMISSION_GROUPS)[]).map(group => (
          <div key={group} className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
              {GROUP_LABELS[group]}
            </p>
            <div className="space-y-1">
              {PERMISSION_GROUPS[group].map(key => (
                <label key={key} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={set.has(key)}
                    onChange={() => toggle(key)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  {permissionLabel(key)}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MembershipEditor({
  user,
  onSaved,
  roleDefs,
}: {
  user: User
  onSaved: (u: User) => void
  roleDefs: RoleDefinition[]
}) {
  const { apps } = useApps()
  const appRoleOptions = buildAppRoleOptions(roleDefs)
  const [roles, setRoles] = useState<Record<string, AppRoleState>>(() => {
    const map: Record<string, AppRoleState> = {}
    user.memberships.forEach(m => {
      map[m.appSlug] = { role: m.role, permissions: parseMembershipPermissions(m) }
    })
    return map
  })
  const [saving, setSaving] = useState(false)

  function setRole(appSlug: string, role: string) {
    setRoles(r => ({
      ...r,
      [appSlug]: { role, permissions: role === 'custom' ? (r[appSlug]?.permissions ?? []) : [] },
    }))
  }

  function setPermissions(appSlug: string, permissions: PermissionKey[]) {
    setRoles(r => ({ ...r, [appSlug]: { role: r[appSlug]?.role ?? 'custom', permissions } }))
  }

  async function save() {
    setSaving(true)
    const memberships = Object.entries(roles)
      .filter(([, s]) => s.role !== '')
      .map(([appSlug, s]) => ({
        appSlug,
        role: s.role,
        permissions: s.role === 'custom' ? s.permissions : [],
      }))
    const res = await fetch(`/api/admin/users/${user.id}/memberships`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberships }),
    })
    setSaving(false)
    if (res.ok) {
      onSaved({
        ...user,
        memberships: memberships.map(m => ({
          appSlug: m.appSlug,
          role: m.role,
          permissions: m.role === 'custom' ? JSON.stringify(m.permissions) : null,
        })),
      })
      toast.success('Memberships saved')
    } else {
      toast.error('Failed to save memberships')
    }
  }

  return (
    <div className="space-y-3">
      {apps.map(app => {
        const state = roles[app.slug] ?? { role: '', permissions: [] }
        return (
          <div key={app.slug} className="space-y-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none">{app.icon}</span>
                <span className="text-sm font-medium truncate">{app.name}</span>
                {!app.enabled && (
                  <Badge variant="secondary" className="text-xs shrink-0">Disabled</Badge>
                )}
              </div>
              <AppSelect
                options={appRoleOptions.map(o => ({ ...o }))}
                value={state.role}
                onChange={(v) => setRole(app.slug, v)}
                size="sm"
                className="shrink-0"
                align="end"
              />
            </div>
            {state.role === 'custom' && (
              <PermissionPicker
                selected={state.permissions}
                onChange={(keys) => setPermissions(app.slug, keys)}
                roleDefs={roleDefs}
              />
            )}
          </div>
        )
      })}
      <Button size="sm" onClick={save} disabled={saving} className="w-full mt-1">
        {saving ? 'Saving…' : 'Save memberships'}
      </Button>
    </div>
  )
}

// ─── Edit user form ───────────────────────────────────────────────────────────

function EditUserForm({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState<'member' | 'admin'>(user.role === 'admin' ? 'admin' : 'member')
  const [saving, setSaving] = useState(false)

  const dirty = name !== user.name || email !== user.email || role !== user.role

  async function save() {
    setSaving(true)
    const body: Record<string, string> = {}
    if (name.trim() !== user.name) body.name = name.trim()
    if (email.trim() !== user.email) body.email = email.trim()
    if (role !== user.role) body.role = role
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      onSaved({ ...user, ...body })
      toast.success('User updated')
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to update user')
    }
  }

  return (
    <div className="mb-4 pb-4 border-b border-border/60 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Full name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Email</label>
          <Input value={email} type="email" onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Global role</label>
          <AppSelect
            options={GLOBAL_ROLE_OPTIONS.map(o => ({ ...o }))}
            value={role}
            onChange={(v) => setRole(v as 'member' | 'admin')}
            className="w-full"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const router = useRouter()
  const { apps } = useApps()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createRole, setCreateRole] = useState<'member' | 'admin'>('member')
  const [resettingId, setResettingId] = useState<number | null>(null)
  const [resetPasswordResult, setResetPasswordResult] = useState<{ name: string; password: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState<User | null>(null)
  const [roleDefs, setRoleDefs] = useState<RoleDefinition[]>([])

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/users')
    if (res.status === 401 || res.status === 403) { router.push('/login'); return }
    if (!res.ok) { toast.error('Failed to load users'); setLoading(false); return }
    const data = await res.json()
    setUsers(data.users)
    setLoading(false)
  }, [router])

  const loadRoles = useCallback(async () => {
    const res = await fetch('/api/admin/roles')
    if (!res.ok) return
    const data = await res.json()
    setRoleDefs(data.roles ?? [])
  }, [])

  useEffect(() => { load(); loadRoles() }, [load, loadRoles])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    const form = e.currentTarget
    const body = {
      name:     (form.elements.namedItem('name')     as HTMLInputElement).value.trim(),
      email:    (form.elements.namedItem('email')    as HTMLInputElement).value.trim(),
      password: (form.elements.namedItem('password') as HTMLInputElement).value,
      role:     createRole,
    }
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setCreating(false)
    if (res.ok) {
      form.reset()
      setCreateRole('member')
      setShowCreate(false)
      toast.success(`${body.name} created`)
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      setCreateError(data.error ?? 'Failed to create user')
    }
  }

  async function handleResetPassword(user: User) {
    setConfirmReset(null)
    setResettingId(user.id)
    const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setResettingId(null)
    if (res.ok) {
      setResetPasswordResult({ name: user.name, password: data.password })
    } else {
      toast.error(data.error ?? 'Failed to reset password')
    }
  }

  async function handleRetire(user: User) {
    if (!confirm(`Retire ${user.name}? They will be blocked from logging in. You can restore them later.`)) return
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('User retired')
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to retire user')
    }
  }

  async function handleRestore(user: User) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore: true }),
    })
    if (res.ok) {
      setUsers(us => us.map(u => u.id === user.id ? { ...u, deletedAt: null } : u))
      toast.success('User restored')
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to restore user')
    }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">User Management</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? '—' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setShowCreate(v => !v); setCreateError('') }}>
          <Plus className="h-4 w-4" />
          New User
        </Button>
      </div>

      {/* Create user form */}
      {showCreate && (
        <Card>
          <CardHeader className="pb-2 border-b border-border/60">
            <CardTitle className="text-sm font-semibold">Create New User</CardTitle>
            <CardDescription>They can log in immediately with these credentials.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2" autoComplete="off">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Full name</label>
                <Input name="name" placeholder="Alice Smith" autoComplete="off" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Email</label>
                <Input name="email" type="email" placeholder="alice@example.com" autoComplete="off" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Password</label>
                <Input name="password" type="password" placeholder="Min. 8 characters" minLength={8} autoComplete="new-password" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Global role</label>
                <AppSelect
                  options={GLOBAL_ROLE_OPTIONS.map(o => ({ ...o }))}
                  value={createRole}
                  onChange={(v) => setCreateRole(v as 'member' | 'admin')}
                  className="w-full"
                />
              </div>
              {createError && (
                <p className="col-span-2 text-sm text-destructive">{createError}</p>
              )}
              <div className="col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={creating}>
                  {creating ? 'Creating…' : 'Create User'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users list */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No users yet.</p>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <Card key={user.id} size="sm" className={user.deletedAt ? 'opacity-60' : undefined}>
              <CardContent className="pt-3 pb-3">
                {/* User row */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{user.name}</span>
                      <RolePill role={user.role} />
                      {user.role === 'admin' && (
                        <Shield className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      {user.deletedAt && (
                        <Badge variant="destructive" className="text-xs">Retired</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
                    {user.memberships.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {user.memberships.map(m => {
                          const app = apps.find(a => a.slug === m.appSlug)
                          const membershipRoleLabel = roleLabel(roleDefs, m.role)
                          const label =
                            m.role === 'custom'
                              ? `${membershipRoleLabel} (${parseMembershipPermissions(m).length})`
                              : membershipRoleLabel
                          return (
                            <span key={m.appSlug} className="flex items-center gap-1 text-xs text-muted-foreground">
                              {app?.icon} <span className="font-medium">{label}</span>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setExpandedId(id => id === user.id ? null : user.id)}
                    >
                      {expandedId === user.id
                        ? <ChevronUp className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />}
                      Apps
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => setConfirmReset(user)}
                      disabled={resettingId === user.id}
                      aria-label={`Reset password for ${user.name}`}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    {user.deletedAt ? (
                      <Button
                        variant="outline"
                        size="icon-xs"
                        onClick={() => handleRestore(user)}
                        aria-label={`Restore ${user.name}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => handleRetire(user)}
                        aria-label={`Retire ${user.name}`}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Membership editor */}
                {expandedId === user.id && (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <EditUserForm
                      user={user}
                      onSaved={updated => setUsers(us => us.map(u => u.id === updated.id ? updated : u))}
                    />
                    <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                      App Access
                    </p>
                    <MembershipEditor
                      user={user}
                      onSaved={updated => setUsers(us => us.map(u => u.id === updated.id ? updated : u))}
                      roleDefs={roleDefs}
                    />
                    <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
                      {[...roleDefs, { name: 'custom', label: 'Custom', description: ROLE_LABELS.custom.description }].map(r => (
                        <div key={r.name} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <AppRolePill role={r.name} roleDefs={roleDefs} />
                          <span>{r.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reset password confirm */}
      <Dialog
        open={!!confirmReset}
        onOpenChange={(open) => { if (!open) setConfirmReset(null) }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Reset password for <strong>{confirmReset?.name}</strong>? Their current password
              stops working immediately and a new one is generated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => { if (confirmReset) handleResetPassword(confirmReset) }}
              disabled={!!confirmReset && resettingId === confirmReset.id}
            >
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password result modal */}
      <Dialog
        open={!!resetPasswordResult}
        onOpenChange={(open) => { if (!open) setResetPasswordResult(null) }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Password reset</DialogTitle>
            <DialogDescription>
              New password for <strong>{resetPasswordResult?.name}</strong>. This is shown only
              once — copy it now, it cannot be retrieved again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
              {resetPasswordResult?.password}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => {
                if (!resetPasswordResult) return
                navigator.clipboard.writeText(resetPasswordResult.password)
                toast.success('Password copied')
              }}
              aria-label="Copy password"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordResult(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
