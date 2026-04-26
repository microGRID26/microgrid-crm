import { randomUUID } from 'node:crypto'

export const EVAL_PREFIX = 'eval-'

export const EVAL_ORG_A_SLUG = 'evals-org-a'
export const EVAL_ORG_B_SLUG = 'evals-org-b'
export const EVAL_ORG_A_NAME = 'Evals Org A'
export const EVAL_ORG_B_NAME = 'Evals Org B'
// Partner-flavor org. Created with org_type='engineering' (NOT 'partner' — that
// value isn't in the organizations_org_type_check enum) so the EPC bulk-add-staff
// trigger doesn't fire on it. Used by partner_idempotency eval.
export const EVAL_PARTNER_ORG_SLUG = 'evals-partner-x'
export const EVAL_PARTNER_ORG_NAME = 'Evals Partner X'
export const EVAL_PARTNER_KEY_NAME = 'evals-partner-key'

export const EVAL_USER_A_EMAIL = 'eval-user-a@gomicrogridenergy.com'
export const EVAL_USER_B_EMAIL = 'eval-user-b@gomicrogridenergy.com'
export const EVAL_USER_A_NAME = 'Eval User A'
export const EVAL_USER_B_NAME = 'Eval User B'

export const EVAL_PASSWORD = 'EvalHarness-2026-Fixed-Pw!'

export const EVAL_ORG_SLUGS = [EVAL_ORG_A_SLUG, EVAL_ORG_B_SLUG] as const
export const EVAL_USER_EMAILS = [EVAL_USER_A_EMAIL, EVAL_USER_B_EMAIL] as const

export function evalId(suffix?: string): string {
  const short = randomUUID().slice(0, 8)
  return suffix ? `${EVAL_PREFIX}${short}-${suffix}` : `${EVAL_PREFIX}${short}`
}

export function evalProjectId(): string {
  // 16 hex chars (~1.8e19 collision space) — bumped from 8 hex per R1 finding
  // on Phase 4 write_side_parity coverage. 8-hex was 256M space which is fine
  // in practice but free to harden.
  return `PROJ-EVAL-${randomUUID().slice(0, 8)}-${randomUUID().slice(0, 8)}`
}

export function isEvalRow(value: string | null | undefined): boolean {
  if (!value) return false
  return value.startsWith(EVAL_PREFIX) || value.startsWith('PROJ-EVAL-')
}
