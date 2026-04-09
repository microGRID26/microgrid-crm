Built and maintained by Atlas (AI assistant) for MicroGRID Energy / EDGE.

# CLAUDE.md

Essential guidance for Claude Code. Detailed reference in `ARCHITECTURE.md`.

## Session Startup (auto-orient)

At the start of EVERY new conversation, before doing anything else:
1. Read the latest session state memory file (check MEMORY.md for the most recent `session*_state.md`)
2. Read feedback files: `feedback_audit_rubric.md`, `feedback_self_prompt_protocol.md`, `feedback_straight_talk.md`
3. Run `git log --oneline -5` and `npm test -- --run` (tail last 5 lines)
4. Report: latest commit, test count, any failures, last session summary, blocked items
5. Ask Greg what he wants to work on

Keep the report under 20 lines. If tests fail or TS errors exist, flag prominently.

## Project

MicroGRID — solar project management system for MicroGRID Energy / EDGE. Tracks ~920 active residential solar installation projects (`projects` table where `disposition='Sale'`) through a 7-stage pipeline (evaluation → survey → design → permit → install → inspection → complete). Built for PMs who each own a set of projects. Migrated from NetSuite.

**Data architecture (verified post-cleanup 2026-04-08):**
- `projects` table: 1,567 rows total
  - 920 `Sale` (active pipeline — what every page shows)
  - 391 `Cancelled`, 149 `Loyalty`, 106 `Legal`, 1 `On Hold`
  - 0 `In Service` (shadow copies removed in cleanup)
- `legacy_projects` table: 15,585 rows (canonical NetSuite archive: 15,330 In Service, 149 Loyalty, 106 Legal)
- **April 6 2026 import event + Apr 8 cleanup:** On 2026-04-06, ~15,090 rows were bulk-inserted into `projects` from `legacy_projects` (no commit, no documentation). On 2026-04-08, drift investigation found that the import had brought in **223 corrected contract values** from a fresher NetSuite source where `legacy_projects.contract` had $0 placeholders. Cleanup steps:
  1. Backfilled the 223 corrected contract values from `projects` → `legacy_projects` (preserved the corrections in the canonical archive)
  2. Deleted the 15,098 shadow copies from `projects` (CASCADE removed 43 `project_adders` rows)
  3. Cleaned ~832 orphan rows in `task_state`/`task_history`/`service_calls`/`project_funding` that pointed to deleted projects (no FK enforced these)
- **`legacy_projects` is now the canonical archive** for In Service projects (15,585 rows: 15,330 In Service, 149 Loyalty, 106 Legal). `projects` table contains active pipeline only (~920 Sale + 391 Cancelled + 149 Loyalty + 106 Legal + 1 On Hold).
- `/legacy` page reads from `legacy_projects` directly. Drift check `npx tsx scripts/check-legacy-drift.ts` is preserved for future safety.
- **Manual review TODO:** 3 contract values have a true disagreement between `projects` and `legacy_projects` (both positive, different values, all `projects < legacy`). These were preserved in both tables — check whether the legacy value (higher) or the projects value (lower) is correct:
  - PROJ-1716 Damaris Renteria — projects=$13,280.64, legacy=$31,939.41
  - PROJ-3620 Robert Hassell — projects=$6,150, legacy=$20,202
  - PROJ-12649 Gabe Harman — projects=$72,000, legacy=$73,000

## Commands

```bash
npm run dev        # Dev server on :3000
npm run build      # Production build (Next.js)
npm run lint       # ESLint (Next.js + TypeScript presets)
npm test           # Run all tests (Vitest, single run)
npm run test:watch # Run tests in watch mode
```

Auto-deploys to Vercel on push to `main`.

## Tech Stack

- **Next.js 16** (App Router, `"use client"` pages — no RSC data fetching)
- **React 19** + TypeScript (strict)
- **Tailwind CSS v4** (PostCSS plugin, not config-based)
- **Supabase** — PostgreSQL, Auth (Google OAuth), Realtime subscriptions
- **No state management library** — pure `useState`/`useEffect`/`useCallback` + Supabase realtime
- **Leaflet** — maps (ramp-up planner proximity clustering)
- **Resend** — transactional email (onboarding, digest, announcements)
- **Sentry** — error tracking (optional, activated by `NEXT_PUBLIC_SENTRY_DSN`)
- **date-fns** — date manipulation
- **lucide-react** — icons

### Native Mobile App (`/mobile`)

A standalone Expo React Native app lives in the `/mobile` directory with its own `package.json` and `app.json`. It is the customer-facing companion to the web portal (`/portal/*`). **Not part of the Next.js build** — it has its own dependency tree and dev server.

- **Expo SDK 54** + React Native 0.81 + React 19 + TypeScript
- **Expo Router 6** (file-based routing) with tab navigation (Home, Support, Atlas, Account)
- **Supabase** client with `expo-secure-store` for token persistence
- **Push notifications** via `expo-notifications` (Expo Push Token saved to `customer_accounts.push_token`)
- **Commands**: `cd mobile && npm install && npx expo start`

## Testing

**Vitest** + React Testing Library with jsdom. 3,044 tests across 106 files. Supabase globally mocked in `vitest.setup.ts`. Tests focus on business logic, not rendering. When adding features, add corresponding tests. API route tests in `__tests__/api/`.

Test categories: `__tests__/lib/` (API, utils), `__tests__/logic/` (SLA, funding, filters), `__tests__/pages/` (page logic), `__tests__/auth/` (OAuth, proxy), `__tests__/hooks/` (custom hooks), `__tests__/components/` (UI components).

## Architecture Patterns

### Pages
All pages in `app/*/page.tsx` as client components. Each fetches data via Supabase browser client on mount, subscribes to realtime changes. Root `/` redirects to user's preferred homepage.

**51 pages total** — see `ARCHITECTURE.md` for full inventory. Key pages: `/command` (morning briefing — Fix These First + Push These Forward), `/queue` (PM worklist), `/pipeline` (Kanban), `/analytics` (10 tabs: Executive, Cash Flow, Install Velocity, Pipeline, By PM, Sales, Crew, Forecast, Job Costing, Operations), `/schedule` (crew calendar), `/funding` (M1/M2/M3 milestones + Ready to Collect cards), `/tickets` (issue tracking), `/ramp-up` (install planning with proximity clustering + schedule sync).

### API Layer
All data access via `lib/api/` — 20+ modules. Pages import from `@/lib/api`. The API layer handles error logging, type casting, `.limit()` calls, and consistent return shapes. Use `db()` helper from `lib/db.ts` for writes to untyped tables.

### Hooks (`lib/hooks/`)
- **`useSupabaseQuery<T>`** — generic data fetching with LRU cache (50 entries, 5-min TTL), request dedup, stale-while-revalidate, pagination, realtime subscriptions, org-scoped filtering. `clearQueryCache()` after bulk mutations.
- **`useProjectTasks`** — all task automation logic (500+ lines): status changes, revision cascade, auto-advance stage, funding triggers, blocker detection, notification rules.
- **`useOrg`** — multi-tenant org context via `OrgProvider`. Returns `orgId`, `orgName`, `switchOrg`.
- **`usePmFilter`** — shared PM dropdown state for Command/Queue.
- **`useServerFilter`** — filter/search state management producing Supabase query params.
- **`useEdgeSync`** — fire-and-forget EDGE webhook triggers.

### Realtime
`supabase.channel().on('postgres_changes', ...)` pattern. `useSupabaseQuery` supports `subscribe: true` with optional `realtimeFilter` for scoped subscriptions.

### Task Automation Chain
When task statuses change in ProjectPanel:
1. Auto-populate project dates (11 task→date mappings)
2. Auto-advance stage when last required task completes
3. Auto-detect/clear blockers on stuck tasks
4. Funding milestone triggers (Install Complete → M2 Eligible, PTO → M3 Eligible)
5. Revision cascade resets downstream tasks + clears dates
6. Auto-set dependent tasks to Ready To Start
7. Auto-set In Service disposition on final task

### Multi-Tenant Organizations
`organizations` + `org_memberships` tables. `org_id` on 8 tables. Org-scoped RLS on 30 tables (migration 043). `useOrg()` hook provides context. Default org: MicroGRID Energy (`a0000000-...0001`). `OrgSwitcher` component in nav for multi-org users.

## Style Conventions

- Dark theme: `bg-gray-900` (page), `bg-gray-800` (cards), green accent (`#1D9E75` / `text-green-400`)
- Status colors: green = on track, amber = at risk, red = critical/blocked, blue = in progress
- Font: Inter (Google Fonts)
- Use `cn()` from `lib/utils.ts` for conditional Tailwind classes
- Icon library: `lucide-react`
- Date formatting: `fmtDate()` and `daysAgo()` helpers (native Date API, returns `'—'` for null)
- Currency: `fmt$()` — whole dollars, no decimals on dashboards

## Critical Patterns

### Filter Pattern
When combining search with dropdown filters, do NOT early-return the search match. This was a recurring bug:
```typescript
// WRONG — search overrides other filters
if (search.trim()) { return name.includes(q) || id.includes(q) }
// RIGHT — search narrows, other filters still apply
if (search.trim()) { if (!name.includes(q) && !id.includes(q)) return false }
return true
```

### Search Sanitization
All `.ilike()` queries must use `escapeIlike()` from `lib/utils.ts` to escape `%`, `_`, `\`.

### cycleDays Helper
`daysAgo()` returns `0` for null. Use `||` not `??` when falling back:
```typescript
daysAgo(p.sale_date) || daysAgo(p.stage_date)  // RIGHT
daysAgo(p.sale_date) ?? daysAgo(p.stage_date)   // WRONG — 0 won't trigger ??
```

### Crews Table Quirk
`active` column is a **string** (`'TRUE'`/`'FALSE'`), not boolean. Filter with `.eq('active', 'TRUE')`.

### TypeScript
`types/database.ts` covers core tables. Some tables (project_funding, service_calls, ahjs, utilities, users) accessed via `lib/api/` or `db()` helper. **0 `as any` casts in production code** — use API layer or `db()` instead of adding new casts. 1 `: any` remains in `mobile/app/onboarding.tsx` (Feather icon name from external data, acceptable).

### Disposition Filtering
States: `null`/`'Sale'` (active), `'Loyalty'`, `'In Service'`, `'Cancelled'`. `Cancelled` always excluded from active views. Loyalty shown in Queue/Audit (intentional). Transitions constrained: Sale → Loyalty → Cancelled (no skipping).

### Centralized Constants
- `lib/utils.ts` — `SLA_THRESHOLDS`, `STAGE_LABELS`, `STAGE_ORDER`
- `lib/tasks.ts` — `TASKS`, `ALL_TASKS_MAP`, `TASK_DATE_FIELDS`, `JOB_LABELS`, `INTERNAL_DOMAINS`
- All job type labels centralized in `lib/tasks.ts` (JOB_LABELS). Do not hardcode job type display strings elsewhere.
- Internal email domains centralized as `INTERNAL_DOMAINS` in `lib/tasks.ts`.

## Security

### Auth
Email domain whitelist: `@gomicrogridenergy.com`, `@energydevelopmentgroup.com`, `@trismartsolar.com`. Unauthorized domains redirected to login.

### Route Protection (two layers)
1. **Server-side** (`proxy.ts`) — role-based route access with hierarchy: super_admin(5) > admin(4) > finance(3) > manager(2) > user(1) > sales(0). Role cached in httpOnly cookie (5 min). Admin/System always query DB.
2. **Client-side** — operational pages check `useCurrentUser().isManager`.

### Role-Based Access
`users.role`: super_admin, admin, finance, manager, user. RLS via `auth_is_admin()` / `auth_is_super_admin()`. All authenticated users can create/edit projects. Delete is super-admin-only. Cancel/Reactivate is admin+.

### Org-Scoped RLS
30 tables have org-scoped SELECT policies. Direct `org_id` check on 8 tables, EXISTS subquery via `project_id` on 16 tables, FK inheritance on 3 tables. All include `org_id IS NULL` backward compat + `auth_is_platform_user()` for cross-org visibility. When adding new tables with `project_id`, add org-scoped RLS using the EXISTS pattern from migration 043.

### Security Headers
`next.config.ts`: X-Frame-Options DENY, nosniff, HSTS, XSS protection, Content-Security-Policy. Webhook secrets use timing-safe comparison. Role cookie HMAC-signed to prevent forgery.

## Supabase Configuration
- `pgrst.db_max_rows` = 50000
- All project queries use `.limit(2000)`, task_state `.limit(50000)`
- All `lib/api/` queries have explicit `.limit()` calls (55 limits across 16 files)
- Reference tables: `.limit(500)`, data tables: `.limit(1000)`-`.limit(2000)`, equipment: `.limit(5000)`

## QA Daily Driver

Daily QA banner on `/command` (Command Center) that hands each tester one specific test case per day. Mirrors the SPARK QA Daily Driver (Spark migration 035 / Session 16).

**Gate:** authenticated user MUST have at least one `test_assignments` row OR be admin/manager/super_admin (admin override sees the full role-filtered pool). 8 testers already have assignments — see `test_assignments` table.

**Tables:** `qa_runs`, `qa_run_events` (migration 096). `tester_id` is `text` matching `users.id` (NOT auth.uid()).

**Selection algorithm** (`lib/qa/case-selection.ts`, pure / unit-tested):
1. Filter cases the tester has run in the last 14 days (cooldown).
2. Filter by role — MicroGRID has `role_filter` values `'all'`, `'manager'`, `'admin'`. `user`/`sales`/`finance` see `'all'` only; `manager` sees `all` + `manager`; admins see everything.
3. Sort by priority desc → days-since-last-run desc → plan/case sort_order → daily seed hash (`djb2(testerId:utcDate:caseId)`).
4. When `assignedCaseIds` is non-null, the picker is constrained to ONLY those cases.

**Components:**
- `components/qa/QADailyDriver.tsx` — banner mounted in `app/command/page.tsx` between Nav and filter bar
- `components/qa/QARunOverlay.tsx` — global side panel mounted in `components/Providers.tsx` via Suspense, activates when URL has `?qa_run=<id>`
- `app/testing/components/QADrivers.tsx` — Daily Drivers sub-tab inside the existing Admin testing panel (toggle: Manual Tests / Daily Drivers)
- `app/testing/components/QAEditor.tsx` — inline "New Plan" / "New Case" forms inside Manual Tests sub-tab

**API routes:**
- `GET /api/qa/today` — returns `{ done, streak, case|activeRun, empty?, hasMore? }`. Accepts `?force=1` for "Run another"
- `POST /api/qa/runs/start` — creates qa_runs row, idempotent for double-clicks
- `POST /api/qa/runs/[id]/event` — append qa_run_events (nav, console_error, click, etc.)
- `POST /api/qa/runs/[id]/complete` — atomic claim → finalize → dual-write test_results
- `POST /api/qa/runs/[id]/skip` — finalize as skipped
- `POST /api/qa/skip-today` — create a fresh skipped row when banner hits Skip without ever starting
- `POST /api/admin/qa-plans` — admin only, create new plan
- `POST /api/admin/qa-cases` — admin only, create new case
- `GET /api/cron/qa-runs-cleanup` — daily 5 AM UTC, abandons stale `started` runs (>8h)

**Type note:** the Database type doesn't include qa_runs/qa_run_events, so `lib/qa/server.ts` uses an untyped admin client (cast to `any`). All input validation is enforced explicitly in the routes.

## Cron Jobs (Vercel)
- `/api/email/send-daily` — weekdays 1 PM UTC (onboarding emails)
- `/api/email/onboarding-reminder` — weekdays 3 PM UTC
- `/api/email/digest` — weekdays noon UTC (PM digest)

## Known Issues

Real quirks and limitations to be aware of:

- `active` field on `crews` is string `'TRUE'`/`'FALSE'`, not boolean. Filter with `.eq('active', 'TRUE')`.
- `useSupabaseQuery` cannot query views or untyped tables — use `lib/api/` or `db()` helper instead.
- SubHub webhook requires `SUPABASE_SECRET_KEY` env var.
- Ops dashboard "Last Year" period only queries active `projects` table, not `legacy_projects` — historical year-over-year comparisons will undercount.
- CSP uses `unsafe-inline` in script-src (Next.js requirement). `unsafe-eval` removed in production, kept in dev.
- Role cookie HMAC prefers `ROLE_COOKIE_SECRET` env var, falls back to anon key. Set the explicit secret in Vercel for prod.
- 1 oversized file remains: `app/tickets/page.tsx` at 893 lines (5 components already extracted; the rest is tightly coupled page logic).
- 1 `: any` remains in `mobile/app/onboarding.tsx` (Feather icon name from external data, acceptable).
- `db()` return type is untyped by design.
- Greg's local `npm install` in `mobile/` hangs silently after the version line — likely lockfile/cache/post-install issue. Doesn't affect EAS Build (remote does its own clean install) but blocks local mobile dev. Try `rm -rf node_modules package-lock.json && npm install` or `npm cache clean --force`.

## Conventions

Always-do patterns. Breaking these will be caught in audit.

- **`escapeFilterValue()`** in `utils.ts` for PostgREST `.or()` contexts. Use instead of `escapeIlike()` in `.or()` strings. All existing `.or()` calls use it.
- **`timingSafeEqual()`** for ALL secret/token comparison in API routes — never plain `===`. Use `import { timingSafeEqual } from 'crypto'` (ESM) — never `require('crypto')`.
- **Rate limiting** via `lib/rate-limit.ts` — uses Upstash Redis when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set, falls back to in-memory. All sensitive routes are rate-limited.
- **`INACTIVE_DISPOSITIONS`** / **`INACTIVE_DISPOSITION_FILTER`** constants in `utils.ts` for all active project queries. Includes: In Service, Loyalty, Cancelled, Legal, On Hold.
- **Error boundaries:** all user-facing routes have `error.tsx` files (parent boundaries cover nested routes).
- **`lib/tasks.ts`** is the single source of truth for `JOB_LABELS` and `JOB_LABELS_SHORT`. Never redefine job labels locally.
- **`lib/api/` API wrappers** for cross-page queries: `loadLiveStats()`, `loadAHJs()`, `loadProjectsForMap()`, `loadOrgNames()`, `loadTodaySchedule()`, `loadScheduleForCrewWeek()`.
- **Atlas IS the customer feedback admin UI** — query `customer_feedback` directly via Supabase MCP when Greg asks to "look at the feedback." No CRM `/feedback` page by design (see `feedback_atlas_collects_app_feedback.md` memory).
- **Run integrity checks BEFORE recommending destructive cleanup**, never as the first step of execution. Session 29 near-miss almost cost ~$7M in contract corrections (see `feedback_drift_check_before_destructive.md` memory).

## Migrations Log

Running list of applied Supabase migrations (recent first):

| # | Purpose |
|---|---|
| **096** | QA Daily Driver — `qa_runs` + `qa_run_events` tables for the daily QA banner on `/command`. Indexes on `(tester_id, started_at desc)`, `test_case_id`, `status`. RLS mirrors test_results (permissive read/write for authenticated, admin override via `auth_is_admin()`). |
| **088** | NPS support — adds `'nps'` category to `customer_feedback`, extends rating CHECK to 0-10, adds `customer_accounts.nps_prompts_shown JSONB` for one-shot prompt tracking |
| **087** | Customer in-app feedback — `customer_feedback` + `customer_feedback_attachments` tables, RLS, public storage bucket `customer-feedback` |
| **086** | Security fixes — tightened `customer_messages.cm_update_read` (was wide-open `USING(true)`), added `org_id` + org-scoped RLS to `customer_payment_methods` and `customer_payments` |
| **085** | QA testing framework (5 tables) |
| **084** | `customer_messages` with Realtime |
| **083** | `customer_billing_statements` + `customer_payment_methods` + `customer_payments` |
| **082** | `customer_referrals` |
| **081** | `permit_submissions` + AHJ e-filing columns |
| **080** | `material_requests` + `material_request_items`, `photo_audit_*` on work_orders, `meet_link` on calendar_sync |
| **079** | `cancellation_fee` + `cancellation_fee_status` on projects |
| **078** | `vendors` table + `vendor_onboarding_docs` |
| **077** | JSA tables (`jsa`, `jsa_activities`, `jsa_acknowledgements`) |
| **076** | 11 performance indexes, `aggregate_earnings` RPC, milestone progression trigger |
| **072** | `org_id` column on `schedule` table |
| **043** | Org-scoped RLS enforcement (30 tables) |

**Postgres triggers in production:**
- M1→M2→M3 funding progression (can't submit M2 before M1, M3 before M2)
- `link_customer_account_on_signup()` — auto-links pre-seeded `customer_accounts` to `auth.users` on first OTP login (Session 29)

## Features Reference

Quick map of where things live:

- **Job costing:** `/job-costing` page (P&L, crew rates, cost entry), API at `lib/api/job-costing.ts`, auto-capture from WO completion
- **Auto-schedule suggestions:** SuggestionPanel on `/schedule`, API at `lib/api/schedule-suggestions.ts`
- **Vendor scorecard:** tab on `/vendors`, API at `lib/api/vendor-scorecard.ts`
- **Permit tracking:** tab on `/permits`, API at `lib/api/permit-submissions.ts`
- **Planset generator:** `/planset` produces 8 sheets (PV-1 through PV-8) with project selector, Duracell defaults, and redesign bridge. Missing: compliance certs, battery mode letter, equipment elevation (photo), OSR (manual)
- **`/legacy` page** reads from `legacy_projects` directly. Tab counts pulled live (not hardcoded).
- **Drift detection:** `npx tsx scripts/check-legacy-drift.ts` (pure logic in `lib/legacy-drift.ts`, exits 1 on disagreement, 11 unit tests)
- **Customer in-app feedback** (mobile): floating FAB on every `(tabs)` screen of customer app → category/rating/message/screenshots + auto-captures screen path + app version + device info via `react-native-view-shot`. Files: `mobile/lib/feedback.ts`, `mobile/components/FeedbackButton.tsx`, `mobile/components/FeedbackModal.tsx`, `mobile/components/NPSPrompt.tsx`. Storage bucket `customer-feedback` (public).
- **Privacy policy** at `/privacy` (public, no auth — added to `PUBLIC_ROUTES` in `proxy.ts`). Static page in `app/privacy/page.tsx`. App Store Connect → Privacy Policy URL points here. Required for App Store submission.
- **Account deletion** (App Store guideline 5.1.1(v)): mobile Account screen → "Delete Account" button → two-step typed-DELETE confirmation modal → calls `POST /api/customer/delete-account` → deletes `customer_accounts` row (FK CASCADE handles feedback/billing/payments/referrals) + `auth.users` row via admin client. Does NOT touch `projects`, `customer_messages`, or any installation business records (retained for warranty/legal per privacy policy). Rate limited 3/hour/user. Files: `app/api/customer/delete-account/route.ts`, `mobile/lib/api.ts` (`deleteCustomerAccount()`), `mobile/app/(tabs)/account.tsx`.
- **NPS prompts** trigger once per session 5s after entering tabs (deduped via useRef). Milestones: `pto_complete`, `first_billing_30d`, `onboarding_complete`.
- **Feedback reply API:** `POST /api/notifications/feedback-reply` (timing-safe + Supabase session auth, rate limit 30/min/feedback). Looks up feedback row, bumps `status='responded'`, fires Expo push via `sendCustomerFeedbackReplyNotification`. Atlas calls this after writing `admin_response`.
- **Customer billing/messaging/QA tables (082-085)** are fully typed in `types/database.ts`.
- **`/job-costing`** and **`/planset`** are in main nav (Financial + Tools sections).
- **8 pages refactored** with `components/` subfolders: infographic, command, fleet, planset, inventory, change-orders, work-orders, engineering.

## Mobile App Reference

- iOS app on TestFlight (Expo SDK 54, RN 0.81, build via EAS GitHub integration → Mac builders)
- **iOS 26 SDK deadline: April 28, 2026** — Apple ITMS-90725. Builds with iOS 18.4 SDK rejected after this date. Upgrade target: Expo SDK 55 (RN 0.83, Xcode 26). Effort: medium (1-3 days).
- **Account deletion flow** in `mobile/app/(tabs)/account.tsx` — required by Apple guideline 5.1.1(v). Two-step typed-DELETE confirmation modal calls `POST /api/customer/delete-account`.
- **Privacy Policy link** in mobile Account screen (Security section) opens `https://nova.gomicrogridenergy.com/privacy` via `Linking.openURL`.
- Folly coroutine fix: `plugins/withFollyFix.js` injects `-DFOLLY_CFG_NO_COROUTINES=1`
- Work order types: install, service, inspection, rnr (renamed from repair), survey
- Vendor categories: manufacturer, distributor, install_partner, electrical, plumbing, hvac, roofing, interior, other
- Ticket categories include `'monitoring'`
- Supabase Storage buckets: `wo-photos` (work order checklist photos), `customer-feedback` (in-app feedback screenshots, public)
- `react-native-view-shot@~4.0.3` for screen capture in feedback feature

## Co-Author Convention

```
Co-Authored-By: Atlas (Claude Opus 4.6) <noreply@anthropic.com>
```
