import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require no authentication
const PUBLIC_ROUTES = ['/login', '/auth']
const PUBLIC_PREFIXES = ['/api/webhooks/', '/api/email/send-daily', '/api/calendar/', '/_next/', '/favicon.ico']

// Role hierarchy levels (must match lib/useCurrentUser.ts ROLE_LEVEL)
const ROLE_LEVEL: Record<string, number> = {
  super_admin: 5,
  admin: 4,
  finance: 3,
  manager: 2,
  user: 1,
  sales: 0,
}

// Routes that require specific minimum role levels
// Routes not listed here require only authentication (level >= 0)
const ROUTE_ROLE_REQUIREMENTS: { prefix: string; minLevel: number; label: string }[] = [
  // Super admin only
  { prefix: '/system', minLevel: 5, label: 'super_admin' },
  // Admin+
  { prefix: '/admin', minLevel: 4, label: 'admin' },
  // Manager+ (most operational pages)
  { prefix: '/analytics', minLevel: 2, label: 'manager' },
  { prefix: '/reports', minLevel: 2, label: 'manager' },
  { prefix: '/funding', minLevel: 2, label: 'manager' },
  { prefix: '/ntp', minLevel: 2, label: 'manager' },
  { prefix: '/inventory', minLevel: 2, label: 'manager' },
  { prefix: '/service', minLevel: 2, label: 'manager' },
  { prefix: '/work-orders', minLevel: 2, label: 'manager' },
  { prefix: '/warranty', minLevel: 2, label: 'manager' },
  { prefix: '/fleet', minLevel: 2, label: 'manager' },
  { prefix: '/vendors', minLevel: 2, label: 'manager' },
  { prefix: '/permits', minLevel: 2, label: 'manager' },
  { prefix: '/documents', minLevel: 2, label: 'manager' },
  { prefix: '/change-orders', minLevel: 2, label: 'manager' },
  { prefix: '/redesign', minLevel: 2, label: 'manager' },
  { prefix: '/legacy', minLevel: 2, label: 'manager' },
  { prefix: '/batch', minLevel: 2, label: 'manager' },
  { prefix: '/planset', minLevel: 2, label: 'manager' },
  { prefix: '/audit-trail', minLevel: 2, label: 'manager' },
  { prefix: '/audit', minLevel: 2, label: 'manager' },
  { prefix: '/dashboard', minLevel: 2, label: 'manager' },
]

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) return true
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return true
  // Static files
  if (pathname.includes('.') && !pathname.startsWith('/api/')) return true
  return false
}

function getRequiredLevel(pathname: string): { minLevel: number; label: string } | null {
  for (const route of ROUTE_ROLE_REQUIREMENTS) {
    if (pathname === route.prefix || pathname.startsWith(route.prefix + '/')) {
      return route
    }
  }
  return null
}

// Cookie name for cached user role (set after first DB lookup per session)
const ROLE_COOKIE = 'mg_user_role'
const ROLE_COOKIE_MAX_AGE = 300 // 5 minutes

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip public routes entirely
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Create Supabase client for middleware (uses request/response cookies)
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Set cookies on both the request (for downstream) and response
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session — this is critical for Supabase Auth to work with middleware
  // getUser() validates the JWT server-side (not just decoding it)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    // Not authenticated — redirect to login
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // Check if this route requires a specific role
  const requirement = getRequiredLevel(pathname)
  if (!requirement) {
    // Route only requires authentication, which we've confirmed
    return response
  }

  // Role check needed — try cached cookie first, then fall back to DB
  // For sensitive routes (/admin, /system), ALWAYS query DB to prevent cookie forgery
  const isSensitiveRoute = pathname.startsWith('/admin') || pathname.startsWith('/system')
  let userRole: string | undefined = isSensitiveRoute ? undefined : request.cookies.get(ROLE_COOKIE)?.value

  if (!userRole) {
    // Query the users table for role
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('email', user.email ?? '')
        .single()

      userRole = userRow?.role ?? 'user'
    } catch {
      // DB query failed — default to 'user' role (least privilege)
      userRole = 'user'
    }

    // Cache the role in a short-lived cookie to avoid repeated DB lookups
    // (only useful for non-sensitive routes on subsequent requests)
    response.cookies.set(ROLE_COOKIE, userRole!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ROLE_COOKIE_MAX_AGE,
      path: '/',
    })
  }

  // userRole is guaranteed to be set: either from cookie (non-sensitive) or DB query above
  const resolvedRole = userRole ?? 'user'
  const userLevel = ROLE_LEVEL[resolvedRole] ?? 1

  if (userLevel < requirement.minLevel) {
    // Insufficient role — redirect to command with error
    const redirectUrl = new URL('/command', request.url)
    redirectUrl.searchParams.set('error', 'insufficient_role')
    redirectUrl.searchParams.set('required', requirement.label)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

// Matcher: run middleware on all routes except static assets and Next.js internals
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
