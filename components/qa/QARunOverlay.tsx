'use client'

/**
 * QARunOverlay — global side panel that activates when the URL contains
 * `?qa_run=<id>`. Captures nav + console errors, paste-to-screenshot,
 * verdict + notes, dual-writes via /api/qa/runs/[id]/complete.
 *
 * Mounted in components/Providers.tsx so it works on every internal page.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Beaker, X, CheckCircle2, XCircle, Ban, AlertTriangle, Camera, Send, Star,
  ExternalLink, Loader2, Maximize2, Minimize2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ActiveCase {
  id: string
  plan_name: string
  title: string
  instructions: string | null
  expected_result: string | null
  page_url: string | null
  priority: string
}

type Verdict = 'pass' | 'fail' | 'blocked'

const SS_KEY = 'qa-run-state'

export default function QARunOverlay() {
  const router = useRouter()
  const search = useSearchParams()
  const pathname = usePathname()
  const supabase = createClient()

  const runId = search?.get('qa_run') ?? null
  const active = !!runId

  const [theCase, setTheCase] = useState<ActiveCase | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [stars, setStars] = useState(0)
  const [notes, setNotes] = useState('')
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const startTimeRef = useRef<number>(Date.now())
  const lastNavRef = useRef<string>(pathname || '')

  // Hydrate / persist collapse state
  useEffect(() => {
    if (!active) return
    try {
      const raw = sessionStorage.getItem(SS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.runId === runId) {
          setCollapsed(!!parsed.collapsed)
          startTimeRef.current = parsed.startedAt ?? Date.now()
        } else {
          startTimeRef.current = Date.now()
          sessionStorage.setItem(SS_KEY, JSON.stringify({ runId, collapsed: false, startedAt: startTimeRef.current }))
        }
      } else {
        startTimeRef.current = Date.now()
        sessionStorage.setItem(SS_KEY, JSON.stringify({ runId, collapsed: false, startedAt: startTimeRef.current }))
      }
    } catch { /* ignore */ }
  }, [active, runId])

  useEffect(() => {
    if (!active || !runId) return
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({ runId, collapsed, startedAt: startTimeRef.current }))
    } catch { /* ignore */ }
  }, [collapsed, active, runId])

  // Load the case from /api/qa/today
  useEffect(() => {
    if (!active) return
    let cancelled = false
    fetch('/api/qa/today', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (cancelled || !json) return
        if (json.activeRun?.id === runId && json.case) {
          setTheCase(json.case)
        }
      })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [active, runId])

  const logEvent = useCallback((type: string, extra: Record<string, unknown> = {}) => {
    if (!runId) return
    const elapsed = Date.now() - startTimeRef.current
    fetch(`/api/qa/runs/${runId}/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ type, elapsedMs: elapsed, ...extra }),
    }).catch(() => { /* fire-and-forget */ })
  }, [runId])

  // Track nav between pages
  useEffect(() => {
    if (!active || !pathname) return
    if (pathname === lastNavRef.current) return
    lastNavRef.current = pathname
    logEvent('nav', { url: pathname })
  }, [pathname, active, logEvent])

  // Capture window.error + unhandledrejection
  useEffect(() => {
    if (!active) return
    const onError = (e: ErrorEvent) => {
      logEvent('console_error', {
        message: String(e.message ?? '').slice(0, 4000),
        url: typeof window !== 'undefined' ? window.location.pathname : null,
      })
    }
    const onRej = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
      logEvent('console_error', {
        message: msg.slice(0, 4000),
        url: typeof window !== 'undefined' ? window.location.pathname : null,
      })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRej)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRej)
    }
  }, [active, logEvent])

  // Paste-to-screenshot
  useEffect(() => {
    if (!active) return
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()
          if (!blob) continue
          if (blob.size > 8 * 1024 * 1024) {
            setSubmitError('Screenshot too large (8 MB max)')
            return
          }
          setScreenshotBlob(blob)
          const reader = new FileReader()
          reader.onload = () => setScreenshotPreview(typeof reader.result === 'string' ? reader.result : null)
          reader.readAsDataURL(blob)
          e.preventDefault()
          return
        }
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [active])

  const closeOverlay = useCallback(() => {
    if (!runId) return
    try { sessionStorage.removeItem(SS_KEY) } catch { /* ignore */ }
    const params = new URLSearchParams(search?.toString() ?? '')
    params.delete('qa_run')
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`)
  }, [runId, pathname, search, router])

  const handleSubmit = useCallback(async () => {
    if (!verdict || !runId) return
    setSubmitting(true)
    setSubmitError(null)

    let screenshotPath: string | undefined
    if (screenshotBlob) {
      const ext = screenshotBlob.type.includes('png') ? 'png' : screenshotBlob.type.includes('jpeg') ? 'jpg' : 'png'
      const path = `qa-runs/${runId}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('recordings')
        .upload(path, screenshotBlob, { contentType: screenshotBlob.type, upsert: true })
      if (upErr) {
        setSubmitError(`Screenshot upload failed: ${upErr.message}`)
        setSubmitting(false)
        return
      }
      screenshotPath = path
    }

    try {
      const res = await fetch(`/api/qa/runs/${runId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          result: verdict,
          starRating: stars > 0 ? stars : undefined,
          notes: notes.trim() || undefined,
          screenshotUrl: screenshotPath,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setSubmitError(j.error || 'Submit failed')
        setSubmitting(false)
        return
      }
      setSubmitted(true)
      setSubmitting(false)
      setTimeout(() => {
        try { sessionStorage.removeItem(SS_KEY) } catch { /* ignore */ }
        router.push('/command')
      }, 1200)
    } catch {
      setSubmitError('Network error')
      setSubmitting(false)
    }
  }, [verdict, runId, stars, notes, screenshotBlob, router, supabase])

  if (!active) return null
  if (submitted) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5" />
        <span className="font-semibold">Thanks — logged. Day +1 streak.</span>
      </div>
    )
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-[9999] bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-lg shadow-2xl shadow-violet-500/40 flex items-center gap-2 transition-all"
      >
        <Beaker className="w-4 h-4" />
        <span className="font-semibold text-[13px]">QA Run Active</span>
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    )
  }

  return (
    <div className="fixed top-0 right-0 bottom-0 z-[9999] w-full sm:w-[400px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col text-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gradient-to-r from-violet-600/20 to-blue-600/20">
        <div className="w-8 h-8 rounded-md bg-violet-500/30 border border-violet-500/40 flex items-center justify-center">
          <Beaker className="w-4 h-4 text-violet-200" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-violet-300 font-bold">QA Run</p>
          <p className="text-[12px] font-semibold text-white truncate">{theCase?.title || 'Loading…'}</p>
        </div>
        <button onClick={() => setCollapsed(true)} className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center">
          <Minimize2 className="w-3.5 h-3.5 text-white/60" />
        </button>
        <button onClick={closeOverlay} className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center">
          <X className="w-3.5 h-3.5 text-white/60" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!theCase ? (
          <div className="flex items-center justify-center h-32 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">Plan</p>
              <p className="text-[12px] text-white/80">{theCase.plan_name}</p>
            </div>

            {theCase.instructions && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">Instructions</p>
                <p className="text-[13px] text-white/90 whitespace-pre-line leading-relaxed">{theCase.instructions}</p>
              </div>
            )}

            {theCase.expected_result && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">Expected result</p>
                <p className="text-[13px] text-white/90 whitespace-pre-line leading-relaxed">{theCase.expected_result}</p>
              </div>
            )}

            {theCase.page_url && pathname !== theCase.page_url && (
              <button
                onClick={() => {
                  const sep = theCase.page_url!.includes('?') ? '&' : '?'
                  router.push(`${theCase.page_url}${sep}qa_run=${runId}`)
                }}
                className="w-full py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[12px] text-white/80 flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Jump to {theCase.page_url}
              </button>
            )}

            <div className="border-t border-white/10 pt-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">Verdict</p>
              <div className="grid grid-cols-3 gap-2">
                {(['pass', 'fail', 'blocked'] as const).map((v) => {
                  const meta = {
                    pass:    { Icon: CheckCircle2, label: 'Pass',    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25', sel: 'bg-emerald-500 text-white border-emerald-400' },
                    fail:    { Icon: XCircle,      label: 'Fail',    cls: 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25',                 sel: 'bg-red-500 text-white border-red-400' },
                    blocked: { Icon: Ban,          label: 'Blocked', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25',         sel: 'bg-amber-500 text-white border-amber-400' },
                  }[v]
                  const isSel = verdict === v
                  return (
                    <button
                      key={v}
                      onClick={() => setVerdict(v)}
                      className={`py-2.5 rounded-md border text-[12px] font-semibold flex flex-col items-center gap-1 transition-all ${isSel ? meta.sel : meta.cls}`}
                    >
                      <meta.Icon className="w-4 h-4" />
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">How did this feel?</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setStars(stars === n ? 0 : n)}
                    className={`w-7 h-7 rounded ${n <= stars ? 'text-amber-400' : 'text-white/20 hover:text-white/40'} transition-all`}
                    aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  >
                    <Star className="w-5 h-5" fill={n <= stars ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">Notes (anything broken or confusing?)</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 4000))}
                rows={4}
                placeholder="Optional. Paste a screenshot directly into this panel."
                className="w-full bg-white/5 border border-white/10 rounded-md p-2.5 text-[12px] text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-violet-500/50"
              />
            </div>

            {screenshotPreview && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold flex items-center gap-1">
                    <Camera className="w-3 h-3" /> Screenshot attached
                  </p>
                  <button
                    onClick={() => { setScreenshotPreview(null); setScreenshotBlob(null) }}
                    className="text-[10px] text-white/40 hover:text-white/80"
                  >
                    Remove
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshotPreview} alt="Pasted screenshot" className="w-full rounded-md border border-white/10" />
              </div>
            )}

            {!screenshotPreview && (
              <p className="text-[11px] text-white/40 italic">
                Tip: paste a screenshot directly here (Cmd/Ctrl+V).
              </p>
            )}

            {submitError && (
              <div className="rounded-md bg-red-500/15 border border-red-500/30 px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-red-300">{submitError}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-white/10 p-3 bg-black/20">
        <button
          onClick={handleSubmit}
          disabled={!verdict || submitting || !theCase}
          className="w-full h-10 rounded-md bg-violet-500 hover:bg-violet-400 text-white font-semibold text-[13px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Submit run
        </button>
      </div>
    </div>
  )
}
