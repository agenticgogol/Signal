'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuthSession } from '@/lib/useAuthSession'
import { AdminGateModal, getAdminToken } from '@/components/AdminGate'

// Single shared engine behind both the Feed page's "Ask Signal" tab and the
// standalone Memory Assistant page. Previously these were two independent
// hand-rolled implementations hitting the same /api/knowledge/recall and
// /api/memory/history endpoints, with different gating, different history
// panels, and no awareness of each other — a question asked in one place
// didn't visibly connect to the other even though they shared a backend.
// Now there's exactly one implementation, used in two layouts:
//   - variant="compact": embedded in the Feed tab for in-flow quick recall
//   - variant="full": the dedicated Memory Assistant page for deep search

interface RecallAnswer {
  answer: string
  citations: { title: string; url: string }[]
  feedMatches: number
  knowledgeMatches: number
}

interface ChatHistoryItem {
  id: string
  question: string
  answerSummary: string
  citations: { title: string; url: string }[]
  scope: string
  createdAt: string
}

interface ArticleHistoryItem {
  articleId: string
  title: string
  url: string
  eventType: string
  publishedAt: string | null
  seenAt: string
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

export default function AskSignalPanel({
  variant = 'full',
  suggestedQuestions = [],
  crossLink,
  externalQuestion,
}: {
  variant?: 'compact' | 'full'
  suggestedQuestions?: string[]
  crossLink?: { href: string; label: string }
  // Lets a parent page (e.g. Today's "💬 Ask about this" on a reading/
  // publishing item) trigger a question from outside without needing to
  // navigate here first. `nonce` must change on every trigger (even for a
  // repeated question) since effects only re-fire on a changed dependency.
  externalQuestion?: { text: string; nonce: number } | null
}) {
  const { session, user } = useAuthSession()
  const userId = user?.id ?? process.env.NEXT_PUBLIC_USER_ID ?? ''

  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [answer, setAnswer] = useState<RecallAnswer | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  const [articleHistory, setArticleHistory] = useState<ArticleHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showChatHistory, setShowChatHistory] = useState(false)
  const [showArticleHistory, setShowArticleHistory] = useState(false)
  const [showAdminGate, setShowAdminGate] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!session?.access_token || !user?.id) return
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/memory/history?userId=${encodeURIComponent(user.id)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const json = await res.json()
      setChatHistory(json.chatHistory ?? [])
      setArticleHistory(json.articleHistory ?? [])
    } catch {}
    setHistoryLoading(false)
  }, [session?.access_token, user?.id])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const ask = useCallback(async (nextQuestion?: string, adminToken?: string) => {
    const q = (nextQuestion ?? question).trim()
    if (!q || !userId) return
    setQuestion(q)
    setLoading(true)
    setError(null)
    setUpgradeRequired(false)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const token = adminToken || getAdminToken()
      if (!session?.access_token && token) headers['x-admin-token'] = token
      const res = await fetch('/api/knowledge/recall', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, question: q }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.upgrade_required) setUpgradeRequired(true)
        throw new Error(json.error ?? 'Could not answer that question')
      }
      setAnswer(json)
      fetchHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setAnswer(null)
    }
    setLoading(false)
  }, [question, session?.access_token, userId, fetchHistory])

  const requestAsk = (nextQuestion?: string) => {
    if (session?.access_token || getAdminToken()) {
      ask(nextQuestion)
      return
    }
    setQuestion(nextQuestion ?? question)
    setShowAdminGate(true)
  }

  useEffect(() => {
    if (externalQuestion?.text) requestAsk(externalQuestion.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuestion?.nonce])

  const compact = variant === 'compact'

  return (
    <div>
      {showAdminGate && (
        <AdminGateModal
          action="ask Signal a recall question"
          onSuccess={token => { setShowAdminGate(false); ask(question, token) }}
          onCancel={() => setShowAdminGate(false)}
        />
      )}

      {/* Search box */}
      <div className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 ${compact ? 'mb-5' : 'mb-6'}`}>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') requestAsk() }}
            placeholder="What was that agent reliability concept I saw last week?"
            className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={() => requestAsk()}
            disabled={loading || !question.trim()}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
          >
            {loading ? 'Searching…' : 'Ask'}
          </button>
        </div>

        {suggestedQuestions.length > 0 && !answer && (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestedQuestions.map(sample => (
              <button
                key={sample}
                onClick={() => requestAsk(sample)}
                className="rounded-full border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:border-violet-300 dark:hover:border-violet-700"
              >
                {sample}
              </button>
            ))}
          </div>
        )}

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

        {answer && (
          <div className="mt-5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-4">
            <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{answer.answer}</p>
            <p className="mt-3 text-[11px] text-zinc-400">Searched: {answer.feedMatches} feed articles · {answer.knowledgeMatches} knowledge items</p>
            {answer.citations.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {answer.citations.slice(0, 6).map((citation, idx) => (
                  <a key={`${citation.url}-${idx}`} href={citation.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-violet-600 dark:text-violet-400 hover:underline border border-violet-200 dark:border-violet-800 rounded-lg px-2 py-1">
                    {citation.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prior questions — shared across both surfaces, so a question asked
          on the Feed tab shows up here and vice versa. Collapsed by default
          so this panel doesn't dominate pages (like Today) where it's one
          of several sections competing for space. */}
      {!historyLoading && chatHistory.length > 0 && (
        <div className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${compact ? 'mb-5' : 'mb-6'} ${showChatHistory ? 'p-5' : 'px-5 py-3'}`}>
          <button onClick={() => setShowChatHistory(v => !v)} className="w-full flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">Recent questions ({chatHistory.length})</p>
            <span className="text-xs text-zinc-400">{showChatHistory ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showChatHistory && (
          <div className="space-y-2 mt-3">
            {chatHistory.slice(0, compact ? 8 : 12).map(item => (
              <button
                key={item.id}
                onClick={() => requestAsk(item.question)}
                className="w-full text-left rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 hover:border-violet-300 dark:hover:border-violet-700 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">{item.question}</p>
                  <span className="text-[10px] text-zinc-400 shrink-0 mt-0.5">{formatRelativeTime(item.createdAt)}</span>
                </div>
                {item.answerSummary && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{item.answerSummary}</p>
                )}
              </button>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Reading history — "you saw this before" — also collapsed by default */}
      {!historyLoading && articleHistory.length > 0 && (
        <div className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${compact ? 'mb-5' : 'mb-6'} ${showArticleHistory ? 'p-5' : 'px-5 py-3'}`}>
          <button onClick={() => setShowArticleHistory(v => !v)} className="w-full flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Your reading history ({articleHistory.length})</p>
            <span className="text-xs text-zinc-400">{showArticleHistory ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showArticleHistory && (
          <div className="space-y-2 mt-3">
            {articleHistory.slice(0, compact ? 10 : 14).map(item => (
              <a
                key={item.articleId}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
              >
                <span className="mt-0.5 text-base leading-none shrink-0">
                  {item.eventType === 'pin' ? '📌' : item.eventType === 'like' ? '👍' : '📖'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug">{item.title}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    You {item.eventType === 'pin' ? 'pinned' : item.eventType === 'like' ? 'liked' : 'opened'} this · {formatRelativeTime(item.seenAt)}
                  </p>
                </div>
              </a>
            ))}
          </div>
          )}
        </div>
      )}

      {crossLink && (
        <a href={crossLink.href} className="inline-flex items-center text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">
          {crossLink.label}
        </a>
      )}
    </div>
  )
}
