'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types/database'

interface CurrentUser {
  id: string
  email: string
  name: string
  role: UserRole
  isAdmin: boolean      // role is admin or super_admin
  isSuperAdmin: boolean // role is super_admin
  isFinance: boolean    // role is finance+
  isManager: boolean    // role is manager+
}

const ROLE_LEVEL: Record<UserRole, number> = {
  super_admin: 5,
  admin: 4,
  finance: 3,
  manager: 2,
  user: 1,
}

function buildUser(id: string, email: string, name: string, role: UserRole): CurrentUser {
  const level = ROLE_LEVEL[role] ?? 1
  return {
    id, email, name, role,
    isAdmin: level >= 4,
    isSuperAdmin: role === 'super_admin',
    isFinance: level >= 3,
    isManager: level >= 2,
  }
}

let cached: CurrentUser | null = null

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (cached) return
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      const email = data.user?.email
      if (!email) { setLoading(false); return }
      const { data: u } = await (supabase as any)
        .from('users').select('id, name, email, role')
        .eq('email', email).single()
      const resolved: CurrentUser = u
        ? buildUser(u.id, u.email, u.name, u.role ?? 'user')
        : buildUser('', email, email.split('@')[0], 'user')
      cached = resolved
      setUser(resolved)
      setLoading(false)
    }).catch((err) => {
      console.error('useCurrentUser: failed to load user', err)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}
