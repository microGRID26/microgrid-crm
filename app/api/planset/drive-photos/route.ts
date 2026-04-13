/**
 * GET /api/planset/drive-photos?projectId=PROJ-XXX
 *
 * Auto-pulls photos from a project's Google Drive folder for /planset image slots.
 * Scopes to "07 Site Survey" subfolder (08 Design is a nested workspace, not
 * a photo dump). Uses Claude Haiku 4.5 vision to classify up to 20 images into
 * planset-slot categories — filename-based classification is impossible because
 * TriSMART's checklist app names files sequentially (checklist_media_..._0.jpg).
 *
 * Falls back silently to null slots on any failure — /planset UI treats null as
 * "show upload placeholder" so there's zero regression when Drive or vision
 * is unavailable.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { listFolderChildren, findSubfolder, getFileMetadata, getFileBytes, type DriveFile } from '@/lib/google-drive'
import { classifyImage, type PhotoLabel } from '@/lib/planset/vision-classify'

const DEBUG_VERSION = 'v4-vision-classify'

interface PlansetPhotos {
  aerialPhotoUrl: string | null
  housePhotoUrl: string | null
  sitePlanImageUrl: string | null
  roofPlanImageUrl: string | null
  equipmentPhotos: (string | null)[]
  /** Non-fatal diagnostic — what was attempted, what matched, why empty */
  meta: {
    folderId: string | null
    driveId: string | null
    subfoldersSearched: string[]
    filesListed: number
    imagesClassified: number
    imagesMatched: number
    classificationBreakdown: Record<string, number>
    fallbackReason?: string
    elapsedMs: number
    debugVersion: string
  }
}

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const SITE_SURVEY_FOLDER = '07 Site Survey'
const DESIGN_FOLDER = '08 Design'
const SUBFOLDERS = [SITE_SURVEY_FOLDER, DESIGN_FOLDER] as const
const CACHE_TTL_MS = 5 * 60 * 1000

// Hard cap on images classified per request. 20 × ~$0.0015 = ~$0.03 per load.
// Most site surveys cover aerial/house/msp/meter/inverter/battery in the first
// 20 checklist steps, so this captures the important photos without burning
// budget on the trailing "additional shots" section.
const MAX_CLASSIFY = 20

// Max raw image size for vision classification. Anthropic caps vision payloads
// at ~5MB base64-encoded, which is ~3.75MB raw. Skip anything larger to avoid
// wasted download + encoding + guaranteed API rejection.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

// Equipment labels mapped to the PV-3.1 equipment photo slots. Each slot takes
// one distinct equipment photo.
const EQUIPMENT_LABELS: ReadonlySet<PhotoLabel> = new Set(['msp', 'inverter', 'battery', 'meter'])

// In-memory cache — Vercel server instance scope. Keyed by projectId.
const cache = new Map<string, { value: PlansetPhotos; expiresAt: number }>()

function emptyResult(
  folderId: string | null,
  reason: string,
  started: number,
  filesListed = 0,
  driveId: string | null = null,
): PlansetPhotos {
  return {
    aerialPhotoUrl: null,
    housePhotoUrl: null,
    sitePlanImageUrl: null,
    roofPlanImageUrl: null,
    equipmentPhotos: [null, null, null, null],
    meta: {
      folderId,
      driveId,
      subfoldersSearched: [],
      filesListed,
      imagesClassified: 0,
      imagesMatched: 0,
      classificationBreakdown: {},
      fallbackReason: reason,
      elapsedMs: Date.now() - started,
      debugVersion: DEBUG_VERSION,
    },
  }
}

function proxyUrl(fileId: string): string {
  return `/api/planset/drive-image/${encodeURIComponent(fileId)}`
}

export async function GET(req: NextRequest) {
  const started = Date.now()

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Tight rate limit — each call triggers up to 20 vision classifications
  // at ~$0.03 per invocation. 10/min caps runaway cost at ~$0.30/min/user.
  const { success } = await rateLimit(`planset-drive:${user.email}`, {
    windowMs: 60_000, max: 10, prefix: 'planset-drive',
  })
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const projectId = req.nextUrl.searchParams.get('projectId')?.trim()
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  // Cache check
  const cached = cache.get(projectId)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value)
  }

  // Load project folder from project_folders join table. folder_url is 100%
  // populated, folder_id column is only populated for ~1.6% of rows so we
  // parse the Drive folder ID out of the URL ourselves when needed.
  const pfResult = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { folder_id: string | null; folder_url: string | null } | null; error: unknown }>
        }
      }
    }
  })
    .from('project_folders')
    .select('folder_id, folder_url')
    .eq('project_id', projectId)
    .maybeSingle()

  if (pfResult.error || !pfResult.data) {
    return NextResponse.json(emptyResult(null, `project_folders row not found`, started))
  }

  let folderId = pfResult.data.folder_id
  if (!folderId && pfResult.data.folder_url) {
    const match = pfResult.data.folder_url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    if (match) folderId = match[1]
  }
  if (!folderId) {
    const result = emptyResult(null, 'project has no drive folder (column null + url unparseable)', started)
    cache.set(projectId, { value: result, expiresAt: Date.now() + CACHE_TTL_MS })
    return NextResponse.json(result)
  }

  // Discover the parent Shared Drive ID — required so listFolderChildren can
  // use corpora=drive + driveId, which is the only pattern that reliably
  // returns Shared Drive content to a service account.
  const parentMeta = await getFileMetadata(folderId)
  if (!parentMeta) {
    return NextResponse.json(emptyResult(folderId, 'could not fetch parent folder metadata (check service account grant)', started))
  }
  const parentDriveId = parentMeta.driveId ?? null

  // Find 07 Site Survey + 08 Design subfolders. Only 07 contains flat photos
  // (08 is a nested workspace). We still search both for the file count so
  // diagnostics reflect reality.
  const allFiles: DriveFile[] = []
  const subfoldersSearched: string[] = []
  try {
    const subfolderIds = await Promise.all(
      SUBFOLDERS.map(name => findSubfolder(folderId, name, parentDriveId ?? undefined))
    )
    for (let i = 0; i < subfolderIds.length; i++) {
      const id = subfolderIds[i]
      if (!id) continue
      subfoldersSearched.push(SUBFOLDERS[i])
      const children = await listFolderChildren(id, 200, parentDriveId ?? undefined)
      allFiles.push(...children)
    }
  } catch (err) {
    console.error('[drive-photos] listing failed:', err)
    return NextResponse.json(emptyResult(folderId, `drive listing failed: ${(err as Error).message}`, started, 0, parentDriveId))
  }

  // Bail early if the classification key is missing — otherwise every image
  // silently falls through to 'other' and the diagnostic breadcrumbs are
  // useless for debugging.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      emptyResult(folderId, 'ANTHROPIC_API_KEY not set on server — vision classification disabled', started, allFiles.length, parentDriveId)
    )
  }

  // Only classify images from 07 Site Survey (flat photos). 08 Design is a
  // nested workspace — recursing into its subfolders is a v2 enhancement.
  // Filter out oversized images before classification (Drive's `size` field
  // is a string-encoded number on the file metadata). Files without a size
  // field still get classified — assume they're small and let getFileBytes
  // find out.
  const images = allFiles
    .filter(f => IMAGE_MIMES.has(f.mimeType))
    .filter(f => !f.size || parseInt(f.size, 10) <= MAX_IMAGE_BYTES)
  const toClassify = images.slice(0, MAX_CLASSIFY)

  // Classify images in parallel. classifyImage never throws — returns
  // { label: 'other', error } on any failure so Promise.all stays safe.
  const classifications = await Promise.all(
    toClassify.map(async img => {
      const bytes = await getFileBytes(img.id)
      if (!bytes) return { img, label: 'other' as PhotoLabel }
      // Second-pass size check — getFileBytes already downloaded, so this is
      // belt-and-braces for files that had no size in metadata.
      if (bytes.bytes.byteLength > MAX_IMAGE_BYTES) {
        return { img, label: 'other' as PhotoLabel }
      }
      const result = await classifyImage(bytes.bytes, bytes.mimeType)
      return { img, label: result.label }
    })
  )

  // Tally breakdown for diagnostics
  const breakdown: Record<string, number> = {}
  for (const c of classifications) {
    breakdown[c.label] = (breakdown[c.label] ?? 0) + 1
  }

  // Slot-filling: take the FIRST image of each class into its slot. The
  // checklist order is roughly chronological (aerial shots come before
  // equipment closeups), so first-match usually gets the hero photo.
  const result: PlansetPhotos = {
    aerialPhotoUrl: null,
    housePhotoUrl: null,
    sitePlanImageUrl: null,
    roofPlanImageUrl: null,
    equipmentPhotos: [],
    meta: {
      folderId,
      driveId: parentDriveId,
      subfoldersSearched,
      filesListed: allFiles.length,
      imagesClassified: classifications.length,
      imagesMatched: 0,
      classificationBreakdown: breakdown,
      elapsedMs: 0,
      debugVersion: DEBUG_VERSION,
    },
  }

  let matched = 0
  const equipmentFound: string[] = []
  for (const { img, label } of classifications) {
    if (label === 'aerial' && !result.aerialPhotoUrl) {
      result.aerialPhotoUrl = proxyUrl(img.id); matched++; continue
    }
    if (label === 'house' && !result.housePhotoUrl) {
      result.housePhotoUrl = proxyUrl(img.id); matched++; continue
    }
    if (label === 'site_plan' && !result.sitePlanImageUrl) {
      result.sitePlanImageUrl = proxyUrl(img.id); matched++; continue
    }
    if (label === 'roof_plan' && !result.roofPlanImageUrl) {
      result.roofPlanImageUrl = proxyUrl(img.id); matched++; continue
    }
    if (EQUIPMENT_LABELS.has(label) && equipmentFound.length < 4) {
      equipmentFound.push(proxyUrl(img.id)); matched++
    }
  }
  while (equipmentFound.length < 4) equipmentFound.push(null as unknown as string)
  result.equipmentPhotos = equipmentFound as (string | null)[]

  result.meta.imagesMatched = matched
  result.meta.elapsedMs = Date.now() - started

  cache.set(projectId, { value: result, expiresAt: Date.now() + CACHE_TTL_MS })
  return NextResponse.json(result)
}
