'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuthSession } from '@/lib/useAuthSession'
import { AdminGateModal, getAdminToken } from '@/components/AdminGate'

interface ConceptExplanation {
  term: string
  whatItIs: string
  whyItMatters: string
  howItWorks: string
  codeSnippet: string | null
  useCases: string[]
}

interface GroundedMatch {
  type: 'feed' | 'knowledge'
  title: string
  url: string
}

interface HistoryItem {
  id: string
  term: string
  grounded_titles: string[]
  created_at: string
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  } catch { return '' }
}

// The shared engine behind both the inline "click a term while reading"
// slide-over and the standalone AI Tutor Hub page — one lookup pipeline,
// two presentations, same as Ask Signal's compact/full pattern.
export default function TutorPanel({
  variant = 'full',
  initialTerm,
  sourceRef,
  onClose,
}: {
  variant?: 'compact' | 'full'
  initialTerm?: string
  sourceRef?: { articleId?: string; knowledgeItemId?: string }
  onClose?: () => void
}) {
  const { session, user } = useAuthSession()
  const userId = user?.id ?? process.env.NEXT_PUBLIC_USER_ID ?? ''

  const [term, setTerm] = useState(initialTerm ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [explanation, setExplanation] = useState<ConceptExplanation | null>(null)
  const [grounding, setGrounding] = useState<GroundedMatch[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showAdminGate, setShowAdminGate] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!userId) return
    try {
      const headers: Record<string, string> = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const token = getAdminToken()
      if (!session?.access_token && token) headers['x-admin-token'] = token
      const res = await fetch(`/api/tutor/history?userId=${encodeURIComponent(userId)}`, { headers })
      if (!res.ok) return
      const json = await res.json()
      setHistory(json.history ?? [])
    } catch {}
  }, [session?.access_token, userId])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const lookup = useCallback(async (nextTerm?: string, adminToken?: string) => {
    const q = (nextTerm ?? term).trim()
    if (!q || !userId) return
    setTerm(q)
    setLoading(true)
    setError(null)
    setUpgradeRequired(false)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const token = adminToken || getAdminToken()
      if (!session?.access_token && token) headers['x-admin-token'] = token
      const res = await fetch('/api/tutor/explain', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, term: q, ...sourceRef }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.upgrade_required) setUpgradeRequired(true)
        throw new Error(json.error ?? 'Could not explain that concept')
      }
      setExplanation(json.explanation)
      setGrounding(json.grounding ?? [])
      fetchHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setExplanation(null)
    }
    setLoading(false)
  }, [term, session?.access_token, userId, sourceRef, fetchHistory])

  const requestLookup = (nextTerm?: string) => {
    if (session?.access_token || getAdminToken()) {
      lookup(nextTerm)
      return
    }
    setTerm(nextTerm ?? term)
    setShowAdminGate(true)
  }

  useEffect(() => {
    if (initialTerm) requestLookup(initialTerm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTerm])

  const compact = variant === 'compact'

  return (
    <div>
      {showAdminGate && (
        <AdminGateModal
          action="use the AI Tutor"
          onSuccess={token => { setShowAdminGate(false); lookup(term, token) }}
          onCancel={() => setShowAdminGate(false)}
        />
      )}

      <div className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 ${compact ? 'mb-5' : 'mb-6'}`}>
        {onClose && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">🎓 AI Tutor</p>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xl leading-none">×</button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={term}
            onChange={e => setTerm(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') requestLookup() }}
            placeholder="Any AI concept or term — e.g. 'LoRA fine-tuning', 'attention mechanism'"
            className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={() => requestLookup()}
            disabled={loading || !term.trim()}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
          >
            {loading ? 'Explaining…' : 'Explain'}
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-red-600 dark:text-red-400">
            <span>{error}</span>
            {upgradeRequired && (
              <a href="/settings" className="shrink-0 rounded-lg border border-red-200 dark:border-red-800 px-2.5 py-1 font-semibold hover:bg-red-50 dark:hover:bg-red-950/30">
                Set up in Settings →
              </a>
            )}
          </div>
        )}

        {loading && (
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map(i => <div key={i} className="h-4 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />)}
          </div>
        )}

        {explanation && !loading && (
          <div className="mt-5 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 capitalize">{explanation.term}</h3>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500 dark:text-violet-400 mb-1">What it is</p>
              <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{explanation.whatItIs}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500 dark:text-violet-400 mb-1">Why it matters</p>
              <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{explanation.whyItMatters}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500 dark:text-violet-400 mb-1">How it works</p>
              <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{explanation.howItWorks}</p>
            </div>
            {explanation.codeSnippet && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500 dark:text-violet-400 mb-1">Example</p>
                <pre className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-3.5 text-xs overflow-x-auto"><code>{explanation.codeSnippet}</code></pre>
              </div>
            )}
            {explanation.useCases.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500 dark:text-violet-400 mb-1">Use cases</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {explanation.useCases.map((uc, i) => <li key={i}>{uc}</li>)}
                </ul>
              </div>
            )}

            {grounding.length > 0 && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">📚 Backed by your library</p>
                <div className="space-y-1.5">
                  {grounding.map((g, i) => (
                    g.url
                      ? <a key={i} href={g.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-emerald-700 dark:text-emerald-300 hover:underline">{g.type === 'feed' ? '📰' : '📖'} {g.title}</a>
                      : <p key={i} className="text-xs text-emerald-700 dark:text-emerald-300">{g.type === 'feed' ? '📰' : '📖'} {g.title}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!compact && history.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <button onClick={() => setShowHistory(v => !v)} className="w-full flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">Recent lookups ({history.length})</p>
            <span className="text-xs text-zinc-400">{showHistory ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showHistory && (
            <div className="mt-3 space-y-1.5">
              {history.map(h => (
                <button key={h.id} onClick={() => requestLookup(h.term)}
                  className="w-full text-left flex items-center justify-between gap-2 rounded-xl border border-zinc-100 dark:border-zinc-800 px-3 py-2 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 capitalize">{h.term}</span>
                  <span className="text-[10px] text-zinc-400 shrink-0">{formatRelativeTime(h.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
