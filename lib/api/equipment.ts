// lib/api/equipment.ts — Equipment catalog data access
import { db } from '@/lib/db'
import { escapeIlike } from '@/lib/utils'

export interface Equipment {
  id: string
  name: string
  manufacturer: string | null
  model: string | null
  category: string
  watts: number | null
  description: string | null
  active: boolean
  sort_order: number
  created_at?: string
}

export type EquipmentCategory = 'module' | 'inverter' | 'battery' | 'optimizer' | 'racking' | 'electrical' | 'adder' | 'other'

export const EQUIPMENT_CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: 'module', label: 'Module' },
  { value: 'inverter', label: 'Inverter' },
  { value: 'battery', label: 'Battery' },
  { value: 'optimizer', label: 'Optimizer' },
  { value: 'racking', label: 'Racking' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'adder', label: 'Adder' },
  { value: 'other', label: 'Other' },
]

/**
 * Load all equipment items, optionally filtered by category.
 */
export async function loadEquipment(category?: string): Promise<Equipment[]> {
  const supabase = db()
  let q = supabase.from('equipment').select('*').eq('active', true).order('sort_order').order('name')
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) console.error('[loadEquipment]', error.message)
  return (data ?? []) as Equipment[]
}

/**
 * Search equipment by name, optionally filtered by category.
 * Uses ilike for partial matching.
 */
export async function searchEquipment(query: string, category?: string): Promise<Equipment[]> {
  const supabase = db()
  let q = supabase
    .from('equipment')
    .select('*')
    .eq('active', true)
    .ilike('name', `%${escapeIlike(query)}%`)
    .order('sort_order')
    .order('name')
    .limit(20)
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) console.error('[searchEquipment]', error.message)
  return (data ?? []) as Equipment[]
}

/**
 * Load all equipment (including inactive) for admin management.
 */
export async function loadAllEquipment(): Promise<Equipment[]> {
  const supabase = db()
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .order('category')
    .order('sort_order')
    .order('name')
  if (error) console.error('[loadAllEquipment]', error.message)
  return (data ?? []) as Equipment[]
}
