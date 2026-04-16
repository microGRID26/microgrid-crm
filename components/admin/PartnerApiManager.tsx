'use client'

// components/admin/PartnerApiManager.tsx — Admin UI for issuing + revoking
// partner API keys. Mounted as the `partner_api` module on /admin.
//
// Surface:
//   - Table of all keys (active + optionally revoked) with org, scopes, tier,
//     last-used, expires, status
//   - "New Key" modal: org dropdown, name, scope checkboxes, presets, tier,
//     PII toggle, DPA version, optional expires_at
//   - On success: show plaintext bearer ONCE with big copy CTA + warning
//   - Revoke button per row → confirm → DELETE

import { useCallback, useEffect, useState } from 'react'
import { db } from '@/lib/db'
import { fmtDate } from '@/lib/utils'
import { Input, Modal, SaveBtn, Textarea, Badge } from './shared'
// Single source of truth — imported from the client-safe constants file so
// server + admin UI can never drift.
import { SCOPES, SCOPE_PRESETS } from '@/lib/partner-api/scope-constants'

interface KeyRow {
  id: string
  org_id: string
  org_name: string | null
  org_slug: string | null
  name: string
  key_prefix: string
  scopes: string[]
  rate_limit_tier: string
  customer_pii_scope: boolean
  dpa_version: string | null
  created_at: string
  last_used_at: string | null
  expires_at: string
  revoked_at: string | null
  revoke_reason: string | null
}

interface OrgOption {
  id: string
  name: string
  slug: string
  org_type: string
}

export function PartnerApiManager() {
  const [keys, setKeys] = useState<KeyRow[]>([])
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(true)
  const [includeRevoked, setIncludeRevoked] = useState(false)
  const [toast, setToast] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [issuedKey, setIssuedKey] = useState<{
    id: string; plaintext: string; prefix: string; expires_at: string
  } | null>(null)

  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  const loadKeys = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/partner-keys?include_revoked=${includeRevoked}`)
    if (!res.ok) {
      flash('Failed to load keys')
      setLoading(false)
      return
    }
    const json = await res.json() as { data: KeyRow[] }
    setKeys(json.data ?? [])
    setLoading(false)
  }, [includeRevoked, flash])

  useEffect(() => {
    void loadKeys()
  }, [loadKeys])

  useEffect(() => {
    async function loadOrgs() {
      const sb = db()
      const { data } = await sb
        .from('organizations')
        .select('id, name, slug, org_type')
        .eq('active', true)
        .order('name')
      if (data) setOrgs(data as OrgOption[])
    }
    void loadOrgs()
  }, [])

  const revoke = async (id: string, name: string) => {
    if (!confirm(`Revoke "${name}"? The partner will lose access immediately.`)) return
    const reason = prompt('Revoke reason (optional):') ?? ''
    const res = await fetch(`/api/admin/partner-keys/${id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (res.ok) {
      flash('Key revoked')
      await loadKeys()
    } else {
      flash('Failed to revoke')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {toast && (
        <div className="fixed bottom-5 right-5 bg-green-700 text-white text-xs px-4 py-2 rounded-md shadow-lg z-[200]">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Partner API Keys</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Issue + revoke keys for external vendors (Rush, Solicit, NewCo, etc.)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={includeRevoked}
              onChange={(e) => setIncludeRevoked(e.target.checked)}
              className="accent-green-500"
            />
            Show revoked
          </label>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-md transition-colors"
          >
            + New Key
          </button>
        </div>
      </div>

      {/* Key list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-gray-500 text-sm py-8 text-center">Loading keys…</div>
        ) : keys.length === 0 ? (
          <div className="text-gray-500 text-sm py-8 text-center">
            No partner keys yet. Click "New Key" to issue one.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-800 text-gray-400 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Name / Org</th>
                <th className="text-left px-3 py-2 font-medium">Prefix</th>
                <th className="text-left px-3 py-2 font-medium">Scopes</th>
                <th className="text-left px-3 py-2 font-medium">Tier</th>
                <th className="text-left px-3 py-2 font-medium">Last Used</th>
                <th className="text-left px-3 py-2 font-medium">Expires</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const isRevoked = !!k.revoked_at
                const isExpired = new Date(k.expires_at) < new Date()
                return (
                  <tr key={k.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-3 py-2">
                      <div className="font-medium text-white">{k.name}</div>
                      <div className="text-gray-500">{k.org_name ?? k.org_slug ?? k.org_id.slice(0, 8)}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-400">{k.key_prefix}…</td>
                    <td className="px-3 py-2 text-gray-400">
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {k.scopes.slice(0, 3).map((s) => (
                          <span key={s} className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px]">{s}</span>
                        ))}
                        {k.scopes.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px]">+{k.scopes.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{k.rate_limit_tier}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {k.last_used_at ? fmtDate(k.last_used_at) : '—'}
                    </td>
                    <td className={`px-3 py-2 ${isExpired ? 'text-red-400' : 'text-gray-500'}`}>
                      {fmtDate(k.expires_at)}
                    </td>
                    <td className="px-3 py-2">
                      {isRevoked ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-900/40 text-red-400 border border-red-800">
                          Revoked
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-900/40 text-amber-400 border border-amber-800">
                          Expired
                        </span>
                      ) : (
                        <Badge active={true} />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!isRevoked && (
                        <button
                          onClick={() => revoke(k.id, k.name)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && (
        <CreateKeyModal
          orgs={orgs}
          onClose={() => setCreateOpen(false)}
          onCreated={(k) => {
            setCreateOpen(false)
            setIssuedKey(k)
            void loadKeys()
          }}
        />
      )}

      {issuedKey && (
        <IssuedKeyModal
          issuedKey={issuedKey}
          onClose={() => setIssuedKey(null)}
          onCopied={() => flash('Copied to clipboard')}
        />
      )}
    </div>
  )
}

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateKeyModal({
  orgs,
  onClose,
  onCreated,
}: {
  orgs: OrgOption[]
  onClose: () => void
  onCreated: (k: { id: string; plaintext: string; prefix: string; expires_at: string }) => void
}) {
  const [orgId, setOrgId] = useState('')
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>([])
  const [tier, setTier] = useState<'standard' | 'premium' | 'unlimited'>('standard')
  const [piiScope, setPiiScope] = useState(false)
  const [dpaVersion, setDpaVersion] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleScope = (s: string) => {
    setScopes((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s])
  }

  const applyPreset = (label: string) => {
    const preset = SCOPE_PRESETS[label]
    if (preset) setScopes([...preset])
  }

  const save = async () => {
    setError('')
    if (!orgId) { setError('Select an org'); return }
    if (!name.trim()) { setError('Name is required'); return }
    if (scopes.length === 0) { setError('At least one scope is required'); return }
    setSaving(true)
    const res = await fetch('/api/admin/partner-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        org_id: orgId,
        name: name.trim(),
        scopes,
        rate_limit_tier: tier,
        customer_pii_scope: piiScope,
        dpa_version: dpaVersion.trim() || null,
        expires_at: expiresAt || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      setError(body.error ?? 'Failed to create key')
      return
    }
    const json = await res.json() as {
      data: { id: string; plaintext: string; prefix: string; expires_at: string }
    }
    onCreated(json.data)
  }

  return (
    <Modal title="Issue new partner API key" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 font-medium">Organization</label>
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
          >
            <option value="">— Select an org —</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name} ({o.org_type})</option>
            ))}
          </select>
        </div>

        <Input label="Key name" value={name} onChange={setName} />

        <div>
          <label className="text-xs text-gray-400 font-medium">Scope presets</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {Object.keys(SCOPE_PRESETS).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className="px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 transition-colors"
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setScopes([])}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-500 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 font-medium">Scopes ({scopes.length} selected)</label>
          <div className="mt-1 grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
            {SCOPES.map((s) => (
              <label key={s} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800/50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={scopes.includes(s)}
                  onChange={() => toggleScope(s)}
                  className="accent-green-500"
                />
                <span className="text-xs font-mono text-gray-300">{s}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 font-medium">Rate limit tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as typeof tier)}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
            >
              <option value="standard">Standard (60 read / 20 write / 5 upload per min)</option>
              <option value="premium">Premium (5× standard)</option>
              <option value="unlimited">Unlimited (no cap)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium">Expires at (optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={piiScope}
            onChange={(e) => setPiiScope(e.target.checked)}
            className="accent-green-500"
          />
          Grant customer-PII scope (phone + email in responses)
        </label>

        <Textarea label="DPA version signed" value={dpaVersion} onChange={setDpaVersion} />

        {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-gray-800 mt-3">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <SaveBtn onClick={save} saving={saving} />
      </div>
    </Modal>
  )
}

// ── Issued-key display modal ──────────────────────────────────────────────────

function IssuedKeyModal({
  issuedKey,
  onClose,
  onCopied,
}: {
  issuedKey: { id: string; plaintext: string; prefix: string; expires_at: string }
  onClose: () => void
  onCopied: () => void
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issuedKey.plaintext)
      onCopied()
    } catch {
      // ignore — the text is visible for manual copy
    }
  }

  return (
    <Modal title="API key issued — copy now" onClose={onClose}>
      <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3 text-xs text-amber-300">
        This is the <strong>only time</strong> the plaintext bearer will be shown. Copy it now and
        store it somewhere safe. If you lose it, you'll have to issue a new key.
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-400 font-medium">Bearer (Authorization header)</label>
        <div className="flex gap-2">
          <code className="flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-xs text-emerald-400 break-all select-all">
            {issuedKey.plaintext}
          </code>
          <button
            onClick={copy}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Send as <code className="bg-gray-800 px-1.5 py-0.5 rounded">Authorization: Bearer {issuedKey.prefix}…</code>
        {' '}Expires {fmtDate(issuedKey.expires_at)}.
      </div>

      <div className="flex justify-end pt-3 border-t border-gray-800 mt-3">
        <button
          onClick={onClose}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-md transition-colors"
        >
          I've copied it
        </button>
      </div>
    </Modal>
  )
}
