'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionConfirmModal, AdminGateModal, getAdminToken } from '@/components/AdminGate'
import { TAG_COLORS, TAG_LABELS } from '@/lib/tagColors'
import { useAuthSession } from '@/lib/useAuthSession'

interface Notebook {
  id: string
  title: string
}

interface KnowledgeConnection {
  knowledgeTitle: string
  knowledgeUrl: string | null
  feedTitle: string
  feedUrl: string
  insight: string
  worthPost: boolean
}

interface StaleItem {
  id: string
  title: string
  sourceUrl: string | null
  topicTags: string[]
  daysOld: number
  notebookTitle: string
}

interface RankedItem {
  id: string
  notebook_id: string
  notebook_title: string
  title: string
  source_type: 'url' | 'note' | 'youtube'
  source_url: string | null
  summary: string | null
  why_it_matters: string | null
  topic_tags: string[]
  processed_at: string | null
  created_at: string | null
  blend_score: number
  topic_score: number
  recency_score: number
  detail_score: number
  is_fresh: boolean
}

type SourceMode = 'url' | 'youtube' | 'github' | 'note' | 'file' | 'image'

const SOURCE_MODES: { id: SourceMode; icon: string; label: string }[] = [
  { id: 'url', icon: '🔗', label: 'URL' },
  { id: 'youtube', icon: '▶️', label: 'YouTube Video' },
  { id: 'github', icon: '🐙', label: 'GitHub Repo' },
  { id: 'note', icon: '📋', label: 'Paste Text / LinkedIn Post' },
  { id: 'file', icon: '📄', label: 'Word / PDF' },
  { id: 'image', icon: '🖼️', label: 'Screenshot / Image' },
]

function isLikelyYouTubeUrl(url: string): boolean {
  return /youtube\.com\/(watch|shorts|live)|youtu\.be\//.test(url)
}

function TopicPill({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
  const label = TAG_LABELS[tag.toLowerCase()] ?? tag
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{label}</span>
}

function CostNotice({ text }: { text: string }) {
  return (
    <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
      <span>⚡</span> {text}
    </p>
  )
}

export default function KnowledgePage() {
  const { session, user, loading } = useAuthSession()
  const fallbackUserId = process.env.NEXT_PUBLIC_USER_ID || ''
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const userId = user?.id ?? (adminUnlocked ? fallbackUserId : '')

  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [canUsePaidFeatures, setCanUsePaidFeatures] = useState(false)
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [notebookFilter, setNotebookFilter] = useState<string>('all')

  const [items, setItems] = useState<RankedItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [topicFilter, setTopicFilter] = useState<string>('all')
  const [selectedItem, setSelectedItem] = useState<RankedItem | null>(null)

  // Search / Ask bar
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)
  const [askAnswer, setAskAnswer] = useState<{ answer: string; citations: { title: string; url: string }[] } | null>(null)
  // When set, Ask is scoped to conversing with ONE saved item instead of
  // blending across the whole library — set via "Ask about this" on any
  // item's detail panel, shown as a clearable chip above the search bar.
  const [scopedItem, setScopedItem] = useState<{ id: string; title: string } | null>(null)

  // Connection Agent — button-triggered only, never automatic
  const [findingConnections, setFindingConnections] = useState(false)
  const [connectionsError, setConnectionsError] = useState<string | null>(null)
  const [connections, setConnections] = useState<KnowledgeConnection[] | null>(null)
  const [connectionsScanned, setConnectionsScanned] = useState<number | null>(null)

  // Declutter — Knowledge Decay, free heuristic scan
  const [staleItems, setStaleItems] = useState<StaleItem[] | null>(null)
  const [staleLoading, setStaleLoading] = useState(false)
  const [staleError, setStaleError] = useState<string | null>(null)
  const [selectedStaleIds, setSelectedStaleIds] = useState<Set<string>>(new Set())
  const [archiving, setArchiving] = useState(false)
  const [archiveStatus, setArchiveStatus] = useState<string | null>(null)

  // Add-source panel
  const [sourceMode, setSourceMode] = useState<SourceMode>('url')
  const [urlInput, setUrlInput] = useState('')
  const [youtubeInput, setYoutubeInput] = useState('')
  const [githubInput, setGithubInput] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [addStatus, setAddStatus] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  const [showAdminGate, setShowAdminGate] = useState(false)
  const [showPaidConfirm, setShowPaidConfirm] = useState(false)
  const [confirmDescription, setConfirmDescription] = useState('')
  const pendingRun = useRef<((token?: string) => Promise<void>) | null>(null)

  const [showNewNotebook, setShowNewNotebook] = useState(false)
  const [newNotebookTitle, setNewNotebookTitle] = useState('')
  const [creatingNotebook, setCreatingNotebook] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && getAdminToken()) setAdminUnlocked(true)
  }, [])

  const authHeaders = (adminToken?: string): Record<string, string> => {
    if (session?.access_token) return { Authorization: `Bearer ${session.access_token}` }
    const token = adminToken || getAdminToken()
    return token ? { 'x-admin-token': token } : {}
  }

  const fetchAll = async () => {
    if (!userId) return
    setItemsLoading(true)
    setItemsError(null)
    try {
      const headers = authHeaders()
      const [profileRes, itemsRes] = await Promise.all([
        fetch(`/api/data/profile?userId=${encodeURIComponent(userId)}`, { headers }),
        fetch(`/api/data/knowledge-feed?userId=${encodeURIComponent(userId)}`, { headers }),
      ])
      const profileJson = await profileRes.json()
      const itemsJson = await itemsRes.json()
      if (!profileRes.ok) throw new Error(profileJson.error ?? 'Could not load profile')
      if (!itemsRes.ok) throw new Error(itemsJson.error ?? 'Could not load your reading list')
      setPlan(profileJson.plan === 'pro' ? 'pro' : 'free')
      setCanUsePaidFeatures(Boolean(profileJson.canUsePaidFeatures))
      setItems(itemsJson.items ?? [])
      setNotebooks(itemsJson.notebooks ?? [])
    } catch (e) {
      setItemsError(e instanceof Error ? e.message : String(e))
    }
    setItemsLoading(false)
  }

  useEffect(() => {
    if (!loading) fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.access_token, userId, adminUnlocked])

  const createNotebook = async () => {
    if (!newNotebookTitle.trim()) return
    setCreatingNotebook(true)
    try {
      const res = await fetch('/api/knowledge/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId, title: newNotebookTitle.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not create notebook')
      setNewNotebookTitle('')
      setShowNewNotebook(false)
      await fetchAll()
      if (json.notebook?.id) setNotebookFilter(json.notebook.id)
    } catch (e) {
      setItemsError(e instanceof Error ? e.message : String(e))
    }
    setCreatingNotebook(false)
  }

  // ── gating: run a costly action now if unlocked, else prompt ────────────
  const runOrGate = (description: string, run: (token?: string) => Promise<void>) => {
    pendingRun.current = run
    if (canUsePaidFeatures) {
      setConfirmDescription(description)
      setShowPaidConfirm(true)
    } else {
      setShowAdminGate(true)
    }
  }

  const filteredItems = items.filter(item =>
    (notebookFilter === 'all' || item.notebook_id === notebookFilter) &&
    (topicFilter === 'all' || item.topic_tags.includes(topicFilter))
  )

  const allTopics = useMemo(() => {
    const set = new Set<string>()
    items.forEach(item => item.topic_tags.forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [items])

  const groupedByTopic = useMemo(() => {
    const groups: Record<string, RankedItem[]> = {}
    filteredItems.forEach(item => {
      const key = item.topic_tags[0] || 'untagged'
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    })
    return Object.entries(groups)
      .map(([topic, list]) => ({
        topic,
        items: list.sort((a, b) => b.blend_score - a.blend_score),
        avgScore: list.reduce((sum, i) => sum + i.blend_score, 0) / list.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
  }, [filteredItems])

  // ── Ask ───────────────────────────────────────────────────────────────
  const doAsk = async (adminToken?: string) => {
    if (!question.trim()) return
    setAsking(true)
    setAskError(null)
    try {
      const res = await fetch('/api/knowledge/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(adminToken) },
        body: JSON.stringify({
          userId,
          question: question.trim(),
          notebookId: notebookFilter === 'all' ? null : notebookFilter,
          itemId: scopedItem?.id ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not answer that question')
      setAskAnswer(json)
    } catch (e) {
      setAskError(e instanceof Error ? e.message : String(e))
      setAskAnswer(null)
    }
    setAsking(false)
  }

  const doFindConnections = async (adminToken?: string) => {
    setFindingConnections(true)
    setConnectionsError(null)
    try {
      const res = await fetch('/api/knowledge/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(adminToken) },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not scan for connections')
      setConnections(json.connections ?? [])
      setConnectionsScanned(json.candidatesScanned ?? null)
    } catch (e) {
      setConnectionsError(e instanceof Error ? e.message : String(e))
      setConnections(null)
    }
    setFindingConnections(false)
  }

  const handleFindConnections = () => {
    runOrGate('This scans your reading list and recent feed for free, then makes one LLM call to explain any real connections it finds — uses your configured model, costs API credits.', doFindConnections)
  }

  // ── Declutter — free heuristic scan, no LLM, no gating ─────────────────
  const scanForStale = async () => {
    if (!userId) return
    setStaleLoading(true)
    setStaleError(null)
    try {
      const res = await fetch(`/api/knowledge/stale?userId=${encodeURIComponent(userId)}`, { headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not scan for stale items')
      setStaleItems(json.items ?? [])
      setSelectedStaleIds(new Set())
    } catch (e) {
      setStaleError(e instanceof Error ? e.message : String(e))
    }
    setStaleLoading(false)
  }

  const toggleStaleSelection = (id: string) => {
    setSelectedStaleIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const archiveSelected = async () => {
    if (selectedStaleIds.size === 0) return
    setArchiving(true)
    setArchiveStatus(null)
    try {
      const res = await fetch('/api/knowledge/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId, itemIds: Array.from(selectedStaleIds) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not archive selected items')
      setArchiveStatus(`Archived ${json.archivedCount} item${json.archivedCount !== 1 ? 's' : ''} — hidden from ranking and search, never deleted.`)
      setStaleItems(prev => (prev ?? []).filter(item => !selectedStaleIds.has(item.id)))
      setSelectedStaleIds(new Set())
      await fetchAll()
    } catch (e) {
      setArchiveStatus(e instanceof Error ? e.message : String(e))
    }
    setArchiving(false)
  }

  // ── Add source ────────────────────────────────────────────────────────
  const doAddUrl = (url: string) => async (adminToken?: string) => {
    setAdding(true)
    setAddError(null)
    setAddStatus(null)
    try {
      const res = await fetch('/api/knowledge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(adminToken) },
        body: JSON.stringify({ userId, sourceType: 'url', sourceUrl: url }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save this source')
      setUrlInput('')
      setYoutubeInput('')
      setGithubInput('')
      setAddStatus(`Saved "${json.item?.title || url}" — extracting links and summarizing now.`)
      await fetchAll()
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e))
    }
    setAdding(false)
  }

  const doAddNote = async (adminToken?: string) => {
    if (!noteText.trim()) return
    setAdding(true)
    setAddError(null)
    setAddStatus(null)
    try {
      const res = await fetch('/api/knowledge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(adminToken) },
        body: JSON.stringify({ userId, sourceType: 'note', title: noteTitle.trim(), noteText }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save this note')
      setNoteTitle('')
      setNoteText('')
      setAddStatus(`Saved "${json.item?.title || 'your note'}" — links extracted, summary on its way.`)
      await fetchAll()
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e))
    }
    setAdding(false)
  }

  const doUploadFile = (files: FileList) => async (adminToken?: string) => {
    setAdding(true)
    setAddError(null)
    setAddStatus(`Uploading ${files.length} file${files.length !== 1 ? 's' : ''}…`)
    try {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.set('userId', userId)
        form.set('file', file)
        const res = await fetch('/api/knowledge/items/upload', { method: 'POST', headers: authHeaders(adminToken), body: form })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? `Could not process ${file.name}`)
      }
      setAddStatus(`Processed ${files.length} file${files.length !== 1 ? 's' : ''}.`)
      await fetchAll()
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e))
      setAddStatus(null)
    }
    setAdding(false)
  }

  const handleAddClick = () => {
    if (sourceMode === 'url' && urlInput.trim()) {
      runOrGate('This will fetch the page and use your configured model to summarize and tag it.', doAddUrl(urlInput.trim()))
    } else if (sourceMode === 'youtube' && youtubeInput.trim()) {
      if (!isLikelyYouTubeUrl(youtubeInput.trim())) {
        setAddError('That does not look like a YouTube video URL.')
        return
      }
      runOrGate('This will fetch the video\'s transcript and use your configured model to summarize and tag it.', doAddUrl(youtubeInput.trim()))
    } else if (sourceMode === 'github' && githubInput.trim()) {
      const url = githubInput.trim().startsWith('http') ? githubInput.trim() : `https://github.com/${githubInput.trim()}`
      runOrGate('This will fetch the repo page and use your configured model to summarize and tag it.', doAddUrl(url))
    } else if (sourceMode === 'note' && noteText.trim()) {
      runOrGate('This will use your configured model to summarize, tag, and extract any links from this text.', doAddNote)
    }
  }

  const handleFileChange = (files: FileList | null) => {
    if (!files || files.length === 0) return
    runOrGate('This will extract the document text and use your configured model to summarize and tag it.', doUploadFile(files))
  }

  const handleAsk = () => {
    if (!question.trim()) return
    runOrGate('This will use your configured model to answer from your reading list.', doAsk)
  }

  if (loading) {
    return <div className="mx-auto max-w-7xl px-6 py-8"><div className="h-48 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" /></div>
  }

  if (!session && !adminUnlocked) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        {showAdminGate && (
          <AdminGateModal
            action="open the knowledge workspace"
            onSuccess={() => { setShowAdminGate(false); setAdminUnlocked(true) }}
            onCancel={() => setShowAdminGate(false)}
          />
        )}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <h1 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Your Library</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Sign in to use your private knowledge workspace, or unlock the admin workspace to ingest links, files, and notes without signing in.</p>
          <div className="mt-5 flex items-center gap-3">
            <button onClick={() => setShowAdminGate(true)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700">Unlock admin workspace</button>
            <button onClick={() => window.dispatchEvent(new Event('signal-auth-popup:open'))} className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300">Sign in</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 pb-24">
      {showAdminGate && (
        <AdminGateModal
          persistSession={false}
          action="use the knowledge workspace"
          onSuccess={token => { setShowAdminGate(false); const run = pendingRun.current; pendingRun.current = null; if (run) run(token) }}
          onCancel={() => { setShowAdminGate(false); pendingRun.current = null }}
        />
      )}
      {showPaidConfirm && (
        <ActionConfirmModal
          title="Confirm API usage"
          description={confirmDescription}
          confirmLabel="Proceed"
          action="run this on your configured model"
          onConfirm={() => { setShowPaidConfirm(false); const run = pendingRun.current; pendingRun.current = null; if (run) run() }}
          onCancel={() => { setShowPaidConfirm(false); pendingRun.current = null }}
        />
      )}

      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">📚 Your Library</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Your permanent collection — every link, file, and note you save, kept and organized here for good. Today only shows a slice of it; add to this any time and it never expires.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${plan === 'pro' ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300' : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'}`}>
            {plan === 'pro' ? 'Pro access' : 'Free preview'}
          </span>
          <Link href="/feed?tab=library" className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">🔎 Explore Full Library →</Link>
          <Link href="/knowledge/resources" className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">🔗 Resources →</Link>
        </div>
      </div>

      {/* ── Notebook selector — one shared filter for the whole workspace ── */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs text-zinc-400 font-medium">Notebook</span>
        <select value={notebookFilter} onChange={e => setNotebookFilter(e.target.value)}
          className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 px-2.5 py-1.5">
          <option value="all">All notebooks</option>
          {notebooks.map(nb => <option key={nb.id} value={nb.id}>{nb.title}</option>)}
        </select>
        {!showNewNotebook ? (
          <button onClick={() => setShowNewNotebook(true)} className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">+ New notebook</button>
        ) : (
          <div className="flex items-center gap-1.5">
            <input value={newNotebookTitle} onChange={e => setNewNotebookTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createNotebook() }}
              placeholder="Notebook name" autoFocus
              className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5" />
            <button onClick={createNotebook} disabled={creatingNotebook || !newNotebookTitle.trim()}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 disabled:opacity-40">{creatingNotebook ? '…' : 'Create'}</button>
            <button onClick={() => { setShowNewNotebook(false); setNewNotebookTitle('') }} className="text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
          </div>
        )}
      </div>

      {/* ── Top: Ask bar ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
            {scopedItem ? 'Ask about this item' : 'Ask your reading list'}
          </p>
        </div>
        {scopedItem && (
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2.5 py-1 rounded-full max-w-full">
              💬 Asking about: <span className="truncate max-w-[240px]">{scopedItem.title}</span>
            </span>
            <button onClick={() => setScopedItem(null)} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">✕ back to whole library</button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAsk() }}
            placeholder={scopedItem ? `Ask anything about "${scopedItem.title}"…` : 'What did I save about agent evaluation? What repos have I bookmarked on RAG?'}
            className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button onClick={handleAsk} disabled={asking || !question.trim()}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors">
            {asking ? 'Searching…' : 'Ask'}
          </button>
        </div>
        <CostNotice text="Answers only from what you've saved and processed — uses your configured LLM, costs API credits." />
        {askError && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{askError}</p>}
        {askAnswer && (
          <div className="mt-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-4">
            <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{askAnswer.answer}</p>
            {askAnswer.citations.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {askAnswer.citations.slice(0, 6).map((c, i) => (
                  <a key={`${c.url}-${i}`} href={c.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-violet-600 dark:text-violet-400 hover:underline border border-violet-200 dark:border-violet-800 rounded-lg px-2 py-1">
                    {c.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Middle: Add source (left) + Topics & rankings (right) ───────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Add a source</h2>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {SOURCE_MODES.map(mode => (
              <button key={mode.id} onClick={() => setSourceMode(mode.id)}
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all ${
                  sourceMode === mode.id ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-violet-300'}`}>
                <span>{mode.icon}</span>{mode.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {sourceMode === 'url' && (
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                placeholder="https://example.com/article"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
            )}
            {sourceMode === 'youtube' && (
              <input value={youtubeInput} onChange={e => setYoutubeInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
            )}
            {sourceMode === 'github' && (
              <input value={githubInput} onChange={e => setGithubInput(e.target.value)}
                placeholder="https://github.com/owner/repo or owner/repo"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
            )}
            {sourceMode === 'note' && (
              <div className="space-y-2">
                <input value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={6}
                  placeholder="Paste your LinkedIn post, article text, or any note here. Any links or GitHub repos mentioned get extracted automatically."
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
            )}
            {sourceMode === 'file' && (
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-6 text-center cursor-pointer hover:border-violet-300 transition-colors">
                <span className="text-2xl">📄</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Click to choose a Word doc or PDF</span>
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => handleFileChange(e.target.files)} />
              </label>
            )}
            {sourceMode === 'image' && (
              <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-6 text-center">
                <span className="text-2xl">🖼️</span>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Screenshot/image ingestion is coming soon.</p>
                <p className="mt-1 text-[11px] text-zinc-400">For now, paste any text from the image using &quot;Paste Text&quot; instead.</p>
              </div>
            )}
          </div>

          {sourceMode !== 'file' && sourceMode !== 'image' && (
            <>
              <button onClick={handleAddClick} disabled={adding}
                className="mt-3 w-full rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-2.5 text-sm font-bold text-white transition-colors">
                {adding ? 'Saving…' : '+ Add to reading list'}
              </button>
              <CostNotice text="Summarizing, tagging, and link extraction uses your configured LLM — costs API credits." />
            </>
          )}
          {sourceMode === 'file' && <CostNotice text="Text extraction is free; summarizing and tagging uses your configured LLM and costs API credits." />}

          {addStatus && <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">{addStatus}</p>}
          {addError && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{addError}</p>}
        </section>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Topics, at a glance</h2>

          {allTopics.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button onClick={() => setTopicFilter('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${topicFilter === 'all' ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'}`}>
                All
              </button>
              {allTopics.map(tag => (
                <button key={tag} onClick={() => setTopicFilter(tag)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${topicFilter === tag ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'}`}>
                  {TAG_LABELS[tag.toLowerCase()] ?? tag}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 max-h-[560px] overflow-y-auto space-y-5 pr-1">
            {itemsLoading ? (
              [0, 1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />)
            ) : itemsError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{itemsError}</p>
            ) : groupedByTopic.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-3">📝</div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing saved yet — add a source on the left to get started.</p>
              </div>
            ) : (
              groupedByTopic.map(group => (
                <div key={group.topic}>
                  <div className="flex items-center gap-2 mb-2">
                    <TopicPill tag={group.topic} />
                    <span className="text-[11px] text-zinc-400">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {group.items.slice(0, 4).map((item, idx) => (
                      <button key={item.id} onClick={() => setSelectedItem(item)}
                        className={`w-full text-left rounded-xl border p-3 transition-colors ${
                          selectedItem?.id === item.id ? 'border-violet-400 bg-violet-50/60 dark:bg-violet-950/20' : 'border-zinc-100 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-700'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                            <span className="mr-1">{item.source_type === 'youtube' ? '▶️' : item.source_type === 'note' ? '📋' : '🔗'}</span>
                            {item.title}
                          </p>
                          {idx === 0 && <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Top pick</span>}
                        </div>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{item.why_it_matters || item.summary || ''}</p>
                        <p className="mt-1.5 text-[10px] text-zinc-400">{item.notebook_title} · match {Math.round(item.blend_score * 100)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── Connection Agent — button-triggered, never automatic ────────── */}
      <section className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">🔎 Find Connections</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Cross-references what you've saved against your last 14 days of feed. Free to scan — only costs credits if it finds something worth explaining.</p>
          </div>
          <button onClick={handleFindConnections} disabled={findingConnections}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-2.5 text-sm font-bold text-white transition-colors shrink-0">
            {findingConnections ? 'Scanning…' : '🔎 Find Connections'}
          </button>
        </div>
        <CostNotice text="Heuristic scan is free. If it finds candidate pairs, one batched LLM call explains them — uses your configured model, costs API credits." />

        {connectionsError && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{connectionsError}</p>}

        {connections !== null && (
          connections.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">Scanned {connectionsScanned ?? 0} pairs — nothing connected strongly enough to be worth surfacing right now. Save more sources or check back after your next feed refresh.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {connections.map((c, i) => (
                <div key={i} className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{c.insight}</p>
                    {c.worthPost && <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">💡 Worth a post</span>}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                    {c.knowledgeUrl ? (
                      <a href={c.knowledgeUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-violet-600 dark:text-violet-400">📚 {c.knowledgeTitle}</a>
                    ) : <span>📚 {c.knowledgeTitle}</span>}
                    <span>×</span>
                    <a href={c.feedUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-violet-600 dark:text-violet-400">📰 {c.feedTitle}</a>
                    {c.worthPost && (
                      <Link href={`/create?source=custom&topic=${encodeURIComponent(c.insight)}`} className="ml-auto font-semibold text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400">→ Create</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {/* ── Declutter — free heuristic scan, no LLM ──────────────────────── */}
      <section className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">🧹 Declutter</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Finds items untouched for 90+ days. Archiving only hides them from ranking and search — nothing is ever deleted.</p>
          </div>
          <button onClick={scanForStale} disabled={staleLoading}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-violet-300 disabled:opacity-50 px-4 py-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 transition-colors shrink-0">
            {staleLoading ? 'Scanning…' : '🧹 Scan for stale items'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">Free — heuristic only, no LLM call.</p>

        {staleError && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{staleError}</p>}
        {archiveStatus && <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">{archiveStatus}</p>}

        {staleItems !== null && (
          staleItems.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">Nothing stale — everything in your library is recent or still fresh.</p>
          ) : (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-zinc-400">{staleItems.length} candidate{staleItems.length !== 1 ? 's' : ''}</p>
                <button onClick={archiveSelected} disabled={selectedStaleIds.size === 0 || archiving}
                  className="rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 disabled:opacity-40 px-3 py-1.5 text-xs font-bold">
                  {archiving ? 'Archiving…' : `Archive selected (${selectedStaleIds.size})`}
                </button>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {staleItems.map(item => (
                  <label key={item.id} className="flex items-start gap-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 p-2.5 cursor-pointer hover:border-violet-200 dark:hover:border-violet-800">
                    <input type="checkbox" className="mt-0.5" checked={selectedStaleIds.has(item.id)} onChange={() => toggleStaleSelection(item.id)} />
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{item.title}</p>
                      <p className="text-[11px] text-zinc-400">{item.notebookTitle} · {item.daysOld} days old{item.topicTags.length > 0 ? ` · ${item.topicTags.slice(0, 2).join(', ')}` : ''}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )
        )}
      </section>

      {/* ── Bottom: selected item summary ────────────────────────────────── */}
      {selectedItem && (
        <section className="mt-6 rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">{selectedItem.notebook_title}</p>
              <h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">{selectedItem.title}</h2>
            </div>
            <button onClick={() => setSelectedItem(null)} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selectedItem.topic_tags.map(tag => <TopicPill key={tag} tag={tag} />)}
          </div>
          {selectedItem.summary && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 mb-1">Summary</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{selectedItem.summary}</p>
            </div>
          )}
          {selectedItem.why_it_matters && (
            <div className="mt-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-zinc-900 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1">Why this matters</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{selectedItem.why_it_matters}</p>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            {selectedItem.source_url && (
              <a href={selectedItem.source_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">Open source →</a>
            )}
            <button onClick={() => {
              setScopedItem({ id: selectedItem.id, title: selectedItem.title })
              setQuestion('')
              setAskAnswer(null)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
              className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:underline">💬 Ask about this</button>
            <Link href={`/knowledge/${selectedItem.notebook_id}`} className="text-xs font-semibold text-zinc-400 hover:underline">View in notebook →</Link>
          </div>
        </section>
      )}
    </div>
  )
}
