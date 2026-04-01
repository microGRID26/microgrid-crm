'use client'

import { useState, useEffect, useRef } from 'react'
import { db } from '@/lib/db'
import { INTERNAL_DOMAINS } from '@/lib/utils'

interface MentionNoteInputProps {
  onSubmit: (text: string) => void
  placeholder?: string
  projectId: string
  currentUserName: string
  /** Render as a compact single-line input (for task notes) vs multi-line textarea (for project notes) */
  compact?: boolean
  /** Show saving state on the submit button */
  saving?: boolean
}

/**
 * Shared @mention autocomplete input.
 * Detects @ in text, shows autocomplete dropdown of users, inserts mention,
 * and creates mention_notification records on submit.
 */
export function MentionNoteInput({
  onSubmit,
  placeholder = 'Add a note... Type @ to mention someone',
  projectId,
  currentUserName,
  compact = false,
  saving = false,
}: MentionNoteInputProps) {
  const [value, setValue] = useState('')
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIdx, setMentionIdx] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => {
    db().from('users').select('id, name').eq('active', true)
      .or(INTERNAL_DOMAINS.map(d => `email.like.%@${d}`).join(','))
      .order('name')
      .then(({ data }: any) => { if (data) setUsers(data) })
  }, [])

  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = mentionQuery
    ? users.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : users

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const val = e.target.value
    setValue(val)

    const cursor = e.target.selectionStart ?? val.length
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@([\w\s]*)$/)

    if (atMatch && !atMatch[1].includes('\n')) {
      setShowMentions(true)
      setMentionQuery(atMatch[1].trim())
      setMentionIdx(0)
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (userName: string) => {
    const cursor = inputRef.current?.selectionStart ?? value.length
    const textBefore = value.slice(0, cursor)
    const textAfter = value.slice(cursor)
    const atPos = textBefore.lastIndexOf('@')
    const newText = textBefore.slice(0, atPos) + `@${userName} ` + textAfter
    setValue(newText)
    setShowMentions(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSubmit = async () => {
    const text = value.trim()
    if (!text) return

    // Extract @mentions and create notifications
    const mentions = text.match(/@[A-Z][a-z]+ [A-Z][a-z]+/g)
    if (mentions) {
      const write = db()
      const { data: allUsers } = await write.from('users').select('id, name').eq('active', true)
      if (allUsers) {
        for (const mention of mentions) {
          const name = mention.slice(1).trim()
          const user = (allUsers as { id: string; name: string }[]).find(
            u => u.name.toLowerCase() === name.toLowerCase()
          )
          if (user) {
            const { error: mentionErr } = await write.from('mention_notifications').insert({
              project_id: projectId || 'TICKET',
              mentioned_user_id: user.id,
              mentioned_by: currentUserName || 'Unknown',
              message: text.slice(0, 200),
            })
            if (mentionErr) console.error('mention notification failed:', mentionErr)
          }
        }
      }
    }

    // Trigger notification bell refresh if mentions were created
    if (mentions && mentions.length > 0) {
      window.dispatchEvent(new Event('notifications:refresh'))
    }

    onSubmit(text)
    setValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, filtered.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filtered[mentionIdx].name) }
      else if (e.key === 'Escape') { setShowMentions(false) }
    } else if (compact && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    } else if (!compact && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  const dropdown = showMentions && filtered.length > 0 && (
    <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto w-56">
      {filtered.map((u, i) => (
        <button key={u.id}
          onClick={() => insertMention(u.name)}
          className={`w-full text-left px-3 py-2 text-xs transition-colors ${i === mentionIdx ? 'bg-green-900/50 text-green-300' : 'text-gray-300 hover:bg-gray-700'}`}>
          @{u.name}
        </button>
      ))}
    </div>
  )

  if (compact) {
    return (
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-700 text-gray-200 text-[11px] rounded px-2 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-green-500/50"
            placeholder={placeholder}
          />
          {dropdown}
        </div>
        <button onClick={handleSubmit} disabled={!value.trim()} className="text-[10px] bg-green-900 text-green-400 px-2 py-1 rounded hover:bg-green-800 transition-colors disabled:opacity-30">Add</button>
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-gray-800 text-white text-sm rounded-lg p-3 border border-gray-700 focus:border-green-500 focus:outline-none resize-none placeholder-gray-500"
        />
        {dropdown}
      </div>
      <div className="flex justify-end mt-2">
        <button onClick={handleSubmit} disabled={saving || !value.trim()}
          className="text-xs px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white rounded-lg transition-colors">
          {saving ? 'Saving...' : 'Add Note'}
        </button>
      </div>
    </div>
  )
}
