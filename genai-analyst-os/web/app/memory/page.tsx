'use client'

import { useEffect, useState } from 'react'
import { useAuthSession } from '@/lib/useAuthSession'
import AskSignalPanel from '@/components/AskSignalPanel'

interface KnowledgeNotebook {
  id: string
  title: string
}

const SUGGESTED_QUESTIONS = [
  'What was that agent reliability idea I saw last week?',
  'Did I save anything useful on RAG evaluation recently?',
  'What were the strongest takeaways on MCP or agent tooling?',
]

export default function MemoryPage() {
  const { session, user, loading } = useAuthSession()
  const userId = user?.id ?? process.env.NEXT_PUBLIC_USER_ID ?? ''
  const [notebooks, setNotebooks] = useState<KnowledgeNotebook[]>([])

  useEffect(() => {
    if (!userId) return
    const headers: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
    fetch(`/api/data/knowledge-notebooks?userId=${encodeURIComponent(userId)}`, { headers })
      .then(r => r.json())
      .then(json => setNotebooks(json.notebooks ?? []))
      .catch(() => setNotebooks([]))
  }, [userId, session?.access_token])

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-8"><div className="h-48 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" /></div>
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 pb-20">
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-7">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Memory Assistant</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Ask what you saw before — across feed and knowledge</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">This is the same recall engine as the Ask Signal tab on your Feed, with room to dig deeper — full question history, full reading history, and your notebook library in one place.</p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section>
          <AskSignalPanel
            variant="full"
            suggestedQuestions={SUGGESTED_QUESTIONS}
            crossLink={{ href: '/feed?tab=chat', label: '← Quick-ask from your Feed instead' }}
          />
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
              <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-4">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Prior questions</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Recall is shared with the Feed page — anything asked there shows up here too, and vice versa.</p>
              </div>
            </div>
          </div>

          {notebooks.length > 0 && (
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Your notebooks</h3>
              <div className="mt-4 space-y-2">
                {notebooks.slice(0, 8).map(nb => (
                  <a key={nb.id} href={`/knowledge/${nb.id}`} className="block rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
                    {nb.title}
                  </a>
                ))}
              </div>
              <a href="/knowledge" className="mt-3 inline-flex text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">Manage notebooks →</a>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
