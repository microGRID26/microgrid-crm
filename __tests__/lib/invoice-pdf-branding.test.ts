// __tests__/lib/invoice-pdf-branding.test.ts — Pure-function tests for PDF branding helpers
//
// Phase 1.4 of the multi-tenant invoicing chain refactored lib/invoices/pdf.tsx
// to render per-org branding chrome (color, font, tagline, footer contact)
// pulled from organizations.settings.brand at render time. This file tests the
// pure helpers: resolveBrandTheme + shouldRenderAttestation.
//
// The full PDF render (renderInvoicePDF) hits @react-pdf/renderer's Node-only
// path and is integration-tested separately via the send route smoke test.

import { describe, it, expect } from 'vitest'

import {
  DEFAULT_BRAND_THEME,
  resolveBrandTheme,
  shouldRenderAttestation,
  EPC_ATTESTATION_TEXT,
} from '@/lib/invoices/pdf'
import type { Organization } from '@/types/database'

function buildOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'Test Org',
    slug: 'test-org',
    org_type: 'epc',
    allowed_domains: [],
    logo_url: null,
    settings: {},
    active: true,
    billing_email: null,
    billing_address: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('resolveBrandTheme', () => {
  it('returns the MicroGRID default when settings.brand is missing', () => {
    const theme = resolveBrandTheme(buildOrg({ settings: {} }))
    expect(theme).toEqual(DEFAULT_BRAND_THEME)
  })

  it('returns the default when settings is null', () => {
    const theme = resolveBrandTheme(buildOrg({ settings: null as unknown as Record<string, unknown> }))
    expect(theme).toEqual(DEFAULT_BRAND_THEME)
  })

  it('uses overrides from settings.brand when present', () => {
    const theme = resolveBrandTheme(
      buildOrg({
        settings: {
          brand: {
            primary_color: '#1a3a5c',
            secondary_color: '#0f1f33',
            font: 'Helvetica',
            tagline: 'Equipment Supply & Distribution',
          },
        },
      }),
    )
    expect(theme.primary_color).toBe('#1a3a5c')
    expect(theme.secondary_color).toBe('#0f1f33')
    expect(theme.tagline).toBe('Equipment Supply & Distribution')
    expect(theme.font).toBe('Helvetica')
  })

  it('falls back to default for missing individual brand fields', () => {
    const theme = resolveBrandTheme(
      buildOrg({
        settings: {
          brand: {
            primary_color: '#1a3a5c',
            // no secondary_color, no font, no tagline
          },
        },
      }),
    )
    expect(theme.primary_color).toBe('#1a3a5c')
    expect(theme.secondary_color).toBe(DEFAULT_BRAND_THEME.secondary_color)
    expect(theme.font).toBe(DEFAULT_BRAND_THEME.font)
    expect(theme.tagline).toBe(DEFAULT_BRAND_THEME.tagline)
  })

  it('ignores non-string brand field types defensively', () => {
    const theme = resolveBrandTheme(
      buildOrg({
        settings: {
          brand: {
            primary_color: 12345 as unknown as string, // invalid type
            font: ['Helvetica'] as unknown as string, // invalid type
          },
        },
      }),
    )
    expect(theme.primary_color).toBe(DEFAULT_BRAND_THEME.primary_color)
    expect(theme.font).toBe(DEFAULT_BRAND_THEME.font)
  })
})

describe('shouldRenderAttestation', () => {
  it('returns true for epc → platform (the full EPC → EDGE invoice)', () => {
    expect(
      shouldRenderAttestation(
        buildOrg({ org_type: 'epc' }),
        buildOrg({ org_type: 'platform' }),
      ),
    ).toBe(true)
  })

  it('returns false for newco_distribution → epc (no attestation needed)', () => {
    expect(
      shouldRenderAttestation(
        buildOrg({ org_type: 'newco_distribution' }),
        buildOrg({ org_type: 'epc' }),
      ),
    ).toBe(false)
  })

  it('returns false for direct_supply_equity_corp → newco_distribution', () => {
    expect(
      shouldRenderAttestation(
        buildOrg({ org_type: 'direct_supply_equity_corp' }),
        buildOrg({ org_type: 'newco_distribution' }),
      ),
    ).toBe(false)
  })

  it('returns false for engineering → epc (Rush invoices)', () => {
    expect(
      shouldRenderAttestation(
        buildOrg({ org_type: 'engineering' }),
        buildOrg({ org_type: 'epc' }),
      ),
    ).toBe(false)
  })

  it('returns false for sales → epc (MG sales commission)', () => {
    expect(
      shouldRenderAttestation(
        buildOrg({ org_type: 'sales' }),
        buildOrg({ org_type: 'epc' }),
      ),
    ).toBe(false)
  })

  it('returns false for platform → epc (reverse direction)', () => {
    expect(
      shouldRenderAttestation(
        buildOrg({ org_type: 'platform' }),
        buildOrg({ org_type: 'epc' }),
      ),
    ).toBe(false)
  })
})

describe('EPC_ATTESTATION_TEXT', () => {
  it('contains the exact certification language from Mark Bench 2026-04-13 meeting', () => {
    // Mark provided this verbatim in the meeting; tests pin the language so a
    // future reword has to update the test (and force a re-review).
    expect(EPC_ATTESTATION_TEXT).toContain('EPC certifies')
    expect(EPC_ATTESTATION_TEXT).toContain('internal allocations')
    expect(EPC_ATTESTATION_TEXT).toContain('originating, engineering, procuring, constructing, commissioning')
    expect(EPC_ATTESTATION_TEXT).toContain('completed project invoice to EDGE')
  })

  it('is non-empty and reasonably long for a legal certification', () => {
    expect(EPC_ATTESTATION_TEXT.length).toBeGreaterThan(100)
  })
})
