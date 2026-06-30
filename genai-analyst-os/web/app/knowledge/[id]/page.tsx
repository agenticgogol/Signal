'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ActionConfirmModal, AdminGateModal } from '@/components/AdminGate'
import { TAG_COLORS, TAG_LABELS } from '@/lib/tagColors'
import { useAuthSession } from '@/lib/useAuthSession'

interface Notebook {
  id: string
  title: string
  description: string | null
}

interface KnowledgeItem {
  id: string
  source_type: 'url' | 'note'
  source_url: string | null
  title: string
  summary: string | null
  why_it_matters: string | null
  topic_tags: string[]
  status: 'pending' | 'processing' | 'ready' | 'failed'
  processing_error: string | null
  created_at: string
  processed_at: string | null
}

export default function NotebookDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const notebookId = String(params?.id || '')
  const { session, user, loading } = useAuthSession()
  const userId = user?.id ?? ''

  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [canUsePaidFeatures, setCanUsePaidFeatures] = useState(false)
  const [notebook, setNotebook] = useState<Notebook | null>(null)
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [pageError, setPageError] = useState<string | null>(null)

  const [urlInput, setUrlInput] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState<'url' | 'note' | null>(null)

  const [showAdminGate, setShowAdminGate] = useState(false)
  const [showPaidConfirm, setShowPaidConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState<'url' | 'note' | 'chat' | null>(null)

  const [question, setQuestion] = useState('')
  const [includeFeed, setIncludeFeed] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [chatAnswer, setChatAnswer] = useState('')
  const [chatCitations, setChatCitations] = useState<Array<{ title: string; url: string }>>([])
  const [retrievalMode, setRetrievalMode] = useState<'semantic' | 'lexical' | null>(null)

  const readyCount = useMemo(() => items.filter(item => item.status === 'ready').length, [items])

  const fetchNotebook = async () => {
    if (!session?.access_token || !userId || !notebookId) return
    setPageError(null)
    try {
      const [profileRes, notebookRes] = await Promise.all([
        fetch(`/api/data/profile?userId=${encodeURIComponent(userId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`/api/data/knowledge-notebook?userId=${encodeURIComponent(userId)}&notebookId=${encodeURIComponent(notebookId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ])
      const profileJson = await profileRes.json()
      const notebookJson = await notebookRes.json()
      if (!profileRes.ok) throw new Error(profileJson.error ?? 'Could not load profile')
      if (!notebookRes.ok) throw new Error(notebookJson.error ?? 'Could not load notebook')
      setPlan(profileJson.plan === 'pro' ? 'pro' : 'free')
      setCanUsePaidFeatures(Boolean(profileJson.canUsePaidFeatures))
      setNotebook(notebookJson.notebook ?? null)
      setItems(notebookJson.items ?? [])
    } catch (e) {
      setPageError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    if (!loading) fetchNotebook()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.access_token, userId, notebookId])

  useEffect(() => {
    const q = searchParams.get('q')
    const includeFeedParam = searchParams.get('includeFeed')
    if (q) setQuestion(q)
    if (includeFeedParam === '1' || includeFeedParam === 'true') setIncludeFeed(true)
  }, [searchParams])

  const submitUrl = async (adminToken?: string) => {
    if (!session?.access_token || !userId || !urlInput.trim()) return
    setSubmitting('url')
    setPageError(null)
    try {
      const res = await fetch('/api/knowledge/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          ...(adminToken ? { 'x-admin-token': adminToken } : {}),
        },
        body: JSON.stringify({
          userId,
          notebookId,
          sourceType: 'url',
          sourceUrl: urlInput.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not ingest URL')
      setUrlInput('')
      await fetchNotebook()
    } catch (e) {
      setPageError(e instanceof Error ? e.message : String(e))
    }
    setSubmitting(null)
  }

  const submitNote = async (adminToken?: string) => {
    if (!session?.access_token || !userId || !noteText.trim()) return
    setSubmitting('note')
    setPageError(null)
    try {
      const res = await fetch('/api/knowledge/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          ...(adminToken ? { 'x-admin-token': adminToken } : {}),
        },
        body: JSON.stringify({
          userId,
          notebookId,
          sourceType: 'note',
          title: noteTitle.trim(),
          noteText,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not ingest note')
      setNoteTitle('')
      setNoteText('')
      await fetchNotebook()
    } catch (e) {
      setPageError(e instanceof Error ? e.message : String(e))
    }
    setSubmitting(null)
  }

  const askQuestion = async (adminToken?: string) => {
    if (!session?.access_token || !userId || !question.trim()) return
    setChatLoading(true)
    setChatError(null)
    try {
      const res = await fetch('/api/knowledge/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          ...(adminToken ? { 'x-admin-token': adminToken } : {}),
        },
        body: JSON.stringify({ userId, notebookId, question, includeFeed }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not answer question')
      setChatAnswer(json.answer ?? '')
      setChatCitations(json.citations ?? [])
      setRetrievalMode(json.retrievalMode === 'semantic' ? 'semantic' : 'lexical')
    } catch (e) {
      setChatError(e instanceof Error ? e.message : String(e))
    }
    setChatLoading(false)
  }

  const requestAction = (action: 'url' | 'note' | 'chat') => {
    setPendingAction(action)
    if (canUsePaidFeatures) setShowPaidConfirm(true)
    else setShowAdminGate(true)
  }

  const runPending = (adminToken?: string) => {
    if (pendingAction === 'url') submitUrl(adminToken)
    else if (pendingAction === 'note') submitNote(adminToken)
    else if (pendingAction === 'chat') askQuestion(adminToken)
    setPendingAction(null)
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-8"><div className="h-48 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" /></div>
  }

  if (!session || !userId) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <h1 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Notebook</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Sign in first to view your notebook, ingest saved links, and ask grounded questions against your own stored knowledge.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 pb-20">
      {showAdminGate && (
        <AdminGateModal
          persistSession={false}
          action={pendingAction === 'chat' ? 'knowledge chat' : 'knowledge ingestion'}
          onSuccess={token => { setShowAdminGate(false); runPending(token) }}
          onCancel={() => { setShowAdminGate(false); setPendingAction(null) }}
        />
      )}
      {showPaidConfirm && (
        <ActionConfirmModal
          title="Confirm API usage"
          description={pendingAction === 'chat'
            ? 'This will answer from your stored notebook knowledge and optionally your recent feed using your configured model.'
            : 'This will process the submitted source, generate Signal notes, and store chunked notebook knowledge using your configured model.'}
          confirmLabel="Proceed"
          action={pendingAction === 'chat' ? 'answer a notebook question' : 'process notebook knowledge'}
          onConfirm={() => { setShowPaidConfirm(false); runPending() }}
          onCancel={() => { setShowPaidConfirm(false); setPendingAction(null) }}
        />
      )}

      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Notebook</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">{notebook?.title || 'Loading notebook…'}</h1>
            {notebook?.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">{notebook.description}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${plan === 'pro' ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300' : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'}`}>
              {plan === 'pro' ? 'Pro access' : 'Free preview'}
            </span>
            <span className="rounded-full border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{readyCount}/{items.length} processed</span>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
          <strong className="text-zinc-700 dark:text-zinc-300">How this works:</strong> saved URLs and notes are converted into a notebook feed with a summary, why-it-matters note, topic tags, and chunked retrieval context. Chat answers are grounded in what is stored here, optionally blended with your recent Signal feed.
        </div>
        {pageError && <div className="mt-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{pageError}</div>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Save a URL</h2>
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="mt-4 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
            <button onClick={() => requestAction('url')} disabled={submitting === 'url' || !urlInput.trim()}
              className="mt-4 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40">
              {submitting === 'url' ? 'Processing…' : canUsePaidFeatures ? 'Save and process URL' : 'Admin: Save and process URL'}
            </button>
          </div>

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Save a note</h2>
            <input value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
              placeholder="Optional note title"
              className="mt-4 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="Paste your notes, copied research, or internal thinking here…"
              rows={8}
              className="mt-3 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
            <button onClick={() => requestAction('note')} disabled={submitting === 'note' || !noteText.trim()}
              className="mt-4 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40">
              {submitting === 'note' ? 'Processing…' : canUsePaidFeatures ? 'Save and process note' : 'Admin: Save and process note'}
            </button>
          </div>

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Ask this notebook</h2>
                <p className="mt-1 text-xs text-zinc-400">Grounded answers only from stored notebook knowledge, optionally with recent feed context.</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <input type="checkbox" checked={includeFeed} onChange={e => setIncludeFeed(e.target.checked)} />
                Blend recent feed
              </label>
            </div>
            <textarea value={question} onChange={e => setQuestion(e.target.value)}
              placeholder="What are the strongest arguments in this notebook about agent reliability?"
              rows={4}
              className="mt-4 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
            <button onClick={() => requestAction('chat')} disabled={chatLoading || !question.trim()}
              className="mt-4 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">
              {chatLoading ? 'Thinking…' : canUsePaidFeatures ? 'Ask notebook' : 'Admin: Ask notebook'}
            </button>
            {chatError && <div className="mt-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{chatError}</div>}
            {chatAnswer && (
              <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-4">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-400">
                  Retrieval mode: {retrievalMode === 'semantic' ? 'semantic chunk search' : 'lexical fallback'}
                </p>
                <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{chatAnswer}</p>
                {chatCitations.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 mb-2">Citations</p>
                    <div className="space-y-2">
                      {chatCitations.map((citation, idx) => (
                        <a key={`${citation.url}-${idx}`} href={citation.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-violet-600 dark:text-violet-400 hover:underline">
                          {citation.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Notebook feed</h2>
              <p className="mt-1 text-xs text-zinc-400">Saved items become a structured feed with Signal notes.</p>
            </div>
            <Link href={`/create?source=notebook&notebook_id=${notebookId}`} className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-950/50">
              Use in Create
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 p-6 text-sm text-zinc-500 dark:text-zinc-400">
                No saved items yet. Add a URL or note to start building this notebook.
              </div>
            ) : items.map(item => (
              <div key={item.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.status === 'ready' ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300' : item.status === 'failed' ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'}`}>{item.status}</span>
                  <span className="text-[11px] text-zinc-400 uppercase tracking-wide">{item.source_type}</span>
                  {item.topic_tags.slice(0, 3).map(tag => (
                    <span key={tag} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_COLORS[tag] || 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                      {TAG_LABELS[tag] ?? tag}
                    </span>
                  ))}
                </div>
                <p className="mt-2 font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                {item.summary && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-6">{item.summary}</p>}
                {item.why_it_matters && (
                  <div className="mt-3 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/70 dark:bg-violet-950/20 p-3 text-sm text-violet-900 dark:text-violet-200">
                    <strong>Why it matters:</strong> {item.why_it_matters}
                  </div>
                )}
                {item.processing_error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{item.processing_error}</p>}
                <div className="mt-3 flex items-center justify-between gap-3">
                  {item.source_url ? (
                    <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 dark:text-violet-400 hover:underline">
                      Open source
                    </a>
                  ) : <span className="text-xs text-zinc-400">Private note</span>}
                  <span className="text-xs text-zinc-400">
                    {item.processed_at ? `Processed ${new Date(item.processed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : `Saved ${new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
