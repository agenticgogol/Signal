'use client'

import { useState, useEffect, useCallback } from 'react'
import { TAG_COLORS, TAG_LABELS } from '@/lib/tagColors'
import { AdminGateModal, getAdminToken } from '@/components/AdminGate'

// ── helpers ───────────────────────────────────────────────────────────────────

function localDateISO(d = new Date()) {
  // Use LOCAL date (not UTC) to match Python's date.today() on the same machine
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoToday() { return localDateISO() }

function daysAgoISO(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return localDateISO(d)
}

function formatPubDate(raw: string | null | undefined): string {
  if (!raw) return ''
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return '' }
}

function getDomain(url: string) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

const TOPIC_GRADIENTS: Record<string, string> = {
  agentic:  'from-blue-500 to-indigo-500',
  llm:      'from-violet-500 to-purple-500',
  rag:      'from-purple-500 to-pink-500',
  infra:    'from-slate-500 to-zinc-500',
  finetune: 'from-orange-500 to-amber-500',
  llmops:   'from-teal-500 to-cyan-500',
  eval:     'from-green-500 to-emerald-500',
}

function topicGradient(tags: string[]): string {
  for (const t of tags) {
    const g = TOPIC_GRADIENTS[t.toLowerCase()]
    if (g) return g
  }
  return 'from-zinc-400 to-slate-500'
}

function priorityLabel(score: number): { label: string; cls: string } {
  if (score >= 0.8) return { label: 'Must Read', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800' }
  if (score >= 0.6) return { label: 'Top Pick',  cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800' }
  if (score >= 0.4) return { label: 'Good Read', cls: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' }
  return { label: 'Explore',   cls: 'bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' }
}

// ── types ─────────────────────────────────────────────────────────────────────

interface Article {
  id: string; url: string; title: string
  tldr_bullets: string[]; topic_tags: string[]
  depth_score: number; published_at: string; source_id: string
}

interface FeedItem {
  blend_score: number; feed_date: string
  articles: Article | Article[] | null
}

interface DigestItem {
  headline: string; summary: string; url: string; tags: string[]
}

type DateRange = 'today' | '7d' | '30d'

// ── sub-components ────────────────────────────────────────────────────────────

function TagPill({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600'
  const label = TAG_LABELS[tag.toLowerCase()] ?? tag
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
      <div className="h-44 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
        <div className="h-4 w-4/5 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}

function ArticleCard({
  item, reaction, onReact, selected, onSelect,
}: {
  item: FeedItem
  reaction?: 'like' | 'dislike'
  onReact: (articleId: string, r: 'like' | 'dislike') => void
  selected: boolean
  onSelect: (articleId: string) => void
}) {
  const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
  if (!article) return null
  const bullets: string[] = Array.isArray(article.tldr_bullets) ? article.tldr_bullets : []
  const tags: string[] = Array.isArray(article.topic_tags) ? article.topic_tags : []
  const pubDate = formatPubDate(article.published_at)
  const grad = topicGradient(tags)
  const priority = priorityLabel(item.blend_score)

  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-2xl border overflow-hidden hover:shadow-md transition-all flex flex-col group ${
      selected ? 'border-violet-400 dark:border-violet-600 ring-2 ring-violet-200 dark:ring-violet-900' : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
    }`}>
      <a href={article.url} target="_blank" rel="noopener noreferrer"
        className="block relative h-40 flex-shrink-0 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${grad} opacity-80 group-hover:opacity-90 transition-opacity`} />
        {tags[0] && (
          <span className="absolute inset-0 flex items-center justify-center text-white/10 font-black text-4xl uppercase tracking-widest pointer-events-none select-none">
            {TAG_LABELS[tags[0]] ?? tags[0]}
          </span>
        )}
      </a>

      <div className="p-4 flex-1 flex flex-col gap-2">
        {/* Priority + tags row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${priority.cls}`}>
            {priority.label}
          </span>
          {tags.slice(0, 2).map(tag => <TagPill key={tag} tag={tag} />)}
        </div>

        <a href={article.url} target="_blank" rel="noopener noreferrer"
          className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-violet-600 dark:hover:text-violet-400 transition-colors leading-snug line-clamp-2 text-sm">
          {article.title}
        </a>

        {bullets.length > 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{bullets[0]}</p>
        )}

        {/* Footer: domain + date + actions */}
        <div className="mt-auto pt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-zinc-400 truncate">{getDomain(article.url)}</span>
            {pubDate && <span className="text-xs text-zinc-300 dark:text-zinc-600">·</span>}
            {pubDate && <span className="text-xs text-zinc-400 flex-shrink-0">{pubDate}</span>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Select for Create */}
            <button
              onClick={() => onSelect(article.id)}
              title={selected ? 'Remove from Create' : 'Save for Create content'}
              className={`p-1.5 rounded-lg text-sm transition-all ${
                selected ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-violet-400'
              }`}
            >
              {selected ? '📌' : '📌'}
            </button>
            {/* Like */}
            <button
              onClick={() => onReact(article.id, 'like')}
              title="Helpful — show more like this"
              className={`p-1.5 rounded-lg text-sm transition-all ${
                reaction === 'like' ? 'bg-green-100 dark:bg-green-900/40 text-green-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-green-500'
              }`}
            >
              👍
            </button>
            {/* Dislike */}
            <button
              onClick={() => onReact(article.id, 'dislike')}
              title="Not relevant — show less"
              className={`p-1.5 rounded-lg text-sm transition-all ${
                reaction === 'dislike' ? 'bg-red-100 dark:bg-red-900/40 text-red-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-red-500'
              }`}
            >
              👎
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const userId = process.env.NEXT_PUBLIC_USER_ID!

  const [activeTab, setActiveTab] = useState<'all' | 'headlines'>('all')
  const [dateRange, setDateRange] = useState<DateRange>('today')

  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  const [digest, setDigest] = useState<DigestItem[]>([])
  const [digestLoading, setDigestLoading] = useState(false)

  const [selectedTopic, setSelectedTopic] = useState<string>('all')
  const [prefToast, setPrefToast] = useState<string | null>(null)

  // Reactions: articleId → 'like' | 'dislike'
  const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike'>>({})

  // Selected for Create — read sessionStorage synchronously on first render (no flicker)
  const [selectedForCreate, setSelectedForCreate] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const saved = sessionStorage.getItem('signal_selected_articles')
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set()
    } catch { return new Set() }
  })

  const [triggering, setTriggering] = useState(false)
  const [pipelineStarted, setPipelineStarted] = useState(false)
  const [triggerError, setTriggerError] = useState<string | null>(null)
  const [showAdminGate, setShowAdminGate] = useState(false)

  // ── data fetching ─────────────────────────────────────────────────────────

  const fetchFeed = useCallback(async (range: DateRange) => {
    setLoading(true)
    try {
      let url: string
      const today = isoToday()
      if (range === 'today') {
        url = `/api/data/feed?userId=${userId}&date=${today}`
      } else if (range === '7d') {
        url = `/api/data/feed?userId=${userId}&from=${daysAgoISO(7)}&to=${today}`
      } else {
        url = `/api/data/feed?userId=${userId}&from=${daysAgoISO(30)}&to=${today}`
      }
      const res = await fetch(url)
      const json = await res.json()
      setItems(json.items ?? [])
    } catch { setItems([]) }
    setLoading(false)
  }, [userId])

  const fetchDigest = useCallback(async () => {
    setDigestLoading(true)
    setDigest([])
    try {
      const res = await fetch(`/api/data/digest?userId=${userId}&date=${isoToday()}`)
      const json = await res.json()
      setDigest(json.items ?? [])
    } catch { setDigest([]) }
    setDigestLoading(false)
  }, [userId])

  const fetchReactions = useCallback(async () => {
    try {
      const res = await fetch(`/api/articles/react?userId=${userId}`)
      const json = await res.json()
      const map: Record<string, 'like' | 'dislike'> = {}
      for (const r of (json.reactions ?? [])) map[r.article_id] = r.reaction
      setReactions(map)
    } catch {}
  }, [userId])

  // On first mount: if "today" has no data, auto-switch to the last date that does
  useEffect(() => {
    async function autoSelectRange() {
      try {
        const res = await fetch(`/api/data/latest-date?userId=${userId}`)
        const json = await res.json()
        if (json.date) {
          const latestDate = json.date
          const today = isoToday()
          // If latest data is older than today, switch to last-7d so it's visible
          if (latestDate < today) {
            setDateRange('7d')
            return // fetchFeed will fire via the dateRange useEffect below
          }
        }
      } catch {}
      fetchFeed('today')
    }
    autoSelectRange()
    fetchReactions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => { fetchFeed(dateRange) }, [dateRange, fetchFeed])
  useEffect(() => { if (activeTab === 'headlines') fetchDigest() }, [activeTab, fetchDigest])

  // ── actions ────────────────────────────────────────────────────────────────

  const doTrigger = async () => {
    setTriggering(true)
    setPipelineStarted(false)
    setTriggerError(null)
    try {
      const res = await fetch('/api/pipeline/trigger', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        setPipelineStarted(true)
        // Pipeline runs async (~2 min) — poll for new data every 20s, up to 3 min
        let attempts = 0
        const poll = setInterval(async () => {
          attempts++
          try {
            const r = await fetch(`/api/data/latest-date?userId=${userId}`)
            const d = await r.json()
            const latestDate: string = d.date ?? ''
            const today = isoToday()
            if (latestDate === today || attempts >= 9) {
              clearInterval(poll)
              const range: DateRange = latestDate < today ? '7d' : 'today'
              setDateRange(range)
              await fetchFeed(range)
              if (activeTab === 'headlines') fetchDigest()
              setPipelineStarted(false)
            }
          } catch {}
        }, 20000)
      } else {
        setTriggerError(json.error ?? 'Pipeline trigger failed')
      }
    } catch (err) {
      setTriggerError(String(err))
    }
    setTriggering(false)
  }

  const handleTrigger = () => {
    const token = getAdminToken()
    if (token) { doTrigger() }
    else { setShowAdminGate(true) }
  }

  const handleReact = async (articleId: string, r: 'like' | 'dislike') => {
    const existing = reactions[articleId]
    // Toggle off if same reaction
    if (existing === r) {
      setReactions(prev => { const n = { ...prev }; delete n[articleId]; return n })
      fetch('/api/articles/react', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, articleId }) })
    } else {
      setReactions(prev => ({ ...prev, [articleId]: r }))
      fetch('/api/articles/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, articleId, reaction: r }) })
    }
  }

  const handleSelect = (articleId: string) => {
    setSelectedForCreate(prev => {
      const next = new Set(prev)
      if (next.has(articleId)) next.delete(articleId)
      else next.add(articleId)
      try { sessionStorage.setItem('signal_selected_articles', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const handleSavePreference = async () => {
    if (selectedTopic === 'all') return
    try {
      await fetch('/api/data/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, topic: selectedTopic, boost: 0.1 }),
      })
      setPrefToast(`Preference saved — '${TAG_LABELS[selectedTopic] ?? selectedTopic}' will rank higher`)
    } catch {}
    setTimeout(() => setPrefToast(null), 4000)
  }

  // ── derived ────────────────────────────────────────────────────────────────

  const articles = items
    .map(item => (Array.isArray(item.articles) ? item.articles[0] : item.articles) ? item : null)
    .filter(Boolean) as FeedItem[]

  const topicCounts: Record<string, number> = {}
  for (const item of articles) {
    const a = Array.isArray(item.articles) ? item.articles[0] : item.articles
    for (const t of (a?.topic_tags ?? [])) topicCounts[t] = (topicCounts[t] ?? 0) + 1
  }
  const allTopics = Object.keys(topicCounts).sort((a, b) => topicCounts[b] - topicCounts[a])

  const filteredArticles = selectedTopic === 'all'
    ? articles
    : articles.filter(item => {
        const a = Array.isArray(item.articles) ? item.articles[0] : item.articles
        return (a?.topic_tags ?? []).includes(selectedTopic)
      })

  const selectedCount = selectedForCreate.size

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {showAdminGate && (
        <AdminGateModal
          action="run the feed pipeline"
          onSuccess={() => { setShowAdminGate(false); doTrigger() }}
          onCancel={() => setShowAdminGate(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Feed</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">GenAI intelligence, curated daily</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <a href="/create?source=feed"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded-xl hover:bg-violet-100 transition-colors">
              📌 {selectedCount} saved → Create
            </a>
          )}
          <button
            onClick={handleTrigger}
            disabled={triggering || pipelineStarted}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
          >
            {triggering
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Starting…</>
              : pipelineStarted
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Pipeline running (~2 min)…</>
              : <>⚡ Get Latest Feed</>}
          </button>
        </div>
      </div>

      {/* Date range tabs */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl mb-5 w-fit">
        {([
          { id: 'today' as DateRange, label: 'Today' },
          { id: '7d'   as DateRange, label: 'Last 7 days' },
          { id: '30d'  as DateRange, label: 'Last 30 days' },
        ]).map(opt => (
          <button key={opt.id} onClick={() => setDateRange(opt.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              dateRange === opt.id
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-5 border-b border-zinc-200 dark:border-zinc-800 mb-5">
        {[
          { id: 'all'       as const, label: 'All Feeds' },
          { id: 'headlines' as const, label: 'Headlines Digest' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-violet-600 text-violet-600'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── All Feeds ──────────────────────────────────────────────────────── */}
      {activeTab === 'all' && (
        <div>
          {/* Topic filters */}
          {!loading && allTopics.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <button onClick={() => setSelectedTopic('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  selectedTopic === 'all'
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'
                }`}>
                All <span className="opacity-70">({articles.length})</span>
              </button>
              {allTopics.map(topic => (
                <button key={topic} onClick={() => setSelectedTopic(topic)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    selectedTopic === topic
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'
                  }`}>
                  {TAG_LABELS[topic] ?? topic} <span className="opacity-70">({topicCounts[topic]})</span>
                </button>
              ))}
              {selectedTopic !== 'all' && (
                <button onClick={handleSavePreference}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all">
                  ⭐ Save Preference
                </button>
              )}
            </div>
          )}

          {triggerError && (
            <div className="mb-4 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <span>⚠️</span>
              <span><strong>Pipeline error:</strong> {triggerError}</span>
            </div>
          )}

          {prefToast && (
            <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              ✓ {prefToast}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0,1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-base font-medium text-zinc-700 dark:text-zinc-300">No articles yet</p>
              <p className="text-sm text-zinc-400 mt-1">Click ⚡ Get Latest Feed to pull fresh articles.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-400 mb-4">{filteredArticles.length} articles · 📌 tap pin to save for Create</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredArticles.map((item, idx) => {
                  const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
                  return (
                    <ArticleCard
                      key={idx}
                      item={item}
                      reaction={article ? reactions[article.id] : undefined}
                      onReact={handleReact}
                      selected={article ? selectedForCreate.has(article.id) : false}
                      onSelect={handleSelect}
                    />
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Headlines Digest ───────────────────────────────────────────────── */}
      {activeTab === 'headlines' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-500">Today&apos;s InShorts-style digest, ranked by importance</p>
            <button onClick={fetchDigest}
              className="text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium">
              Regenerate
            </button>
          </div>

          {digestLoading ? (
            <div className="space-y-3">
              {[0,1,2,3,4,5,6,7].map(i => (
                <div key={i} className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : digest.length > 0 ? (
            <div className="space-y-2">
              {digest.map((item, i) => {
                const priorityBand = i < 2 ? 'Must Read' : i < 5 ? 'Top Pick' : 'Good Read'
                const bandCls = i < 2
                  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                  : i < 5
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
                  : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                return (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                    className="flex gap-4 items-start bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 hover:shadow-md hover:border-zinc-200 dark:hover:border-zinc-700 transition-all group">
                    <span className={`flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br ${topicGradient(item.tags)} flex items-center justify-center text-white text-xs font-bold`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${bandCls}`}>
                          {priorityBand}
                        </span>
                        {(item.tags ?? []).slice(0, 2).map(tag => <TagPill key={tag} tag={tag} />)}
                      </div>
                      <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mb-1 line-clamp-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                        {item.headline}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {item.summary}
                      </p>
                      <span className="text-xs text-zinc-400 mt-1 block">{getDomain(item.url)}</span>
                    </div>
                  </a>
                )
              })}
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-16 text-zinc-400">
              <div className="text-5xl mb-4">📭</div>
              <p className="font-medium">No articles yet</p>
              <p className="text-sm mt-1">Switch to All Feeds and click ⚡ Get Latest Feed.</p>
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-400 text-sm">
              Click &ldquo;Regenerate&rdquo; to generate today&apos;s digest.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
