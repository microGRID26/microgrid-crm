import { db } from '@/lib/db'

// ── Change order data access ─────────────────────────────────────────────────

/** Load all change orders with project join */
export async function loadChangeOrders(limit = 2000) {
  // Uses db() because the select includes a join (project:projects) which requires untyped query
  const { data, error } = await db().from('change_orders')
    .select('*, project:projects(name, city, pm, pm_id)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) console.error('change_orders load failed:', error)
  return { data: data ?? [], error }
}
