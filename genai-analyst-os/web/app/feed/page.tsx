'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TAG_COLORS, TAG_LABELS } from '@/lib/tagColors'
import { ActionConfirmModal, AdminGateModal, getAdminToken } from '@/components/AdminGate'
import OnboardingChecklist, { type SetupStatus } from '@/components/OnboardingChecklist'
import { useAuthSession } from '@/lib/useAuthSession'

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
function formatPubFull(raw: string | null | undefined): string {
  if (!raw) return ''
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
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
function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

const PIPELINE_KEY = 'signal_pipeline_started_at'
const CONFIG_KEY   = 'signal_pipeline_config'

// Inline gradient styles — Tailwind dynamic class names don't compile reliably
const TOPIC_GRADIENTS: Record<string, string> = {
  agentic:  'linear-gradient(135deg, #3b82f6, #6366f1)',
  llm:      'linear-gradient(135deg, #8b5cf6, #a855f7)',
  rag:      'linear-gradient(135deg, #a855f7, #ec4899)',
  infra:    'linear-gradient(135deg, #64748b, #71717a)',
  finetune: 'linear-gradient(135deg, #f97316, #f59e0b)',
  llmops:   'linear-gradient(135deg, #14b8a6, #06b6d4)',
  eval:     'linear-gradient(135deg, #22c55e, #10b981)',
}
function topicGradient(tags: string[]): string {
  for (const t of tags) { const g = TOPIC_GRADIENTS[t.toLowerCase()]; if (g) return g }
  return 'linear-gradient(135deg, #a1a1aa, #71717a)'
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
  og_image_url?: string
  depth_score: number; published_at: string; source_id: string
}
interface FeedItem { blend_score: number; feed_date: string; memory_boost?: number; articles: Article | Article[] | null }
interface WeeklyItem {
  id: string; url: string; title: string
  blend_score: number; feed_date: string
  topic_tags: string[]; tldr_bullets: string[]
  why_it_matters: string | null; key_takeaways: string[]
  published_at: string | null
}
interface NewsItem {
  title: string; url: string; description: string
  pubDate: string; pubMs: number; source: string; category: string
}
interface NarrativeData {
  headline: string; signal: string
  watch: { item: string; why: string }[]; takeaway: string
}
interface SourceArticleMeta {
  title: string
  url: string
  topic_tags: string[]
  why_it_matters: string | null
}
interface NarrativeMeta {
  cached: boolean; generatedAt: string | null; articleCount: number
  sourceArticles?: SourceArticleMeta[]
  modelProvider?: string | null
  modelName?: string | null
  generationMode?: string | null
}
interface DailyDigestData {
  headline: string
  signal: string
  highlights: { title: string; why: string }[]
  takeaway: string
}
interface DigestRecord {
  digest_date?: string
  week_start?: string
  article_count: number
  dominant_topics: string[]
  generated_at: string
  emailed_at?: string | null
  narrative?: DailyDigestData
}
interface DigestProvenance {
  sourceArticles: SourceArticleMeta[]
  modelProvider: string | null
  modelName: string | null
  generationMode: string | null
}
interface PipelineConfig { lookbackDays: number; maxPerSource: number }
type DateRange = 'today' | '7d' | '30d'
type SortBy   = 'ranking' | 'recency'
type Tab      = 'feed' | 'chat' | 'daily' | 'news' | 'weekly' | 'library'

interface KnowledgeNotebookFilter {
  id: string
  title: string
}

interface KnowledgeFeedItem {
  id: string
  notebook_id: string
  notebook_title: string
  title: string
  source_type: 'url' | 'note'
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

interface RelatedKnowledgeMatch {
  notebookId: string
  notebookTitle: string
  knowledgeTitle: string
  summary: string | null
  whyItMatters: string | null
  matchScore: number
  sourceUrl: string | null
}

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

const DEFAULT_CONFIG: PipelineConfig = { lookbackDays: 7, maxPerSource: 5 }

// ── TagPill ───────────────────────────────────────────────────────────────────

function TagPill({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
  const label = TAG_LABELS[tag.toLowerCase()] ?? tag
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
}

// ── SkeletonCard ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
      <div className="h-36 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse w-full" />
        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse w-4/5" />
        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse w-3/5" />
      </div>
    </div>
  )
}

// ── FeedInfoTooltip ───────────────────────────────────────────────────────────

function FeedInfoTooltip() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-xs font-bold flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">?
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-50 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl p-4 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">How Signal builds your feed</p>
          <p><strong className="text-zinc-700 dark:text-zinc-300">Your Feed:</strong> Crawls your saved RSS sources within the lookback window. Articles scored by recency + topic match + source tier → Must Read / Top Pick / Good Read / Explore.</p>
          <p><strong className="text-zinc-700 dark:text-zinc-300">AI News:</strong> Live headlines directly from 6 curated sources (The Decoder, TechCrunch, VentureBeat, MIT Tech Review, Import AI, Last Week in AI) — no pipeline needed.</p>
          <p><strong className="text-zinc-700 dark:text-zinc-300">Daily Digest:</strong> One story-like morning brief generated overnight from your strongest ranked articles, with optional email delivery.</p>
          <p><strong className="text-zinc-700 dark:text-zinc-300">Weekly Digest:</strong> A narrative briefing generated from your top articles of the week using your configured model provider.</p>
          <p><strong className="text-zinc-700 dark:text-zinc-300">Premium actions:</strong> Get Latest Feed, Weekly Digest Regenerate, Create, Ideas, Outline, and Voice analysis. Admin-free use requires both subscription entitlement and a configured model API key.</p>
          <p className="text-amber-700 dark:text-amber-400 font-medium">⚠ If you see no enrichment (Why it matters / Takeaways), run this SQL in Supabase:<br/><code className="font-mono text-[10px]">ALTER TABLE articles ADD COLUMN IF NOT EXISTS why_it_matters TEXT;<br/>ALTER TABLE articles ADD COLUMN IF NOT EXISTS key_takeaways TEXT[];<br/>ALTER TABLE articles ADD COLUMN IF NOT EXISTS og_image_url TEXT;</code></p>
          <button onClick={() => setOpen(false)} className="text-violet-600 dark:text-violet-400 font-medium hover:underline">Close</button>
        </div>
      )}
    </div>
  )
}

// ── PipelineConfigPanel ───────────────────────────────────────────────────────

function PipelineConfigPanel({ config, onChange, onClose }: {
  config: PipelineConfig; onChange: (c: PipelineConfig) => void; onClose: () => void
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pipeline settings</p>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Lookback — how far back to fetch articles</p>
          <div className="flex gap-2 flex-wrap">
            {[1, 3, 7, 14].map(n => (
              <button key={n} onClick={() => onChange({ ...config, lookbackDays: n })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  config.lookbackDays === n
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-violet-300'
                }`}>
                {n} day{n > 1 ? 's' : ''}{n === 7 ? ' (default)' : ''}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Max articles per source per run</p>
          <div className="flex gap-2 flex-wrap">
            {[1, 3, 5, 10].map(n => (
              <button key={n} onClick={() => onChange({ ...config, maxPerSource: n })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  config.maxPerSource === n
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-violet-300'
                }`}>
                {n}{n === 5 ? ' (default)' : ''}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-400">Settings apply to the next pipeline run. More articles = longer pipeline runtime.</p>
      </div>
    </div>
  )
}

// ── ArticleCard ───────────────────────────────────────────────────────────────

function ArticleCard({ item, reaction, onReact, selected, onSelect, onOpen, isFresh, relatedKnowledge = [] }: {
  item: FeedItem
  reaction?: 'like' | 'dislike'
  onReact: (id: string, r: 'like' | 'dislike') => void
  selected: boolean
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  isFresh?: boolean
  isEmerging?: boolean
  relatedKnowledge?: RelatedKnowledgeMatch[]
}) {
  const [expanded, setExpanded] = useState(false)
  const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
  if (!article) return null
  const bullets   = Array.isArray(article.tldr_bullets) ? article.tldr_bullets : []
  const tags      = Array.isArray(article.topic_tags) ? article.topic_tags : []
  const takeaways = Array.isArray(article.key_takeaways) ? article.key_takeaways : []
  const why       = article.why_it_matters ?? ''
  const imgUrl    = article.og_image_url ?? ''
  const pubDate   = formatPubDate(article.published_at)
  const gradient  = topicGradient(tags)
  const priority  = priorityLabel(item.blend_score)
  const scorePct = Math.max(0, Math.min(100, Math.round(item.blend_score * 100)))
  const surfacedReasons = [
    isFresh ? 'Fresh in your current window' : null,
    tags.length > 0 ? `Matched topics: ${tags.slice(0, 2).map(tag => TAG_LABELS[tag] ?? tag).join(', ')}` : null,
    item.blend_score >= 0.6 ? 'High relevance score' : item.blend_score >= 0.4 ? 'Solid relevance score' : 'Exploratory signal',
  ].filter(Boolean) as string[]

  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-2xl border overflow-hidden hover:shadow-md transition-all flex flex-col group ${
      selected  ? 'border-violet-400 dark:border-violet-600 ring-2 ring-violet-200 dark:ring-violet-900'
      : isFresh ? 'border-green-300 dark:border-green-700'
      : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
    }`}>

      {/* Banner — image if available, else gradient */}
      <a href={article.url} target="_blank" rel="noopener noreferrer"
        onClick={() => onOpen(article.id)}
        className="relative block h-36 flex-shrink-0 overflow-hidden">
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt="" className="w-full h-full object-cover" onError={e => {
            (e.currentTarget as HTMLImageElement).style.display = 'none'
            const sibling = e.currentTarget.nextElementSibling as HTMLElement | null
            if (sibling) sibling.style.display = 'block'
          }} />
        ) : null}
        <div style={{ background: gradient, display: imgUrl ? 'none' : 'block' }}
          className="absolute inset-0 opacity-90 group-hover:opacity-100 transition-opacity" />
        {/* Always-visible gradient overlay on top of image for legibility */}
        {imgUrl && <div style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)' }} className="absolute inset-0" />}
        {(isFresh) && (
          <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow z-10">
            ✦ Fresh
          </span>
        )}
        {!imgUrl && tags[0] && (
          <span className="absolute inset-0 flex items-center justify-center text-white/10 font-black text-4xl uppercase tracking-widest pointer-events-none select-none">
            {TAG_LABELS[tags[0]] ?? tags[0]}
          </span>
        )}
      </a>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${priority.cls}`}>{priority.label}</span>
          {tags.slice(0, 2).map(tag => <TagPill key={tag} tag={tag} />)}
        </div>

        <a href={article.url} target="_blank" rel="noopener noreferrer"
          onClick={() => onOpen(article.id)}
          className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-violet-600 dark:hover:text-violet-400 transition-colors leading-snug line-clamp-2 text-sm">
          {article.title}
        </a>

        {(why || takeaways.length > 0 || bullets.length > 0) ? (
          <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 p-3">
            <button onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center justify-between gap-3 text-left">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Signal notes</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {why ? 'Why this matters' : 'Key takeaways'}{takeaways.length > 0 ? ` · ${takeaways.length} takeaways` : ''}
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">Why this surfaced: {surfacedReasons[0]} · score {scorePct}/100</p>
              </div>
              <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">{expanded ? 'Hide' : 'Open'}</span>
            </button>
            {expanded && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">Ranking breakdown</p>
                  <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${scorePct}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">Blend score combines recency, topic match, source tier, your learned preference signals, and recent memory interactions.</p>
                  {typeof item.memory_boost === 'number' && item.memory_boost !== 0 && (
                    <p className="mt-1 text-[11px] text-zinc-400">Memory boost: {item.memory_boost > 0 ? '+' : ''}{Math.round(item.memory_boost * 100)}/100 from recent opens, pins, and reactions.</p>
                  )}
                </div>
                {why && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1">Why this matters</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{why}</p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">Why this surfaced</p>
                  <ul className="space-y-1">
                    {surfacedReasons.map((reason, i) => (
                      <li key={i} className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">• {reason}</li>
                    ))}
                  </ul>
                </div>
                {takeaways.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">Key takeaways</p>
                    <ul className="space-y-1.5">
                      {takeaways.map((t, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-white dark:bg-zinc-900 text-zinc-400 flex items-center justify-center text-[10px] font-semibold mt-0.5">{i+1}</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!why && takeaways.length === 0 && bullets.length > 0 && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{bullets[0]}</p>
                )}
              </div>
            )}
          </div>
        ) : null}

        {relatedKnowledge.length > 0 && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Backed by your library</p>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">
                  {relatedKnowledge[0].knowledgeTitle} · {relatedKnowledge[0].notebookTitle}
                </p>
                {relatedKnowledge[0].whyItMatters && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{relatedKnowledge[0].whyItMatters}</p>
                )}
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{Math.round(relatedKnowledge[0].matchScore * 100)}%</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <a
                href={`/knowledge/${relatedKnowledge[0].notebookId}?q=${encodeURIComponent(`What does my notebook say that helps interpret this article: ${article.title}?`)}&includeFeed=1`}
                className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Ask notebook
              </a>
              <a
                href={`/create?source=notebook&notebook_id=${relatedKnowledge[0].notebookId}`}
                className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
              >
                Use notebook in Create
              </a>
              <a
                href={`/knowledge/${relatedKnowledge[0].notebookId}`}
                className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:underline"
              >
                Open notebook
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-zinc-400 truncate">{getDomain(article.url)}</span>
            {pubDate && <><span className="text-xs text-zinc-300 dark:text-zinc-600">·</span>
            <span className="text-xs text-zinc-400 flex-shrink-0">{pubDate}</span></>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onSelect(article.id)} title={selected ? 'Remove from Create' : 'Pin for Create'}
              className={`p-1.5 rounded-lg text-sm transition-all ${selected ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-violet-400'}`}>📌</button>
            <button onClick={() => onReact(article.id, 'like')}
              className={`p-1.5 rounded-lg text-sm transition-all ${reaction === 'like' ? 'bg-green-100 dark:bg-green-900/40 text-green-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-green-500'}`}>👍</button>
            <button onClick={() => onReact(article.id, 'dislike')}
              className={`p-1.5 rounded-lg text-sm transition-all ${reaction === 'dislike' ? 'bg-red-100 dark:bg-red-900/40 text-red-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-red-500'}`}>👎</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── WeeklyArticleRow ──────────────────────────────────────────────────────────

function WeeklyArticleRow({ item, reaction, onReact }: {
  item: WeeklyItem; reaction?: 'like' | 'dislike'; onReact: (id: string, r: 'like' | 'dislike') => void
}) {
  const [expanded, setExpanded] = useState(false)
  const priority = priorityLabel(item.blend_score)
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4 hover:border-zinc-200 dark:hover:border-zinc-700 transition-all">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-1 self-stretch rounded-full" style={{ background: topicGradient(item.topic_tags) }} />
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
          {item.key_takeaways.length > 0 && (
            <div>
              {expanded && (
                <ul className="space-y-1 mb-2">
                  {item.key_takeaways.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center text-[10px] font-semibold mt-0.5">{i+1}</span>
                      {t}
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => setExpanded(e => !e)}
                className="text-xs text-zinc-400 hover:text-violet-500 font-medium transition-colors">
                {expanded ? '▲ Hide' : `▼ ${item.key_takeaways.length} takeaways`}
              </button>
            </div>
          )}
          {!item.why_it_matters && !item.key_takeaways.length && item.tldr_bullets.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{item.tldr_bullets[0]}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onReact(item.id, 'like')}
            className={`p-1.5 rounded-lg text-sm transition-all ${reaction === 'like' ? 'bg-green-100 dark:bg-green-900/40 text-green-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-green-500'}`}>👍</button>
          <button onClick={() => onReact(item.id, 'dislike')}
            className={`p-1.5 rounded-lg text-sm transition-all ${reaction === 'dislike' ? 'bg-red-100 dark:bg-red-900/40 text-red-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-red-500'}`}>👎</button>
        </div>
      </div>
    </div>
  )
}

// ── NewsCard ──────────────────────────────────────────────────────────────────

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      className="block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4 hover:shadow-md hover:border-zinc-200 dark:hover:border-zinc-700 transition-all group">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2 py-0.5 rounded-full">
          {item.source}
        </span>
        <span className="text-xs text-zinc-400">{item.category}</span>
        {item.pubDate && <span className="text-xs text-zinc-300 dark:text-zinc-600 ml-auto">{formatPubFull(item.pubDate)}</span>}
      </div>
      <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors leading-snug mb-1 line-clamp-2">
        {item.title}
      </p>
      {item.description && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">{item.description}</p>
      )}
    </a>
  )
}

function ProvenancePanel({
  label,
  mode,
  provider,
  model,
  sourceArticles,
}: {
  label: string
  mode?: string | null
  provider?: string | null
  model?: string | null
  sourceArticles?: SourceArticleMeta[]
}) {
  const articles = sourceArticles ?? []
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Why you can trust this</p>
      <div className="space-y-3 text-xs text-zinc-500 dark:text-zinc-400">
        <p><strong className="text-zinc-700 dark:text-zinc-300">Mode:</strong> {mode ?? label}</p>
        <p><strong className="text-zinc-700 dark:text-zinc-300">Model:</strong> {provider ? `${provider}${model ? ` · ${model}` : ''}` : 'Not disclosed in this response'}</p>
        <p><strong className="text-zinc-700 dark:text-zinc-300">Source basis:</strong> built from your ranked feed articles, not generic browsing.</p>
      </div>
      {articles.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 mb-2">Top source articles used</p>
          <div className="space-y-2">
            {articles.map((article, idx) => (
              <a key={`${article.url}-${idx}`} href={article.url} target="_blank" rel="noopener noreferrer"
                className="block rounded-xl border border-zinc-100 dark:border-zinc-800 px-3 py-2 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2">{article.title}</p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  {article.topic_tags.slice(0, 2).map(tag => TAG_LABELS[tag] ?? tag).join(' · ') || getDomain(article.url)}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DigestSignalStats({ items }: { items: Array<{ label: string; value: string; tone?: 'violet' | 'emerald' | 'blue' }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map(item => (
        <div key={item.label} className={`rounded-2xl border p-4 ${
          item.tone === 'emerald'
            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20'
            : item.tone === 'blue'
              ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20'
              : 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20'
        }`}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{item.label}</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

function FeedSection({ title, subtitle, items, reactions, onReact, selectedForCreate, onSelect, onOpen, freshArticleIds, relatedKnowledgeMap }: {
  title: string
  subtitle: string
  items: FeedItem[]
  reactions: Record<string, 'like' | 'dislike'>
  onReact: (id: string, r: 'like' | 'dislike') => void
  selectedForCreate: Set<string>
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  freshArticleIds: Set<string>
  relatedKnowledgeMap?: Record<string, RelatedKnowledgeMatch[]>
}) {
  if (items.length === 0) return null
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs text-zinc-400">{items.length}</span>
      </div>
      <div className="grid items-start grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item, idx) => {
          const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
          return (
            <ArticleCard
              key={`${title}-${idx}`}
              item={item}
              reaction={article ? reactions[article.id] : undefined}
              onReact={onReact}
              selected={article ? selectedForCreate.has(article.id) : false}
              onSelect={onSelect}
              onOpen={onOpen}
              isFresh={article ? freshArticleIds.has(article.id) : false}
              relatedKnowledge={article ? relatedKnowledgeMap?.[article.id] ?? [] : []}
            />
          )
        })}
      </div>
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { session, user } = useAuthSession()
  const userId = user?.id ?? process.env.NEXT_PUBLIC_USER_ID!
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [canUsePaidFeatures, setCanUsePaidFeatures] = useState(false)
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [sourceCount, setSourceCount] = useState<number | null>(null)
  const [seedingSources, setSeedingSources] = useState(false)
  const [seededSources, setSeededSources] = useState(false)

  // Tabs
  const [activeTab, setActiveTab] = useState<Tab>('feed')

  // Feed tab
  const [dateRange, setDateRange] = useState<DateRange>('today')
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTopic, setSelectedTopic] = useState<string>('all')
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortBy>('ranking')
  const [prefToast, setPrefToast] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike'>>({})
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)
  const [yesterdayItems, setYesterdayItems] = useState<FeedItem[]>([])
  const [freshArticleIds, setFreshArticleIds] = useState<Set<string>>(new Set())
  const [freshCount, setFreshCount] = useState(0)
  const [showFreshBanner, setShowFreshBanner] = useState(false)
  const [selectedForCreate, setSelectedForCreate] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const s = sessionStorage.getItem('signal_selected_articles')
      return s ? new Set(JSON.parse(s) as string[]) : new Set()
    } catch { return new Set() }
  })

  // Pipeline state
  const [triggering, setTriggering] = useState(false)
  const [pipelineStarted, setPipelineStarted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [triggerError, setTriggerError] = useState<string | null>(null)
  const [pipelineResult, setPipelineResult] = useState<string | null>(null)
  const [showAdminGate, setShowAdminGate] = useState(false)
  const [showPaidConfirm, setShowPaidConfirm] = useState(false)
  const [pendingFreeAction, setPendingFreeAction] = useState<'feed' | 'narrative' | 'daily' | null>(null)
  const [pendingPaidAction, setPendingPaidAction] = useState<'feed' | 'narrative' | 'daily' | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>(DEFAULT_CONFIG)

  // AI News tab
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsFetchedAt, setNewsFetchedAt] = useState<string | null>(null)
  const [newsFilter, setNewsFilter] = useState<string>('all')

  // Knowledge feed tab
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeFeedItem[]>([])
  const [knowledgeLoading, setKnowledgeLoading] = useState(false)
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null)
  const [knowledgeNotebooks, setKnowledgeNotebooks] = useState<KnowledgeNotebookFilter[]>([])
  const [knowledgeNotebookFilter, setKnowledgeNotebookFilter] = useState<string>('all')
  const [recallQuestion, setRecallQuestion] = useState('')
  const [recallLoading, setRecallLoading] = useState(false)
  const [recallError, setRecallError] = useState<string | null>(null)
  const [recallAnswer, setRecallAnswer] = useState<RecallAnswer | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  const [articleHistory, setArticleHistory] = useState<ArticleHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Weekly digest tab
  const [weeklyItems, setWeeklyItems] = useState<WeeklyItem[]>([])
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [narrative, setNarrative] = useState<NarrativeData | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [narrativeError, setNarrativeError] = useState<string | null>(null)
  const [narrativeMeta, setNarrativeMeta] = useState<NarrativeMeta | null>(null)
  const [weeklyView, setWeeklyView] = useState<'narrative' | 'list'>('narrative')
  const [dailyDigest, setDailyDigest] = useState<DailyDigestData | null>(null)
  const [dailyDigestMeta, setDailyDigestMeta] = useState<DigestRecord | null>(null)
  const [dailyDigestRecent, setDailyDigestRecent] = useState<DigestRecord[]>([])
  const [dailyDigestArchive, setDailyDigestArchive] = useState<DigestRecord[]>([])
  const [weeklyArchive, setWeeklyArchive] = useState<DigestRecord[]>([])
  const [dailyDigestLoading, setDailyDigestLoading] = useState(false)
  const [dailyDigestError, setDailyDigestError] = useState<string | null>(null)
  const [dailyDigestFetched, setDailyDigestFetched] = useState(false)
  const [dailyDigestProvenance, setDailyDigestProvenance] = useState<DigestProvenance | null>(null)

  const pollRef           = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevArticleIdsRef = useRef<Set<string>>(new Set())

  // ── restore localStorage state ─────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    const view = params.get('view')
    if (tab === 'feed' || tab === 'chat' || tab === 'daily' || tab === 'news' || tab === 'weekly' || tab === 'library') setActiveTab(tab)
    if (view === 'narrative' || view === 'list') setWeeklyView(view)

    try {
      const saved = localStorage.getItem(CONFIG_KEY)
      if (saved) setPipelineConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) })
    } catch {}

    const startedAt = localStorage.getItem(PIPELINE_KEY)
    if (startedAt) {
      const ts = parseInt(startedAt)
      const elapsed = Date.now() - ts
      if (elapsed < 5 * 60 * 1000) {
        setPipelineStarted(true)
        startPolling(ts)
        startElapsedTimer(ts)
      } else {
        localStorage.removeItem(PIPELINE_KEY)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshProfile = useCallback(() => {
    if (!userId) return
    fetch(`/api/data/profile?userId=${encodeURIComponent(userId)}`)
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load profile')
        setPlan(json.plan === 'pro' ? 'pro' : 'free')
        setCanUsePaidFeatures(Boolean(json.canUsePaidFeatures))
      })
      .catch(() => { setPlan('free'); setCanUsePaidFeatures(false) })
  }, [userId])

  const refreshSetupStatus = useCallback(() => {
    if (!session?.access_token || !user?.id) { setSetupStatus(null); return }
    fetch(`/api/data/setup-status?userId=${encodeURIComponent(user.id)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load setup status')
        setSetupStatus(json)
        setPlan(json.hasPaidEntitlement ? 'pro' : 'free')
        setCanUsePaidFeatures(Boolean(json.canUsePaidFeatures))
      })
      .catch(() => setSetupStatus(null))
  }, [session?.access_token, user?.id])

  useEffect(() => { refreshProfile() }, [refreshProfile])
  useEffect(() => { refreshSetupStatus() }, [refreshSetupStatus])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') { refreshProfile(); refreshSetupStatus() } }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshProfile, refreshSetupStatus])

  function saveConfig(c: PipelineConfig) {
    setPipelineConfig(c)
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(c)) } catch {}
  }

  function startElapsedTimer(startTs: number) {
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    elapsedRef.current = setInterval(() => {
      setElapsed(Date.now() - startTs)
    }, 1000)
  }
  function stopElapsedTimer() {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }
    setElapsed(0)
  }

  // ── data fetching ─────────────────────────────────────────────────────────

  const fetchFeed = useCallback(async (range: DateRange, isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    try {
      const today = isoToday()
      const url = range === 'today'
        ? `/api/data/feed?userId=${userId}&date=${today}`
        : range === '7d'
        ? `/api/data/feed?userId=${userId}&from=${daysAgoISO(7)}&to=${today}`
        : `/api/data/feed?userId=${userId}&from=${daysAgoISO(30)}&to=${today}`
      const res = await fetch(url)
      const json = await res.json()
      const newItems: FeedItem[] = json.items ?? []

      if (isRefresh) {
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
          setTimeout(() => setShowFreshBanner(false), 90000)
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

  const fetchYesterdayFeed = useCallback(async () => {
    try {
      const day = daysAgoISO(1)
      const res = await fetch(`/api/data/feed?userId=${userId}&date=${day}`)
      const json = await res.json()
      setYesterdayItems((json.items ?? []).slice(0, 6))
    } catch {
      setYesterdayItems([])
    }
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

  const fetchSourceCount = useCallback(async () => {
    if (!session?.access_token || !user?.id) {
      setSourceCount(0)
      return
    }
    try {
      const res = await fetch(`/api/data/sources?userId=${userId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      setSourceCount(Array.isArray(json.sources) ? json.sources.length : 0)
    } catch {
      setSourceCount(0)
    }
  }, [session?.access_token, user?.id, userId])

  const seedStarterSources = useCallback(async () => {
    if (!session?.access_token || !user?.id) return
    setSeedingSources(true)
    try {
      const res = await fetch('/api/sources/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: user.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not seed starter sources')
      await fetchSourceCount()
      setSeededSources(true)
      setPipelineResult(json.inserted > 0
        ? `Starter sources imported for your account (${json.inserted}). Run Get Latest Feed to build your personal feed.`
        : 'Starter sources are already present on your account.')
    } catch (e) {
      setTriggerError(String(e))
    }
    setSeedingSources(false)
  }, [session?.access_token, user?.id, fetchSourceCount])

  const fetchNews = useCallback(async () => {
    setNewsLoading(true)
    try {
      const res = await fetch('/api/data/ai-news')
      const json = await res.json()
      setNewsItems(json.items ?? [])
      setNewsFetchedAt(json.fetchedAt ?? null)
    } catch { setNewsItems([]) }
    setNewsLoading(false)
  }, [])

  const fetchKnowledgeFeed = useCallback(async () => {
    if (!session?.access_token || !user?.id) {
      setKnowledgeItems([])
      setKnowledgeNotebooks([])
      return
    }
    setKnowledgeLoading(true)
    setKnowledgeError(null)
    try {
      const suffix = knowledgeNotebookFilter !== 'all' ? `&notebookId=${encodeURIComponent(knowledgeNotebookFilter)}` : ''
      const res = await fetch(`/api/data/knowledge-feed?userId=${encodeURIComponent(user.id)}${suffix}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not load knowledge feed')
      setKnowledgeItems(json.items ?? [])
      setKnowledgeNotebooks(json.notebooks ?? [])
    } catch (e) {
      setKnowledgeError(e instanceof Error ? e.message : String(e))
      setKnowledgeItems([])
    }
    setKnowledgeLoading(false)
  }, [session?.access_token, user?.id, knowledgeNotebookFilter])

  const askRecall = useCallback(async (question?: string) => {
    const q = (question ?? recallQuestion).trim()
    if (!q || !userId) return
    setRecallLoading(true)
    setRecallError(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const token = getAdminToken()
      if (!session?.access_token && token) headers['x-admin-token'] = token
      const res = await fetch('/api/knowledge/recall', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, question: q }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not answer recall question')
      setRecallAnswer(json)
    } catch (e) {
      setRecallError(e instanceof Error ? e.message : String(e))
      setRecallAnswer(null)
    }
    setRecallLoading(false)
  }, [recallQuestion, session?.access_token, userId])

  const fetchChatHistory = useCallback(async () => {
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

  // Refresh history panel after each new recall answer is returned
  useEffect(() => {
    if (recallAnswer && activeTab === 'chat') fetchChatHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recallAnswer])

  const fetchWeekly = useCallback(async () => {
    setWeeklyLoading(true)
    try {
      const res = await fetch(`/api/data/digest?userId=${userId}&days=7`)
      const json = await res.json()
      setWeeklyItems(json.items ?? [])
    } catch {}
    setWeeklyLoading(false)
  }, [userId])

  const fetchNarrative = useCallback(async (regenerate = false, token?: string) => {
    setNarrativeLoading(true)
    setNarrativeError(null)
    if (regenerate) setNarrative(null)
    try {
      const headers: Record<string, string> = {}
      if (regenerate && session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      if (regenerate && token) headers['x-admin-token'] = token
      const res = await fetch(`/api/data/narrative?userId=${userId}&days=7`, {
        method: regenerate ? 'POST' : 'GET',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      })
      const json = await res.json()
      if (res.ok && json.narrative) {
        setNarrative(json.narrative)
        setNarrativeMeta({
          cached: Boolean(json.cached),
          generatedAt: json.generatedAt ?? null,
          articleCount: Number(json.articleCount ?? 0),
          sourceArticles: Array.isArray(json.provenance?.sourceArticles) ? json.provenance.sourceArticles : [],
          modelProvider: json.provenance?.modelProvider ?? null,
          modelName: json.provenance?.modelName ?? null,
          generationMode: json.provenance?.generationMode ?? null,
        })
      } else {
        setNarrativeError(json.error ?? 'No articles found for the last 7 days')
      }
    } catch (e) { setNarrativeError(String(e)) }
    setNarrativeLoading(false)
  }, [session?.access_token, userId])

  const fetchDailyDigest = useCallback(async () => {
    setDailyDigestLoading(true)
    setDailyDigestError(null)
    try {
      const [digestRes, archiveRes] = await Promise.all([
        fetch(`/api/data/daily-digest?userId=${userId}`),
        fetch(`/api/data/digest-archives?userId=${userId}`),
      ])
      const digestJson = await digestRes.json()
      const archiveJson = await archiveRes.json()
      if (!digestRes.ok) throw new Error(digestJson.error ?? 'Could not load daily digest')
      setDailyDigest((digestJson.current?.narrative ?? null) as DailyDigestData | null)
      setDailyDigestMeta(digestJson.current ?? null)
      setDailyDigestRecent(digestJson.recent ?? [])
      setDailyDigestArchive(archiveJson.dailyArchive ?? [])
      setWeeklyArchive(archiveJson.weeklyArchive ?? [])
      setDailyDigestProvenance(digestJson.provenance ?? null)
    } catch (e) {
      setDailyDigestError(String(e))
    }
    setDailyDigestFetched(true)
    setDailyDigestLoading(false)
  }, [userId])

  const regenerateDailyDigest = useCallback(async (token?: string) => {
    setDailyDigestLoading(true)
    setDailyDigestError(null)
    try {
      const headers: Record<string, string> = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      if (token) headers['x-admin-token'] = token
      const res = await fetch(`/api/data/daily-digest?userId=${userId}`, {
        method: 'POST',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not regenerate daily digest')
      setDailyDigest((json.current?.narrative ?? null) as DailyDigestData | null)
      setDailyDigestMeta(json.current ?? null)
      setDailyDigestFetched(true)
      setDailyDigestProvenance(json.provenance ?? null)
      await fetchDailyDigest()
    } catch (e) {
      setDailyDigestError(String(e))
      setDailyDigestLoading(false)
    }
  }, [session?.access_token, userId, fetchDailyDigest])

  useEffect(() => {
    setDailyDigest(null)
    setDailyDigestMeta(null)
    setDailyDigestRecent([])
    setDailyDigestArchive([])
    setWeeklyArchive([])
    setDailyDigestError(null)
    setDailyDigestFetched(false)
    setDailyDigestProvenance(null)
  }, [userId])

  const promptForCostlyAction = (action: 'feed' | 'narrative' | 'daily') => {
    if (canUsePaidFeatures) {
      setPendingPaidAction(action)
      setShowPaidConfirm(true)
    } else {
      setPendingFreeAction(action)
      setShowAdminGate(true)
    }
  }

  const handleNarrativeRegenerate = () => {
    promptForCostlyAction('narrative')
  }

  const handleDailyDigestRegenerate = () => {
    promptForCostlyAction('daily')
  }

  // Initial load
  useEffect(() => {
    async function autoSelectRange() {
      try {
        const res = await fetch(`/api/data/latest-date?userId=${userId}`)
        const json = await res.json()
        if (json.date && json.date < isoToday()) { setDateRange('7d'); return }
      } catch {}
      fetchFeed('today')
    }
    autoSelectRange()
    fetchReactions()
    fetchSourceCount()
    fetchYesterdayFeed()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!user?.id) return
    if (sourceCount !== 0) return
    if (seedingSources || seededSources) return
    seedStarterSources()
  }, [user?.id, sourceCount, seedingSources, seededSources, seedStarterSources])

  useEffect(() => { fetchFeed(dateRange) }, [dateRange, fetchFeed])

  useEffect(() => {
    if (user?.id && knowledgeItems.length === 0) fetchKnowledgeFeed()
    if (activeTab === 'chat' && user?.id) { fetchYesterdayFeed(); fetchChatHistory() }
    if (activeTab === 'library' && user?.id) fetchKnowledgeFeed()
    if (activeTab === 'news' && newsItems.length === 0) fetchNews()
    if (activeTab === 'daily' && !dailyDigestFetched && !dailyDigestLoading) fetchDailyDigest()
    if (activeTab === 'weekly' && weeklyItems.length === 0) fetchWeekly()
    if (activeTab === 'weekly' && weeklyView === 'narrative' && !narrative && !narrativeLoading) fetchNarrative()
  }, [activeTab, weeklyView, user?.id, knowledgeItems.length, newsItems.length, weeklyItems.length, dailyDigestFetched, dailyDigestLoading, fetchKnowledgeFeed, fetchYesterdayFeed, fetchChatHistory, fetchNews, fetchWeekly, fetchNarrative, fetchDailyDigest])

  // ── pipeline trigger ──────────────────────────────────────────────────────

  const startPolling = useCallback((startedAt?: number) => {
    if (pollRef.current) clearInterval(pollRef.current)
    const runStartedAt = startedAt || Number(localStorage.getItem(PIPELINE_KEY)) || Date.now()
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      try {
        const statusUrl = `/api/pipeline/status?userId=${encodeURIComponent(userId)}&startedAt=${encodeURIComponent(new Date(runStartedAt).toISOString())}`
        const r = await fetch(statusUrl)
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Could not read pipeline status')
        if (d.state === 'finished') {
          if (pollRef.current) clearInterval(pollRef.current)
          localStorage.removeItem(PIPELINE_KEY)
          setPipelineStarted(false)
          stopElapsedTimer()
          // GitHub runners write feed_date in UTC. A seven-day view avoids an
          // empty result around local-midnight timezone boundaries.
          const range: DateRange = '7d'
          setDateRange(range)
          await fetchFeed(range, true)
          setLastRefreshed(new Date().toISOString())
          const articleCount = Number(d.run?.articles_new ?? 0)
          setPipelineResult(articleCount > 0
            ? `Pipeline completed: ${articleCount} article${articleCount === 1 ? '' : 's'} processed.`
            : 'Pipeline completed, but no eligible articles were found. Try a larger lookback or check your source feeds.')
        } else if (attempts >= 40) {
          if (pollRef.current) clearInterval(pollRef.current)
          localStorage.removeItem(PIPELINE_KEY)
          setPipelineStarted(false)
          stopElapsedTimer()
          setTriggerError('The pipeline did not finish within 10 minutes. Check the GitHub Actions run for details.')
        }
      } catch (err) {
        if (attempts >= 40) {
          if (pollRef.current) clearInterval(pollRef.current)
          localStorage.removeItem(PIPELINE_KEY)
          setPipelineStarted(false)
          stopElapsedTimer()
          setTriggerError(String(err))
        }
      }
    }, 15000)
  }, [userId, fetchFeed])

  const doTrigger = async (token?: string) => {
    setFreshArticleIds(new Set())
    setShowFreshBanner(false)
    setTriggering(true)
    setPipelineStarted(false)
    setTriggerError(null)
    setPipelineResult(null)
    try {
      // Compare against the full recent catalogue, not only the currently
      // selected UI range, so older cards are not incorrectly labelled fresh.
      const today = isoToday()
      const knownResponse = await fetch(`/api/data/feed?userId=${userId}&from=${daysAgoISO(30)}&to=${today}`)
      const knownJson = await knownResponse.json()
      const knownItems: FeedItem[] = knownJson.items ?? items
      prevArticleIdsRef.current = new Set(
        knownItems.map(item => (Array.isArray(item.articles) ? item.articles[0] : item.articles)?.id).filter(Boolean) as string[]
      )

      const res = await fetch('/api/pipeline/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          ...(token ? { 'x-admin-token': token } : {}),
        },
        body: JSON.stringify({ userId, lookbackDays: pipelineConfig.lookbackDays, maxPerSource: pipelineConfig.maxPerSource }),
      })
      const json = await res.json()
      if (json.ok) {
        const now = Date.now()
        localStorage.setItem(PIPELINE_KEY, String(now))
        setPipelineStarted(true)
        startPolling(now)
        startElapsedTimer(now)
      } else {
        setTriggerError(json.error ?? 'Pipeline trigger failed — check GITHUB_PAT in Vercel env vars')
      }
    } catch (err) { setTriggerError(String(err)) }
    setTriggering(false)
  }

  const handleTrigger = () => {
    promptForCostlyAction('feed')
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
    const wasSelected = selectedForCreate.has(articleId)
    setSelectedForCreate(prev => {
      const next = new Set(prev)
      if (next.has(articleId)) next.delete(articleId); else next.add(articleId)
      try { sessionStorage.setItem('signal_selected_articles', JSON.stringify([...next])) } catch {}
      return next
    })
    if (!wasSelected) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const token = getAdminToken()
      if (!session?.access_token && token) headers['x-admin-token'] = token
      fetch('/api/memory/article-event', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, articleId, eventType: 'pin' }),
      }).catch(() => {})
    }
  }

  const handleArticleOpen = (articleId: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
    const token = getAdminToken()
    if (!session?.access_token && token) headers['x-admin-token'] = token
    fetch('/api/memory/article-event', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, articleId, eventType: 'open' }),
    }).catch(() => {})
  }

  const handleSavePreference = async () => {
    if (selectedTopic === 'all') return
    try {
      await fetch('/api/data/preferences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    return new Date(bA?.published_at ?? 0).getTime() - new Date(aA?.published_at ?? 0).getTime()
  })

  const publishedMs = (item: FeedItem) => {
    const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
    return new Date(article?.published_at ?? 0).getTime() || 0
  }
  const recentCutoff = Date.now() - 36 * 60 * 60 * 1000
  const emergingTopicCounts: Record<string, number> = {}
  for (const item of filteredArticles) {
    if (publishedMs(item) < recentCutoff) continue
    const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
    for (const tag of (article?.topic_tags ?? [])) emergingTopicCounts[tag] = (emergingTopicCounts[tag] ?? 0) + 1
  }
  const emergingTopics = new Set(
    Object.keys(emergingTopicCounts)
      .sort((a, b) => emergingTopicCounts[b] - emergingTopicCounts[a])
      .slice(0, 3),
  )

  const emergingNow = filteredArticles.filter(item => {
    const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
    return publishedMs(item) >= recentCutoff
      && item.blend_score >= 0.55
      && (article?.topic_tags ?? []).some(tag => emergingTopics.has(tag))
  }).slice(0, 4)

  const emergingIds = new Set(
    emergingNow.map(item => (Array.isArray(item.articles) ? item.articles[0] : item.articles)?.id).filter(Boolean) as string[],
  )

  const groupedArticles = filteredArticles.filter(item => {
    const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
    return article ? !emergingIds.has(article.id) : true
  })
  const freshSection = groupedArticles.filter(item => {
    const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
    return (article && freshArticleIds.has(article.id)) || publishedMs(item) >= recentCutoff
  })
  const freshIds = new Set(
    freshSection.map(item => (Array.isArray(item.articles) ? item.articles[0] : item.articles)?.id).filter(Boolean) as string[],
  )
  const remainingAfterFresh = groupedArticles.filter(item => {
    const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
    return article ? !freshIds.has(article.id) : true
  })
  const topPickSection = remainingAfterFresh.filter(item => item.blend_score >= 0.72)
  const topPickIds = new Set(
    topPickSection.map(item => (Array.isArray(item.articles) ? item.articles[0] : item.articles)?.id).filter(Boolean) as string[],
  )
  const goodReadSection = remainingAfterFresh.filter(item => {
    const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
    return (!article || !topPickIds.has(article.id)) && item.blend_score >= 0.52 && item.blend_score < 0.72
  })
  const goodReadIds = new Set(
    goodReadSection.map(item => (Array.isArray(item.articles) ? item.articles[0] : item.articles)?.id).filter(Boolean) as string[],
  )
  const exploreSection = remainingAfterFresh.filter(item => {
    const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
    return !article || (!topPickIds.has(article.id) && !goodReadIds.has(article.id))
  })

  // Weekly grouped by topic
  const weeklyByTopic: Record<string, WeeklyItem[]> = {}
  for (const item of weeklyItems) {
    const tag = item.topic_tags[0] ?? 'other'
    weeklyByTopic[tag] = [...(weeklyByTopic[tag] ?? []), item]
  }
  const weeklyTopics = Object.keys(weeklyByTopic).sort((a, b) => weeklyByTopic[b].length - weeklyByTopic[a].length)

  // AI news sources for filter
  const newsSources = [...new Set(newsItems.map(n => n.source))]
  const filteredNews = newsFilter === 'all' ? newsItems : newsItems.filter(n => n.source === newsFilter)

  const knowledgeFresh = knowledgeItems.filter(item => item.is_fresh || item.recency_score >= 0.85).slice(0, 6)
  const knowledgeTopPicks = knowledgeItems.filter(item => item.blend_score >= 0.72 && !knowledgeFresh.some(f => f.id === item.id)).slice(0, 8)
  const knowledgeExplore = knowledgeItems.filter(item => !knowledgeFresh.some(f => f.id === item.id) && !knowledgeTopPicks.some(f => f.id === item.id))

  const relatedKnowledgeMap: Record<string, RelatedKnowledgeMatch[]> = {}
  for (const item of filteredArticles) {
    const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
    if (!article) continue
    const articleTags = Array.isArray(article.topic_tags) ? article.topic_tags : []
    if (articleTags.length === 0) continue
    const matches = knowledgeItems
      .map(knowledge => {
        const tags = Array.isArray(knowledge.topic_tags) ? knowledge.topic_tags : []
        const overlap = tags.filter(tag => articleTags.includes(tag)).length
        if (overlap === 0) return null
        const overlapScore = overlap / Math.max(articleTags.length, 1)
        const matchScore = Math.min(1, (overlapScore * 0.65) + (knowledge.blend_score * 0.35))
        return {
          notebookId: knowledge.notebook_id,
          notebookTitle: knowledge.notebook_title,
          knowledgeTitle: knowledge.title,
          summary: knowledge.summary,
          whyItMatters: knowledge.why_it_matters,
          matchScore,
          sourceUrl: knowledge.source_url,
        } satisfies RelatedKnowledgeMatch
      })
      .filter(Boolean)
      .sort((a, b) => (b?.matchScore ?? 0) - (a?.matchScore ?? 0))
      .slice(0, 2) as RelatedKnowledgeMatch[]
    if (matches.length > 0) relatedKnowledgeMap[article.id] = matches
  }

  const personalSignalSection = filteredArticles
    .filter(item => {
      const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
      return article ? Boolean(relatedKnowledgeMap[article.id]?.length) : false
    })
    .sort((a, b) => {
      const aArticle = Array.isArray(a.articles) ? a.articles[0] : a.articles
      const bArticle = Array.isArray(b.articles) ? b.articles[0] : b.articles
      const aBoost = aArticle ? (relatedKnowledgeMap[aArticle.id]?.[0]?.matchScore ?? 0) : 0
      const bBoost = bArticle ? (relatedKnowledgeMap[bArticle.id]?.[0]?.matchScore ?? 0) : 0
      return (bBoost + b.blend_score) - (aBoost + a.blend_score)
    })
    .slice(0, 6)

  const selectedCount = selectedForCreate.size
  const isNonDefaultConfig = pipelineConfig.lookbackDays !== DEFAULT_CONFIG.lookbackDays || pipelineConfig.maxPerSource !== DEFAULT_CONFIG.maxPerSource

  // Elapsed progress estimate (pipeline typically 90-150s)
  const pipelineEstimate = 150000
  const progressPct = pipelineStarted ? Math.min(95, (elapsed / pipelineEstimate) * 100) : 0

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {showAdminGate && (
        <AdminGateModal
          persistSession={false}
          action={
            pendingFreeAction === 'narrative'
              ? 'regenerate the weekly digest'
              : pendingFreeAction === 'daily'
                ? 'regenerate the daily digest'
                : 'run the feed pipeline'
          }
          onSuccess={token => {
            setShowAdminGate(false)
            const action = pendingFreeAction
            setPendingFreeAction(null)
            if (action === 'narrative') {
              fetchNarrative(true, token)
            } else if (action === 'daily') {
              regenerateDailyDigest(token)
            } else {
              doTrigger(token)
            }
          }}
          onCancel={() => {
            setShowAdminGate(false)
            setPendingFreeAction(null)
          }} />
      )}
      {showPaidConfirm && (
        <ActionConfirmModal
          title="Confirm API usage"
          description={pendingPaidAction === 'feed'
            ? 'This will run a paid background refresh for your account. No admin credentials are needed.'
            : 'This will call your configured provider and use your stored account API key. No admin credentials are needed.'}
          confirmLabel="Proceed"
          action={
            pendingPaidAction === 'narrative'
              ? 'regenerate the weekly digest'
              : pendingPaidAction === 'daily'
                ? 'regenerate the daily digest'
                : 'run the feed pipeline'
          }
          onConfirm={() => {
            const action = pendingPaidAction
            setShowPaidConfirm(false)
            setPendingPaidAction(null)
            if (action === 'narrative') fetchNarrative(true)
            else if (action === 'daily') regenerateDailyDigest()
            else doTrigger()
          }}
          onCancel={() => {
            setShowPaidConfirm(false)
            setPendingPaidAction(null)
          }}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Feed</h1>
            <FeedInfoTooltip />
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${plan === 'pro'
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300'
              : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'}`}>
              {plan === 'pro' ? 'Pro access' : 'Free preview'}
            </span>
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
            className={`p-2 rounded-xl border transition-all ${isNonDefaultConfig
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-600'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600'}`}>
            ⚙️
          </button>
          <button onClick={handleTrigger} disabled={triggering || pipelineStarted}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors shadow-sm">
            {triggering
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />Starting…</>
              : pipelineStarted
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />Running {fmtElapsed(elapsed)}</>
              : <>{canUsePaidFeatures ? '⚡ Get Latest Feed' : '🔒 Subscription + API key required'}</>}
          </button>
        </div>
      </div>

      {/* Pipeline config */}
      {showConfig && <PipelineConfigPanel config={pipelineConfig} onChange={saveConfig} onClose={() => setShowConfig(false)} />}

      {setupStatus && !setupStatus.checklistComplete && (
        <div className="mb-5">
          <OnboardingChecklist status={setupStatus} compact />
        </div>
      )}

      {/* Pipeline running banner with progress bar */}
      {pipelineStarted && (
        <div className="mb-5 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between gap-3 text-sm text-violet-700 dark:text-violet-300">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span>
                Pipeline running · {fmtElapsed(elapsed)} elapsed · lookback {pipelineConfig.lookbackDays}d · max {pipelineConfig.maxPerSource}/source
              </span>
            </div>
            <span className="text-xs text-violet-500 flex-shrink-0">~2-3 min · feed refreshes automatically</span>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-violet-100 dark:bg-violet-900/40">
            <div className="h-full bg-violet-500 transition-all duration-1000 rounded-r-full" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Fresh feed banner */}
      {showFreshBanner && freshCount > 0 && (
        <div className="mb-5 px-4 py-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <span>✦</span>
            <span><strong>{freshCount} fresh article{freshCount !== 1 ? 's' : ''}</strong> just pulled — highlighted in green</span>
          </div>
          <button onClick={() => setShowFreshBanner(false)} className="text-green-500 hover:text-green-700 text-lg leading-none ml-4">×</button>
        </div>
      )}

      {pipelineResult && (
        <div className="mb-5 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300 flex items-center justify-between gap-3">
          <span>{pipelineResult}</span>
          <button onClick={() => setPipelineResult(null)} className="text-blue-500 hover:text-blue-700 text-lg leading-none">×</button>
        </div>
      )}

      {/* Error banner */}
      {triggerError && (
        <div className="mb-5 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <span>⚠️</span>
          <span><strong>Pipeline error:</strong> {triggerError}</span>
        </div>
      )}

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 mb-5 -mx-1 px-1">
        {([
          { id: 'feed'    as Tab, label: `Your Feed${articles.length ? ` (${articles.length})` : ''}` },
          { id: 'chat'    as Tab, label: '💬 Ask Signal' },
          { id: 'daily'   as Tab, label: '✦ Daily Digest' },
          { id: 'weekly'  as Tab, label: '📰 Weekly' },
          { id: 'news'    as Tab, label: '🌐 Live News' },
          { id: 'library' as Tab, label: `📚 Knowledge${knowledgeItems.length ? ` (${knowledgeItems.length})` : ''}` },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`pb-3 px-1 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-b-2 border-violet-600 text-violet-600'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ YOUR FEED TAB ═══════════════════════════════════════════════════ */}
      {activeTab === 'feed' && (
        <div>
          {/* Compact Ask Signal bar */}
          <button
            onClick={() => setActiveTab('chat')}
            className="w-full mb-5 flex items-center gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-left hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
          >
            <span className="text-lg">💬</span>
            <span className="flex-1 text-sm text-zinc-400 dark:text-zinc-500">Ask Signal anything about your feed or knowledge base…</span>
            <span className="text-xs font-medium text-violet-600 dark:text-violet-400 shrink-0">Ask Signal →</span>
          </button>

          {/* Date range */}
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

          {/* Topic filters */}
          {!loading && allTopics.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs text-zinc-400 font-medium">Topic</span>
              <button onClick={() => setSelectedTopic('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  selectedTopic === 'all' ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'}`}>
                All <span className="opacity-70">({articles.length})</span>
              </button>
              {allTopics.map(topic => (
                <button key={topic} onClick={() => setSelectedTopic(topic)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    selectedTopic === topic ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'}`}>
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

          {/* Sort + source */}
          {!loading && articles.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-400 font-medium">Sort</span>
                <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg">
                  {([{ id: 'ranking' as SortBy, label: '⭐ Ranking' }, { id: 'recency' as SortBy, label: '🕐 Recency' }]).map(opt => (
                    <button key={opt.id} onClick={() => setSortBy(opt.id)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        sortBy === opt.id ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
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
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline">Reset</button>
              )}
            </div>
          )}

          {prefToast && (
            <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">✓ {prefToast}</div>
          )}

          {loading ? (
            <div className="grid items-start grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0,1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">📭</div>
              {user?.id && sourceCount === 0 ? (
                <>
                  <p className="text-base font-medium text-zinc-700 dark:text-zinc-300">Your account has no sources yet</p>
                  <p className="text-sm text-zinc-400 mt-1 mb-4">
                    {seedingSources
                      ? 'Importing starter sources for your account…'
                      : 'Signal will import starter sources automatically so your first feed is not empty.'}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={seedStarterSources}
                      disabled={seedingSources}
                      className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
                    >
                      {seedingSources ? 'Importing…' : 'Import starter sources'}
                    </button>
                    <a href="/sources" className="text-sm text-violet-600 underline">Manage sources</a>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-base font-medium text-zinc-700 dark:text-zinc-300">No articles in your feed yet</p>
                  <p className="text-sm text-zinc-400 mt-1 mb-4">Click ⚡ Get Latest Feed to pull articles from your saved sources.</p>
                  <p className="text-xs text-zinc-400">Meanwhile, check the <button onClick={() => setActiveTab('news')} className="text-violet-600 underline">🌐 AI News Worldover</button> tab for live headlines.</p>
                </>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-400 mb-4">
                {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
                {selectedTopic !== 'all' || selectedDomain !== 'all' ? ' (filtered)' : ''}
                {' '}· {sortBy === 'ranking' ? 'by relevance' : 'by date'}
                {freshCount > 0 && ` · ✦ ${freshCount} fresh`}
                {personalSignalSection.length > 0 && ` · 📚 ${personalSignalSection.length} linked to your library`}
                {' '}· 📌 pin to Create
              </p>
              {personalSignalSection.length > 0 && (
                <FeedSection
                  title="Personal signal layer"
                  subtitle="Articles strengthened by your private notebook knowledge, so public news and your stored thinking work together."
                  items={personalSignalSection}
                  reactions={reactions}
                  onReact={handleReact}
                  selectedForCreate={selectedForCreate}
                  onSelect={handleSelect}
                  onOpen={handleArticleOpen}
                  freshArticleIds={freshArticleIds}
                  relatedKnowledgeMap={relatedKnowledgeMap}
                />
              )}
              {emergingNow.length > 0 && (
                <FeedSection
                  title="Emerging now"
                  subtitle="Fast-moving topics with strong relevance and fresh publication signals."
                  items={emergingNow}
                  reactions={reactions}
                  onReact={handleReact}
                  selectedForCreate={selectedForCreate}
                  onSelect={handleSelect}
                  onOpen={handleArticleOpen}
                  freshArticleIds={freshArticleIds}
                  relatedKnowledgeMap={relatedKnowledgeMap}
                />
              )}
              <FeedSection
                title="Fresh"
                subtitle="New or newly surfaced articles most likely to matter right now."
                items={freshSection}
                reactions={reactions}
                onReact={handleReact}
                selectedForCreate={selectedForCreate}
                onSelect={handleSelect}
                onOpen={handleArticleOpen}
                freshArticleIds={freshArticleIds}
                relatedKnowledgeMap={relatedKnowledgeMap}
              />
              <FeedSection
                title="Top picks"
                subtitle="Highest-confidence matches based on relevance, recency, source quality, and learned preference signals."
                items={topPickSection}
                reactions={reactions}
                onReact={handleReact}
                selectedForCreate={selectedForCreate}
                onSelect={handleSelect}
                onOpen={handleArticleOpen}
                freshArticleIds={freshArticleIds}
                relatedKnowledgeMap={relatedKnowledgeMap}
              />
              <FeedSection
                title="Good reads"
                subtitle="Solid coverage worth scanning once the priority stack is done."
                items={goodReadSection}
                reactions={reactions}
                onReact={handleReact}
                selectedForCreate={selectedForCreate}
                onSelect={handleSelect}
                onOpen={handleArticleOpen}
                freshArticleIds={freshArticleIds}
                relatedKnowledgeMap={relatedKnowledgeMap}
              />
              <FeedSection
                title="Explore"
                subtitle="Long-tail discoveries and lower-confidence matches that may still surprise you."
                items={exploreSection}
                reactions={reactions}
                onReact={handleReact}
                selectedForCreate={selectedForCreate}
                onSelect={handleSelect}
                onOpen={handleArticleOpen}
                freshArticleIds={freshArticleIds}
                relatedKnowledgeMap={relatedKnowledgeMap}
              />
            </>
          )}
        </div>
      )}

      {/* ══ ASK SIGNAL (CHAT) TAB ══════════════════════════════════════════ */}
      {activeTab === 'chat' && (
        <div className="max-w-3xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Ask Signal</h2>
            <p className="text-sm text-zinc-400 mt-1">Search across your feed and knowledge base together. Signal finds relevant articles and notes, then synthesises a grounded answer with citations.</p>
          </div>

          {/* Search box */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mb-5">
            <div className="flex gap-2">
              <input
                value={recallQuestion}
                onChange={e => setRecallQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') askRecall() }}
                placeholder="What was that agent reliability concept I saw last week?"
                className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                onClick={() => askRecall()}
                disabled={recallLoading || !recallQuestion.trim()}
                className="rounded-xl bg-violet-600 hover:bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              >
                {recallLoading ? 'Searching…' : 'Ask'}
              </button>
            </div>
            {recallError && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{recallError}</p>}
            {recallAnswer && (
              <div className="mt-5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-4">
                <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{recallAnswer.answer}</p>
                <p className="mt-3 text-[11px] text-zinc-400">Searched: {recallAnswer.feedMatches} feed articles · {recallAnswer.knowledgeMatches} knowledge items</p>
                {recallAnswer.citations.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recallAnswer.citations.slice(0, 6).map((citation, idx) => (
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

          {/* Prior questions — click to re-ask */}
          {!historyLoading && chatHistory.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mb-5">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-3">Recent questions</p>
              <div className="space-y-2">
                {chatHistory.slice(0, 8).map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setRecallQuestion(item.question); askRecall(item.question) }}
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
            </div>
          )}

          {/* Article history — "you saw this on X date" */}
          {!historyLoading && articleHistory.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mb-5">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-3">Your reading history</p>
              <div className="space-y-2">
                {articleHistory.slice(0, 10).map(item => (
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
            </div>
          )}

          {/* Continue from yesterday */}
          {yesterdayItems.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">Continue from yesterday</p>
              <p className="text-xs text-zinc-400 mb-4">Strongest signals from yesterday&apos;s feed.</p>
              <div className="space-y-3">
                {yesterdayItems.slice(0, 5).map((item, idx) => {
                  const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
                  if (!article) return null
                  return (
                    <a key={`${article.id}-${idx}`} href={article.url} target="_blank" rel="noopener noreferrer"
                      className="block rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${priorityLabel(item.blend_score).cls}`}>{priorityLabel(item.blend_score).label}</span>
                        <span className="text-[11px] text-zinc-400">{formatPubDate(article.published_at)}</span>
                      </div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">{article.title}</p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{article.why_it_matters || article.tldr_bullets?.[0] || ''}</p>
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ KNOWLEDGE FEED TAB ═════════════════════════════════════════════ */}
      {activeTab === 'library' && (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Ranked from your saved knowledge</p>
              <p className="text-xs text-zinc-400 mt-0.5">Personal links and notes scored by topic affinity, recency, and content richness.</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/knowledge"
                className="text-xs text-violet-600 dark:text-violet-400 px-3 py-1.5 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition-colors font-medium"
              >
                Manage notebooks
              </a>
              <button
                onClick={fetchKnowledgeFeed}
                disabled={knowledgeLoading || !user?.id}
                className="text-xs text-violet-600 dark:text-violet-400 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors font-medium disabled:opacity-50"
              >
                {knowledgeLoading ? 'Refreshing…' : '↺ Refresh'}
              </button>
            </div>
          </div>

          {user?.id && knowledgeNotebooks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="text-xs text-zinc-400 font-medium">Notebook</span>
              <button
                onClick={() => setKnowledgeNotebookFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  knowledgeNotebookFilter === 'all'
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'
                }`}
              >
                All ({knowledgeItems.length})
              </button>
              {knowledgeNotebooks.map(notebook => (
                <button
                  key={notebook.id}
                  onClick={() => setKnowledgeNotebookFilter(notebook.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    knowledgeNotebookFilter === notebook.id
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'
                  }`}
                >
                  {notebook.title}
                </button>
              ))}
            </div>
          )}

          {!user?.id ? (
            <div className="text-center py-16 text-zinc-400">
              <div className="text-5xl mb-4">📚</div>
              <p className="font-medium text-zinc-600 dark:text-zinc-400">Sign in to unlock your knowledge feed</p>
              <p className="text-sm mt-2">This view ranks your saved links and notes so they can become reusable source material for Ideas, Outline, and Create.</p>
            </div>
          ) : knowledgeLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : knowledgeError ? (
            <div className="text-center py-16 text-zinc-400">
              <div className="text-5xl mb-4">⚠️</div>
              <p className="font-medium text-zinc-600 dark:text-zinc-400">{knowledgeError}</p>
              <p className="text-sm mt-2">The knowledge feed is computed from notebook items that have already been processed into Signal notes.</p>
            </div>
          ) : knowledgeItems.length === 0 ? (
            <div className="text-center py-16 text-zinc-400">
              <div className="text-5xl mb-4">📝</div>
              <p className="font-medium text-zinc-600 dark:text-zinc-400">No notebook knowledge yet</p>
              <p className="text-sm mt-2">Save a few links or notes in Knowledge Base first. Signal will extract summaries, why-it-matters notes, and topic tags and then rank them here.</p>
              <a href="/knowledge" className="inline-flex mt-4 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700">Open Knowledge Base</a>
            </div>
          ) : (
            <div className="space-y-8">
              {([
                {
                  title: 'Fresh from your library',
                  subtitle: 'Recently processed knowledge with strong near-term relevance.',
                  items: knowledgeFresh,
                },
                {
                  title: 'Top knowledge picks',
                  subtitle: 'Your highest-confidence reusable context for content generation.',
                  items: knowledgeTopPicks,
                },
                {
                  title: 'Explore more',
                  subtitle: 'Long-tail saved knowledge that may be useful for niche angles or future drafts.',
                  items: knowledgeExplore,
                },
              ].filter(section => section.items.length > 0)).map(section => (
                <div key={section.title}>
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{section.title}</h3>
                    <p className="text-xs text-zinc-400 mt-1">{section.subtitle}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {section.items.map(item => (
                      <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${priorityLabel(item.blend_score).cls}`}>{priorityLabel(item.blend_score).label}</span>
                          {item.is_fresh && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500 text-white">Fresh</span>}
                        </div>
                        <p className="text-[11px] uppercase tracking-wide text-zinc-400 mb-2">{item.notebook_title}</p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug mb-2">{item.title}</p>
                        {item.summary && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-2 line-clamp-3">{item.summary}</p>
                        )}
                        {item.why_it_matters && (
                          <div className="rounded-xl border border-violet-200 dark:border-violet-900/60 bg-violet-50 dark:bg-violet-950/20 p-3 mb-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1">Why this matters</p>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-4">{item.why_it_matters}</p>
                          </div>
                        )}
                        {item.topic_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {item.topic_tags.slice(0, 4).map(tag => <TagPill key={`${item.id}-${tag}`} tag={tag} />)}
                          </div>
                        )}
                        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30 p-3 mb-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-2">Why this surfaced</p>
                          <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <div>
                              <p className="font-semibold text-zinc-700 dark:text-zinc-300">{Math.round(item.topic_score * 100)}</p>
                              <p>topic fit</p>
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-700 dark:text-zinc-300">{Math.round(item.recency_score * 100)}</p>
                              <p>recency</p>
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-700 dark:text-zinc-300">{Math.round(item.detail_score * 100)}</p>
                              <p>richness</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <div className="text-[11px] text-zinc-400">
                            {item.processed_at ? `Processed ${formatRelativeTime(item.processed_at)}` : item.created_at ? `Saved ${formatRelativeTime(item.created_at)}` : ''}
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={`/knowledge/${item.notebook_id}`} className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 underline">Notebook</a>
                            <a href={`/create?source=notebook&notebook_id=${item.notebook_id}`} className="text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline">Use in Create</a>
                            {item.source_url && (
                              <a href={item.source_url} target="_blank" rel="noreferrer" className="text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline">Open source</a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ DAILY DIGEST TAB ═══════════════════════════════════════════════ */}
      {activeTab === 'daily' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Today&apos;s consolidated story</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                One story-like daily brief generated overnight from your strongest ranked articles
                {dailyDigestMeta?.generated_at && ` · generated ${formatRelativeTime(dailyDigestMeta.generated_at)}`}
                {dailyDigestMeta?.emailed_at && ' · emailed'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchDailyDigest} disabled={dailyDigestLoading}
                className="text-xs text-violet-600 dark:text-violet-400 px-3 py-1.5 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition-colors font-medium disabled:opacity-50">
                {dailyDigestLoading ? 'Loading…' : '↺ Refresh view'}
              </button>
              <button onClick={handleDailyDigestRegenerate} disabled={dailyDigestLoading}
                className="text-xs text-violet-600 dark:text-violet-400 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors font-medium disabled:opacity-50">
                {dailyDigestLoading ? 'Writing…' : canUsePaidFeatures ? '↺ Regenerate' : '🔒 Subscription + API key required'}
              </button>
            </div>
          </div>

          {dailyDigestLoading ? (
            <div className="space-y-4">
              <div className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse w-2/3" />
              <div className="h-48 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />
            </div>
          ) : dailyDigestError ? (
            <div className="text-center py-16 text-zinc-400">
              <div className="text-5xl mb-4">📭</div>
              <p className="font-medium text-zinc-600 dark:text-zinc-400">{dailyDigestError}</p>
              <p className="text-sm mt-2">Daily digests are generated by the overnight pipeline and can also be delivered by email if enabled in Settings.</p>
            </div>
          ) : dailyDigest ? (
            <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="space-y-6">
                <DigestSignalStats items={[
                  { label: 'Coverage window', value: dailyDigestMeta?.digest_date ? formatPubDate(dailyDigestMeta.digest_date) : 'Today', tone: 'emerald' },
                  { label: 'Articles used', value: String(dailyDigestMeta?.article_count ?? 0), tone: 'violet' },
                  { label: 'Top topics', value: (dailyDigestMeta?.dominant_topics ?? []).slice(0, 2).join(' · ') || 'Mixed signals', tone: 'blue' },
                ]} />
                <div className="border-l-4 border-emerald-500 pl-4">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide mb-1">The day in one line</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-snug">{dailyDigest.headline}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">The signal today</p>
                  <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{dailyDigest.signal}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-5">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-3">Why this matters</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{dailyDigest.takeaway}</p>
                </div>
              </div>
              <div className="space-y-5">
                <ProvenancePanel
                  label="Pipeline-generated daily digest"
                  mode={dailyDigestProvenance?.generationMode}
                  provider={dailyDigestProvenance?.modelProvider}
                  model={dailyDigestProvenance?.modelName}
                  sourceArticles={dailyDigestProvenance?.sourceArticles}
                />
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Why read this first</p>
                  <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <li>• It compresses today&apos;s strongest ranked signals into one connected story.</li>
                    <li>• It flags what changed in models, tools, and practitioner conversations.</li>
                    <li>• It ends with a practical takeaway rather than generic market commentary.</li>
                  </ul>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Daily highlights</p>
                  <div className="space-y-3">
                    {dailyDigest.highlights.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{item.why}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Recent daily briefs</p>
                  <div className="space-y-2">
                    {dailyDigestRecent.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 px-3 py-2">
                        <div>
                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{formatPubDate(item.digest_date)}</p>
                          <p className="text-[11px] text-zinc-400">{item.article_count} articles · {(item.dominant_topics ?? []).slice(0, 2).join(' · ')}</p>
                        </div>
                        <span className="text-[11px] text-zinc-400">{formatRelativeTime(item.generated_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {(dailyDigestArchive.length > 0 || weeklyArchive.length > 0) && (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Archives</p>
                    {dailyDigestArchive.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 mb-2">Daily archive · older than 7 days</p>
                        <div className="space-y-2">
                          {dailyDigestArchive.slice(0, 6).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                              <span>{formatPubDate(item.digest_date)}</span>
                              <span>{item.article_count} articles</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {weeklyArchive.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 mb-2">Weekly archive · older than 8 weeks</p>
                        <div className="space-y-2">
                          {weeklyArchive.slice(0, 6).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                              <span>Week of {formatPubDate(item.week_start)}</span>
                              <span>{item.article_count} articles</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-zinc-400">
              <div className="text-5xl mb-4">🗞️</div>
              <p className="font-medium text-zinc-600 dark:text-zinc-400">No daily digest yet</p>
              <p className="text-sm mt-2">Daily digests are generated by the overnight pipeline after it ranks your articles for the day.</p>
              <p className="text-sm mt-1">If you just enabled this feature, run the feed pipeline once and then refresh this view.</p>
            </div>
          )}
        </div>
      )}

      {/* ══ AI NEWS WORLDOVER TAB ═══════════════════════════════════════════ */}
      {activeTab === 'news' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Live AI headlines from 6 curated sources</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                The Decoder · TechCrunch AI · VentureBeat · MIT Tech Review · Import AI · Last Week in AI
                {newsFetchedAt && ` · fetched ${formatRelativeTime(newsFetchedAt)}`}
              </p>
            </div>
            <button onClick={fetchNews} disabled={newsLoading}
              className="text-xs text-violet-600 dark:text-violet-400 px-3 py-1.5 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition-colors font-medium disabled:opacity-50">
              {newsLoading ? 'Fetching…' : '↺ Refresh'}
            </button>
          </div>

          {/* Source filter */}
          {!newsLoading && newsSources.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              <button onClick={() => setNewsFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  newsFilter === 'all' ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'}`}>
                All ({newsItems.length})
              </button>
              {newsSources.map(s => (
                <button key={s} onClick={() => setNewsFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    newsFilter === s ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'}`}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {newsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0,1,2,3,4,5,6,7,8].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="text-center py-16 text-zinc-400">
              <div className="text-5xl mb-4">🌐</div>
              <p className="font-medium">No news fetched yet</p>
              <p className="text-sm mt-1">Click Refresh to load live AI headlines.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredNews.map((item, i) => <NewsCard key={i} item={item} />)}
            </div>
          )}
        </div>
      )}

      {/* ══ WEEKLY DIGEST TAB ═══════════════════════════════════════════════ */}
      {activeTab === 'weekly' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Last 7 days · intelligence briefing</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Your configured model connects your top articles with worldwide AI coverage
                {narrativeMeta?.generatedAt && ` · ${narrativeMeta.cached ? 'cached' : 'generated'} ${formatRelativeTime(narrativeMeta.generatedAt)}`}
                {narrativeMeta?.articleCount ? ` · ${narrativeMeta.articleCount} articles` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg">
                {([{ id: 'narrative' as const, label: '📰 Narrative' }, { id: 'list' as const, label: '📋 List' }]).map(v => (
                  <button key={v.id} onClick={() => setWeeklyView(v.id)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      weeklyView === v.id ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {v.label}
                  </button>
                ))}
              </div>
              {weeklyView === 'narrative' && (
                <button onClick={handleNarrativeRegenerate} disabled={narrativeLoading}
                  className="text-xs text-violet-600 dark:text-violet-400 px-3 py-1.5 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition-colors font-medium disabled:opacity-50">
                  {narrativeLoading ? 'Writing briefing…' : canUsePaidFeatures ? '↺ Regenerate' : '🔒 Subscription + API key required'}
                </button>
              )}
            </div>
          </div>

          {/* Narrative view */}
          {weeklyView === 'narrative' && (
            <div>
              {narrativeLoading ? (
                <div className="space-y-4">
                  <div className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse w-2/3" />
                  <div className="h-48 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />
                  <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />
                </div>
              ) : narrativeError ? (
                <div className="text-center py-16 text-zinc-400">
                  <div className="text-5xl mb-4">📭</div>
                  <p className="font-medium text-zinc-600 dark:text-zinc-400">{narrativeError}</p>
                  <p className="text-sm mt-2">The article feed is available. Regenerate is a Pro action because it triggers a fresh personalized briefing on your configured model provider.</p>
                </div>
              ) : narrative ? (
                <div className="space-y-6 max-w-2xl">
                  <DigestSignalStats items={[
                    { label: 'Window', value: 'Last 7 days', tone: 'violet' },
                    { label: 'Articles used', value: String(narrativeMeta?.articleCount ?? 0), tone: 'blue' },
                    { label: 'Generation', value: narrativeMeta?.cached ? 'Cached brief' : 'Fresh analysis', tone: 'emerald' },
                  ]} />
                  <ProvenancePanel
                    label="Weekly digest"
                    mode={narrativeMeta?.generationMode}
                    provider={narrativeMeta?.modelProvider}
                    model={narrativeMeta?.modelName}
                    sourceArticles={narrativeMeta?.sourceArticles}
                  />
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">What this briefing is trying to do</p>
                    <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                      <li>• connect your strongest ranked articles with broader AI world developments</li>
                      <li>• explain where the practitioner conversation is moving</li>
                      <li>• identify the few developments that are actually worth watching next</li>
                    </ul>
                  </div>
                  {/* Headline */}
                  <div className="border-l-4 border-violet-600 pl-4">
                    <p className="text-xs text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-wide mb-1">The Week In One Sentence</p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-snug">{narrative.headline}</p>
                  </div>

                  {/* Signal */}
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">The Signal This Week</p>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {narrative.signal}
                    </div>
                  </div>

                  {/* Watch */}
                  {narrative.watch?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Three Things To Watch</p>
                      <div className="space-y-3">
                        {narrative.watch.map((w, i) => (
                          <div key={i} className="flex gap-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                            <div>
                              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{w.item}</p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{w.why}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Practitioner takeaway */}
                  {narrative.takeaway && (
                    <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-2xl p-5">
                      <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-2">Practitioner Takeaway</p>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{narrative.takeaway}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-400">
                  <p className="text-sm">Click Regenerate to write this week&apos;s briefing. It is a Pro action because it incurs LLM cost.</p>
                </div>
              )}
            </div>
          )}

          {/* List view */}
          {weeklyView === 'list' && (
            <div>
              {weeklyLoading ? (
                <div className="space-y-3">{[0,1,2,3,4].map(i => <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />)}</div>
              ) : weeklyItems.length === 0 ? (
                <div className="text-center py-16 text-zinc-400">
                  <div className="text-5xl mb-4">📭</div>
                  <p>No articles in the last 7 days. Run the pipeline first.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {weeklyTopics.map(topic => (
                    <div key={topic}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-3 h-3 rounded-full" style={{ background: topicGradient([topic]) }} />
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{TAG_LABELS[topic] ?? topic}</h3>
                        <span className="text-xs text-zinc-400">{weeklyByTopic[topic].length} article{weeklyByTopic[topic].length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-2">
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
      )}
    </div>
  )
}
