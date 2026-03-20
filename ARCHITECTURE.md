# MicroGRID CRM — Architecture & Session Handoff

## Project Overview
Solar installation project management CRM for TriSMART Solar. Tracks 487 active projects through 7 stages of the solar installation pipeline.

## URLs
- **New CRM (production)**: https://microgrid-crm.vercel.app
- **Old CRM (fallback)**: https://microgrid26.github.io/trismart-crm/
- **Supabase**: https://hzymsezqfxzpbcqryeim.supabase.co
- **GitHub (new)**: https://github.com/microGRID26/microgrid-crm
- **GitHub (old)**: https://github.com/microGRID26/trismart-crm

## Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind v4
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Hosting**: Vercel Hobby (gkelsch-7941's projects)
- **Auth**: Google OAuth (External) via Supabase Auth, primary domains `@gomicrogridenergy.com` and `@energydevelopmentgroup.com`

## Credentials (ROTATE THESE)
- Supabase anon key: `sb_publishable_XXXX`
- Supabase service role: `sb_secret_XXXX`
- NetSuite account: 8587733
- NetSuite consumer key: `NS_CONSUMER_KEY`
- NetSuite consumer secret: `NS_CONSUMER_SECRET`
- NetSuite token ID: `NS_TOKEN_ID`
- NetSuite token secret: `NS_TOKEN_SECRET`
- Google OAuth client ID: `GOOGLE_CLIENT_ID`
- Google OAuth client secret: `GOOGLE_CLIENT_SECRET`

## Supabase Tables

### projects
Primary table. 487 active rows.
- `id` TEXT PK (format: PROJ-XXXXX)
- `name`, `city`, `address`, `phone`, `email`
- `sale_date`, `stage`, `stage_date`, `pm`
- `disposition`, `contract` (number), `systemkw`
- `financier`, `ahj`, `utility`, `advisor`, `consultant`, `dealer`
- `blocker` — non-null = project is blocked
- `financing_type`, `down_payment`, `tpo_escalator`, `financier_adv_pmt`
- Equipment: `module`, `module_qty`, `inverter`, `inverter_qty`, `battery`, `battery_qty`, `optimizer`, `optimizer_qty`
- Electrical: `meter_location`, `panel_location`, `voltage`, `msp_bus_rating`, `mpu`, `shutdown`, `performance_meter`, `interconnection_breaker`, `main_breaker`
- `hoa`, `esid`, `permit_number`, `utility_app_number`, `permit_fee`
- Dates: `city_permit_date`, `utility_permit_date`, `ntp_date`, `survey_scheduled_date`, `survey_date`, `install_scheduled_date`, `install_complete_date`, `city_inspection_date`, `utility_inspection_date`, `pto_date`, `in_service_date`
- `site_surveyor`, `consultant_email`, `loyalty`
- `created_at`

### stage_history
- `id`, `project_id`, `stage`, `entered` (date)

### notes
- `id`, `project_id`, `text`, `time`, `pm`

### task_state
- `project_id`, `task_id`, `status` (Complete/Pending Resolution/Revision Required/In Progress), `completed_date`

### crews
- `id`, `name`, `warehouse`, `active`

### schedule
- `id`, `project_id`, `crew_id`, `job_type` (survey/install/inspection/service), `date`, `time`, `notes`, `status`, `pm`

### project_funding
- `project_id` PK
- M1: `m1_amount`, `m1_funded_date`, `m1_cb`, `m1_cb_credit`
- M2: `m2_amount`, `m2_funded_date`, `m2_cb`, `m2_cb_credit`
- M3: `m3_amount`, `m3_funded_date`, `m3_projected`
- `nonfunded_code_1/2/3`

### ahjs, utilities
AHJ and utility company reference data with message threads.

### ahj_messages, utility_messages
bluChat message history linked to AHJs/utilities.

### project_folders
Google Drive folder links: `project_id`, `folder_id`, `folder_url`

## Pipeline Stages (in order)
1. `evaluation` — Pre-scrub, customer assessment
2. `survey` — Site survey
3. `design` — System design
4. `permit` — Permitting (city + utility)
5. `install` — Installation
6. `inspection` — City + utility inspection
7. `complete` — PTO and in-service

## SLA Thresholds (days in stage)
Stored in admin panel, defaults:
| Stage | Target (green) | At Risk (amber) | Critical (red) |
|-------|---------------|-----------------|----------------|
| Evaluation | 3 | 4 | 6 |
| Site Survey | 3 | 5 | 10 |
| Design | 3 | 5 | 10 |
| Permitting | 21 | 30 | 45 |
| Installation | 5 | 7 | 10 |
| Inspection | 14 | 21 | 30 |
| Completion | 3 | 5 | 7 |

## Command Center Logic
Projects are classified into sections (in priority order):

1. **Overdue Tasks** — tasks with due dates in the past
2. **Blocked** — `blocker` field is non-null
3. **Critical (Past SLA)** — `daysAgo(stage_date) >= crit threshold` AND not blocked
4. **At Risk** — `daysAgo(stage_date) >= risk threshold` AND not blocked
5. **Stalled** — `daysAgo(stage_date) >= 5` AND not blocked AND SLA status = ok
6. **Aging** — `cycleDays >= 90` (total days since sale_date)
7. **On Track** — everything else

### Key functions
```
cycleDays(p) = daysAgo(p.sale_date) || daysAgo(p.stage_date)
isStalled(p) = !p.blocker && daysAgo(p.stage_date) >= 5
getSLA(p) = compares daysAgo(stage_date) against thresholds
```

## Task System
Each stage has prerequisite tasks. Task status options:
- `Complete`
- `Pending Resolution` — blocked/waiting on something
- `Revision Required` — needs to be redone
- `In Progress`
- (blank) — not started

Tasks are stored in `task_state` table keyed by `project_id` + `task_id`.

## Task Definitions by Stage
```
evaluation: prereview, hoa_check, title_check, om_review
survey: sched_survey, survey_done, survey_review
design: design_done, design_review
permit: city_submit, city_approved, utility_submit, utility_approved, ntp
install: sched_install, inventory, install_done
inspection: sched_city_insp, city_passed, sched_util_insp, util_passed, wpi28
complete: pto_received, in_service
```

## Auth
- Google OAuth via Supabase
- Site URL: https://microgrid-crm.vercel.app
- Callback: https://hzymsezqfxzpbcqryeim.supabase.co/auth/v1/callback
- Redirect URLs in Supabase: both Vercel URLs
- Google OAuth (External), primary domains `@gomicrogridenergy.com` and `@energydevelopmentgroup.com`

## File Structure
```
microgrid-crm/
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx (redirects to /command)
│   ├── login/page.tsx
│   ├── auth/callback/route.ts
│   └── command/page.tsx ← CURRENTLY A STUB
├── lib/
│   ├── supabase/client.ts (browser client)
│   ├── supabase/server.ts (server client)
│   └── utils.ts (fmt$, fmtDate, daysAgo, STAGE_LABELS)
├── types/database.ts (full typed schema)
├── middleware.ts (auth protection)
└── vercel.json
```

## Build/Deploy
- Every push to `main` auto-deploys to Vercel
- Local: `npm run dev` from ~/microgrid-crm
- Env vars in .env.local (never commit) and in Vercel dashboard

## Phase Plan
### Phase 1 (current) — Core PM workflow
- [x] Scaffold + auth + deploy
- [ ] Command Center (full SLA logic)
- [ ] My Queue view
- [ ] Project Panel (tasks, notes, files tabs)
- [ ] Project search

### Phase 2 — Full feature parity
- [ ] Pipeline view
- [ ] Analytics
- [ ] Audit view
- [ ] Schedule view + assign modal
- [ ] Funding view
- [ ] Service Calls
- [ ] Files tab (Drive inline)
- [ ] BOM tab

### Phase 3 — Admin + polish
- [ ] Admin portal (AHJ, Utility, Users, Crews, SLA)
- [ ] Proper RLS on all tables
- [ ] Sentry error tracking
- [ ] Performance audit
- [ ] Custom domain (crm.trismartsolar.com)
- [ ] Mobile responsive pass

### Phase 4 — Scale features
- [ ] NetSuite sync cron (OAuth 2.0)
- [ ] Email/SMS notifications
- [ ] Role-based permissions
- [ ] Bulk operations
- [ ] Drive inline file browser

## Design System
- Dark mode: bg-gray-900 (app bg), bg-gray-800 (cards)
- Accent: green (#1D9E75 / text-green-400)
- Status colors: green=on track, amber=at risk, red=critical/blocked
- Font: Inter
- Keep same visual design as old CRM — don't redesign during rebuild

## Key Business Context
- TriSMART Solar — residential solar installer in Texas
- ~487 active projects at any time, scaling to 300+ users
- PMs (project managers) each own a set of projects
- Tasks must be completed in order (prerequisite system)
- Funding has 3 milestones (M1/M2/M3) tied to install stages
- AHJs (permit authorities) and utilities have different requirements per city
- Google Drive folder linked per project for documents
