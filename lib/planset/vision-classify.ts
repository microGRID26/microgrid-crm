// lib/planset/vision-classify.ts — Claude Haiku 4.5 vision classifier
// Used by /api/planset/drive-photos to label raw checklist photos into
// planset-slot categories. Returns 'other' on any failure (never throws).
//
// Cost note: ~$0.0015 per classification at Haiku 4.5 pricing. The caller
// batches 20 images per planset open, so ~$0.03 per load, cached 5 min
// in-memory.

export type PhotoLabel =
  | 'aerial'       // satellite / drone overhead of the property
  | 'house'        // front elevation of the home
  | 'site_plan'    // hand-drawn or printed site plan with setbacks / lot lines
  | 'roof_plan'    // top-down roof layout with module placement
  | 'msp'          // main service panel / breaker box interior
  | 'inverter'     // existing inverter on wall
  | 'battery'      // existing battery or ESS on wall
  | 'meter'        // utility meter
  | 'roof_closeup' // close-up of roof surface / attic / rafters
  | 'other'

const VALID_LABELS: readonly PhotoLabel[] = [
  'aerial', 'house', 'site_plan', 'roof_plan',
  'msp', 'inverter', 'battery', 'meter', 'roof_closeup', 'other',
]

const CLAUDE_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const VISION_TIMEOUT_MS = 10_000

const PROMPT = `Classify this residential solar site-survey photo into exactly ONE of these categories and respond with ONLY the single category word (no other text):

- aerial: satellite or drone overhead view of a property/roof
- house: front elevation / ground-level exterior of the home
- site_plan: hand-drawn or printed site plan showing lot lines and setbacks
- roof_plan: top-down roof diagram with module placement (drawn, not photographed)
- msp: main service panel or breaker box (interior or exterior door open)
- inverter: existing solar inverter mounted on a wall
- battery: existing battery or energy storage system on a wall
- meter: utility electric meter
- roof_closeup: close-up of roof surface, attic, or rafters (not an overhead view)
- other: anything else (utility bill, ID, sticker, blurry, etc.)

Respond with ONE word only.`

interface ClassifyResult {
  label: PhotoLabel
  error?: string
}

/**
 * Classify one image via Claude vision. Never throws — returns
 * { label: 'other', error } on any failure so the caller's Promise.all
 * never rejects and downstream slot-filling keeps working.
 */
export async function classifyImage(
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<ClassifyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { label: 'other', error: 'ANTHROPIC_API_KEY not set' }

  // Only JPEG/PNG/WebP are supported by Anthropic vision
  const mediaType = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType)) {
    return { label: 'other', error: `unsupported mime: ${mimeType}` }
  }

  // Base64-encode the image bytes. Node Buffer is the fastest path.
  const base64 = Buffer.from(bytes).toString('base64')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)

  try {
    const res = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[vision-classify] Claude API failed:', res.status, errText.slice(0, 300))
      return { label: 'other', error: `HTTP ${res.status}` }
    }

    const data = await res.json() as {
      content?: Array<{ type: string; text?: string }>
    }
    const text = data.content?.find(c => c.type === 'text')?.text?.trim().toLowerCase() ?? ''
    // Accept the first valid label token — the model sometimes adds trailing
    // punctuation or a newline.
    for (const label of VALID_LABELS) {
      if (text.startsWith(label)) return { label }
    }
    return { label: 'other', error: `unparseable response: "${text.slice(0, 40)}"` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[vision-classify] threw:', msg)
    return { label: 'other', error: msg }
  } finally {
    clearTimeout(timeoutId)
  }
}
