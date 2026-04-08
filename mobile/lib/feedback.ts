/**
 * Customer feedback submission helpers.
 *
 * Handles:
 *   - Submitting feedback rows to customer_feedback
 *   - Uploading screenshots to the customer-feedback Storage bucket
 *   - Capturing device + app + screen context automatically
 */

import { supabase } from './supabase'
import { getCustomerAccount } from './api'
import Constants from 'expo-constants'
import * as Device from 'expo-device'

export type FeedbackCategory = 'bug' | 'idea' | 'praise' | 'question' | 'confusing' | 'nps'

/** NPS milestone identifiers — used as keys in customer_accounts.nps_prompts_shown */
export type NpsMilestone = 'pto_complete' | 'first_billing_30d' | 'onboarding_complete'

export interface FeedbackSubmission {
  category: FeedbackCategory
  message: string
  rating?: number | null
  screenPath?: string
  attachments?: { uri: string; mimeType?: string; fileName?: string }[]
}

export interface FeedbackRow {
  id: string
  customer_account_id: string
  project_id: string
  category: FeedbackCategory
  rating: number | null
  message: string
  screen_path: string | null
  app_version: string | null
  device_info: string | null
  status: 'new' | 'reviewing' | 'responded' | 'closed'
  admin_response: string | null
  admin_responded_by: string | null
  admin_responded_at: string | null
  org_id: string | null
  created_at: string
}

/** Build a human-readable device info string */
function getDeviceInfo(): string {
  const os = `${Device.osName ?? 'Unknown'} ${Device.osVersion ?? ''}`.trim()
  const model = Device.modelName ?? Device.deviceName ?? 'Unknown device'
  return `${os} · ${model}`
}

/** Get the running app version from Expo config */
function getAppVersion(): string {
  return (
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    'unknown'
  )
}

/**
 * Upload a single screenshot/file to the customer-feedback bucket.
 * Returns the public URL + size on success, null on failure.
 * Matches the uploadTicketPhoto pattern in lib/api.ts.
 */
async function uploadAttachment(
  feedbackId: string,
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<{ url: string; size: number } | null> {
  try {
    const response = await fetch(uri)
    const arrayBuffer = await response.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)

    const path = `${feedbackId}/${Date.now()}-${fileName}`
    const { error: uploadError } = await supabase.storage
      .from('customer-feedback')
      .upload(path, uint8, { contentType: mimeType, upsert: false })

    if (uploadError) {
      console.error('[feedback] upload failed:', uploadError.message)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('customer-feedback')
      .getPublicUrl(path)

    return { url: urlData.publicUrl, size: uint8.byteLength }
  } catch (err) {
    console.error('[feedback] upload exception:', err instanceof Error ? err.message : err)
    return null
  }
}

export interface SubmitResult {
  /** Inserted feedback row id, or null if the insert failed */
  feedbackId: string | null
  /** Number of attachments that uploaded successfully */
  attachmentsUploaded: number
  /** Number of attachments that failed to upload (still submitted, just no screenshot) */
  attachmentsFailed: number
}

/**
 * Submit feedback (with optional attachments) for the current customer.
 *
 * Returns a SubmitResult so the UI can show partial-success when some
 * attachments fail. The feedback row is always inserted first; attachment
 * upload failures don't block submission.
 */
export async function submitFeedback(input: FeedbackSubmission): Promise<SubmitResult> {
  const result: SubmitResult = { feedbackId: null, attachmentsUploaded: 0, attachmentsFailed: 0 }

  const account = await getCustomerAccount()
  if (!account) {
    console.error('[feedback] no customer account — cannot submit')
    return result
  }

  // Look up org_id from project so RLS gives CRM users visibility
  const { data: proj, error: projError } = await supabase
    .from('projects')
    .select('org_id')
    .eq('id', account.project_id)
    .single()

  if (projError) {
    console.warn('[feedback] could not determine org_id:', projError.message)
  }
  const orgId = (proj as { org_id: string | null } | null)?.org_id ?? null

  const { data: inserted, error: insertError } = await supabase
    .from('customer_feedback')
    .insert({
      customer_account_id: account.id,
      project_id: account.project_id,
      category: input.category,
      rating: input.rating ?? null,
      message: input.message.trim(),
      screen_path: input.screenPath ?? null,
      app_version: getAppVersion(),
      device_info: getDeviceInfo(),
      status: 'new',
      org_id: orgId,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    console.error('[feedback] insert failed:', insertError?.message)
    return result
  }

  const feedbackId = (inserted as { id: string }).id
  result.feedbackId = feedbackId

  // Upload attachments in parallel; track per-file success
  if (input.attachments && input.attachments.length > 0) {
    const settled = await Promise.allSettled(
      input.attachments.map(async (att, idx) => {
        const fileName = att.fileName ?? `screenshot-${idx + 1}.jpg`
        const mimeType = att.mimeType ?? 'image/jpeg'
        const upload = await uploadAttachment(feedbackId, att.uri, fileName, mimeType)
        if (!upload) throw new Error(`upload failed for ${fileName}`)
        const { error: attErr } = await supabase
          .from('customer_feedback_attachments')
          .insert({
            feedback_id: feedbackId,
            file_url: upload.url,
            file_name: fileName,
            mime_type: mimeType,
            file_size: upload.size,
          })
        if (attErr) throw new Error(`attachment row insert failed: ${attErr.message}`)
      }),
    )

    for (const s of settled) {
      if (s.status === 'fulfilled') result.attachmentsUploaded++
      else { result.attachmentsFailed++; console.error('[feedback]', s.reason) }
    }
  }

  return result
}

// ── NPS prompt helpers ─────────────────────────────────────────────────────

/**
 * Submit a 0-10 NPS rating with an optional comment.
 * Stored in customer_feedback with category='nps'.
 */
export async function submitNpsRating(
  score: number,
  milestone: NpsMilestone,
  comment?: string,
): Promise<boolean> {
  if (score < 0 || score > 10) {
    console.error('[nps] score out of range:', score)
    return false
  }
  const result = await submitFeedback({
    category: 'nps',
    rating: score,
    message: comment?.trim() || `NPS @ ${milestone}: ${score}`,
    screenPath: `nps:${milestone}`,
  })
  if (!result.feedbackId) return false

  // Mark this milestone as shown so we don't prompt again
  const account = await getCustomerAccount()
  if (account) {
    const shown = { ...(account.nps_prompts_shown ?? {}), [milestone]: new Date().toISOString().slice(0, 10) }
    await supabase
      .from('customer_accounts')
      .update({ nps_prompts_shown: shown })
      .eq('id', account.id)
  }
  return true
}

/**
 * Mark an NPS milestone as "shown" without submitting a score
 * (e.g., when the user dismisses the prompt without rating).
 * Prevents us from showing it again.
 */
export async function dismissNpsPrompt(milestone: NpsMilestone): Promise<void> {
  const account = await getCustomerAccount()
  if (!account) return
  const shown = { ...(account.nps_prompts_shown ?? {}), [milestone]: new Date().toISOString().slice(0, 10) }
  await supabase
    .from('customer_accounts')
    .update({ nps_prompts_shown: shown })
    .eq('id', account.id)
}

/**
 * Determine which NPS milestone (if any) should be shown to the current user.
 * Returns null if no milestone is due.
 *
 * Logic:
 * - pto_complete: project has pto_date set AND pto milestone not shown
 * - first_billing_30d: project has pto_date >= 30 days ago AND not shown
 * - onboarding_complete: project stage is 'complete' AND not shown
 *
 * Show only ONE milestone at a time (highest-priority first).
 */
export async function getDueNpsMilestone(): Promise<NpsMilestone | null> {
  const account = await getCustomerAccount()
  if (!account) return null

  const shown = account.nps_prompts_shown ?? {}

  const { data: proj, error: projError } = await supabase
    .from('projects')
    .select('stage, pto_date, install_complete_date')
    .eq('id', account.project_id)
    .single()

  if (projError) {
    console.warn('[nps] project lookup failed:', projError.message)
    return null
  }
  if (!proj) return null
  const project = proj as { stage: string | null; pto_date: string | null; install_complete_date: string | null }

  // Highest priority: 30 days post-PTO (best signal of long-term satisfaction)
  if (project.pto_date && !shown.first_billing_30d) {
    const pto = new Date(project.pto_date)
    const daysSincePto = Math.floor((Date.now() - pto.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSincePto >= 30) return 'first_billing_30d'
  }

  // Mid: PTO complete (system just turned on)
  if (project.pto_date && !shown.pto_complete) {
    return 'pto_complete'
  }

  // Low: project entirely complete
  if (project.stage === 'complete' && !shown.onboarding_complete) {
    return 'onboarding_complete'
  }

  return null
}
