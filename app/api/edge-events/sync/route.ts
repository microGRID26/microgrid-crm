import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { syncProjectToEdge, syncFundingToEdge } from '@/lib/api/edge-sync'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options) } catch {}
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let projectId: string, type: string
  try {
    const body = await request.json()
    projectId = body.projectId
    type = body.type ?? 'project'
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  // Project sync is admin-only (manual trigger from EdgeIntegrationManager).
  // Funding sync is any authenticated user (triggered by automated workflows).
  if (type === 'project') {
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (!['admin', 'super_admin'].includes(userRow?.role ?? '')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ok = type === 'funding'
    ? await syncFundingToEdge(projectId)
    : await syncProjectToEdge(projectId)

  return NextResponse.json({ ok })
}
