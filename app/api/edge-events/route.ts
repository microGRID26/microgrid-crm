import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendToEdge, isEdgeConfigured, isEdgeSecretConfigured, getEdgeWebhookUrl } from '@/lib/api/edge-sync'
import type { EdgeEventType } from '@/lib/api/edge-sync'

export async function GET() {
  return NextResponse.json({
    configured: isEdgeConfigured(),
    secretConfigured: isEdgeSecretConfigured(),
    webhookUrl: getEdgeWebhookUrl(),
  })
}

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

  let event: EdgeEventType, projectId: string, data: Record<string, unknown>
  try {
    const body = await request.json()
    event = body.event
    projectId = body.projectId
    data = body.data ?? {}
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!event || !projectId) return NextResponse.json({ error: 'event and projectId required' }, { status: 400 })

  const ok = await sendToEdge(event, projectId, data)
  return NextResponse.json({ ok })
}
