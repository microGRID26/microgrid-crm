import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function readEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !anon || !service) {
    throw new Error(
      'evals/helpers/clients.ts: missing Supabase env vars. Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).',
    )
  }
  return { url, anon, service }
}

let _service: SupabaseClient | null = null

export function serviceClient(): SupabaseClient {
  if (_service) return _service
  const { url, service } = readEnv()
  _service = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _service
}

export async function userClient(email: string, password: string): Promise<SupabaseClient> {
  const { url, anon } = readEnv()
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`userClient sign-in failed for ${email}: ${error.message}`)
  }
  return client
}

export function supabaseUrl(): string {
  return readEnv().url
}
