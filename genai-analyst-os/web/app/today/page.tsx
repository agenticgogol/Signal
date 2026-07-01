'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuthSession } from '@/lib/useAuthSession'

interface QueueEntry {
  id: string
  itemType: 'feed' | 'reading_list'
  title: string
  url: string | null
  sourceLabel: string
  estMinutes: number
  score: number
  status: 'unread' | 'read' | 'skipped'
  rank: number
}

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

const MINUTE_OPTIONS = [10, 15, 20, 30]

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const hrs = Math.floor(diff / 3600000)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  } catch { return '' }
}

// The two daily jobs — "what to read" and "what to review & publish" —
// live on one landing page so a signed-in user needs zero navigation
// decisions to do either. Everything else (Feed, News, Reading List,
// Ideas, Create) is one click away below, for whoever has time to go deeper.
export default function TodayPage() {
  const { session, user, loading } = useAuthSession()
  const userId = user?.id ?? ''

  const authHeaders = (): Record<string, string> =>
    session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}

  // ── Reading queue ────────────────────────────────────────────────────
  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [targetMinutes, setTargetMinutes] = useState(15)
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [savingMinutes, setSavingMinutes] = useState(false)

  const fetchQueue = async () => {
    if (!userId) return
    setQueueLoading(true)
    setQueueError(null)
    try {
      const res = await fetch(`/api/today/queue?userId=${encodeURIComponent(userId)}`, { headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not load today\'s queue')
      setEntries(json.entries ?? [])
      setTargetMinutes(json.targetMinutes ?? 15)
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : String(e))
    }
    setQueueLoading(false)
  }

  const refreshQueue = async () => {
    setRefreshing(true)
    setQueueError(null)
    try {
      const res = await fetch('/api/today/queue/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not refresh the queue')
      setEntries(json.entries ?? [])
      setTargetMinutes(json.targetMinutes ?? 15)
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : String(e))
    }
    setRefreshing(false)
  }

  const setQueueStatus = async (queueItemId: string, status: 'read' | 'skipped') => {
    setActioningId(queueItemId)
    try {
      const res = await fetch('/api/today/queue/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId, queueItemId, status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not update this item')
      setEntries(prev => prev.map(e => e.id === queueItemId ? { ...e, status } : e))
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : String(e))
    }
    setActioningId(null)
  }

  const changeTargetMinutes = async (minutes: number) => {
    if (minutes === targetMinutes) return
    setSavingMinutes(true)
    try {
      const res = await fetch('/api/data/reading-minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId, minutes }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save your target')
      setTargetMinutes(minutes)
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingMinutes(false)
    }
  }

  const openItem = (entry: QueueEntry) => {
    if (entry.url) window.open(entry.url, '_blank', 'noopener,noreferrer')
    if (entry.status === 'unread') setQueueStatus(entry.id, 'read')
  }

  // ── Drafts (Share Your Voice) ────────────────────────────────────────
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [draftsLoading, setDraftsLoading] = useState(true)
  const [draftsError, setDraftsError] = useState<string | null>(null)
  const [draftActioning, setDraftActioning] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [draftFormatFilter, setDraftFormatFilter] = useState<string>('all')

  const fetchDrafts = async () => {
    if (!userId) return
    setDraftsLoading(true)
    setDraftsError(null)
    try {
      const res = await fetch(`/api/drafts-inbox/items?userId=${encodeURIComponent(userId)}`, { headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not load Drafts Inbox')
      setDrafts(json.items ?? [])
    } catch (e) {
      setDraftsError(e instanceof Error ? e.message : String(e))
    }
    setDraftsLoading(false)
  }

  const reviewDraft = async (itemId: string, action: 'approve' | 'dismiss') => {
    setDraftActioning(itemId)
    try {
      const res = await fetch('/api/drafts-inbox/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId, itemId, action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not update this draft')
      setDrafts(prev => prev.map(item => item.id === itemId ? { ...item, status: json.status } : item))
    } catch (e) {
      setDraftsError(e instanceof Error ? e.message : String(e))
    }
    setDraftActioning(null)
  }

  const copyDraft = (draft: DraftItem) => {
    navigator.clipboard?.writeText(draft.final_content)
    setCopiedId(draft.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  useEffect(() => {
    if (!loading) { fetchQueue(); fetchDrafts() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.access_token, userId])

  const minutesDone = entries.filter(e => e.status === 'read').reduce((sum, e) => sum + e.estMinutes, 0)
  const minutesTotal = entries.reduce((sum, e) => sum + e.estMinutes, 0)
  const pendingEntries = entries.filter(e => e.status === 'unread')
  const doneEntries = entries.filter(e => e.status !== 'unread')
  const progressPct = minutesTotal > 0 ? Math.min(100, Math.round((minutesDone / minutesTotal) * 100)) : 0
  const allDone = entries.length > 0 && pendingEntries.length === 0
  const pendingDrafts = drafts.filter(d => d.status === 'pending')
  const draftFormats = Array.from(new Set(drafts.map(d => d.format)))
  const filteredPendingDrafts = draftFormatFilter === 'all' ? pendingDrafts : pendingDrafts.filter(d => d.format === draftFormatFilter)

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">👋 Today</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Two jobs: read what matters, review what's ready to publish. Everything else is one click away below.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 mb-10">
      {/* ══ JOB 1: What to read ═══════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">📋 What to read today</h2>
          <button onClick={refreshQueue} disabled={refreshing || queueLoading}
            className="text-xs text-violet-600 dark:text-violet-400 px-3 py-1.5 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition-colors font-medium disabled:opacity-50 shrink-0">
            {refreshing ? 'Refreshing…' : '↺ Refresh'}
          </button>
        </div>
        <p className="text-xs text-zinc-400 mb-3">Blended from Feed and Reading List — about {targetMinutes} minutes.</p>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-zinc-400">Daily target:</span>
          {MINUTE_OPTIONS.map(m => (
            <button key={m} onClick={() => changeTargetMinutes(m)} disabled={savingMinutes}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                targetMinutes === m ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'}`}>
              {m}m
            </button>
          ))}
        </div>

        {queueError && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{queueError}</p>}

        {entries.length > 0 && (
          <div className="mb-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              <span>{minutesDone.toFixed(0)} / {minutesTotal.toFixed(0)} min</span>
              <span>{doneEntries.length} / {entries.length} items</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full bg-violet-600 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            {allDone && <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">✅ All done for today — nice work.</p>}
          </div>
        )}

        {queueLoading ? (
          <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />)}</div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing queued yet — add sources to your <Link href="/feed" className="text-violet-600 dark:text-violet-400 hover:underline">Feed</Link> or <Link href="/knowledge" className="text-violet-600 dark:text-violet-400 hover:underline">Reading List</Link>, then refresh.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingEntries.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
                <button onClick={() => setQueueStatus(entry.id, 'read')} disabled={actioningId === entry.id}
                  className="shrink-0 w-6 h-6 rounded-full border-2 border-zinc-300 dark:border-zinc-600 hover:border-violet-500 transition-colors" title="Mark as read" />
                <button onClick={() => openItem(entry)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2 py-0.5 rounded-full shrink-0">
                      {entry.itemType === 'feed' ? '📰' : '📖'} {entry.sourceLabel}
                    </span>
                    <span className="text-xs text-zinc-400 shrink-0">~{entry.estMinutes.toFixed(0)} min</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{entry.title}</p>
                </button>
                <button onClick={() => setQueueStatus(entry.id, 'skipped')} disabled={actioningId === entry.id}
                  className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">Skip</button>
              </div>
            ))}

            {doneEntries.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-2">Done today</p>
                <div className="space-y-1.5">
                  {doneEntries.map(entry => (
                    <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-2.5 opacity-60">
                      <span className="shrink-0 text-sm">{entry.status === 'read' ? '✅' : '⏭️'}</span>
                      <p className="flex-1 min-w-0 text-sm text-zinc-500 dark:text-zinc-400 truncate line-through">{entry.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══ JOB 2: What to review & publish ═════════════════════════════ */}
      <section>
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">🗣️ Share your voice</h2>
        <p className="text-xs text-zinc-400 mb-3">Auto-drafted from what you've been reading. Nothing publishes without your approval. Opt in or out, and choose the target platform, in <Link href="/settings" className="text-violet-600 dark:text-violet-400 hover:underline">Settings</Link>.</p>

        {draftFormats.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <button onClick={() => setDraftFormatFilter('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${draftFormatFilter === 'all' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'}`}>
              All
            </button>
            {draftFormats.map(format => (
              <button key={format} onClick={() => setDraftFormatFilter(format)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${draftFormatFilter === format ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'}`}>
                {format}
              </button>
            ))}
          </div>
        )}

        {draftsError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{draftsError}</p>}

        {draftsLoading ? (
          <div className="h-32 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        ) : filteredPendingDrafts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No pending drafts. If Drafts Inbox is on in Settings, check back tomorrow — it drafts at most one post a day from what you engaged with most.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPendingDrafts.map(draft => (
              <div key={draft.id} className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10 p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">{draft.format} · {formatRelativeTime(draft.created_at)}</p>
                    {draft.source_title && (
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Inspired by:{' '}
                        {draft.source_url ? <a href={draft.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline text-zinc-500">{draft.source_title}</a> : draft.source_title}
                      </p>
                    )}
                  </div>
                </div>
                <textarea readOnly value={draft.final_content} rows={8}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-3 text-sm resize-y focus:outline-none" />
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => reviewDraft(draft.id, 'approve')} disabled={draftActioning === draft.id}
                    className="rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-2 text-sm font-bold text-white transition-colors">✅ Approve</button>
                  <button onClick={() => copyDraft(draft)}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    {copiedId === draft.id ? '✓ Copied' : '📋 Copy'}
                  </button>
                  <button onClick={() => reviewDraft(draft.id, 'dismiss')} disabled={draftActioning === draft.id}
                    className="ml-auto rounded-xl px-4 py-2 text-sm font-medium text-zinc-400 hover:text-red-600 dark:hover:text-red-400">🗑 Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>

      {/* ══ Explore more ═══════════════════════════════════════════════ */}
      <section>
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-3">Have more time? Go deeper</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Link href="/feed" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">📰 Feed</Link>
          <Link href="/feed?tab=news" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">🌐 News</Link>
          <Link href="/knowledge" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">📖 Reading List</Link>
          <Link href="/ideas" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">💡 Ideas</Link>
        </div>
      </section>
    </div>
  )
}
