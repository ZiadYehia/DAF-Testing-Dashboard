'use client'

// Client-side access to the current user's effective permissions for an app.
// Mirrors the fetch style of use-apps.ts / knowledge page: one GET on mount,
// fail closed (no permissions, no role) on any error or non-OK response so
// gated UI stays hidden rather than flashing on then disappearing.

import { useEffect, useState } from 'react'
import type { PermissionKey } from '@/lib/permissions'

interface RoleResponse {
  role?: string
  permissions?: string[]
}

export function usePermissions(app: string): {
  role: string | null
  permissions: Set<PermissionKey>
  can: (key: PermissionKey) => boolean
  loading: boolean
} {
  const [role, setRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!app) {
      setRole(null)
      setPermissions(new Set())
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    fetch(`/api/${app}/role`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load role'))))
      .then((d: RoleResponse) => {
        if (!active) return
        setRole(d.role ?? null)
        setPermissions(new Set((Array.isArray(d.permissions) ? d.permissions : []) as PermissionKey[]))
      })
      .catch(() => {
        if (!active) return
        setRole(null)
        setPermissions(new Set())
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [app])

  function can(key: PermissionKey): boolean {
    return permissions.has(key)
  }

  return { role, permissions, can, loading }
}
