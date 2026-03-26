import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const STORAGE_STATE_PATH = path.join(__dirname, '.auth', 'storage-state.json')
const TEST_EMAIL = 'e2e-test@gomicrogridenergy.com'
const TEST_PASSWORD = 'E2E-test-pw-2026!'

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. ' +
      'E2E tests require these to create a test session.'
    )
  }

  // Create admin Supabase client
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Ensure test user exists with a password
  const { data: listData } = await supabase.auth.admin.listUsers()
  let testUser = listData?.users?.find((u) => u.email === TEST_EMAIL)

  if (!testUser) {
    console.log('[E2E Setup] Creating test user:', TEST_EMAIL)
    const { data, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Test User' },
    })
    if (error) throw new Error(`Failed to create test user: ${error.message}`)
    testUser = data.user!

    // Also provision a users table row so useCurrentUser works
    await supabase.from('users').upsert(
      {
        id: testUser.id,
        email: TEST_EMAIL,
        name: 'E2E Test User',
        role: 'admin',
        active: true,
      },
      { onConflict: 'id' }
    )
  } else {
    // Ensure password is set (user might exist from a prior run without password)
    await supabase.auth.admin.updateUserById(testUser.id, {
      password: TEST_PASSWORD,
    })
  }

  // Sign in as the test user to get access/refresh tokens
  // We need a regular (anon key) client for signInWithPassword
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.')
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: signInData, error: signInError } =
    await anonClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })

  if (signInError || !signInData.session) {
    throw new Error(
      `Failed to sign in test user: ${signInError?.message ?? 'no session returned'}`
    )
  }

  const session = signInData.session
  const ref = supabaseUrl.match(/https:\/\/(.+?)\.supabase/)?.[1] ?? ''
  const storageKey = `sb-${ref}-auth-token`

  console.log('[E2E Setup] Authenticated as', TEST_EMAIL)
  console.log('[E2E Setup] Supabase ref:', ref)

  // Launch a browser to set localStorage, then save storage state
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  // Navigate to the app origin so we can set localStorage on the correct domain
  await page.goto('http://localhost:3000/login')
  await page.waitForLoadState('domcontentloaded')

  // Set the Supabase auth token in localStorage
  await page.evaluate(
    ({ key, session: s }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          expires_in: s.expires_in,
          expires_at: s.expires_at,
          token_type: s.token_type,
          user: s.user,
        })
      )
    },
    {
      key: storageKey,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
        user: session.user,
      },
    }
  )

  // Ensure output directory exists
  const authDir = path.dirname(STORAGE_STATE_PATH)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  // Save the storage state (includes localStorage)
  await context.storageState({ path: STORAGE_STATE_PATH })
  console.log('[E2E Setup] Storage state saved to', STORAGE_STATE_PATH)

  await browser.close()
}
