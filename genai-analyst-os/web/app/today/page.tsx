'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { ActionConfirmModal, AdminGateModal } from '@/components/AdminGate'
import AskSignalPanel from '@/components/AskSignalPanel'
import { useAuthSession } from '@/lib/useAuthSession'

interface StreakInfo {
  currentStreak: number
  longestStreak: number
  last7Days: number
  last30Days: number
  todayComplete: boolean
  nextMilestone: number | null
  isMilestoneToday: boolean
}

interface QueueEntry {
  id: string
  itemType: 'feed' | 'reading_list' | 'news'
  title: string
  url: string | null
  sourceLabel: string
  estMinutes: number
  score: number
  status: 'unread' | 'read' | 'skipped'
  rank: number
  summary: string | null
  whyItMatters: string | null
  takeaways: string[]
}

interface DraftItem {
  id: string
  topic: string
  format: string
  final_content: string
  source_title: string | null
  source_url: string | null
  status: 'pending' | 'approved' | 'dismissed'
  created_at: string
  published_platforms?: string[]
}

const MINUTE_OPTIONS = [10, 15, 20, 30]

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const hrs = Math.floor(diff / 3600000)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  } catch { return '' }
}

function draftPreview(content: string): { headline: string; teaser: string } {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const headline = (lines[0] || 'Untitled draft').slice(0, 100)
  const rest = lines.slice(1).join(' ')
  const teaser = (rest.split(/(?<=[.?!])\s/)[0] || rest).slice(0, 160)
  return { headline, teaser }
}

function SimpleModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// The two daily jobs — "what to read" and "what to review & publish" —
// live on one landing page so a signed-in user needs zero navigation
// decisions to do either. Everything else (Feed, News, Reading List,
// Ideas, Create) is one click away below, for whoever has time to go deeper.
export default function TodayPage() {
  const { session, user, loading } = useAuthSession()
  const userId = user?.id ?? ''

  const authHeaders = (): Record<string, string> =>
    session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}

  // ── Reading queue ────────────────────────────────────────────────────
  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [targetMinutes, setTargetMinutes] = useState(15)
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false)
  const [showReadingInfo, setShowReadingInfo] = useState(false)
  const [showPublishingInfo, setShowPublishingInfo] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [savingMinutes, setSavingMinutes] = useState(false)

  const fetchQueue = async () => {
    if (!userId) return
    setQueueLoading(true)
    setQueueError(null)
    try {
      const res = await fetch(`/api/today/queue?userId=${encodeURIComponent(userId)}`, { headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not load today\'s queue')
      setEntries(json.entries ?? [])
      setTargetMinutes(json.targetMinutes ?? 15)
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : String(e))
    }
    setQueueLoading(false)
  }

  const refreshQueue = async () => {
    setShowRefreshConfirm(false)
    setRefreshing(true)
    setQueueError(null)
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
      setQueueError(e instanceof Error ? e.message : String(e))
    }
    setRefreshing(false)
  }

  const setQueueStatus = async (queueItemId: string, status: 'read' | 'skipped' | 'unread') => {
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
      if (status === 'read') fetchStreaks()
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : String(e))
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
      setQueueError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingMinutes(false)
    }
  }

  const openItemLink = (entry: QueueEntry) => {
    if (entry.url) window.open(entry.url, '_blank', 'noopener,noreferrer')
    if (entry.status === 'unread') setQueueStatus(entry.id, 'read')
  }

  const toggleExpand = (entryId: string) => {
    setExpandedId(prev => prev === entryId ? null : entryId)
  }

  // ── Drafts (Share Your Voice) ────────────────────────────────────────
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [draftsLoading, setDraftsLoading] = useState(true)
  const [draftsError, setDraftsError] = useState<string | null>(null)
  const [draftActioning, setDraftActioning] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [draftFormatFilter, setDraftFormatFilter] = useState<string>('all')
  const [canUsePaidFeatures, setCanUsePaidFeatures] = useState(false)
  const [streaks, setStreaks] = useState<{ reading: StreakInfo; publishing: StreakInfo } | null>(null)
  const [smartGenerating, setSmartGenerating] = useState(false)
  const [smartGenerateError, setSmartGenerateError] = useState<string | null>(null)
  const [smartGenerateNote, setSmartGenerateNote] = useState<string | null>(null)
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)
  const [showGenerateAdminGate, setShowGenerateAdminGate] = useState(false)
  const [showPlatformPicker, setShowPlatformPicker] = useState(false)
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['linkedin'])
  const [ideaCount, setIdeaCount] = useState(1)
  const [showAllIdeas, setShowAllIdeas] = useState(false)
  const [askExternalQuestion, setAskExternalQuestion] = useState<{ text: string; nonce: number } | null>(null)

  const askAbout = (title: string) => {
    setAskExternalQuestion({ text: `Tell me about "${title}" and why it matters.`, nonce: Date.now() })
    document.getElementById('today-ask-signal')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null)
  const [customTopic, setCustomTopic] = useState('')
  const [feedbackDraftId, setFeedbackDraftId] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([])
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [publishNote, setPublishNote] = useState<string | null>(null)

  const fetchDrafts = async () => {
    if (!userId) return
    setDraftsLoading(true)
    setDraftsError(null)
    try {
      const res = await fetch(`/api/drafts-inbox/items?userId=${encodeURIComponent(userId)}`, { headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not load Drafts Inbox')
      setDrafts(json.items ?? [])
    } catch (e) {
      setDraftsError(e instanceof Error ? e.message : String(e))
    }
    setDraftsLoading(false)
  }

  const reviewDraft = async (itemId: string, action: 'approve' | 'dismiss') => {
    setDraftActioning(itemId)
    try {
      const res = await fetch('/api/drafts-inbox/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId, itemId, action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not update this draft')
      setDrafts(prev => prev.map(item => item.id === itemId ? { ...item, status: json.status } : item))
      if (action === 'approve') fetchStreaks()
    } catch (e) {
      setDraftsError(e instanceof Error ? e.message : String(e))
    }
    setDraftActioning(null)
  }

  const copyDraft = (draft: DraftItem) => {
    navigator.clipboard?.writeText(draft.final_content)
    setCopiedId(draft.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const fetchProfile = async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/data/profile?userId=${encodeURIComponent(userId)}`, { headers: authHeaders() })
      const json = await res.json()
      if (res.ok) setCanUsePaidFeatures(Boolean(json.canUsePaidFeatures))
    } catch {}
    try {
      const res = await fetch(`/api/data/drafts-inbox-settings?userId=${encodeURIComponent(userId)}`, { headers: authHeaders() })
      const json = await res.json()
      if (res.ok && json.format) setSelectedFormats([json.format])
    } catch {}
  }

  const fetchStreaks = async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/today/streaks?userId=${encodeURIComponent(userId)}`, { headers: authHeaders() })
      const json = await res.json()
      if (res.ok) setStreaks(json)
    } catch {}
  }

  const fetchConnections = async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/data/platform-connections?userId=${encodeURIComponent(userId)}`, { headers: authHeaders() })
      const json = await res.json()
      if (res.ok) setConnectedPlatforms(json.connected ?? [])
    } catch {}
  }

  const publishTo = async (draftId: string, platform: 'medium' | 'linkedin' | 'x' | 'email') => {
    setPublishingId(draftId)
    setPublishNote(null)
    try {
      const res = await fetch('/api/today/draft/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId, itemId: draftId, platform }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Publish failed')
      setPublishNote(json.message)
      if (json.ok) await fetchDrafts()
    } catch (e) {
      setPublishNote(e instanceof Error ? e.message : String(e))
    }
    setPublishingId(null)
  }

  useEffect(() => {
    if (!loading) { fetchQueue(); fetchDrafts(); fetchProfile(); fetchStreaks(); fetchConnections() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.access_token, userId])

  const doSmartGenerate = async (adminToken?: string) => {
    setSmartGenerating(true)
    setSmartGenerateError(null)
    setSmartGenerateNote(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      if (adminToken) headers['x-admin-token'] = adminToken
      const res = await fetch('/api/today/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, customTopic: customTopic.trim() || undefined, formats: selectedFormats, ideaCount: customTopic.trim() ? 1 : ideaCount }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not generate content')
      if (json.skipped) setSmartGenerateNote(json.skipped)
      else {
        setSmartGenerateNote(`Generated ${json.drafts.length} draft${json.drafts.length !== 1 ? 's' : ''}: ${json.drafts.map((d: { format: string }) => d.format).join(', ')}.`)
        setCustomTopic('')
      }
      await fetchDrafts()
    } catch (e) {
      setSmartGenerateError(e instanceof Error ? e.message : String(e))
    }
    setSmartGenerating(false)
  }

  const handleSmartGenerateClick = () => {
    setShowPlatformPicker(true)
  }

  const toggleFormatSelection = (format: string) => {
    setSelectedFormats(prev => prev.includes(format) ? prev.filter(f => f !== format) : [...prev, format])
  }

  const confirmPlatformPicker = () => {
    if (selectedFormats.length === 0) return
    setShowPlatformPicker(false)
    if (canUsePaidFeatures) setShowGenerateConfirm(true)
    else setShowGenerateAdminGate(true)
  }

  const submitFeedback = async (draftId: string) => {
    if (!feedbackText.trim()) return
    setFeedbackSubmitting(true)
    try {
      const res = await fetch('/api/today/draft/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId, itemId: draftId, feedback: feedbackText.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not regenerate this draft')
      setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, final_content: json.finalContent } : d))
      setFeedbackDraftId(null)
      setFeedbackText('')
    } catch (e) {
      setDraftsError(e instanceof Error ? e.message : String(e))
    }
    setFeedbackSubmitting(false)
  }

  const pendingEntries = entries.filter(e => e.status === 'unread')
  const doneEntries = entries.filter(e => e.status !== 'unread')
  const progressPct = entries.length > 0 ? Math.min(100, Math.round((doneEntries.length / entries.length) * 100)) : 0
  const allDone = entries.length > 0 && pendingEntries.length === 0
  const pendingDrafts = drafts.filter(d => d.status === 'pending')
  const draftFormats = Array.from(new Set(drafts.map(d => d.format)))
  const filteredPendingDrafts = draftFormatFilter === 'all' ? pendingDrafts : pendingDrafts.filter(d => d.format === draftFormatFilter)
  // Group by idea (topic) so "N ideas" surfaces as distinct clusters rather
  // than a flat list where multi-format variants of the same idea blend in
  // with genuinely different ideas.
  const draftIdeaGroups = Object.values(
    filteredPendingDrafts.reduce<Record<string, DraftItem[]>>((acc, d) => {
      (acc[d.topic] ??= []).push(d)
      return acc
    }, {})
  ).sort((a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime())
  const visibleIdeaGroups = showAllIdeas ? draftIdeaGroups : draftIdeaGroups.slice(0, 3)

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 pb-24">
      {showGenerateAdminGate && (
        <AdminGateModal
          persistSession={false}
          action="generate today's content"
          onSuccess={token => { setShowGenerateAdminGate(false); doSmartGenerate(token) }}
          onCancel={() => setShowGenerateAdminGate(false)}
        />
      )}
      {showGenerateConfirm && (
        <ActionConfirmModal
          title="Confirm API usage"
          description={`Picks your best-engaged topic and writes it up for ${selectedFormats.join(', ')}${selectedFormats.length > 1 ? ' — first one gets the full pipeline, the rest are cheap adapted variants of it' : ''} — uses your configured model, costs API credits.`}
          confirmLabel="Generate"
          action="generate today's content"
          onConfirm={() => { setShowGenerateConfirm(false); doSmartGenerate() }}
          onCancel={() => setShowGenerateConfirm(false)}
        />
      )}
      {showPlatformPicker && (
        <SimpleModal title="Which platform(s)?" onClose={() => setShowPlatformPicker(false)}>
          <p className="text-xs text-zinc-400 mb-3">The first one gets the full evidence-grounded pipeline; any others are cheap adapted variants of that same draft.</p>
          <div className="space-y-2 mb-4">
            {[
              { id: 'linkedin', label: 'LinkedIn' },
              { id: 'substack', label: 'Substack' },
              { id: 'thread', label: 'Twitter/X Thread' },
              { id: 'blog', label: 'Blog Post' },
              { id: 'youtube_long', label: 'YouTube Long Script' },
              { id: 'youtube_short', label: 'YouTube Short Script' },
            ].map(({ id, label }) => (
              <label key={id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                <input type="checkbox" checked={selectedFormats.includes(id)} onChange={() => toggleFormatSelection(id)} />
                {label}
              </label>
            ))}
          </div>
          {!customTopic.trim() && (
            <div className="mb-4">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">How many different ideas? (diversity — each gets its own full generation)</p>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setIdeaCount(n)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${ideaCount === n ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}>
                    {n} idea{n > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={confirmPlatformPicker} disabled={selectedFormats.length === 0}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-2 text-sm font-bold text-white transition-colors">
            Continue
          </button>
        </SimpleModal>
      )}
      {showRefreshConfirm && (
        <SimpleModal title="Refresh your reading queue?" onClose={() => setShowRefreshConfirm(false)}>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            You&apos;ll get a new set of about {Math.max(1, pendingEntries.length)} item{pendingEntries.length === 1 ? '' : 's'}, re-ranked from your Feed and Reading List. Anything you&apos;ve already marked read or skipped today stays untouched — only your remaining unread items get replaced.
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={refreshQueue} className="rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2 text-sm font-bold text-white transition-colors">Yes, refresh</button>
            <button onClick={() => setShowRefreshConfirm(false)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">Cancel</button>
          </div>
        </SimpleModal>
      )}
      {showReadingInfo && (
        <SimpleModal title="How Your Daily Reading is built" onClose={() => setShowReadingInfo(false)}>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed list-disc list-inside">
            <li>Pulled from two places: your <strong>Feed</strong> (ranked by topic affinity, using the same scoring as the Feed tab) and your <strong>Reading List</strong> (ranked by topic affinity + how recently it was processed).</li>
            <li>Items are merged and filled in, best first, until they add up to about your daily minute target — estimated from actual word count, not a flat guess.</li>
            <li>Anything you&apos;ve already marked read stays out of the pool for 14 days, so the queue doesn&apos;t repeat itself.</li>
            <li>Refreshing only replaces items you haven&apos;t acted on yet — read/skipped items from today are never touched.</li>
          </ul>
        </SimpleModal>
      )}
      {showPublishingInfo && (
        <SimpleModal title="How Your Daily Publishing picks a topic" onClose={() => setShowPublishingInfo(false)}>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed list-disc list-inside">
            <li>Blends five signals: explicit engagement (likes/pins), what you&apos;ve recently read, trending news relevant to your feed, and emerging/trending topics — each weighted, adjustable in <Link href="/settings" className="text-violet-600 dark:text-violet-400 hover:underline">Settings</Link>.</li>
            <li>Your declared interest areas modulate every candidate&apos;s score rather than competing as their own signal.</li>
            <li>A signal with nothing to go on some day (e.g. no emerging topics) drops out and its weight redistributes across the others automatically.</li>
            <li>Type a custom topic to skip the picker entirely and write about exactly what you choose.</li>
            <li>The primary draft is written for your configured platform, then cheaply adapted into one naturally paired platform (e.g. LinkedIn → Thread) — same idea, not a second full generation.</li>
          </ul>
        </SimpleModal>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">👋 Today</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Two jobs: read what matters, review what's ready to publish. Everything else is one click away below.</p>
      </div>

      {streaks && (streaks.reading.currentStreak > 0 || streaks.publishing.currentStreak > 0 || streaks.reading.isMilestoneToday || streaks.publishing.isMilestoneToday) && (
        <div className="mb-8 grid grid-cols-2 gap-4">
          {([
            { info: streaks.reading, label: 'Reading streak', icon: '📖' },
            { info: streaks.publishing, label: 'Publishing streak', icon: '🗣️' },
          ] as const).map(({ info, label, icon }) => (
            <div key={label} className={`rounded-2xl border p-4 ${info.isMilestoneToday ? 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{info.currentStreak > 0 ? '🔥' : icon}</span>
                <div>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{info.currentStreak} day{info.currentStreak === 1 ? '' : 's'}</p>
                  <p className="text-[11px] text-zinc-400">{label} · {info.last7Days}/7 this week · {info.last30Days}/30 this month</p>
                </div>
              </div>
              {info.isMilestoneToday && (
                <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">🎉 {info.currentStreak}-day milestone — nice consistency!</p>
              )}
              {!info.isMilestoneToday && info.nextMilestone && (
                <p className="mt-2 text-[11px] text-zinc-400">{info.nextMilestone - info.currentStreak} more day{info.nextMilestone - info.currentStreak === 1 ? '' : 's'} to a {info.nextMilestone}-day streak</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2 mb-10">
      {/* ══ JOB 1: What to read ═══════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">📋 Your Daily Reading</h2>
            <button onClick={() => setShowReadingInfo(true)} className="text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 text-sm" title="How is this list built?">ⓘ</button>
          </div>
          <button onClick={() => setShowRefreshConfirm(true)} disabled={refreshing || queueLoading || entries.length === 0}
            className="text-xs text-violet-600 dark:text-violet-400 px-3 py-1.5 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition-colors font-medium disabled:opacity-50 shrink-0">
            {refreshing ? 'Refreshing…' : '↺ Refresh'}
          </button>
        </div>
        <p className="text-xs text-zinc-400 mb-3">Blended from Feed and Reading List — about {targetMinutes} minutes. Click any item for a quick summary, or open it to read in full.</p>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-zinc-400">Daily target:</span>
          {MINUTE_OPTIONS.map(m => (
            <button key={m} onClick={() => changeTargetMinutes(m)} disabled={savingMinutes}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                targetMinutes === m ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'}`}>
              {m}m
            </button>
          ))}
        </div>

        {queueError && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{queueError}</p>}

        {entries.length > 0 && (
          <div className="mb-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              <span>{doneEntries.length} / {entries.length} items done</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full bg-violet-600 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            {allDone && <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">✅ All done for today — nice work.</p>}
          </div>
        )}

        {queueLoading ? (
          <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />)}</div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing queued yet — add sources to your <Link href="/feed" className="text-violet-600 dark:text-violet-400 hover:underline">Feed</Link> or <Link href="/knowledge" className="text-violet-600 dark:text-violet-400 hover:underline">Reading List</Link>, then refresh.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingEntries.map(entry => {
              const expanded = expandedId === entry.id
              const previewText = entry.whyItMatters || entry.summary || (entry.takeaways[0] ?? '')
              return (
                <div key={entry.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-violet-300 dark:hover:border-violet-700 transition-colors overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <button onClick={() => setQueueStatus(entry.id, 'read')} disabled={actioningId === entry.id}
                      className="shrink-0 w-6 h-6 rounded-full border-2 border-zinc-300 dark:border-zinc-600 hover:border-violet-500 transition-colors" title="Mark as read" />
                    <button onClick={() => toggleExpand(entry.id)} className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2 py-0.5 rounded-full shrink-0">
                          {entry.itemType === 'feed' ? '📰' : entry.itemType === 'news' ? '🌐' : '📖'} {entry.sourceLabel}
                        </span>
                        <span className="text-xs text-zinc-400 shrink-0">~{entry.estMinutes.toFixed(0)} min</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{entry.title}</p>
                      {!expanded && previewText && <p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">{previewText}</p>}
                    </button>
                    <button onClick={() => setQueueStatus(entry.id, 'skipped')} disabled={actioningId === entry.id}
                      className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">Skip</button>
                  </div>
                  {expanded && (
                    <div className="px-4 pb-4 pl-[3.25rem]">
                      {entry.summary && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-2">{entry.summary}</p>
                      )}
                      {entry.whyItMatters && (
                        <div className="rounded-xl border border-violet-100 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 p-3 mb-2">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1">Why it matters</p>
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{entry.whyItMatters}</p>
                        </div>
                      )}
                      {entry.takeaways.length > 0 && (
                        <ul className="space-y-1 mb-2">
                          {entry.takeaways.map((t, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                              <span className="flex-shrink-0 w-4 h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center text-[10px] font-semibold mt-0.5">{i + 1}</span>
                              {t}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex items-center gap-3">
                        {entry.url && (
                          <button onClick={() => openItemLink(entry)} className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">Open full article ↗</button>
                        )}
                        <button onClick={() => askAbout(entry.title)} className="text-xs font-semibold text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400">💬 Ask about this</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {doneEntries.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-2">Done today</p>
                <div className="space-y-1.5">
                  {doneEntries.map(entry => (
                    <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-2.5">
                      <button onClick={() => setQueueStatus(entry.id, 'unread')} disabled={actioningId === entry.id}
                        className="shrink-0 text-sm hover:opacity-60 transition-opacity" title="Move back to unread">
                        {entry.status === 'read' ? '✅' : '⏭️'}
                      </button>
                      <p className="flex-1 min-w-0 text-sm text-zinc-500 dark:text-zinc-400 truncate line-through">{entry.title}</p>
                      <button onClick={() => setQueueStatus(entry.id, 'unread')} disabled={actioningId === entry.id}
                        className="shrink-0 text-[11px] font-medium text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400">↩ Undo</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══ JOB 2: What to review & publish ═════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">🗣️ Your Daily Publishing</h2>
            <button onClick={() => setShowPublishingInfo(true)} className="text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 text-sm" title="How is this picked?">ⓘ</button>
          </div>
          <button onClick={handleSmartGenerateClick} disabled={smartGenerating}
            className="text-xs text-violet-600 dark:text-violet-400 px-3 py-1.5 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition-colors font-medium disabled:opacity-50 shrink-0">
            {smartGenerating ? 'Generating…' : '✨ Generate today\'s content'}
          </button>
        </div>
        <p className="text-xs text-zinc-400 mb-3">Auto-drafted from what you've been reading, or generate on demand. Nothing publishes without your approval. Opt in or out, and choose the target platform, in <Link href="/settings" className="text-violet-600 dark:text-violet-400 hover:underline">Settings</Link>.</p>

        <input value={customTopic} onChange={e => setCustomTopic(e.target.value)}
          placeholder="Optional: type a custom topic instead of auto-picking one…"
          className="w-full mb-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-violet-500" />

        {smartGenerateError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{smartGenerateError}</p>}
        {smartGenerateNote && <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">{smartGenerateNote}</p>}

        {draftFormats.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <button onClick={() => setDraftFormatFilter('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${draftFormatFilter === 'all' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'}`}>
              All
            </button>
            {draftFormats.map(format => (
              <button key={format} onClick={() => setDraftFormatFilter(format)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${draftFormatFilter === format ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'}`}>
                {format}
              </button>
            ))}
          </div>
        )}

        {draftsError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{draftsError}</p>}

        {draftsLoading ? (
          <div className="h-32 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        ) : filteredPendingDrafts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No pending drafts. If Drafts Inbox is on in Settings, check back tomorrow — it drafts at most one post a day from what you engaged with most.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {visibleIdeaGroups.map(group => (
              <div key={group[0].topic} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 truncate">💡 {group[0].source_title || group[0].topic}</p>
                  <button onClick={() => doSmartGenerate()} disabled={smartGenerating}
                    className="shrink-0 text-[11px] font-medium text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400">🔁 New idea</button>
                </div>
            {group.map(draft => {
              const { headline, teaser } = draftPreview(draft.final_content)
              const draftExpanded = expandedDraftId === draft.id
              return (
                <div key={draft.id} className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10 overflow-hidden">
                  <button onClick={() => setExpandedDraftId(prev => prev === draft.id ? null : draft.id)} className="w-full text-left p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">{draft.format} · {formatRelativeTime(draft.created_at)}</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{headline}</p>
                    {teaser && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">{teaser}</p>}
                    {draft.source_title && (
                      <p className="mt-1 text-[11px] text-zinc-400">
                        Inspired by: {draft.source_title}
                      </p>
                    )}
                  </button>
                  {draftExpanded && (
                    <div className="px-4 pb-4">
                      <textarea readOnly value={draft.final_content} rows={8}
                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-3 text-sm resize-y focus:outline-none" />
                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={() => reviewDraft(draft.id, 'approve')} disabled={draftActioning === draft.id}
                          className="rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-2 text-sm font-bold text-white transition-colors">✅ Approve</button>
                        <button onClick={() => copyDraft(draft)}
                          className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          {copiedId === draft.id ? '✓ Copied' : '📋 Copy'}
                        </button>
                        <button onClick={() => reviewDraft(draft.id, 'dismiss')} disabled={draftActioning === draft.id}
                          className="ml-auto rounded-xl px-4 py-2 text-sm font-medium text-zinc-400 hover:text-red-600 dark:hover:text-red-400">🗑 Dismiss</button>
                        <button onClick={() => { setFeedbackDraftId(prev => prev === draft.id ? null : draft.id); setFeedbackText('') }}
                          className="text-sm font-medium text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400">✏️ Feedback</button>
                        <button onClick={() => askAbout(draft.source_title || draft.topic)}
                          className="text-sm font-medium text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400">💬 Ask</button>
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-zinc-400">Publish:</span>
                        {(['medium', 'linkedin', 'x'] as const).filter(p => connectedPlatforms.includes(p)).map(platform => (
                          <button key={platform} onClick={() => publishTo(draft.id, platform)} disabled={publishingId === draft.id}
                            className="text-xs font-medium px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-violet-300 disabled:opacity-50">
                            {draft.published_platforms?.includes(platform) ? '✓ ' : ''}{platform}
                          </button>
                        ))}
                        <button onClick={() => publishTo(draft.id, 'email')} disabled={publishingId === draft.id}
                          className="text-xs font-medium px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-violet-300 disabled:opacity-50">
                          {draft.published_platforms?.includes('email') ? '✓ ' : ''}email
                        </button>
                        {connectedPlatforms.length === 0 && (
                          <Link href="/settings" className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline">Connect more in Settings →</Link>
                        )}
                      </div>
                      {publishingId === draft.id && <p className="mt-1 text-xs text-zinc-400">Publishing…</p>}
                      {publishNote && publishingId === null && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{publishNote}</p>}
                      {feedbackDraftId === draft.id && (
                        <div className="mt-3">
                          <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={3}
                            placeholder="What should change? e.g. 'more contrarian', 'shorter', 'drop the stats'…"
                            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
                          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">⚡ Regenerates this draft now and remembers your feedback for future drafts — uses your configured model, costs API credits.</p>
                          <button onClick={() => submitFeedback(draft.id)} disabled={feedbackSubmitting || !feedbackText.trim()}
                            className="mt-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-2 text-sm font-bold text-white transition-colors">
                            {feedbackSubmitting ? 'Regenerating…' : 'Regenerate with feedback'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
              </div>
            ))}
            {draftIdeaGroups.length > visibleIdeaGroups.length && (
              <button onClick={() => setShowAllIdeas(true)} className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">
                See {draftIdeaGroups.length - visibleIdeaGroups.length} more idea{draftIdeaGroups.length - visibleIdeaGroups.length > 1 ? 's' : ''} →
              </button>
            )}
          </div>
        )}
      </section>
      </div>

      {/* ══ Ask Signal — inline, no navigation away ═════════════════════ */}
      <section id="today-ask-signal" className="mb-10">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">💬 Ask Signal</h2>
        <p className="text-xs text-zinc-400 mb-3">Searches your Feed, Reading List, and News together. Click "💬 Ask about this" / "💬 Ask" on anything above to jump straight to a question about it.</p>
        <AskSignalPanel variant="compact" externalQuestion={askExternalQuestion} crossLink={{ href: '/memory', label: 'Open full Memory Assistant →' }} />
      </section>

      {/* ══ Explore more ═══════════════════════════════════════════════ */}
      <section>
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-3">Have more time? Go deeper</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Link href="/feed" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">📰 Feed</Link>
          <Link href="/feed?tab=news" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">🌐 News</Link>
          <Link href="/knowledge" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">📖 Reading List</Link>
          <Link href="/ideas" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">💡 Ideas</Link>
        </div>
      </section>
    </div>
  )
}
