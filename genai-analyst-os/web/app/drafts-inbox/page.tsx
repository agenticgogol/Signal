'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuthSession } from '@/lib/useAuthSession'

interface DraftItem {
  id: string
  topic: string
  format: string
  final_content: string
  source_title: string | null
  source_url: string | null
  status: 'pending' | 'approved' | 'dismissed'
  created_at: string
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const hrs = Math.floor(diff / 3600000)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  } catch { return '' }
}

export default function DraftsInboxPage() {
  const { session, user, loading } = useAuthSession()
  const userId = user?.id ?? ''

  const [items, setItems] = useState<DraftItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const authHeaders = (): Record<string, string> =>
    session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}

  const fetchItems = async () => {
    if (!userId) return
    setItemsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/drafts-inbox/items?userId=${encodeURIComponent(userId)}`, { headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not load Drafts Inbox')
      setItems(json.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setItemsLoading(false)
  }

  useEffect(() => {
    if (!loading) fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.access_token, userId])

  const review = async (itemId: string, action: 'approve' | 'dismiss') => {
    setActioning(itemId)
    try {
      const res = await fetch('/api/drafts-inbox/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId, itemId, action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not update this draft')
      setItems(prev => prev.map(item => item.id === itemId ? { ...item, status: json.status } : item))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setActioning(null)
  }

  const copyContent = (item: DraftItem) => {
    navigator.clipboard?.writeText(item.final_content)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const pending = items.filter(i => i.status === 'pending')
  const reviewed = items.filter(i => i.status !== 'pending')

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 pb-24">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">📥 Drafts Inbox</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Autonomous drafts from what you engaged with most. Nothing here ever publishes on its own.</p>
        </div>
        <Link href="/settings" className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">⚙️ Toggle in Settings →</Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {itemsLoading ? (
        <div className="space-y-3">{[0, 1].map(i => <div key={i} className="h-40 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />)}</div>
      ) : pending.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No pending drafts. If Drafts Inbox is on in Settings, check back tomorrow — it drafts at most one post a day from what you engaged with most.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(item => (
            <div key={item.id} className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10 p-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">{item.format} · {formatRelativeTime(item.created_at)}</p>
                  {item.source_title && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Inspired by:{' '}
                      {item.source_url ? <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline text-zinc-500">{item.source_title}</a> : item.source_title}
                    </p>
                  )}
                </div>
              </div>
              <textarea readOnly value={item.final_content} rows={10}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-3 text-sm resize-y focus:outline-none" />
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => review(item.id, 'approve')} disabled={actioning === item.id}
                  className="rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-2 text-sm font-bold text-white transition-colors">
                  ✅ Approve
                </button>
                <button onClick={() => copyContent(item)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  {copiedId === item.id ? '✓ Copied' : '📋 Copy'}
                </button>
                <button onClick={() => review(item.id, 'dismiss')} disabled={actioning === item.id}
                  className="ml-auto rounded-xl px-4 py-2 text-sm font-medium text-zinc-400 hover:text-red-600 dark:hover:text-red-400">
                  🗑 Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-3">Reviewed</p>
          <div className="space-y-2">
            {reviewed.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-2.5">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{item.topic}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${item.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
