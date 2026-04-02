import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Send push notification to a customer.
 * Called internally from CRM when PM replies to a ticket or project stage changes.
 *
 * POST /api/portal/push
 * Body: { projectId: string, title: string, body: string, data?: object }
 */
export async function POST(request: NextRequest) {
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Service key not configured' }, { status: 503 })
  }

  const { projectId, title, body, data } = await request.json()
  if (!projectId || !title || !body) {
    return NextResponse.json({ error: 'projectId, title, and body required' }, { status: 400 })
  }

  // Look up customer push token
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
  const { data: accounts } = await supabase
    .from('customer_accounts')
    .select('push_token, name')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .not('push_token', 'is', null)

  if (!accounts?.length) {
    return NextResponse.json({ sent: 0, reason: 'no push tokens' })
  }

  // Send via Expo Push API
  const messages = accounts
    .filter((a: any) => a.push_token)
    .map((a: any) => ({
      to: a.push_token,
      sound: 'default',
      title,
      body,
      data: { ...data, projectId },
    }))

  if (messages.length === 0) {
    return NextResponse.json({ sent: 0, reason: 'no valid tokens' })
  }

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    })
    const result = await res.json()
    return NextResponse.json({ sent: messages.length, result })
  } catch (err: any) {
    console.error('[push] send failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Push notification API' })
}
