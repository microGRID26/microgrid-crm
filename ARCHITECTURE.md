# MicroGRID CRM — Architecture Reference

Detailed reference documentation. For essential patterns and conventions, see `CLAUDE.md`.

## Page Inventory (44 pages)

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Redirects to user's preferred homepage (default: `/command`) |
| Command | `/command` | Morning dashboard — personal stats, action items, pipeline snapshot, sortable project table |
| Queue | `/queue` | PM worklist — smart filters, collapsible sections (Follow-ups, DB-driven sections, Blocked, Active, Loyalty, Complete), inline quick actions, funding badges |
| Pipeline | `/pipeline` | Visual Kanban — smart column headers, task-enriched cards, compact/detailed toggle, URL-persistent filters, mobile accordion |
| Analytics | `/analytics` | 7 tabs: Leadership, Pipeline Health, By PM, Funding, Cycle Times, Dealers, Operations |
| Ops | `/ops` | Standalone operations dashboard — Power BI replication with 3 metric rows (Sold/Scheduled/Installed), breakdowns by City/Utility/EC/Consultant, KPIs, drill-down filtering |
| Schedule | `/schedule` | Crew calendar — multi-day jobs, job type badges, crew brief panel, Google Calendar sync |
| Funding | `/funding` | M1/M2/M3 milestones — sortable columns, powered by `funding_dashboard` Postgres view |
| Tickets | `/tickets` | Issue tracking — 8 categories, SLA tracking, threaded comments, resolution workflow, CSV export |
| NTP | `/ntp` | Notice to Proceed queue — cross-org approval workflow |
| Engineering | `/engineering` | Cross-org design assignments — submit/complete with deliverables and revision tracking |
| Invoices | `/invoices` | Inter-org billing — milestone triggers, status lifecycle, payment tracking |
| Sales | `/sales` | 5 tabs: Teams, Personnel, Pay Scales, Distribution, Onboarding. Admin-only. |
| Commissions | `/commissions` | 5 tabs: Calculator, Earnings, Advances, Leaderboard, Rate Card |
| Inventory | `/inventory` | 3 tabs: Project Materials, Purchase Orders, Warehouse — filters, sorting, PO advancement |
| Work Orders | `/work-orders` | Field work tracking — type-specific checklists, status flow, crew assignment, customer signatures |
| Service | `/service` | Legacy — 922 imported NetSuite service cases (read-only) |
| Vendors | `/vendors` | Supplier directory — search, category/equipment type filters, inline edit |
| Warranty | `/warranty` | Equipment warranty tracking — cross-project list, claim management, CSV export |
| Fleet | `/fleet` | Vehicle management — status lifecycle, maintenance history, expiry alerts |
| Permits | `/permits` | 1,633 AHJ records with portal URLs, masked credentials, filters |
| Change Orders | `/change-orders` | HCO queue with 6-step workflow |
| Documents | `/documents` | File browser hub + `/documents/missing` missing docs report |
| Reports | `/reports` | Atlas — AI-powered natural language query (Claude Sonnet, Manager+ role, 25/day rate limit) |
| Ramp-Up | `/ramp-up` | Install planning — readiness scoring, proximity clustering with tier colors, route optimization, weekly scheduling |
| Map | `/map` | Interactive project map with proximity analysis |
| Infographic | `/infographic` | Mobile-responsive company infographic — EDGE-scoped, all domains supported |
| Redesign | `/redesign` | System redesign calculator — string sizing, voltage/current, panel-fit, DXF export |
| Planset | `/planset` | Duracell SLD planset generator |
| Batch | `/batch` | SLD batch design — bulk redesigns with string calculations |
| Legacy | `/legacy` | Read-only lookup of 14,705 In Service TriSMART projects |
| Dashboard | `/dashboard` | PM performance dashboard — portfolio metrics, SLA health |
| Crew | `/crew` | Mobile daily crew view — weekly schedule, job badges, Google Maps links |
| Mobile Field | `/mobile/field` | Mobile field operator — today's jobs, status progression, one-tap actions |
| Mobile Leadership | `/mobile/leadership` | Mobile leadership dashboard — Manager+ role, auto-refresh 5 min |
| Mobile Scan | `/mobile/scan` | Barcode scanner — BarcodeDetector API, warehouse stock lookup, checkout/checkin |
| Audit | `/audit` | Task compliance review |
| Audit Trail | `/audit-trail` | Admin-only change log — sortable, filterable, paginated at 50/page |
| Admin | `/admin` | Admin portal — AHJ, Utilities, HOA, Financiers, Equipment, Users, Crews, SLA, etc. |
| System | `/system` | Super-admin — Feature Flags, Calendar Sync, EDGE Integration, Orgs, Notification Rules |
| Help | `/help` | Knowledge base — 79 topics, 12 categories, search, deep linking |
| Login | `/login` | Google OAuth login — branded "Operating System / Powered by EDGE" |

## API Routes (13 endpoints)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/email/send-daily` | GET | Cron: onboarding email series (weekdays 1 PM UTC) |
| `/api/email/digest` | GET | Cron: PM digest email (weekdays noon UTC) |
| `/api/email/onboarding-reminder` | GET | Cron: onboarding doc reminders (weekdays 3 PM UTC) |
| `/api/email/enroll` | POST | Enroll user in onboarding email series |
| `/api/email/announce` | POST | Send announcement to all active users |
| `/api/email/test` | POST | Test email sending |
| `/api/reports/chat` | POST | Atlas AI query endpoint (Claude Sonnet) |
| `/api/calendar/sync` | POST | Google Calendar sync (batch, delete, full_sync) |
| `/api/calendar/webhook` | POST | Google Calendar push notification receiver |
| `/api/webhooks/subhub` | POST | SubHub contract signed → create project |
| `/api/webhooks/subhub-vwc` | POST | SubHub VWC webhook |
| `/api/webhooks/edge` | POST | EDGE inbound funding updates |
| `/api/notifications/stuck-task` | POST | Stuck task notification |

## API Layer (`lib/api/`)

Centralized data access. Pages import from `@/lib/api`.

| Module | Key Exports |
|--------|-------------|
| `projects.ts` | `loadProjects(orgId?)`, `updateProject`, `loadUsers`, `loadProjectAdders`, `searchProjects` |
| `notes.ts` | `loadProjectNotes`, `loadTaskNotes`, `addNote`, `deleteNote`, `createMentionNotification` |
| `tasks.ts` | `upsertTaskState`, `loadTaskStates`, `loadTaskHistory`, `insertTaskHistory` |
| `schedules.ts` | `loadScheduleByDateRange` (multi-day job support) |
| `tickets.ts` | `loadTickets`, `createTicket`, `updateTicketStatus`, `addTicketComment`, `getSLAStatus` |
| `crews.ts` | `loadCrewsByIds(orgId?)`, `loadActiveCrews(orgId?)` |
| `documents.ts` | `loadAllProjectFiles`, `searchAllProjectFiles`, `loadDocumentRequirements` |
| `equipment.ts` | `loadEquipment`, `searchEquipment`, `stripRawPrice()` (confidential pricing) |
| `inventory.ts` | Materials CRUD, PO lifecycle, warehouse stock/transactions, `getLowStockItems` |
| `vendors.ts` | `loadVendors(orgId?)`, `searchVendors(orgId?)`, vendor CRUD |
| `work-orders.ts` | WO lifecycle, checklists, `createWorkOrderFromProject`, `getValidTransitions` |
| `warranties.ts` | Warranty CRUD, claims, `loadExpiringWarranties` |
| `fleet.ts` | Vehicle CRUD, maintenance records, `loadUpcomingMaintenance` |
| `custom-fields.ts` | Field definitions CRUD, per-project values |
| `calendar.ts` | Calendar settings, sync tracking |
| `engineering.ts` | Cross-org assignments, deliverables, status transitions |
| `engineering-config.ts` | Rush auto-routing config, `autoRouteAssignment` |
| `ntp.ts` | NTP requests, review workflow |
| `invoices.ts` | Invoice lifecycle, line items, collision-safe number generation |
| `commissions.ts` | Rates, records, tiers, geo modifiers, hierarchy, `calculateTieredCommission` |
| `commission-advanced.ts` | EC/Non-EC calculation, M1 advances, clawback |
| `sales-teams.ts` | Pay scales, distribution, teams, reps, onboarding docs, rep notes, rep scorecards, ticket rep stats |
| `ramp-planner.ts` | Readiness scoring, proximity clustering, route optimization, `getMonday`, `getNextWeeks` |
| `edge-sync.ts` | EDGE webhook sending, `syncProjectToEdge`, `syncFundingToEdge` |
| `saved-queries.ts` | Atlas saved query management |
| `time-entries.ts` | Time tracking |

## Component Inventory

### Core (14)
`Nav.tsx`, `Providers.tsx`, `OrgSwitcher.tsx`, `GlobalSearch.tsx`, `QuickActionMenu.tsx`, `NotificationBell.tsx`, `FeedbackButton.tsx`, `ErrorBoundary.tsx`, `SessionTracker.tsx`, `Pagination.tsx`, `BulkActionBar.tsx`, `SldRenderer.tsx`, `EquipmentAutocomplete.tsx`, `VendorAutocomplete.tsx`

### Project Panel (16)
`ProjectPanel.tsx` (main modal — overview/tasks/notes/files/BOM/materials/warranty/NTP/tickets tabs), `InfoTab.tsx`, `TasksTab.tsx`, `NotesTab.tsx`, `FilesTab.tsx`, `BomTab.tsx`, `MaterialsTab.tsx`, `WarrantyTab.tsx`, `NTPTab.tsx`, `TicketsTab.tsx`, `PermitPortalCard.tsx`, `DocumentChecklist.tsx`, `JobBriefPanel.tsx`, `NewProjectModal.tsx`, `MentionNoteInput.tsx`, `ScheduleAssignModal.tsx`

### Admin (30)
`shared.tsx` (styles, types, SectionShell, ModalShell), `UsersManager.tsx`, `CrewsManager.tsx`, `AHJManager.tsx`, `UtilityManager.tsx`, `HOAManager.tsx`, `FinancierManager.tsx`, `EquipmentManager.tsx`, `VendorManager.tsx`, `ReasonsManager.tsx`, `NotificationRulesManager.tsx`, `QueueConfigManager.tsx`, `SLAManager.tsx`, `DocumentRequirementsManager.tsx`, `CustomFieldsManager.tsx`, `FeatureFlagManager.tsx`, `CalendarSyncManager.tsx`, `EdgeIntegrationManager.tsx`, `EmailManager.tsx`, `CommissionRatesManager.tsx`, `EngineeringConfigManager.tsx`, `InvoiceRulesManager.tsx`, `PayScaleManager.tsx`, `PayDistributionManager.tsx`, `OrgManager.tsx`, `TicketConfigManager.tsx`, `AuditTrailManager.tsx`, `PermissionMatrix.tsx`, `FeedbackManager.tsx`, `CRMInfo.tsx`, `ReleaseNotes.tsx`

### Analytics (7)
`Leadership.tsx`, `PipelineHealth.tsx`, `ByPM.tsx`, `FundingTab.tsx`, `CycleTimes.tsx`, `Dealers.tsx`, `shared.tsx`

### Help (17)
`HelpSearch.tsx`, `HelpSidebar.tsx`, `HelpCategory.tsx`, `HelpTopic.tsx`, plus 12 topic files and `topics/index.ts`

### Funding (5)
`MsCells.tsx`, `EditableCell.tsx`, `StatusSelect.tsx`, `NfCodePicker.tsx`, `MsBadge.tsx`

## Database Tables

### Core Project Data
- **projects** — PK `id` TEXT (`PROJ-XXXXX`). `stage`, `disposition`, `blocker`, `pm_id`, `org_id`, `energy_community` (BOOLEAN), `system_kw`, `contract`, plus ~50 fields.
- **task_state** — composite key `(project_id, task_id)`. Statuses: Complete, Pending Resolution, Revision Required, In Progress, Scheduled, Ready To Start, Not Ready. Fields: `reason`, `notes`, `follow_up_date`. Open RLS.
- **notes** — per-project timestamped. Optional `task_id` for per-task notes. @mentions create `mention_notifications`.
- **stage_history** — audit trail of stage transitions.
- **audit_log** — all project field changes with old/new values, changed_by.
- **project_funding** — M1/M2/M3 milestone amounts, dates, CB credits.
- **project_adders** — project extras (EV charger, critter guard, etc.). 4,185 records.

### Schedule & Operations
- **schedule** — crew assignments with `job_type`, `end_date` for multi-day jobs.
- **work_orders** — field work with status lifecycle, checklists (`wo_checklist_items`), signatures, time tracking.
- **crews** — `active` is STRING `'TRUE'`/`'FALSE'` (not boolean).

### Ticketing System
- **tickets** — `ticket_number` (TKT-YYYYMMDD-NNN), 8 categories, SLA tracking, status lifecycle (open→assigned→in_progress→waiting→escalated→resolved→closed).
- **ticket_comments** — threaded conversation with `is_internal` flag.
- **ticket_history** — field-level audit trail.
- **ticket_categories** — 26 subcategories with default SLA targets.
- **ticket_resolution_codes** — 15 resolution categories.

### Equipment & Inventory
- **equipment** — 2,517 items (panels, inverters, batteries, optimizers). Pricing fields: `sourcing`, `raw_price` (confidential), `sell_price`.
- **project_materials** — per-project material lists with status (needed→ordered→shipped→delivered→installed).
- **warehouse_stock** — BOS items with reorder points, `barcode` for scanning, location (shelf/bin/truck).
- **warehouse_transactions** — checkout/checkin/adjustment audit trail.
- **purchase_orders** + **po_line_items** — PO lifecycle with tracking.

### Financial
- **invoices** + **invoice_line_items** — inter-org billing with status lifecycle.
- **invoice_rules** — milestone-triggered templates (8 defaults).
- **commission_rates** — per-role rates (6 defaults).
- **commission_records** — per-project per-role calculations.
- **commission_config** — EC/Non-EC rates, ops deduction, M1 advance config (12 defaults).
- **commission_advances** — M1 advance tracking with clawback.
- **commission_tiers** — volume-based rate increases.
- **commission_geo_modifiers** — market-specific multipliers.
- **commission_hierarchy** — multi-level override chain.

### Sales
- **pay_scales** — named rate tiers (4 defaults: Consultant→Exclusive).
- **pay_distribution** — override split percentages (7 roles, sum to 100%).
- **sales_teams** — hierarchy with VP/Regional/Manager/Asst Manager, stack rate.
- **sales_reps** — personnel with team/pay scale/role/status.
- **onboarding_requirements** + **onboarding_documents** — rep document lifecycle.

### Multi-Tenant
- **organizations** — name, slug, org_type (platform/epc/sales/engineering/supply/customer). Default: MicroGRID Energy (`a0000000-...0001`).
- **org_memberships** — user→org mapping with role (owner/admin/member/viewer).
- **engineering_assignments** — cross-org design work.
- **engineering_config** — Rush Engineering auto-routing (exclusive partner, $1,200 fee).
- **ntp_requests** — cross-org NTP approval workflow.

### Reference Data
- **ahjs** — 1,633 AHJ records with permit portals, credentials, submission methods. `display_name` for short dropdown labels.
- **utilities** — 203 utility companies. `display_name` for short dropdown labels.
- **financiers** — financing companies with `display_name` for short labels.
- **hoas** — 421 HOA records.
- **feature_flags** — 7 admin-toggleable flags with rollout percentage.

### Tracking
- **vehicles** + **vehicle_maintenance** — fleet management.
- **equipment_warranties** + **warranty_claims** — warranty tracking.
- **custom_field_definitions** + **custom_field_values** — admin-defined dynamic fields.
- **calendar_settings** + **calendar_sync** — Google Calendar sync.
- **edge_sync_log** — webhook event log.
- **email_onboarding** — 30-day training series enrollment.
- **user_sessions** — session tracking with heartbeat.
- **feedback** — user-submitted feedback.
- **legacy_projects** + **legacy_notes** — 14,705 historical projects, 150,633 BluChat notes.
- **rep_notes** — timestamped notes log per sales rep (like project notes). Admin insert only.
- **ticket_rep_stats** — DB view aggregating per-rep ticket metrics (total, open, resolved, service vs sales, critical, escalated, avg resolution hours).

## SQL Migrations (supabase/)

77 files from `008-pm-id-migration.sql` through `066-ramp-planner.sql`. Key milestones:
- **008-015**: Core (PM IDs, audit log, roles, RLS, fields, adders, HOA, mentions)
- **016**: Scale optimization (indexes, helper functions, funding_dashboard view, LRU cache)
- **017-021**: Admin-configurable (financiers, task reasons, notification rules, queue sections, user preferences)
- **022-031**: Data & operations (legacy projects, documents, equipment, inventory, POs, warehouse, EDGE sync, vendors, work orders, email onboarding)
- **032-038**: Extensions (multi-day schedule, barcodes, warranty, fleet, custom fields, calendar sync, feature flags)
- **039-043**: Multi-tenant (organizations, org_memberships, backfill, RLS helpers, org-scoped RLS enforcement)
- **045-053**: Cross-org (NTP workflow, engineering assignments, invoices, commissions, tiers/geo/hierarchy, Rush/NewCo config, invoice rules, pay scales, commission advanced)
- **054-055**: Hardening (tighten RLS, SLA stage date reset)
- **056-066**: Recent (welcome calls, clock in/out, saved queries, notifications, meter numbers, rep fields, PO tracking, service rep compliance, ticketing system, permission matrix, ramp planner)
- **067**: display_name columns on AHJs and utilities
- **068**: rep_notes table, ticket_rep_stats view

## Key Features (Detailed)

### Ops Dashboard
Power BI replication available as `/ops` standalone page AND Analytics → Operations tab. 3 metric rows (Sold/Scheduled/Installed) × 8 columns (count, batteries, est annual production, PV kW, battery kWh, total value, avg value, avg kW). Breakdowns by City, Utility, Energy Community, Consultant with `display_name` support for short labels. KPIs: cancels, cancel %, sale-to-EIC, sale-to-PTO, EIC-to-PTO. 10 period filters including Last Year. Historical periods (Last Year, Last Quarter) lazy-load 14,705 legacy projects for complete data. Drill-down on every cell with auto-scroll to project list. Test account filtering (Greg Test, Superman, MicroGRID dealer).

### Ramp-Up Planner
Install scheduling tool at `/ramp-up`. Features: readiness scoring (NTP, permits, equipment, HOA, scope — weighted to 100), proximity clustering with 4 tiers (Ready Now green, Almost Ready blue, Needs Work amber, Not Ready red), route optimization (nearest-neighbor), weekly capacity planning, job type filter (install/battery/reroof), best bundle auto-select. Uses Leaflet map with zip code centroids.

### Ticketing System
Full issue tracking at `/tickets`. 8 categories × 26 subcategories with default SLA targets. Status lifecycle with validated transitions. Response/resolution SLA tracking with ok/warning/breached indicators. Threaded comments with internal notes toggle. Resolution requires category + notes. Field change audit trail. CSV export. Realtime updates. Demo data seeded via `064b-ticket-demo-data.sql`.

### Schedule & Crew Brief
Crew calendar with multi-day job support, R&R date tracking, AHJ auto-populate from project data. `JobBriefPanel` shows job details, project info, and permit requirements. Schedule assignment modal with crew search, job type selection, date range.

### EDGE Integration
Bidirectional webhooks between MicroGRID and EDGE Portal. Outbound: HMAC-SHA256 signed payloads for project/funding events via `useEdgeSync` hook. Inbound: funding status updates at `/api/webhooks/edge`. All events logged to `edge_sync_log`. Admin panel in System page for connection status and manual sync.

### Google Calendar Sync
Service account integration via `lib/google-calendar.ts` (JWT + Web Crypto RS256). Per-crew calendar config in `calendar_settings`. Color-coded events by job type (blueberry=survey, basil=install, banana=inspection, tomato=service). Bidirectional sync with webhook receiver. Admin management in System page.

### Atlas (AI Reports)
Natural language query at `/reports`. Claude Sonnet generates Supabase query plans from plain English. 25/day rate limit per user (tracked in `user_sessions`). Allowed tables: projects, project_funding, task_state, notes, schedule, service_calls, change_orders. Max 500 rows. Sortable results, CSV export, follow-up suggestions, conversation history. Requires `ANTHROPIC_API_KEY` and `SUPABASE_SECRET_KEY`.

### Email System (Resend)
- **Onboarding**: 30-day training email series. 4 weeks: Foundations (1-7), Operations (8-14), Power Features (15-21), Mastery (22-30). Templates in `lib/email-templates.ts`.
- **Digest**: Daily PM digest with portfolio stats, blocked projects, stuck tasks.
- **Announcements**: One-off broadcasts to all users or filtered by role.
- **Onboarding Reminders**: Automated doc completion reminders for sales reps.
- All from `nova@gomicrogridenergy.com`. Graceful no-op without `RESEND_API_KEY`.

### Document Management
Google Drive integration with auto-created 16-folder structure per project (via Apps Script webhook). `project_files` table for Drive file inventory. `document_requirements` for admin-configurable required docs per stage (23 defaults seeded). Status tracking: present/missing/pending/verified. File browser at `/documents`, missing docs report at `/documents/missing`.

### Commission System
Per-role commission rates (per_watt/percentage/flat). EC/Non-EC rates with energy community flag on projects. Volume tiers by deal count or watts. Geo modifiers by state/city/region. Multi-level override hierarchy. M1 advance tracking with clawback. Calculator, earnings dashboard, leaderboard.

### Sales Team Management
Pay scale stacks (4 tiers), override split distribution (7 roles = 100%), team hierarchy (VP→Regional→Manager→Asst Manager), sales rep personnel with onboarding document lifecycle (7-status tracking). Admin-only access.

### Multi-Tenant Architecture
Organizations with type taxonomy (platform/epc/sales/engineering/supply/customer). Org-scoped RLS on 30 tables via 4 helper functions. `useOrg()` hook with `OrgProvider`. `switchOrg()` clears all cached data. OrgSwitcher in nav bar. Engineering assignments and invoices are cross-org. Rush Engineering auto-routing for design work. NTP approval workflow between EPCs and EDGE platform.

### @Mention System
Type `@` in notes for autocomplete. Green highlighted names in note text. Notification bell (30s polling) with navigation to project/notes tab.

### Bulk Operations
`BulkActionBar` on Pipeline and Queue. Actions: Reassign PM, Set/Clear Blocker, Change Disposition, Set Follow-up. Disposition transition validation. Progress overlay, failure reporting, audit logging. `clearQueryCache()` after completion.

### Infographic
Mobile-responsive company dashboard at `/infographic`. EDGE-scoped data queries via `useOrg()`. Open to all authenticated users with support for all internal email domains.

## Data Inventory
- 938 active projects
- 14,705 legacy In Service projects
- ~330K total notes (53K original + 127K NetSuite action comments + 150K legacy BluChat)
- 67K+ task history entries
- 4,185 adders
- 922 service cases
- 12,054 funding records
- 2,517 equipment catalog items
- 1,633 AHJ records, 203 utilities, 421 HOAs
- 4,500+ files in Google Drive

## Import Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `extract-emails.ts` / `extract-emails-oauth.ts` | Google Workspace email extraction |
| `extract-subhub-projects.ts` / `extract-subhub.sh` | SubHub API extraction |
| `parse-vault-export.ts` | Google Vault MBOX parsing |
| `parse-teams-export.ts` / `parse-teams-html.ts` | Microsoft Teams export parsing |
| `import-legacy-projects.ts` | NetSuite JSON → legacy_projects schema |
| `import-equipment.ts` | Equipment catalog parsing |
| `import-action-comments.ts` | NetSuite actions → task notes |
| `backfill-legacy-fields.ts` / `backfill-from-csv.ts` | Legacy data backfill |
| `generate-action-plan.ts` | Email analysis → action items |
| `upload-legacy-projects.ts` / `upload-legacy-notes.ts` | Legacy data to Supabase |
| `upload-equipment.ts` / `upload-action-comments.ts` | Catalog and notes upload |
| `upload-drive-files.ts` / `upload-project-folders.ts` | Drive metadata upload |
| `seagate-to-gdrive.py` | Seagate → Google Drive migration (BluDocs) |
| `sync-drive-files.py` | Scan shared drive, export file metadata |

## Desktop Data Reference

| Location | Contents |
|----------|----------|
| `~/Desktop/ns_job_export_ALL_*/` | 28,760 JOB_*.json files from NetSuite + master CSVs |
| `~/Desktop/Edge NetSuite Export/` | 21,334 files — EDGE project data, BluChat exports |
| `~/Desktop/NetSuite/` | 12 subdirs — Bluchat, Cases, Config, Scripts, Vendors |
| `~/Desktop/NOVA_exports/` | Customer/project data exports |
| `email-export/` | April Yarborough CFO mailbox — categorized by topic |
| `teams-export/` | EcoFlow team chat export |

## Environment Variables

### Required
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SECRET_KEY` — Service role key (webhooks, Atlas, calendar sync)

### Optional
- `ANTHROPIC_API_KEY` — Claude API for Atlas reports
- `RESEND_API_KEY` — Resend for email sending
- `NEXT_PUBLIC_SENTRY_DSN` — Sentry error tracking
- `NEXT_PUBLIC_EDGE_WEBHOOK_URL` — EDGE Portal webhook URL
- `EDGE_WEBHOOK_SECRET` — EDGE webhook HMAC secret
- `GOOGLE_CALENDAR_CREDENTIALS` — Service account JSON for calendar sync
- `GOOGLE_CALENDAR_WEBHOOK_TOKEN` — Calendar webhook verification
- `SUBHUB_WEBHOOK_ENABLED` / `SUBHUB_WEBHOOK_SECRET` — SubHub webhook
- `CRON_SECRET` — Vercel cron endpoint auth
- `ADMIN_API_SECRET` — Announcement endpoint auth
- `NEXT_PUBLIC_APP_URL` — Base URL for email CTAs (default: `https://nova.gomicrogridenergy.com`)

## SLA Thresholds

| Stage | Target (green) | Risk (amber) | Critical (red) |
|-------|---------------|--------------|-----------------|
| Evaluation | 3 | 4 | 6 |
| Survey | 3 | 5 | 10 |
| Design | 3 | 5 | 10 |
| Permit | 21 | 30 | 45 |
| Install | 5 | 7 | 10 |
| Inspection | 14 | 21 | 30 |
| Complete | 3 | 5 | 7 |

## Pipeline Stages
1. `evaluation` — Pre-scrub, customer assessment
2. `survey` — Site survey
3. `design` — System design
4. `permit` — Permitting (city + utility)
5. `install` — Installation
6. `inspection` — City + utility inspection
7. `complete` — PTO and in-service

## Task System
Each stage has prerequisite tasks defined in `lib/tasks.ts` (`TASKS`). Tasks have status lifecycle and automation chain (see CLAUDE.md). AHJ-conditional requirements: WP1 and WPI 2&8 are optional but required for Corpus Christi and Texas City (`AHJ_REQUIRED_TASKS`).

## Customer Portal (Web)

Customer-facing web portal at `/portal/*` routes. PWA-capable with `manifest.json`, safe-area insets, and bottom tab navigation. Light-themed (CSS custom properties via `portal.css`). Completely separate auth flow from the internal CRM — customers authenticate via `customer_accounts` table (not the `users` table).

### Auth Flow
- `CustomerAuthProvider` wraps all portal pages (in `app/portal/layout.tsx`)
- `useCustomerAuth()` hook resolves `customer_accounts` by `auth_user_id`, loads project, timeline, and schedule
- Login at `/portal/login` — Google OAuth or magic link
- Account status gating: only `active` accounts can access portal (not `invited` or `suspended`)
- Customer-safe field projection — no contract, blocker, pm_id, org_id, or pricing data exposed

### Pages
| Route | Description |
|-------|-------------|
| `/portal` | Redirects to dashboard |
| `/portal/login` | Customer login (Google OAuth / magic link) |
| `/portal/dashboard` | Project status — stage progress bar, 60-day SLA countdown, upcoming schedule, timeline milestones, system specs |
| `/portal/tickets` | Support tickets — create tickets, view status, threaded comments, photo attachments via Supabase Storage |
| `/portal/chat` | Atlas AI — customer-facing Claude chat with project context, suggested prompts |
| `/portal/account` | Account settings — notification preferences, contact info |

### API Layer
`lib/api/customer-portal.ts` — all queries scoped to a single `project_id`. Exports: `CustomerAccount`, `CustomerProject`, `StageHistoryEntry`, `CustomerScheduleEntry`, `CUSTOMER_STAGE_LABELS`, `CUSTOMER_STAGE_DESCRIPTIONS`, `JOB_TYPE_LABELS`.

### File Attachments (Supabase Storage)
Ticket comments support photo and file attachments uploaded to the `ticket-attachments` Supabase Storage bucket. Upload flow: file selected → uploaded to `ticket-attachments/{ticket_id}/{timestamp}.{ext}` → public URL retrieved → embedded in comment as image or file link. Supported by both the web portal (`/portal/tickets`) and native mobile app (via `expo-image-picker` and `expo-document-picker`).

## Native Mobile App (`/mobile`)

Standalone React Native app in the `/mobile` directory with its own `package.json` and Expo config. Customer-facing companion to the web portal — same data, native experience.

### Tech Stack
- **Expo SDK 54** with Expo Router 6 (file-based routing)
- **React Native 0.81** + React 19 + TypeScript
- **Supabase** — direct client queries (same project as web CRM)
- Inter font family via `@expo-google-fonts/inter`
- `lucide-react-native` for icons, `expo-haptics` for tactile feedback
- Dark/light mode via `useColorScheme()` + `ThemeContext`

### Bundle IDs
- iOS: `com.microgridenergy.portal`
- Android: `com.microgridenergy.portal`

### Architecture
- `mobile/app/_layout.tsx` — root layout with auth guard, font loading, splash screen, theme provider
- `mobile/app/(auth)/` — login and OAuth callback screens
- `mobile/app/(tabs)/` — 4-tab bottom navigation: Home, Support, Atlas, Account
- `mobile/app/ticket/[id].tsx` — ticket detail screen with threaded comments
- `mobile/lib/supabase.ts` — Supabase client with `expo-secure-store` for token persistence
- `mobile/lib/api.ts` — data access layer (mirrors `lib/api/customer-portal.ts`, direct Supabase queries)
- `mobile/lib/theme.ts` — dark/light theme colors with `ThemeContext`
- `mobile/lib/cache.ts` — persistent LRU cache for instant render (stale-while-revalidate)
- `mobile/lib/notifications.ts` — Expo push notification registration and handling
- `mobile/lib/constants.ts` — stage labels, descriptions, job type labels
- `mobile/lib/types.ts` — TypeScript types (mirrors web portal types)

### Screens
| Screen | Tab | Description |
|--------|-----|-------------|
| Dashboard | Home | Project status with stage progress, SLA countdown, schedule, milestones |
| Tickets | Support | Ticket list with unread badge (30s polling), create ticket, photo/file attachments |
| Ticket Detail | (stack) | Threaded comments, status display, attachment support |
| Chat | Atlas | AI assistant with project context and suggested prompts |
| Account | Account | Profile, notification preferences, logout |

### Push Notifications
- Registration via `expo-notifications` on app startup after auth
- Permission request flow (iOS/Android)
- Android notification channel: "MicroGRID" with MAX importance
- Expo Push Token saved to `customer_accounts.push_token` for server-side sends
- Notification tap handler for deep linking to relevant screens
- Badge count from unread ticket updates (via `expo-secure-store` last-seen timestamp)

### Commands
```bash
cd mobile
npm install        # Install dependencies
npx expo start    # Start dev server (Expo Go or dev client)
npx expo start --ios     # iOS simulator
npx expo start --android # Android emulator
```

## Route Protection

### Role Hierarchy
super_admin(5) > admin(4) > finance(3) > manager(2) > user(1) > sales(0)

### Route Map
- **Public**: `/login`, `/auth`, `/api/webhooks/*`, `/api/email/send-daily`, `/api/calendar/webhook`
- **Any authenticated**: `/command`, `/queue`, `/pipeline`, `/schedule`, `/crew`, `/mobile/*`, `/commissions`
- **Manager+**: `/analytics`, `/reports`, `/funding`, `/ntp`, `/inventory`, `/service`, `/work-orders`, `/warranty`, `/fleet`, `/vendors`, `/permits`, `/documents`, `/change-orders`, `/engineering`, `/invoices`, `/redesign`, `/legacy`, `/batch`, `/planset`, `/audit-trail`, `/audit`, `/dashboard`
- **Admin+**: `/admin`, `/sales`
- **Super admin**: `/system`
