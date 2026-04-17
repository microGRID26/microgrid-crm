import { describe, it, expect } from 'vitest'
import { isValidTransition } from '@/app/api/warranty/[id]/route'

describe('workmanship_claim state machine', () => {
  it('allows pending → deployed | voided', () => {
    expect(isValidTransition('pending', 'deployed')).toBe(true)
    expect(isValidTransition('pending', 'voided')).toBe(true)
  })

  it('blocks pending → invoiced (must deploy first)', () => {
    expect(isValidTransition('pending', 'invoiced')).toBe(false)
    expect(isValidTransition('pending', 'recovered')).toBe(false)
  })

  it('allows deployed → invoiced | voided', () => {
    expect(isValidTransition('deployed', 'invoiced')).toBe(true)
    expect(isValidTransition('deployed', 'voided')).toBe(true)
  })

  it('blocks deployed → pending (no backward steps)', () => {
    expect(isValidTransition('deployed', 'pending')).toBe(false)
  })

  it('allows invoiced → recovered | voided', () => {
    expect(isValidTransition('invoiced', 'recovered')).toBe(true)
    expect(isValidTransition('invoiced', 'voided')).toBe(true)
  })

  it('blocks invoiced → deployed (no backward steps)', () => {
    expect(isValidTransition('invoiced', 'deployed')).toBe(false)
    expect(isValidTransition('invoiced', 'pending')).toBe(false)
  })

  it('terminal states reject every outgoing transition except self', () => {
    expect(isValidTransition('recovered', 'recovered')).toBe(true)
    expect(isValidTransition('voided', 'voided')).toBe(true)

    for (const next of ['pending', 'deployed', 'invoiced', 'voided']) {
      if (next !== 'voided') {
        expect(isValidTransition('recovered', next)).toBe(false)
      }
    }
    for (const next of ['pending', 'deployed', 'invoiced', 'recovered']) {
      if (next !== 'recovered') {
        expect(isValidTransition('voided', next)).toBe(false)
      }
    }
  })

  it('allows same-state (idempotent save) for every status', () => {
    for (const s of ['pending', 'deployed', 'invoiced', 'recovered', 'voided']) {
      expect(isValidTransition(s, s)).toBe(true)
    }
  })

  it('rejects unknown from-state', () => {
    expect(isValidTransition('nonsense', 'pending')).toBe(false)
  })
})
