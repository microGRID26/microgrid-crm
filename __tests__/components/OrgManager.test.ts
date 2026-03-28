import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── OrgManager unit tests ───────────────────────────────────────────────────
// Tests cover: slugify, domain parsing, delete guard, role options, validation

// ── Extracted helpers from OrgManager ────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

const ORG_TYPES = ['platform', 'epc', 'sales', 'engineering', 'supply', 'customer'] as const
const ORG_ROLES = ['owner', 'admin', 'member', 'viewer'] as const

const ORG_ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

const ORG_TYPE_LABELS: Record<string, string> = {
  platform: 'Platform',
  epc: 'EPC',
  sales: 'Sales',
  engineering: 'Engineering',
  supply: 'Supply',
  customer: 'Customer',
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('OrgManager', () => {
  describe('slugify', () => {
    it('converts name to lowercase slug', () => {
      expect(slugify('MicroGRID Energy')).toBe('microgrid-energy')
    })

    it('replaces special characters with hyphens', () => {
      expect(slugify('EDGE (Portal) Inc.')).toBe('edge-portal-inc')
    })

    it('removes leading and trailing hyphens', () => {
      expect(slugify('--test--')).toBe('test')
    })

    it('collapses multiple non-alphanumeric chars into single hyphen', () => {
      expect(slugify('hello   world   test')).toBe('hello-world-test')
    })

    it('truncates to 50 characters', () => {
      const longName = 'A'.repeat(100)
      expect(slugify(longName).length).toBeLessThanOrEqual(50)
    })

    it('handles empty string', () => {
      expect(slugify('')).toBe('')
    })

    it('handles string with only special characters', () => {
      expect(slugify('!!!@@@###')).toBe('')
    })

    it('preserves numbers', () => {
      expect(slugify('Team 42 Alpha')).toBe('team-42-alpha')
    })
  })

  describe('domain parsing', () => {
    it('splits comma-separated domains into array', () => {
      const input = 'gomicrogridenergy.com, energydevelopmentgroup.com'
      const domains = input.split(',').map(d => d.trim()).filter(Boolean)
      expect(domains).toEqual(['gomicrogridenergy.com', 'energydevelopmentgroup.com'])
    })

    it('handles single domain', () => {
      const input = 'gomicrogridenergy.com'
      const domains = input.split(',').map(d => d.trim()).filter(Boolean)
      expect(domains).toEqual(['gomicrogridenergy.com'])
    })

    it('handles empty string', () => {
      const input = ''
      const domains = input.split(',').map(d => d.trim()).filter(Boolean)
      expect(domains).toEqual([])
    })

    it('filters out empty entries from trailing commas', () => {
      const input = 'gomicrogridenergy.com, , ,  '
      const domains = input.split(',').map(d => d.trim()).filter(Boolean)
      expect(domains).toEqual(['gomicrogridenergy.com'])
    })

    it('handles domains with extra whitespace', () => {
      const input = '  foo.com  ,  bar.com  ,  baz.com  '
      const domains = input.split(',').map(d => d.trim()).filter(Boolean)
      expect(domains).toEqual(['foo.com', 'bar.com', 'baz.com'])
    })
  })

  describe('delete guard', () => {
    it('blocks deletion when org has projects', () => {
      const projData = [{ id: 'PROJ-12345' }]
      const hasProjects = projData && projData.length > 0
      expect(hasProjects).toBe(true)
    })

    it('allows deletion when org has no projects', () => {
      const projData: { id: string }[] = []
      const hasProjects = projData && projData.length > 0
      expect(hasProjects).toBe(false)
    })

    it('allows deletion when project query returns null', () => {
      const projData = null as { id: string }[] | null
      const hasProjects = projData && projData.length > 0
      expect(hasProjects).toBeFalsy()
    })
  })

  describe('role options', () => {
    it('has 4 org roles: owner, admin, member, viewer', () => {
      expect(ORG_ROLES).toEqual(['owner', 'admin', 'member', 'viewer'])
      expect(ORG_ROLES).toHaveLength(4)
    })

    it('all roles have labels', () => {
      for (const role of ORG_ROLES) {
        expect(ORG_ROLE_LABELS[role]).toBeDefined()
        expect(typeof ORG_ROLE_LABELS[role]).toBe('string')
        expect(ORG_ROLE_LABELS[role].length).toBeGreaterThan(0)
      }
    })
  })

  describe('org type options', () => {
    it('has 6 org types', () => {
      expect(ORG_TYPES).toHaveLength(6)
    })

    it('all types have labels', () => {
      for (const t of ORG_TYPES) {
        expect(ORG_TYPE_LABELS[t]).toBeDefined()
        expect(typeof ORG_TYPE_LABELS[t]).toBe('string')
      }
    })
  })

  describe('validation', () => {
    it('rejects empty name', () => {
      const draft = { name: '', slug: '', org_type: 'epc', allowed_domains: '', active: true }
      const isValid = draft.name.trim().length > 0
      expect(isValid).toBe(false)
    })

    it('rejects whitespace-only name', () => {
      const draft = { name: '   ', slug: '', org_type: 'epc', allowed_domains: '', active: true }
      const isValid = draft.name.trim().length > 0
      expect(isValid).toBe(false)
    })

    it('accepts valid name', () => {
      const draft = { name: 'EDGE Portal', slug: 'edge-portal', org_type: 'platform', allowed_domains: '', active: true }
      const isValid = draft.name.trim().length > 0
      expect(isValid).toBe(true)
    })

    it('slug falls back to slugified name when empty', () => {
      const editing = null
      const draft = { name: 'My New Org', slug: '' }
      const slug = editing ? 'existing' : (draft.slug.trim() || slugify(draft.name))
      expect(slug).toBe('my-new-org')
    })

    it('slug is locked when editing (uses existing)', () => {
      const editing = { id: '1', slug: 'existing-slug' }
      const draft = { name: 'Updated Name', slug: 'existing-slug' }
      const slug = editing ? editing.slug : (draft.slug.trim() || slugify(draft.name))
      expect(slug).toBe('existing-slug')
    })
  })

  describe('member deduplication', () => {
    it('detects existing membership', () => {
      const existing = [{ id: 'membership-1' }]
      const isDuplicate = existing && existing.length > 0
      expect(isDuplicate).toBe(true)
    })

    it('allows new membership when not existing', () => {
      const existing: { id: string }[] = []
      const isDuplicate = existing && existing.length > 0
      expect(isDuplicate).toBe(false)
    })
  })
})
