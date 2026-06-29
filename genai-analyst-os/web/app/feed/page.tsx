'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TAG_COLORS, TAG_LABELS } from '@/lib/tagColors'
import { AdminGateModal, getAdminToken } from '@/components/AdminGate'

// ── helpers ───────────────────────────────────────────────────────────────────

function localDateISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isoToday() { return localDateISO() }
function daysAgoISO(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return localDateISO(d)
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

const PIPELINE_KEY = 'signal_pipeline_started_at'
const CONFIG_KEY = 'signal_pipeline_config'

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
  for (const t of tags) { const g = TOPIC_GRADIENTS[t.toLowerCase()]; if (g) return g }
  return 'from-zinc-400 to-slate-500'
}
function priorityLabel(score: number): { label: string; cls: string } {
  if (score >= 0.8) return { label: 'Must Read', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800' }
  if (score >= 0.6) return { label: 'Top Pick',  cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800' }
  if (score >= 0.4) return { label: 'Good Read', cls: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' }
  return { label: 'Explore', cls: 'bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' }
}

// ── types ─────────────────────────────────────────────────────────────────────

interface Article {
  id: string; url: string; title: string
  tldr_bullets: string[]; topic_tags: string[]
  why_it_matters?: string; key_takeaways?: string[]
  depth_score: number; published_at: string; source_id: string
}
interface FeedItem { blend_score: number; feed_date: string; articles: Article | Article[] | null }
interface WeeklyItem {
  id: string; url: string; title: string
  blend_score: number; feed_date: string
  topic_tags: string[]; tldr_bullets: string[]
  why_it_matters: string | null; key_takeaways: string[]
  published_at: string | null
}
interface PipelineConfig { lookbackDays: number; maxPerSource: number }
type DateRange = 'today' | '7d' | '30d'
type SortBy = 'ranking' | 'recency'

const DEFAULT_CONFIG: PipelineConfig = { lookbackDays: 7, maxPerSource: 5 }

// ── sub-components ────────────────────────────────────────────────────────────

function TagPill({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
  const label = TAG_LABELS[tag.toLowerCase()] ?? tag
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
      <div className="h-36 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
        <div className="h-3 w-4/5 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
        <div className="h-3 w-2/3 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}

function FeedInfoTooltip() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-xs font-bold flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">?</button>
      {open && (
        <div className="absolute left-0 top-7 z-50 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl p-4 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">How Signal builds your feed</p>
          <p><span className="font-medium text-zinc-700 dark:text-zinc-300">What it fetches:</span> Latest articles from each source within your lookback window. Uses the max-per-source limit you set.</p>
          <p><span className="font-medium text-zinc-700 dark:text-zinc-300">Scoring:</span> Each article gets a blend score combining recency, source tier, topic match, and content depth. Must Read ≥0.8, Top Pick ≥0.6, Good Read ≥0.4.</p>
          <p><span className="font-medium text-zinc-700 dark:text-zinc-300">Enrichment:</span> The pipeline generates TL;DR bullets, topic tags, &quot;Why it matters&quot;, and 3 key takeaways per article at crawl time — so cards load instantly.</p>
          <button onClick={() => setOpen(false)} className="text-violet-600 dark:text-violet-400 font-medium hover:underline">Close</button>
        </div>
      )}
    </div>
  )
}

function PipelineConfigPanel({
  config, onChange, onClose,
}: {
  config: PipelineConfig
  onChange: (c: PipelineConfig) => void
  onClose: () => void
}) {
  const lookbackOptions = [1, 3, 7, 14]
  const maxOptions = [1, 3, 5, 10]
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pipeline settings</p>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none">×</button>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Lookback window — how far back to fetch articles</p>
          <div className="flex gap-2 flex-wrap">
            {lookbackOptions.map(n => (
              <button key={n} onClick={() => onChange({ ...config, lookbackDays: n })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  config.lookbackDays === n
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-violet-300'
                }`}>
                {n} day{n > 1 ? 's' : ''}
                {n === DEFAULT_CONFIG.lookbackDays ? ' (default)' : ''}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Max articles per source</p>
          <div className="flex gap-2 flex-wrap">
            {maxOptions.map(n => (
              <button key={n} onClick={() => onChange({ ...config, maxPerSource: n })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  config.maxPerSource === n
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-violet-300'
                }`}>
                {n}{n === DEFAULT_CONFIG.maxPerSource ? ' (default)' : ''}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-400">Settings saved locally and sent to the next pipeline run.</p>
      </div>
    </div>
  )
}

function ArticleCard({
  item, reaction, onReact, selected, onSelect, isFresh,
}: {
  item: FeedItem
  reaction?: 'like' | 'dislike'
  onReact: (articleId: string, r: 'like' | 'dislike') => void
  selected: boolean
  onSelect: (articleId: string) => void
  isFresh?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
  if (!article) return null
  const bullets: string[] = Array.isArray(article.tldr_bullets) ? article.tldr_bullets : []
  const tags: string[] = Array.isArray(article.topic_tags) ? article.topic_tags : []
  const takeaways: string[] = Array.isArray(article.key_takeaways) ? article.key_takeaways : []
  const whyItMatters = article.why_it_matters ?? ''
  const pubDate = formatPubDate(article.published_at)
  const grad = topicGradient(tags)
  const priority = priorityLabel(item.blend_score)

  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-2xl border overflow-hidden hover:shadow-md transition-all flex flex-col group ${
      selected ? 'border-violet-400 dark:border-violet-600 ring-2 ring-violet-200 dark:ring-violet-900'
      : isFresh ? 'border-green-300 dark:border-green-700'
      : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
    }`}>
      <a href={article.url} target="_blank" rel="noopener noreferrer"
        className="block relative h-36 flex-shrink-0 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${grad} opacity-80 group-hover:opacity-90 transition-opacity`} />
        {isFresh && (
          <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
            ✦ Fresh
          </span>
        )}
        {tags[0] && (
          <span className="absolute inset-0 flex items-center justify-center text-white/10 font-black text-4xl uppercase tracking-widest pointer-events-none select-none">
            {TAG_LABELS[tags[0]] ?? tags[0]}
          </span>
        )}
      </a>

      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${priority.cls}`}>{priority.label}</span>
          {tags.slice(0, 2).map(tag => <TagPill key={tag} tag={tag} />)}
        </div>

        <a href={article.url} target="_blank" rel="noopener noreferrer"
          className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-violet-600 dark:hover:text-violet-400 transition-colors leading-snug line-clamp-2 text-sm">
          {article.title}
        </a>

        {/* Why it matters — always visible */}
        {whyItMatters && (
          <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed">
            {whyItMatters}
          </p>
        )}

        {/* Expandable takeaways */}
        {takeaways.length > 0 ? (
          <div>
            {expanded && (
              <ul className="space-y-1 mb-1.5">
                {takeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center text-[10px] font-semibold mt-0.5">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setExpanded(e => !e)}
              className="text-xs text-zinc-400 hover:text-violet-500 dark:hover:text-violet-400 transition-colors font-medium">
              {expanded ? '▲ Hide takeaways' : `▼ ${takeaways.length} takeaways`}
            </button>
          </div>
        ) : bullets.length > 0 && !whyItMatters && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{bullets[0]}</p>
        )}

        <div className="mt-auto pt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-zinc-400 truncate">{getDomain(article.url)}</span>
            {pubDate && <><span className="text-xs text-zinc-300 dark:text-zinc-600">·</span>
            <span className="text-xs text-zinc-400 flex-shrink-0">{pubDate}</span></>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onSelect(article.id)} title={selected ? 'Remove from Create' : 'Save for Create'}
              className={`p-1.5 rounded-lg text-sm transition-all ${selected ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-violet-400'}`}>📌</button>
            <button onClick={() => onReact(article.id, 'like')} title="Show more like this"
              className={`p-1.5 rounded-lg text-sm transition-all ${reaction === 'like' ? 'bg-green-100 dark:bg-green-900/40 text-green-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-green-500'}`}>👍</button>
            <button onClick={() => onReact(article.id, 'dislike')} title="Show less like this"
              className={`p-1.5 rounded-lg text-sm transition-all ${reaction === 'dislike' ? 'bg-red-100 dark:bg-red-900/40 text-red-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-red-500'}`}>👎</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const userId = process.env.NEXT_PUBLIC_USER_ID!

  const [activeTab, setActiveTab] = useState<'all' | 'weekly'>('all')
  const [dateRange, setDateRange] = useState<DateRange>('today')
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [weeklyItems, setWeeklyItems] = useState<WeeklyItem[]>([])
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<string>('all')
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortBy>('ranking')
  const [prefToast, setPrefToast] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike'>>({})
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)
  const [freshArticleIds, setFreshArticleIds] = useState<Set<string>>(new Set())
  const [freshCount, setFreshCount] = useState(0)
  const [showFreshBanner, setShowFreshBanner] = useState(false)
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
  const [showConfig, setShowConfig] = useState(false)
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>(DEFAULT_CONFIG)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevArticleIdsRef = useRef<Set<string>>(new Set())

  // ── restore state from localStorage ───────────────────────────────────────

  useEffect(() => {
    // Restore pipeline config
    try {
      const saved = localStorage.getItem(CONFIG_KEY)
      if (saved) setPipelineConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) })
    } catch {}

    // Restore pipeline running state
    const startedAt = localStorage.getItem(PIPELINE_KEY)
    if (startedAt) {
      const elapsed = Date.now() - parseInt(startedAt)
      if (elapsed < 5 * 60 * 1000) {
        setPipelineStarted(true)
        startPolling()
      } else {
        localStorage.removeItem(PIPELINE_KEY)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveConfig = (c: PipelineConfig) => {
    setPipelineConfig(c)
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(c)) } catch {}
  }

  // ── data fetching ─────────────────────────────────────────────────────────

  const fetchFeed = useCallback(async (range: DateRange, isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    try {
      const today = isoToday()
      let url: string
      if (range === 'today') url = `/api/data/feed?userId=${userId}&date=${today}`
      else if (range === '7d') url = `/api/data/feed?userId=${userId}&from=${daysAgoISO(7)}&to=${today}`
      else url = `/api/data/feed?userId=${userId}&from=${daysAgoISO(30)}&to=${today}`
      const res = await fetch(url)
      const json = await res.json()
      const newItems: FeedItem[] = json.items ?? []

      if (isRefresh) {
        // Diff to find fresh articles
        const prev = prevArticleIdsRef.current
        const freshIds = new Set<string>()
        for (const item of newItems) {
          const a = Array.isArray(item.articles) ? item.articles[0] : item.articles
          if (a && !prev.has(a.id)) freshIds.add(a.id)
        }
        if (freshIds.size > 0) {
          setFreshArticleIds(freshIds)
          setFreshCount(freshIds.size)
          setShowFreshBanner(true)
          setTimeout(() => setShowFreshBanner(false), 60000)
        }
      }

      setItems(newItems)
      if (newItems.length > 0) {
        const dates = newItems.map(i => i.feed_date).filter(Boolean).sort().reverse()
        if (dates[0]) setLastRefreshed(new Date(dates[0] + 'T00:00:00').toISOString())
      }
    } catch { setItems([]) }
    if (!isRefresh) setLoading(false)
  }, [userId])

  const fetchWeekly = useCallback(async () => {
    setWeeklyLoading(true)
    setWeeklyItems([])
    try {
      const res = await fetch(`/api/data/digest?userId=${userId}&days=7`)
      const json = await res.json()
      setWeeklyItems(json.items ?? [])
    } catch {}
    setWeeklyLoading(false)
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

  useEffect(() => {
    async function autoSelectRange() {
      try {
        const res = await fetch(`/api/data/latest-date?userId=${userId}`)
        const json = await res.json()
        if (json.date && json.date < isoToday()) {
          setDateRange('7d'); return
        }
      } catch {}
      fetchFeed('today')
    }
    autoSelectRange()
    fetchReactions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => { fetchFeed(dateRange) }, [dateRange, fetchFeed])
  useEffect(() => { if (activeTab === 'weekly') fetchWeekly() }, [activeTab, fetchWeekly])

  // ── pipeline trigger ──────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      try {
        const r = await fetch(`/api/data/latest-date?userId=${userId}`)
        const d = await r.json()
        const latestDate: string = d.date ?? ''
        const today = isoToday()
        if (latestDate === today || attempts >= 9) {
          if (pollRef.current) clearInterval(pollRef.current)
          localStorage.removeItem(PIPELINE_KEY)
          setPipelineStarted(false)
          const range: DateRange = latestDate < today ? '7d' : 'today'
          setDateRange(range)
          await fetchFeed(range, true)
          setLastRefreshed(new Date().toISOString())
        }
      } catch {}
    }, 20000)
  }, [userId, fetchFeed])

  const doTrigger = async () => {
    // Snapshot current article IDs before triggering
    prevArticleIdsRef.current = new Set(
      items
        .map(item => (Array.isArray(item.articles) ? item.articles[0] : item.articles)?.id)
        .filter(Boolean) as string[]
    )
    setFreshArticleIds(new Set())
    setShowFreshBanner(false)
    setTriggering(true)
    setPipelineStarted(false)
    setTriggerError(null)
    try {
      const res = await fetch('/api/pipeline/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lookbackDays: pipelineConfig.lookbackDays,
          maxPerSource: pipelineConfig.maxPerSource,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        localStorage.setItem(PIPELINE_KEY, Date.now().toString())
        setPipelineStarted(true)
        startPolling()
      } else {
        setTriggerError(json.error ?? 'Pipeline trigger failed — check GITHUB_PAT in Vercel env vars')
      }
    } catch (err) {
      setTriggerError(String(err))
    }
    setTriggering(false)
  }

  const handleTrigger = () => {
    const token = getAdminToken()
    if (token) doTrigger()
    else setShowAdminGate(true)
  }

  const handleReact = async (articleId: string, r: 'like' | 'dislike') => {
    const existing = reactions[articleId]
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
      if (next.has(articleId)) next.delete(articleId); else next.add(articleId)
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

  const domainCounts: Record<string, number> = {}
  for (const item of articles) {
    const a = Array.isArray(item.articles) ? item.articles[0] : item.articles
    const d = a ? getDomain(a.url) : ''
    if (d) domainCounts[d] = (domainCounts[d] ?? 0) + 1
  }
  const allDomains = Object.keys(domainCounts).sort((a, b) => domainCounts[b] - domainCounts[a])

  let filteredArticles = articles
  if (selectedTopic !== 'all') filteredArticles = filteredArticles.filter(item => {
    const a = Array.isArray(item.articles) ? item.articles[0] : item.articles
    return (a?.topic_tags ?? []).includes(selectedTopic)
  })
  if (selectedDomain !== 'all') filteredArticles = filteredArticles.filter(item => {
    const a = Array.isArray(item.articles) ? item.articles[0] : item.articles
    return a ? getDomain(a.url) === selectedDomain : false
  })
  if (sortBy === 'recency') filteredArticles = [...filteredArticles].sort((a, b) => {
    const aA = Array.isArray(a.articles) ? a.articles[0] : a.articles
    const bA = Array.isArray(b.articles) ? b.articles[0] : b.articles
    return (new Date(bA?.published_at ?? 0).getTime()) - (new Date(aA?.published_at ?? 0).getTime())
  })

  // Weekly digest grouped by topic
  const weeklyByTopic: Record<string, WeeklyItem[]> = {}
  for (const item of weeklyItems) {
    const tag = item.topic_tags[0] ?? 'other'
    if (!weeklyByTopic[tag]) weeklyByTopic[tag] = []
    weeklyByTopic[tag].push(item)
  }
  const weeklyTopics = Object.keys(weeklyByTopic).sort((a, b) => weeklyByTopic[b].length - weeklyByTopic[a].length)

  const selectedCount = selectedForCreate.size
  const isNonDefaultConfig = pipelineConfig.lookbackDays !== DEFAULT_CONFIG.lookbackDays || pipelineConfig.maxPerSource !== DEFAULT_CONFIG.maxPerSource

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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Feed</h1>
            <FeedInfoTooltip />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">GenAI intelligence, curated daily</p>
            {lastRefreshed && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">· Last refreshed {formatRelativeTime(lastRefreshed)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <a href="/create?source=feed"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded-xl hover:bg-violet-100 transition-colors">
              📌 {selectedCount} → Create
            </a>
          )}
          <button onClick={() => setShowConfig(s => !s)} title="Pipeline settings"
            className={`p-2 rounded-xl border transition-all ${
              isNonDefaultConfig
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-600'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600'
            }`}>
            ⚙️
          </button>
          <button onClick={handleTrigger} disabled={triggering || pipelineStarted}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors shadow-sm">
            {triggering
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Starting…</>
              : pipelineStarted
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Running…</>
              : <>⚡ Get Latest Feed</>}
          </button>
        </div>
      </div>

      {/* Pipeline config panel */}
      {showConfig && (
        <PipelineConfigPanel
          config={pipelineConfig}
          onChange={saveConfig}
          onClose={() => setShowConfig(false)}
        />
      )}

      {/* Fresh feed banner */}
      {showFreshBanner && freshCount > 0 && (
        <div className="mb-5 px-4 py-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <span className="text-base">✦</span>
            <span><strong>{freshCount} fresh article{freshCount !== 1 ? 's' : ''}</strong> just pulled — highlighted in green below</span>
          </div>
          <button onClick={() => setShowFreshBanner(false)} className="text-green-500 hover:text-green-700 text-lg leading-none ml-4">×</button>
        </div>
      )}

      {/* Pipeline running banner */}
      {pipelineStarted && (
        <div className="mb-5 px-4 py-3 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-xl flex items-center gap-3 text-sm text-violet-700 dark:text-violet-300">
          <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span>
            Pipeline running — lookback {pipelineConfig.lookbackDays}d · max {pipelineConfig.maxPerSource}/source.
            Feed refreshes automatically when done (~2 min).
          </span>
        </div>
      )}

      {/* Error banner */}
      {triggerError && (
        <div className="mb-5 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <span>⚠️</span>
          <span><strong>Pipeline error:</strong> {triggerError}</span>
        </div>
      )}

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
          { id: 'all' as const, label: 'All Articles' },
          { id: 'weekly' as const, label: 'Weekly Digest' },
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

      {/* ── All Articles ───────────────────────────────────────────────────────── */}
      {activeTab === 'all' && (
        <div>
          {/* Topic filters */}
          {!loading && allTopics.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs text-zinc-400 font-medium">Topic</span>
              <button onClick={() => setSelectedTopic('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  selectedTopic === 'all' ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'
                }`}>
                All <span className="opacity-70">({articles.length})</span>
              </button>
              {allTopics.map(topic => (
                <button key={topic} onClick={() => setSelectedTopic(topic)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    selectedTopic === topic ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'
                  }`}>
                  {TAG_LABELS[topic] ?? topic} <span className="opacity-70">({topicCounts[topic]})</span>
                </button>
              ))}
              {selectedTopic !== 'all' && (
                <button onClick={handleSavePreference}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all">
                  ⭐ Boost this topic
                </button>
              )}
            </div>
          )}

          {/* Sort + source filters */}
          {!loading && articles.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-400 font-medium">Sort</span>
                <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg">
                  {([
                    { id: 'ranking' as SortBy, label: '⭐ Ranking' },
                    { id: 'recency' as SortBy, label: '🕐 Recency' },
                  ]).map(opt => (
                    <button key={opt.id} onClick={() => setSortBy(opt.id)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        sortBy === opt.id ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {allDomains.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-400 font-medium">Source</span>
                  <select value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)}
                    className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="all">All sources ({articles.length})</option>
                    {allDomains.map(d => <option key={d} value={d}>{d} ({domainCounts[d]})</option>)}
                  </select>
                </div>
              )}
              {(selectedTopic !== 'all' || selectedDomain !== 'all' || sortBy !== 'ranking') && (
                <button onClick={() => { setSelectedTopic('all'); setSelectedDomain('all'); setSortBy('ranking') }}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline transition-colors">
                  Reset filters
                </button>
              )}
            </div>
          )}

          {prefToast && (
            <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">✓ {prefToast}</div>
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
              <p className="text-xs text-zinc-400 mb-4">
                {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
                {selectedTopic !== 'all' || selectedDomain !== 'all' ? ' (filtered)' : ''}
                {' '}· sorted by {sortBy === 'ranking' ? 'relevance score' : 'publish date'}
                {freshCount > 0 && ` · ✦ ${freshCount} fresh`}
                {' '}· 📌 pin to Create
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredArticles.map((item, idx) => {
                  const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
                  return (
                    <ArticleCard key={idx} item={item}
                      reaction={article ? reactions[article.id] : undefined}
                      onReact={handleReact}
                      selected={article ? selectedForCreate.has(article.id) : false}
                      onSelect={handleSelect}
                      isFresh={article ? freshArticleIds.has(article.id) : false}
                    />
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Weekly Digest ──────────────────────────────────────────────────────── */}
      {activeTab === 'weekly' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Last 7 days — grouped by topic</p>
              <p className="text-xs text-zinc-400 mt-0.5">Key ideas, research, and developments worth knowing · instant load from DB</p>
            </div>
            <button onClick={fetchWeekly}
              className="text-xs text-violet-600 dark:text-violet-400 px-3 py-1.5 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition-colors font-medium">
              ↺ Refresh
            </button>
          </div>

          {weeklyLoading ? (
            <div className="space-y-3">
              {[0,1,2,3,4].map(i => <div key={i} className="h-28 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : weeklyItems.length === 0 ? (
            <div className="text-center py-16 text-zinc-400">
              <div className="text-5xl mb-4">📭</div>
              <p className="font-medium text-zinc-600 dark:text-zinc-400">No articles in the last 7 days</p>
              <p className="text-sm mt-1">Run the pipeline first to pull articles.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {weeklyTopics.map(topic => (
                <div key={topic}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${topicGradient([topic])}`} />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {TAG_LABELS[topic] ?? topic}
                    </h3>
                    <span className="text-xs text-zinc-400">{weeklyByTopic[topic].length} article{weeklyByTopic[topic].length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-3">
                    {weeklyByTopic[topic].map((item, i) => (
                      <WeeklyArticleRow key={i} item={item} reaction={reactions[item.id]} onReact={handleReact} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WeeklyArticleRow({
  item, reaction, onReact,
}: {
  item: WeeklyItem
  reaction?: 'like' | 'dislike'
  onReact: (articleId: string, r: 'like' | 'dislike') => void
}) {
  const [expanded, setExpanded] = useState(false)
  const priority = priorityLabel(item.blend_score)
  const hasEnriched = item.why_it_matters || item.key_takeaways.length > 0

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4 hover:border-zinc-200 dark:hover:border-zinc-700 transition-all">
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-1 self-stretch rounded-full bg-gradient-to-b ${topicGradient(item.topic_tags)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${priority.cls}`}>{priority.label}</span>
            <span className="text-xs text-zinc-400">{getDomain(item.url)}</span>
            {item.published_at && <span className="text-xs text-zinc-300 dark:text-zinc-600">· {formatPubDate(item.published_at)}</span>}
          </div>
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 hover:text-violet-600 dark:hover:text-violet-400 transition-colors leading-snug block mb-1">
            {item.title}
          </a>
          {item.why_it_matters && (
            <p className="text-xs text-violet-700 dark:text-violet-300 mb-2">{item.why_it_matters}</p>
          )}
          {hasEnriched && (
            <div>
              {expanded && item.key_takeaways.length > 0 && (
                <ul className="space-y-1 mb-2">
                  {item.key_takeaways.map((t, ti) => (
                    <li key={ti} className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center text-[10px] font-semibold mt-0.5">{ti + 1}</span>
                      {t}
                    </li>
                  ))}
                </ul>
              )}
              {item.key_takeaways.length > 0 && (
                <button onClick={() => setExpanded(e => !e)}
                  className="text-xs text-zinc-400 hover:text-violet-500 dark:hover:text-violet-400 font-medium transition-colors">
                  {expanded ? '▲ Hide takeaways' : `▼ ${item.key_takeaways.length} takeaways`}
                </button>
              )}
            </div>
          )}
          {!hasEnriched && item.tldr_bullets.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{item.tldr_bullets[0]}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button onClick={() => onReact(item.id, 'like')}
            className={`p-1.5 rounded-lg text-sm transition-all ${reaction === 'like' ? 'bg-green-100 dark:bg-green-900/40 text-green-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-green-500'}`}>👍</button>
          <button onClick={() => onReact(item.id, 'dislike')}
            className={`p-1.5 rounded-lg text-sm transition-all ${reaction === 'dislike' ? 'bg-red-100 dark:bg-red-900/40 text-red-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-red-500'}`}>👎</button>
        </div>
      </div>
    </div>
  )
}
