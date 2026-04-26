import { randomUUID } from 'node:crypto'

export const EVAL_PREFIX = 'eval-'

export const EVAL_ORG_A_SLUG = 'evals-org-a'
export const EVAL_ORG_B_SLUG = 'evals-org-b'
export const EVAL_ORG_A_NAME = 'Evals Org A'
export const EVAL_ORG_B_NAME = 'Evals Org B'

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
  return `PROJ-EVAL-${randomUUID().slice(0, 8)}`
}

export function isEvalRow(value: string | null | undefined): boolean {
  if (!value) return false
  return value.startsWith(EVAL_PREFIX) || value.startsWith('PROJ-EVAL-')
}
