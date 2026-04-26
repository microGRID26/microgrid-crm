# MicroGRID Eval Harness

Behavioral regression checks against a real Supabase database. A third test
type alongside Vitest unit tests (`__tests__/`) and Playwright e2e (`e2e/`).

> **What evals catch that unit + e2e don't.** Type-check + Vitest unit tests
> verify code shape. Playwright e2e drives the browser. Neither catches
> *behavioral* regressions: a silent change to RLS, a default that drifts,
> a webhook idempotency contract that silently relaxes. Evals run the same
> code paths the app uses, against a real DB, and assert observable end state.

## Run

```bash
npm run eval         # one-shot
```

Runs in ~10s against prod Supabase using the service role + per-user JWTs.
Cleans up its own rows on `afterAll`.

## How it works

Each scenario lives in `evals/<name>.eval.ts`. The `*.eval.ts` suffix is
matched by `vitest.eval.config.ts` (separate from the unit `*.test.ts`
glob). On startup, `evals/setup.ts` provisions fixtures idempotently — same
2 eval orgs + 2 eval users + 1 partner-eval org + 1 partner key on every
run. Tests sign in via `signInWithPassword` to get a real JWT and query
through real RLS.

## Scenarios (v1)

| File | What it asserts |
|---|---|
| [`create_project.eval.ts`](./create_project.eval.ts) | User A inserts a project into org A and reads it back; user B can't see it; user B can't write into org A. |
| [`assign_crew.eval.ts`](./assign_crew.eval.ts) | Work order create through RLS; user B blocked from writing/reading WOs across orgs. |
| [`partner_idempotency.eval.ts`](./partner_idempotency.eval.ts) | `partner_idempotency_keys` composite PK contract — second insert with same `(api_key_id, idempotency_key)` MUST fail. |
| [`rls_org_isolation.eval.ts`](./rls_org_isolation.eval.ts) | Cross-org RLS canary — user from org B sees zero rows seeded in org A across `projects` and `work_orders`. |

## Adding a scenario

1. Create `evals/<name>.eval.ts` (must end in `.eval.ts`).
2. Import what you need:
   ```ts
   import { describe, it, expect } from 'vitest'
   import { getEvalContext } from './context'
   import { serviceClient, userClient } from './helpers/clients'
   import { EVAL_USER_A_EMAIL, EVAL_PASSWORD, evalProjectId } from './helpers/fixtures'
   ```
3. Use the existing fixtures: 2 eval orgs (`orgAId`, `orgBId`), 2 eval users
   (`userAId`/`userBId`, plus password-auth via `userClient`), 1 partner
   eval org + key.
4. Prefix any rows you insert with `eval-`/`PROJ-EVAL-`/`WO-EVAL-`/etc. Use
   helpers in `fixtures.ts` so cleanup picks them up.
5. **If your scenario creates a new `projects` FK child table** (e.g.,
   `change_orders`, `ntp_requests`, `invoices`, etc.), extend
   [`cleanup.ts`](./cleanup.ts) to delete from that table — `afterAll` will
   re-throw FK violations and your suite will fail loud. See the FK contract
   block in cleanup.ts.

## Safety contract (load-bearing — read before changing setup or cleanup)

This harness runs against PROD Supabase. The constraints below keep eval
data isolated from real org data.

1. **Eval rows are scoped to eval orgs.** Every cleanup is filtered by
   `org_id IN (orgAId, orgBId)` (or `api_key_id = partnerApiKeyId` for the
   partner table). Cleanup re-verifies the org IDs resolve to the canonical
   slugs *and* names before deleting; if either drifts, cleanup throws.
2. **`afterAll` MUST throw on cleanup failure.** A "test passed but cleanup
   silently failed" outcome is worse than a "test failed loud" outcome —
   silent failures strand eval rows in prod indefinitely.
3. **Eval users are scoped.** `assertEvalUserMembershipsScoped` runs at
   start and refuses to run if `eval-user-a` or `eval-user-b` has any
   membership outside its assigned eval org. There's an automatic
   `purgeEvalUserForeignMemberships` step that scrubs the leak each run
   (the `organizations_grant_staff_on_new_epc` trigger silently bulk-adds
   `role='user'` accounts to every new EPC org Greg creates).
4. **Service-role secrets are scrubbed from thrown errors.** Anything that
   looks like a JWT (`eyJ…`) is redacted before re-throw, so failure logs
   pasted into chat can't leak the service role key.

## What's intentionally NOT tested in v1

| Gap | Why deferred | Path to v2 |
|---|---|---|
| Partner-leads HTTP path (POST `/api/v1/partner/leads`) | The route writes new projects under MG's canonical EPC tenant (`org_id = MG_ENERGY_ORG_ID`). Test rows would pollute real production data; no clean way to scope on prod. | Move evals to a Supabase branch. Spawn `next dev` and POST with bearer + `X-MG-Actor` + `Idempotency-Key`. |
| EDGE/SPARK eval suites | One-codebase scope. | Replicate the `evals/` pattern after the MG harness stabilizes. |
| CI integration | Manual post-deploy is enough for v1. | GitHub Actions workflow — run after a successful Vercel deploy. |
| Performance/load evals | Different domain. | Out of scope. |

## File map

```
evals/
├── README.md                     ← you are here
├── setup.ts                      ← provisioning + .env.local loader + secret scrubber
├── cleanup.ts                    ← prefix-guarded teardown
├── context.ts                    ← shared eval context
├── helpers/
│   ├── clients.ts                ← serviceClient + userClient factories
│   └── fixtures.ts               ← eval prefix constants + fixed password
├── create_project.eval.ts        ← scenario 1
├── assign_crew.eval.ts           ← scenario 2
├── partner_idempotency.eval.ts   ← scenario 3
└── rls_org_isolation.eval.ts     ← scenario 4 (canary)
```
