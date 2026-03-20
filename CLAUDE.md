# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MicroGRID CRM — solar project management system for TriSMART Solar. Tracks ~487 active residential solar installation projects through a 7-stage pipeline (evaluation → survey → design → permit → install → inspection → complete). Built for PMs (project managers) who each own a set of projects.

## Commands

```bash
npm run dev        # Dev server on :3000
npm run build      # Production build (Next.js)
npm run lint       # ESLint (Next.js + TypeScript presets)
npm test           # Run all tests (Vitest, single run)
npm run test:watch # Run tests in watch mode
npm start          # Start production server
```

Auto-deploys to Vercel on push to `main`.

## Testing

**Vitest** + React Testing Library with jsdom. Config in `vitest.config.ts`, global setup in `vitest.setup.ts` (Supabase mock, localStorage mock).

Tests are in `__tests__/` organized by category:
- `lib/` — pure utility functions (`daysAgo`, `fmt$`, `fmtDate`, `cn`), CSV export, `useCurrentUser` hook
- `logic/` — SLA classification, funding eligibility, task stuck detection, filter composition, BOM calculations, cycleDays fallback
- `pages/` — page-level logic for command (9-section classification), pipeline (sort/filter), queue (priority), funding, schedule, service, admin
- `auth/` — OAuth callback (exchange, provisioning, error redirect), middleware (route protection, cookie error handling)

The Supabase client is globally mocked in `vitest.setup.ts`. Tests focus on business logic extracted from pages rather than rendering full page components. When adding new features, add corresponding tests for the logic.

## Tech Stack

- **Next.js 16** (App Router, `"use client"` pages — no RSC data fetching)
- **React 19** + TypeScript (strict)
- **Tailwind CSS v4** (PostCSS plugin, not config-based)
- **Supabase** — PostgreSQL, Auth (Google OAuth, External — primary domains `@gomicrogridenergy.com` and `@energydevelopmentgroup.com`, legacy `@trismartsolar.com` logins still work), Realtime subscriptions
- **No state management library** — pure `useState`/`useEffect`/`useCallback` + Supabase realtime channels

## Architecture

### Routing & Pages

All pages are in `app/*/page.tsx` as client components (`"use client"`). Each page fetches its own data via the Supabase browser client on mount and subscribes to realtime changes. Root `/` redirects to `/command`.

Key pages: `/command` (SLA dashboard), `/queue` (PM-filtered list), `/pipeline` (visual stage grid), `/analytics`, `/audit` (task compliance), `/schedule` (crew calendar), `/service`, `/funding` (M1/M2/M3 milestones), `/admin`, `/help`.

### Data Layer

- `lib/supabase/client.ts` — browser Supabase client (used by all pages)
- `lib/supabase/server.ts` — server Supabase client (used by middleware)
- No API routes for data — pages query Supabase directly
- Realtime: `supabase.channel().on('postgres_changes', ...)` pattern in each page

### Shared Code

- `lib/utils.ts` — `cn()` (clsx+twMerge), `fmt$()`, `fmtDate()`, `daysAgo()`, `STAGE_LABELS`, `STAGE_ORDER`, `SLA_THRESHOLDS`, `STAGE_TASKS` (task definitions per stage)
- `lib/export-utils.ts` — CSV export with field picker (50+ fields, grouped)
- `types/database.ts` — full TypeScript types for all Supabase tables
- `components/Nav.tsx` — shared navigation bar with right-side slot for page controls
- `components/project/ProjectPanel.tsx` — large modal (overview/tasks/notes/files/BOM tabs) used across multiple pages

### Key Database Tables

- **projects** — PK is `id` TEXT (format `PROJ-XXXXX`). `stage` field is the pipeline position. `blocker` non-null = blocked.
- **task_state** — composite key `(project_id, task_id)`. Statuses: Complete, Pending Resolution, Revision Required, In Progress, Scheduled, Ready To Start, Not Ready. Includes `reason` field.
- **notes** — per-project timestamped notes
- **schedule** — crew assignments with `job_type` (survey/install/inspection/service)
- **project_funding** — M1/M2/M3 milestone amounts, dates, CB credits
- **stage_history** — audit trail of stage transitions
- **ahjs**, **utilities** — reference data for permit authorities and utility companies

### SLA System

SLA thresholds are centralized in `lib/utils.ts` (`SLA_THRESHOLDS`). Command Center classifies projects in priority order: Overdue → Blocked → Critical → At Risk → Stalled (5+ days, SLA ok) → Aging (90+ cycle days) → On Track. Loyalty and In Service dispositions are separated out.

### Task System

Each pipeline stage has defined tasks in `STAGE_TASKS` (lib/utils.ts). Tasks have prerequisite chains and are tracked in the `task_state` table. "Stuck" tasks (Pending Resolution or Revision Required) surface as badges throughout the UI with their `reason` field.

## Style Conventions

- Dark theme: `bg-gray-900` (page), `bg-gray-800` (cards), green accent (`#1D9E75` / `text-green-400`)
- Status colors: green = on track, amber = at risk, red = critical/blocked, blue = in progress
- Font: Inter (Google Fonts)
- Use `cn()` from `lib/utils.ts` for conditional Tailwind classes
- Icon library: `lucide-react`
- Date formatting: `date-fns` via `fmtDate()` and `daysAgo()` helpers

## Critical Notes

### TypeScript Pattern

`types/database.ts` only covers core tables (`projects`, `task_state`, `notes`, `crews`, `schedule`, `stage_history`, `project_folders`). Several tables used in the app — `project_funding`, `service_calls`, `ahjs`, `utilities`, `users`, `sla_thresholds` — are **not** in the generated types. Pages that query these tables use `as any` casts on the Supabase response. When adding or modifying queries for these tables, expect to cast. The `admin/page.tsx` file is especially cast-heavy due to managing all the untyped reference tables.

Also note: the `Project` type defines a `loyalty: string | null` field, but it is **never read anywhere** in the codebase. All loyalty logic uses `p.disposition === 'Loyalty'` instead. The `loyalty` column appears to be legacy/dead.

### Role-Based Access

The `users` table has a `role` column with values: `super_admin`, `admin`, `finance`, `manager`, `user`. The `useCurrentUser()` hook returns `role`, `isAdmin`, `isSuperAdmin`, `isFinance`, `isManager` convenience booleans. RLS policies use `auth_is_admin()` and `auth_is_super_admin()` Postgres functions that check the `role` column. When adding admin-gated features, check `isAdmin` or `isSuperAdmin` from the hook on the client side; the database enforces the same via RLS.

### Crews Table Quirk

The `active` column on `crews` is stored as a **string** (`'TRUE'`/`'FALSE'`), not a boolean. The schedule page filters with `.eq('active', 'TRUE')` (uppercase only), while the admin page defensively checks both cases (`c.active === 'TRUE' || c.active === 'true'`). When querying crews, always filter on the string `'TRUE'`, and be aware that mixed-case values may exist in the data.

### Disposition Filtering

The `disposition` field has three meaningful states: `null` (active), `'Loyalty'`, and `'In Service'`. Filtering is **intentionally inconsistent** across pages:

- **Command** (`/command`): excludes both from the main pipeline, then renders them as separate sections at the bottom
- **Pipeline** (`/pipeline`): excludes both `'In Service'` and `'Loyalty'`
- **Analytics** (`/analytics`): excludes both `'In Service'` and `'Loyalty'`
- **Queue** (`/queue`): excludes only `'In Service'` — Loyalty projects **do** appear because PMs still actively manage them

When adding new views or filters, decide deliberately which dispositions to include. The queue behavior (showing Loyalty but hiding In Service) is intentional, not a bug.

### Filter Pattern

When combining search with dropdown filters, do **not** early-return the search match result. This was a recurring bug where search text would bypass other active filters. The correct pattern:

```typescript
// WRONG — search overrides other filters
if (search.trim()) {
  return name.includes(q) || id.includes(q)
}

// RIGHT — search narrows, other filters still apply
if (search.trim()) {
  if (!name.includes(q) && !id.includes(q)) return false
}
return true
```

### cycleDays Helper

`daysAgo()` returns `0` for null/undefined input (never returns null). Use `||` (not `??`) when falling back between date fields, since `??` only coalesces null/undefined and `0` is a valid number that won't trigger it:

```typescript
// WRONG — ?? never falls through because daysAgo always returns a number
daysAgo(p.sale_date) ?? daysAgo(p.stage_date)

// RIGHT — || falls through when daysAgo returns 0
daysAgo(p.sale_date) || daysAgo(p.stage_date)
```

## Known Bugs

- The `loyalty` field on `projects` is unused — all loyalty logic checks `disposition === 'Loyalty'` instead. The column should eventually be dropped or reconciled.
- RLS policies are enforced but still evolving. `auth_is_admin()` and `auth_is_super_admin()` Postgres functions gate write access based on the `role` column. Some tables may still have permissive policies that need tightening.
- The `active` field on `crews` is a string instead of a boolean, leading to defensive dual-case checking throughout the codebase.
