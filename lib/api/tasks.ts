import { db } from '@/lib/db'

export async function upsertTaskState(record: {
  project_id: string
  task_id: string
  status: string
  reason?: string | null
  completed_date?: string | null
  started_date?: string
  follow_up_date?: string | null
  notes?: string | null
}) {
  const { error } = await db().from('task_state').upsert(record, { onConflict: 'project_id,task_id' })
  if (error) console.error('task_state upsert failed:', error)
  return { error }
}

export async function loadTaskHistory(projectIds: string[], options?: { limit?: number; statusFilter?: string[] }) {
  let query = db().from('task_history')
    .select('project_id, task_id, status, reason, changed_by, changed_at')
    .in('project_id', projectIds)
    .order('changed_at', { ascending: false })
    .limit(options?.limit ?? 50)

  if (options?.statusFilter) {
    query = query.in('status', options.statusFilter)
  }

  const { data, error } = await query
  if (error) console.error('task_history load failed:', error)
  return { data: data ?? [], error }
}

export async function insertTaskHistory(record: {
  project_id: string
  task_id: string
  status: string
  reason?: string | null
  changed_by?: string
}) {
  const { error } = await db().from('task_history').insert(record)
  if (error) console.error('task_history insert failed:', error)
  return { error }
}

export async function loadProjectAdders(projectId: string) {
  const { data, error } = await db().from('project_adders')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) console.error('adders load failed:', error)
  return { data: data ?? [], error }
}

export async function addProjectAdder(adder: {
  project_id: string
  adder_name: string
  price: number
  quantity: number
  total_amount: number
}) {
  const { error } = await db().from('project_adders').insert(adder)
  if (error) console.error('adder insert failed:', error)
  return { error }
}

export async function deleteProjectAdder(adderId: string) {
  const { error } = await db().from('project_adders').delete().eq('id', adderId)
  if (error) console.error('adder delete failed:', error)
  return { error }
}
