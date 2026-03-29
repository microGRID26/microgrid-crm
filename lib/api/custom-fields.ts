// lib/api/custom-fields.ts — Custom field definitions and values data access layer
import { db } from '@/lib/db'

// ── Types ───────────────────────────────────────────────────────────────────

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'url'

export interface CustomFieldDefinition {
  id: string
  field_name: string
  label: string
  field_type: CustomFieldType
  options: string[] | null
  required: boolean
  default_value: string | null
  section: string
  sort_order: number
  active: boolean
  created_at: string
}

export interface CustomFieldValue {
  id: string
  project_id: string
  field_id: string
  value: string | null
  updated_at: string
}

export const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'url', label: 'URL' },
]

// ── Definitions ─────────────────────────────────────────────────────────────

/**
 * Load all custom field definitions, optionally filtering to active only.
 */
export async function loadFieldDefinitions(activeOnly?: boolean): Promise<CustomFieldDefinition[]> {
  const supabase = db()
  let q = supabase.from('custom_field_definitions').select('*').order('sort_order').order('created_at').limit(500)
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) console.error('[loadFieldDefinitions]', error.message)
  return (data ?? []) as CustomFieldDefinition[]
}

/**
 * Create a new custom field definition (admin only).
 */
export async function addFieldDefinition(def: Omit<CustomFieldDefinition, 'id' | 'created_at'>): Promise<CustomFieldDefinition | null> {
  const supabase = db()
  const { data, error } = await supabase.from('custom_field_definitions').insert(def).select().single()
  if (error) {
    console.error('[addFieldDefinition]', error.message)
    return null
  }
  return data as CustomFieldDefinition
}

/**
 * Update a custom field definition (admin only).
 */
export async function updateFieldDefinition(id: string, updates: Partial<CustomFieldDefinition>): Promise<boolean> {
  const supabase = db()
  const { error } = await supabase.from('custom_field_definitions').update(updates).eq('id', id)
  if (error) {
    console.error('[updateFieldDefinition]', error.message)
    return false
  }
  return true
}

/**
 * Delete a custom field definition (admin only). Cascades to values.
 */
export async function deleteFieldDefinition(id: string): Promise<boolean> {
  const supabase = db()
  const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id)
  if (error) {
    console.error('[deleteFieldDefinition]', error.message)
    return false
  }
  return true
}

// ── Values ──────────────────────────────────────────────────────────────────

/**
 * Load custom field values for a project.
 */
export async function loadProjectCustomFields(projectId: string): Promise<CustomFieldValue[]> {
  const supabase = db()
  const { data, error } = await supabase.from('custom_field_values').select('*').eq('project_id', projectId).limit(500)
  if (error) console.error('[loadProjectCustomFields]', error.message)
  return (data ?? []) as CustomFieldValue[]
}

/**
 * Upsert a custom field value for a project.
 */
export async function saveProjectCustomField(projectId: string, fieldId: string, value: string | null): Promise<boolean> {
  const supabase = db()
  const { error } = await supabase.from('custom_field_values').upsert(
    { project_id: projectId, field_id: fieldId, value, updated_at: new Date().toISOString() },
    { onConflict: 'project_id,field_id' }
  )
  if (error) {
    console.error('[saveProjectCustomField]', error.message)
    return false
  }
  return true
}

/**
 * Load all values for a specific field definition (for reporting).
 */
export async function loadAllCustomFieldValues(fieldId: string): Promise<CustomFieldValue[]> {
  const supabase = db()
  const { data, error } = await supabase.from('custom_field_values').select('*').eq('field_id', fieldId).limit(2000)
  if (error) console.error('[loadAllCustomFieldValues]', error.message)
  return (data ?? []) as CustomFieldValue[]
}
