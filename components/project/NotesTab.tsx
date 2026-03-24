'use client'

import type { Note } from '@/types/database'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// Detect file references in note text and make them clickable
// Links to Google Drive search scoped to the project folder
const FILE_PATTERN = /(\S+\.(?:pdf|png|jpg|jpeg|gif|dwg|xlsx|xls|csv|doc|docx|zip|heic|mp4|mov))/gi
const INLINE_IMAGE = /^image_\d{4}-\d{2}-\d{2}T/i

function isFileRef(part: string): boolean {
  return /\.\w{2,4}$/.test(part) && /\.(pdf|png|jpg|jpeg|gif|dwg|xlsx|xls|csv|doc|docx|zip|heic|mp4|mov)$/i.test(part)
}

function buildDriveSearchUrl(folderUrl: string, fileName: string): string {
  // Extract folder ID from Google Drive URL
  const match = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (match) {
    const folderId = match[1]
    return `https://drive.google.com/drive/search?q=${encodeURIComponent(fileName)}+in:${folderId}`
  }
  // Fallback: general Drive search
  return `https://drive.google.com/drive/search?q=${encodeURIComponent(fileName)}`
}

const MENTION_PATTERN = /(@[\w\s]+?)(?=\s@|\s|$|[.,;!?])/g

function NoteText({ text, folderUrl }: { text: string; folderUrl: string | null }) {
  // First split by file references
  const fileParts = text.split(FILE_PATTERN)

  return (
    <>
      {fileParts.map((part, i) => {
        if (isFileRef(part) && !INLINE_IMAGE.test(part) && folderUrl) {
          return (
            <a key={i} href={buildDriveSearchUrl(folderUrl, part)} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline" title={`Search Google Drive for ${part}`}>
              {part}
            </a>
          )
        }
        // Check for @mentions in this text segment
        const mentionParts = part.split(MENTION_PATTERN)
        if (mentionParts.length === 1) return <React.Fragment key={i}>{part}</React.Fragment>
        return (
          <React.Fragment key={i}>
            {mentionParts.map((mp, j) =>
              mp.startsWith('@') ? (
                <span key={j} className="text-green-400 font-medium">{mp}</span>
              ) : (
                <React.Fragment key={j}>{mp}</React.Fragment>
              )
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}

// @mention autocomplete component
function MentionTextarea({ value, onChange, onSubmit, placeholder }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder: string
}) {
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIdx, setMentionIdx] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const supabase = createClient()
    ;(supabase as any).from('users').select('id, name').eq('active', true).like('email', '%@gomicrogridenergy.com').order('name')
      .then(({ data }: any) => { if (data) setUsers(data) })
  }, [])

  const filtered = mentionQuery
    ? users.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : users

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    onChange(val)

    // Check if we're typing a @mention
    const cursor = e.target.selectionStart
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@(\w*)$/)

    if (atMatch) {
      setShowMentions(true)
      setMentionQuery(atMatch[1])
      setMentionIdx(0)
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (userName: string) => {
    const cursor = textareaRef.current?.selectionStart ?? value.length
    const textBefore = value.slice(0, cursor)
    const textAfter = value.slice(cursor)
    const atPos = textBefore.lastIndexOf('@')
    const newText = textBefore.slice(0, atPos) + `@${userName} ` + textAfter
    onChange(newText)
    setShowMentions(false)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, filtered.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filtered[mentionIdx].name) }
      else if (e.key === 'Escape') { setShowMentions(false) }
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onSubmit()
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-gray-800 text-white text-sm rounded-lg p-3 border border-gray-700 focus:border-green-500 focus:outline-none resize-none placeholder-gray-500"
      />
      {showMentions && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto w-56">
          {filtered.map((u, i) => (
            <button key={u.id}
              onClick={() => insertMention(u.name)}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${i === mentionIdx ? 'bg-green-900/50 text-green-300' : 'text-gray-300 hover:bg-gray-700'}`}>
              @{u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface NotesTabProps {
  notes: Note[]
  newNote: string
  setNewNote: (v: string) => void
  addNote: () => void
  saving: boolean
  folderUrl?: string | null
  projectId?: string
  currentUserName?: string
}

export function NotesTab({ notes, newNote, setNewNote, addNote, saving, folderUrl, projectId, currentUserName }: NotesTabProps) {
  const handleAddNote = async () => {
    // Extract @mentions and create notifications
    const mentions = newNote.match(/@([\w\s]+?)(?=\s@|\s|$|[.,;!?])/g)
    if (mentions && projectId) {
      const supabase = createClient()
      const { data: users } = await (supabase as any).from('users').select('id, name').eq('active', true)
      if (users) {
        for (const mention of mentions) {
          const name = mention.slice(1).trim()
          const user = users.find((u: any) => u.name.toLowerCase() === name.toLowerCase())
          if (user) {
            await (supabase as any).from('mention_notifications').insert({
              project_id: projectId,
              mentioned_user_id: user.id,
              mentioned_by: currentUserName || 'Unknown',
              message: newNote.slice(0, 200),
            })
          }
        }
      }
    }
    addNote()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex-shrink-0">
        <MentionTextarea value={newNote} onChange={setNewNote} onSubmit={handleAddNote}
          placeholder="Add a note… Type @ to mention someone (⌘+Enter to save)" />
        <div className="flex justify-end mt-2">
          <button onClick={handleAddNote} disabled={saving || !newNote.trim()}
            className="text-xs px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white rounded-lg transition-colors">
            {saving ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notes.map(n => (
          <div key={n.id} className="bg-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-green-400">{n.pm}</span>
              <span className="text-xs text-gray-500">
                {n.time ? new Date(n.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
              </span>
            </div>
            <p className="text-xs text-gray-200 whitespace-pre-wrap"><NoteText text={n.text} folderUrl={folderUrl ?? null} /></p>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-xs">No notes yet.</div>
        )}
      </div>
    </div>
  )
}
