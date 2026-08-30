'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ShieldCheck, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  PERMISSION_GROUPS,
  GROUP_LABELS,
  permissionLabel,
  type PermissionKey,
  type RoleDefinition,
} from '@/lib/permissions'

const NAME_PATTERN = /^[a-z][a-z0-9-]{0,19}$/

function makeEmptyRole(): RoleDefinition {
  return { name: '', label: '', description: '', permissions: [] }
}

export default function AdminRolesPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newRole, setNewRole] = useState<RoleDefinition>(makeEmptyRole())
  const [addError, setAddError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/roles')
    if (res.status === 401 || res.status === 403) { router.push('/login'); return }
    if (!res.ok) { toast.error('Failed to load roles'); setLoading(false); return }
    const data = await res.json()
    setRoles(data.roles)
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  function togglePermission(roleName: string, key: PermissionKey) {
    setRoles(rs => rs.map(r => {
      if (r.name !== roleName) return r
      const has = r.permissions.includes(key)
      return {
        ...r,
        permissions: has ? r.permissions.filter(p => p !== key) : [...r.permissions, key],
      }
    }))
  }

  function updateField(roleName: string, field: 'label' | 'description', value: string) {
    setRoles(rs => rs.map(r => r.name === roleName ? { ...r, [field]: value } : r))
  }

  function removeRole(roleName: string) {
    setRoles(rs => rs.filter(r => r.name !== roleName))
  }

  function handleAddRole() {
    setAddError('')
    const name = newRole.name.trim().toLowerCase()
    if (!NAME_PATTERN.test(name)) {
      setAddError('Name must be lowercase letters, numbers, or hyphens, starting with a letter (max 20 chars).')
      return
    }
    if (roles.some(r => r.name === name)) {
      setAddError('A role with this name already exists.')
      return
    }
    if (!newRole.label.trim()) {
      setAddError('Label is required.')
      return
    }
    setRoles(rs => [...rs, { name, label: newRole.label.trim(), description: newRole.description.trim(), permissions: [] }])
    setNewRole(makeEmptyRole())
    setShowAdd(false)
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/roles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (res.ok) {
      toast.success('Roles saved')
    } else {
      toast.error(data.error ?? 'Failed to save roles')
    }
  }

  const groupKeys = Object.keys(PERMISSION_GROUPS) as (keyof typeof PERMISSION_GROUPS)[]

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Roles & Permissions</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? '—' : `${roles.length} role${roles.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowAdd(v => !v); setAddError('') }}>
            <Plus className="h-4 w-4" />
            Add Role
          </Button>
          <Button size="sm" onClick={save} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      {/* Warning note */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
        <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Renaming or deleting a role does not update existing user memberships — affected users
          fall back to no permissions until reassigned.
        </span>
      </div>

      {/* Add role form */}
      {showAdd && (
        <Card>
          <CardHeader className="pb-2 border-b border-border/60">
            <CardTitle className="text-sm font-semibold">Add Role</CardTitle>
            <CardDescription>Creates a new role with no permissions selected.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Name (slug)</label>
                <Input
                  value={newRole.name}
                  onChange={(e) => setNewRole(r => ({ ...r, name: e.target.value }))}
                  placeholder="e.g. reviewer"
                  maxLength={20}
                />
                <p className="text-[10px] text-muted-foreground">Lowercase letters, numbers, hyphens. Max 20 chars.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Label</label>
                <Input
                  value={newRole.label}
                  onChange={(e) => setNewRole(r => ({ ...r, label: e.target.value }))}
                  placeholder="e.g. Reviewer"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Description</label>
                <Input
                  value={newRole.description}
                  onChange={(e) => setNewRole(r => ({ ...r, description: e.target.value }))}
                  placeholder="Short description"
                />
              </div>
              {addError && (
                <p className="col-span-3 text-sm text-destructive">{addError}</p>
              )}
              <div className="col-span-3 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={handleAddRole}>
                  Add Role
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matrix */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : roles.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No roles yet.</p>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card text-left align-bottom px-2 py-2 min-w-[180px]">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Permission
                      </span>
                    </th>
                    {roles.map(role => (
                      <th key={role.name} className="text-left align-bottom px-3 py-2 min-w-[220px] border-l border-border/60">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant={role.builtin ? 'default' : 'secondary'} className="text-[10px]">
                              {role.name}
                            </Badge>
                            {!role.builtin && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon-xs"
                                onClick={() => removeRole(role.name)}
                                aria-label={`Delete role ${role.label}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <Input
                            value={role.label}
                            onChange={(e) => updateField(role.name, 'label', e.target.value)}
                            className="h-7 text-xs font-semibold"
                          />
                          <Textarea
                            value={role.description}
                            onChange={(e) => updateField(role.name, 'description', e.target.value)}
                            className="min-h-0 h-14 text-xs font-normal"
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupKeys.map(group => (
                    <Fragment key={group}>
                      <tr>
                        <td
                          colSpan={roles.length + 1}
                          className="sticky left-0 bg-muted/40 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {GROUP_LABELS[group]}
                        </td>
                      </tr>
                      {PERMISSION_GROUPS[group].map(key => (
                        <tr key={key} className="border-t border-border/40">
                          <td className="sticky left-0 z-10 bg-card px-2 py-1.5 text-xs">
                            {permissionLabel(key)}
                          </td>
                          {roles.map(role => (
                            <td key={role.name} className="border-l border-border/60 px-3 py-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={role.permissions.includes(key)}
                                onChange={() => togglePermission(role.name, key)}
                                className="h-3.5 w-3.5 accent-primary"
                                aria-label={`${permissionLabel(key)} for ${role.label}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
