import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db'

export async function loadProjectNotes(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase.from('notes')
    .select('*')
    .eq('project_id', projectId)
    .is('task_id', null)
    .order('time', { ascending: false })
    .limit(2000)
  if (error) console.error('notes load failed:', error)
  return { data: data ?? [], error }
}

export async function loadTaskNotes(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase.from('notes')
    .select('id, task_id, text, time, pm')
    .eq('project_id', projectId)
    .not('task_id', 'is', null)
    .order('time', { ascending: true })
    .limit(5000)
  if (error) console.error('task notes load failed:', error)
  return { data: data ?? [], error }
}

export async function addNote(note: {
  project_id: string
  text: string
  time: string
  pm: string | null
  pm_id?: string | null
  task_id?: string | null
}) {
  const { data, error } = await db().from('notes').insert(note).select('id, task_id, text, time, pm').single()
  if (error) console.error('note insert failed:', error)
  return { data, error }
}

export async function deleteNote(noteId: string) {
  const { error } = await db().from('notes').delete().eq('id', noteId)
  if (error) console.error('note delete failed:', error)
  return { error }
}

export async function createMentionNotification(mention: {
  project_id: string
  mentioned_user_id: string
  mentioned_by: string
  message: string
}) {
  const { error } = await db().from('mention_notifications').insert(mention)
  if (error) console.error('mention notification failed:', error)
  return { error }
}
