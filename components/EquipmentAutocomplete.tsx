'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { searchEquipment } from '@/lib/api/equipment'
import type { Equipment } from '@/lib/api/equipment'

interface EquipmentAutocompleteProps {
  category: 'module' | 'inverter' | 'battery' | 'optimizer'
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function EquipmentAutocomplete({ category, value, onChange, placeholder, disabled }: EquipmentAutocompleteProps) {
  const [query, setQuery] = useState(value ?? '')
  const [results, setResults] = useState<Equipment[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Sync external value changes
  useEffect(() => {
    setQuery(value ?? '')
  }, [value])

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([])
      setOpen(false)
      return
    }
    const items = await searchEquipment(q, category)
    setResults(items)
    setOpen(items.length > 0)
    setActiveIndex(-1)
  }, [category])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    onChange(v)
    // Debounced search
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v), 200)
  }

  const handleSelect = (item: Equipment) => {
    setQuery(item.name)
    onChange(item.name)
    setOpen(false)
    setResults([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(results[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Click outside closes dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (query.trim().length >= 1 && results.length > 0) setOpen(true) }}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:border-green-500 focus:outline-none"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-xl max-h-48 overflow-y-auto">
          {results.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors ${
                idx === activeIndex
                  ? 'bg-green-700/40 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span className="truncate">{item.name}</span>
              {item.watts && (
                <span className="text-gray-500 text-[10px] flex-shrink-0">{item.watts}W</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
