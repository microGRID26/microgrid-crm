'use client'

import { useState, useMemo, useCallback } from 'react'
import { escapeIlike } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for which dropdowns to extract from the data */
interface DropdownConfig {
  /**
   * Map of dropdown name -> field spec.
   * Field spec can be:
   *   - 'fieldName' — extracts unique values from that field
   *   - 'idField|labelField' — extracts unique id|label pairs (e.g., 'pm_id|pm')
   */
  [dropdownName: string]: string
}

interface UseServerFilterOptions {
  /** Fields to search against when building or() expression */
  searchFields?: string[]
  /** Dropdown extraction config */
  extractDropdowns?: DropdownConfig
  /** Static filters that are always applied (e.g., disposition exclusions) */
  staticFilters?: QueryFilters
}

interface DropdownItem {
  value: string
  label: string
}

interface FilterState {
  [key: string]: string
}

/** Filter object compatible with useSupabaseQuery */
interface QueryFilters {
  [field: string]: { eq: string } | { not_in: (string | number)[] } | { ilike: string }
}

interface UseServerFilterResult {
  /** Current filter values (keyed by filter name) */
  filterValues: FilterState
  /** Set a specific filter value */
  setFilter: (name: string, value: string) => void
  /** Current search text */
  search: string
  /** Set search text */
  setSearch: (value: string) => void
  /** Extracted dropdown options */
  dropdowns: Record<string, DropdownItem[]>
  /** Build query filters for useSupabaseQuery */
  buildQueryFilters: () => QueryFilters
  /** Build or() expression for search */
  buildSearchOr: () => string | undefined
  /** Props to spread on a search input */
  searchProps: {
    value: string
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder: string
  }
  /** Reset all filters to defaults */
  resetFilters: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useServerFilter<T extends object>(
  data: T[],
  options: UseServerFilterOptions = {}
): UseServerFilterResult {
  const { searchFields = [], extractDropdowns = {}, staticFilters = {} } = options

  const [filterValues, setFilterValues] = useState<FilterState>({})
  const [search, setSearch] = useState('')

  // Set individual filter
  const setFilter = useCallback((name: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [name]: value }))
  }, [])

  // Extract dropdown options from data
  const dropdowns = useMemo(() => {
    const result: Record<string, DropdownItem[]> = {}

    for (const [name, fieldSpec] of Object.entries(extractDropdowns)) {
      if (fieldSpec.includes('|')) {
        // Paired field: 'pm_id|pm' -> extract unique id/label pairs
        const [idField, labelField] = fieldSpec.split('|')
        const map = new Map<string, string>()
        for (const row of data) {
          const r = row as Record<string, unknown>
          const id = r[idField]
          const label = r[labelField]
          if (id != null && label != null && typeof id === 'string' && typeof label === 'string') {
            map.set(id, label)
          }
        }
        result[name] = [...map.entries()]
          .map(([value, label]) => ({ value, label }))
          .sort((a, b) => a.label.localeCompare(b.label))
      } else {
        // Single field: extract unique non-null values
        const values = new Set<string>()
        for (const row of data) {
          const val = (row as Record<string, unknown>)[fieldSpec]
          if (val != null && typeof val === 'string') {
            values.add(val)
          }
        }
        result[name] = [...values]
          .sort()
          .map(v => ({ value: v, label: v }))
      }
    }

    return result
  }, [data, extractDropdowns])

  // Build filter object for useSupabaseQuery (merges static + dynamic filters)
  const buildQueryFilters = useCallback((): QueryFilters => {
    const result: QueryFilters = { ...staticFilters }

    for (const [name, value] of Object.entries(filterValues)) {
      if (!value || value === 'all') continue

      // Find the matching dropdown config to get the actual field name
      const fieldSpec = extractDropdowns[name]
      if (fieldSpec) {
        const field = fieldSpec.includes('|') ? fieldSpec.split('|')[0] : fieldSpec
        result[field] = { eq: value }
      } else {
        // Direct field name
        result[name] = { eq: value }
      }
    }

    return result
  }, [filterValues, extractDropdowns, staticFilters])

  // Build or() search expression
  const buildSearchOr = useCallback((): string | undefined => {
    const q = search.trim()
    if (!q || searchFields.length === 0) return undefined

    const escaped = escapeIlike(q)
    return searchFields
      .map(field => `${field}.ilike.%${escaped}%`)
      .join(',')
  }, [search, searchFields])

  // Search input props
  const searchProps = useMemo(() => ({
    value: search,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
    placeholder: 'Search...',
  }), [search])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilterValues({})
    setSearch('')
  }, [])

  return {
    filterValues,
    setFilter,
    search,
    setSearch,
    dropdowns,
    buildQueryFilters,
    buildSearchOr,
    searchProps,
    resetFilters,
  }
}
