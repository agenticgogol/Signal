'use client'

import { useEffect, useState } from 'react'
import { AdminGateModal, getAdminToken } from '@/components/AdminGate'
import { useAuthSession } from '@/lib/useAuthSession'

interface RecallAnswer {
  answer: string
  citations: { title: string; url: string }[]
  feedMatches: number
  knowledgeMatches: number
}

interface KnowledgeNotebook {
  id: string
  title: string
}

interface FeedItemPreview {
  blend_score: number
  feed_date: string
  articles: {
    id: string
    title: string
    url: string
    why_it_matters?: string
  } | {
    id: string
    title: string
    url: string
    why_it_matters?: string
  }[] | null
}

const SUGGESTED_QUESTIONS = [
  'What was that agent reliability idea I saw last week?',
  'Did I save anything useful on RAG evaluation recently?',
  'What were the strongest takeaways on MCP or agent tooling?',
]

export default function MemoryPage() {
  const { session, user, loading } = useAuthSession()
  const fallbackUserId = process.env.NEXT_PUBLIC_USER_ID || ''
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const userId = user?.id ?? (adminUnlocked ? fallbackUserId : '')
  const [showAdminGate, setShowAdminGate] = useState(false)
  const [question, setQuestion] = useState('')
  const [loadingAnswer, setLoadingAnswer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState<RecallAnswer | null>(null)
  const [notebooks, setNotebooks] = useState<KnowledgeNotebook[]>([])
  const [recentFeed, setRecentFeed] = useState<FeedItemPreview[]>([])

  const headers = (adminToken?: string): Record<string, string> => {
    if (session?.access_token) return { Authorization: `Bearer ${session.access_token}` }
    const token = adminToken || getAdminToken()
    return token ? { 'x-admin-token': token } : {}
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && getAdminToken()) setAdminUnlocked(true)
  }, [])

  useEffect(() => {
    if (!userId) return
    const authHeaders = headers()
    Promise.all([
      fetch(`/api/data/knowledge-notebooks?userId=${encodeURIComponent(userId)}`, { headers: authHeaders }).then(r => r.json()).catch(() => ({ notebooks: [] })),
      fetch(`/api/data/feed?userId=${encodeURIComponent(userId)}&from=${new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`).then(r => r.json()).catch(() => ({ items: [] })),
    ]).then(([knowledgeJson, feedJson]) => {
      setNotebooks(knowledgeJson.notebooks ?? [])
      setRecentFeed((feedJson.items ?? []).slice(0, 6))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, session?.access_token, adminUnlocked])

  const ask = async (nextQuestion?: string, adminToken?: string) => {
    const q = (nextQuestion ?? question).trim()
    if (!q || !userId) return
    setQuestion(q)
    setLoadingAnswer(true)
    setError(null)
    try {
      const res = await fetch('/api/knowledge/recall', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers(adminToken),
        },
        body: JSON.stringify({ userId, question: q }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not answer question')
      setAnswer(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setAnswer(null)
    }
    setLoadingAnswer(false)
  }

  const requestAsk = (nextQuestion?: string) => {
    if (session?.access_token || getAdminToken()) {
      ask(nextQuestion)
      return
    }
    if (!user && !adminUnlocked) {
      setQuestion(nextQuestion ?? question)
      setShowAdminGate(true)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-8"><div className="h-48 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" /></div>
  }

  if (!session && !adminUnlocked) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        {showAdminGate && (
          <AdminGateModal
            action="open Memory Assistant"
            onSuccess={token => { setShowAdminGate(false); setAdminUnlocked(true); ask(question, token) }}
            onCancel={() => setShowAdminGate(false)}
          />
        )}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <h1 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Memory Assistant</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Ask about something you saw in your feed or saved in your knowledge base. Sign in or unlock the admin workspace.</p>
          <div className="mt-5 flex items-center gap-3">
            <button onClick={() => setShowAdminGate(true)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700">
              Unlock admin workspace
            </button>
            <button onClick={() => window.dispatchEvent(new Event('signal-auth-popup:open'))} className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 pb-20">
      {showAdminGate && (
        <AdminGateModal
          action="ask Memory Assistant"
          onSuccess={token => { setShowAdminGate(false); ask(question, token) }}
          onCancel={() => setShowAdminGate(false)}
        />
      )}

      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-7">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Memory Assistant</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Ask what you saw before — across feed and knowledge</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">This searches your recent feed memory and your private notebook knowledge, then answers only from what it found with citations back to source material.</p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Ask a recall question</h2>
          <div className="mt-4 flex gap-2">
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') requestAsk() }}
              placeholder="What was that concept on agent reliability, MCP, or evals I saw here before?"
              className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button onClick={() => requestAsk()} disabled={loadingAnswer || !question.trim()} className="rounded-xl bg-zinc-950 dark:bg-white dark:text-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
              {loadingAnswer ? 'Searching…' : 'Ask'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map(sample => (
              <button
                key={sample}
                onClick={() => requestAsk(sample)}
                className="rounded-full border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:border-violet-300 dark:hover:border-violet-700"
              >
                {sample}
              </button>
            ))}
          </div>

          {error && <div className="mt-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

          {answer && (
            <div className="mt-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-5">
              <div className="flex items-center gap-3 text-[11px] text-zinc-400 mb-3">
                <span>{answer.feedMatches} feed matches</span>
                <span>·</span>
                <span>{answer.knowledgeMatches} knowledge matches</span>
              </div>
              <p className="text-sm leading-7 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{answer.answer}</p>
              {answer.citations.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 mb-2">Citations</p>
                  <div className="space-y-2">
                    {answer.citations.map((citation, idx) => (
                      <a key={`${citation.url}-${idx}`} href={citation.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-violet-600 dark:text-violet-400 hover:underline">
                        {citation.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">What it searches</h3>
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-4">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent feed memory</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Top surfaced articles from your recent feed, with why-it-matters and takeaways.</p>
              </div>
              <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-4">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notebook knowledge</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{notebooks.length} notebook{notebooks.length !== 1 ? 's' : ''} currently available for grounded recall.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Recent feed memory</h3>
            <div className="mt-4 space-y-3">
              {recentFeed.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No recent feed history yet.</p>
              ) : recentFeed.slice(0, 4).map((item, idx) => {
                const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
                if (!article) return null
                return (
                  <a key={`${article.id}-${idx}`} href={article.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">{article.title}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{article.why_it_matters || 'Open to revisit details.'}</p>
                  </a>
                )
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
