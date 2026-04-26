import { describe, it, expect } from 'vitest'
import { MICROGRID_CONTRACTOR } from '@/lib/planset-types'

describe('MICROGRID_CONTRACTOR phone', () => {
  it('uses the live 832 number, not the dead 888 number', () => {
    expect(MICROGRID_CONTRACTOR.phone).toBe('(832) 280-7764')
  })
  it('is in proper formatted (XXX) XXX-XXXX shape', () => {
    expect(MICROGRID_CONTRACTOR.phone).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/)
  })
})
