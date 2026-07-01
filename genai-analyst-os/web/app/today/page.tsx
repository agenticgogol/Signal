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

const MINUTE_OPTIONS = [10, 15, 20, 30]

export default function TodayPage() {
  const { session, user, loading } = useAuthSession()
  const userId = user?.id ?? ''

  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [targetMinutes, setTargetMinutes] = useState(15)
  const [queueLoading, setQueueLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [savingMinutes, setSavingMinutes] = useState(false)

  const authHeaders = (): Record<string, string> =>
    session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}

  const fetchQueue = async () => {
    if (!userId) return
    setQueueLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/today/queue?userId=${encodeURIComponent(userId)}`, { headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not load today\'s queue')
      setEntries(json.entries ?? [])
      setTargetMinutes(json.targetMinutes ?? 15)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setQueueLoading(false)
  }

  useEffect(() => {
    if (!loading) fetchQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.access_token, userId])

  const refreshQueue = async () => {
    setRefreshing(true)
    setError(null)
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
      setError(e instanceof Error ? e.message : String(e))
    }
    setRefreshing(false)
  }

  const setStatus = async (queueItemId: string, status: 'read' | 'skipped') => {
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
      setError(e instanceof Error ? e.message : String(e))
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
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingMinutes(false)
    }
  }

  const openItem = (entry: QueueEntry) => {
    if (entry.url) window.open(entry.url, '_blank', 'noopener,noreferrer')
    if (entry.status === 'unread') setStatus(entry.id, 'read')
  }

  const minutesDone = entries.filter(e => e.status === 'read').reduce((sum, e) => sum + e.estMinutes, 0)
  const minutesTotal = entries.reduce((sum, e) => sum + e.estMinutes, 0)
  const pendingEntries = entries.filter(e => e.status === 'unread')
  const doneEntries = entries.filter(e => e.status !== 'unread')
  const progressPct = minutesTotal > 0 ? Math.min(100, Math.round((minutesDone / minutesTotal) * 100)) : 0
  const allDone = entries.length > 0 && pendingEntries.length === 0

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 pb-24">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">📋 Today</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Your daily reading, blended from Feed and Reading List — ranked so you can get through it in about {targetMinutes} minutes.</p>
        </div>
        <button onClick={refreshQueue} disabled={refreshing || queueLoading}
          className="text-xs text-violet-600 dark:text-violet-400 px-3 py-1.5 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition-colors font-medium disabled:opacity-50 shrink-0">
          {refreshing ? 'Refreshing…' : '↺ Refresh'}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-zinc-400">Daily target:</span>
        {MINUTE_OPTIONS.map(m => (
          <button key={m} onClick={() => changeTargetMinutes(m)} disabled={savingMinutes}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              targetMinutes === m ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'}`}>
            {m}m
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Progress */}
      {entries.length > 0 && (
        <div className="mb-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            <span>{minutesDone.toFixed(0)} / {minutesTotal.toFixed(0)} min</span>
            <span>{doneEntries.length} / {entries.length} items</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full bg-violet-600 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          {allDone && (
            <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">✅ All done for today — nice work.</p>
          )}
        </div>
      )}

      {queueLoading ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />)}</div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing queued yet — add sources to your <Link href="/feed" className="text-violet-600 dark:text-violet-400 hover:underline">Feed</Link> or <Link href="/knowledge" className="text-violet-600 dark:text-violet-400 hover:underline">Reading List</Link>, then refresh.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pendingEntries.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
              <button onClick={() => setStatus(entry.id, 'read')} disabled={actioningId === entry.id}
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
              <button onClick={() => setStatus(entry.id, 'skipped')} disabled={actioningId === entry.id}
                className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">Skip</button>
            </div>
          ))}

          {doneEntries.length > 0 && (
            <div className="pt-4">
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
    </div>
  )
}
