// __tests__/lib/invoice-chain.test.ts — Pure-function tests for the chain orchestrator
//
// Phase 1 of the multi-tenant invoicing chain (Tier 2) introduces lib/invoices/chain.ts
// which (a) decides whether to apply Texas sales tax to a given chain rule, and
// (b) walks the rule graph + computes per-link totals. The DB-touching parts of
// the orchestrator (generateProjectChain) require a live Supabase client, so this
// test file covers only the pure helpers — the orchestrator itself is exercised
// by the next-phase integration tests.

import { describe, it, expect } from 'vitest'

import { TX_SALES_TAX_RATE, shouldApplySalesTax, CHAIN_MILESTONE } from '@/lib/invoices/chain'
import type { InvoiceRule } from '@/types/database'

function buildRule(from: string, to: string, name = 'test rule'): InvoiceRule {
  return {
    id: `rule-${from}-${to}`,
    name,
    milestone: 'chain',
    from_org_type: from,
    to_org_type: to,
    line_items: [{ description: 'test', unit_price: 100, category: 'test' }],
    active: true,
    rule_kind: 'chain',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('shouldApplySalesTax', () => {
  it('returns true ONLY for EPC → platform invoices', () => {
    expect(shouldApplySalesTax(buildRule('epc', 'platform'))).toBe(true)
  })

  it('returns false for DSE → NewCo (resale-exempt)', () => {
    expect(shouldApplySalesTax(buildRule('direct_supply_equity_corp', 'newco_distribution'))).toBe(false)
  })

  it('returns false for NewCo → EPC (resale-exempt with 0.5% markup)', () => {
    expect(shouldApplySalesTax(buildRule('newco_distribution', 'epc'))).toBe(false)
  })

  it('returns false for Rush Engineering → EPC (services)', () => {
    expect(shouldApplySalesTax(buildRule('engineering', 'epc'))).toBe(false)
  })

  it('returns false for MicroGRID Sales → EPC (commission)', () => {
    expect(shouldApplySalesTax(buildRule('sales', 'epc'))).toBe(false)
  })

  it('returns false for platform → epc (reverse direction does not match)', () => {
    expect(shouldApplySalesTax(buildRule('platform', 'epc'))).toBe(false)
  })

  it('returns false for epc → epc (same-org, never charged)', () => {
    expect(shouldApplySalesTax(buildRule('epc', 'epc'))).toBe(false)
  })

  it('returns false for customer → platform (B2C, not in chain)', () => {
    expect(shouldApplySalesTax(buildRule('customer', 'platform'))).toBe(false)
  })
})

describe('TX_SALES_TAX_RATE', () => {
  it('is exactly 8.25% per Mark Bench 2026-04-13 meeting', () => {
    expect(TX_SALES_TAX_RATE).toBe(0.0825)
  })

  it('computes the expected tax amount for the proforma sample subtotal', () => {
    // From proforma row 32: TX Sales Tax on row 33 subtotal = 32,292.35
    // (rounded). Implies pre-tax subtotal of ~$391,422.42.
    // We verify the rate produces ~8.25% of that.
    const subtotal = 391_422.42
    const tax = Math.round(subtotal * TX_SALES_TAX_RATE * 100) / 100
    expect(tax).toBeCloseTo(32_292.35, 0)
  })
})

describe('CHAIN_MILESTONE constant', () => {
  it('is the magic value used by every chain rule', () => {
    expect(CHAIN_MILESTONE).toBe('chain')
  })
})
