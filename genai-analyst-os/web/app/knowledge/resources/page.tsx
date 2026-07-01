'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AdminGateModal, getAdminToken } from '@/components/AdminGate'
import { useAuthSession } from '@/lib/useAuthSession'
import { TAG_COLORS, TAG_LABELS } from '@/lib/tagColors'

interface KnowledgeLink {
  id: string
  url: string
  linkType: 'github' | 'paper' | 'video' | 'article'
  label: string
  topicTags: string[]
  createdAt: string
  notebookId: string
  notebookTitle: string
  itemId: string
  itemTitle: string
}

const TYPE_META: Record<string, { title: string; icon: string; empty: string }> = {
  github: { title: 'GitHub Repos', icon: '🐙', empty: 'No GitHub repos extracted yet. Paste a post with a repo link into any notebook.' },
  paper: { title: 'Papers & Research', icon: '📄', empty: 'No paper links extracted yet.' },
  video: { title: 'Videos', icon: '🎥', empty: 'No video links extracted yet.' },
  article: { title: 'Links & Articles', icon: '🔗', empty: 'No other links extracted yet.' },
}

function TopicPill({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
  const label = TAG_LABELS[tag.toLowerCase()] ?? tag
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{label}</span>
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days < 1) return 'today'
    if (days === 1) return '1d ago'
    if (days < 30) return `${days}d ago`
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return '' }
}

function LinkCard({ link }: { link: KnowledgeLink }) {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer"
      className="block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
      <p className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{link.label || link.url}</p>
      <p className="mt-1 text-xs text-zinc-400 truncate">{link.url}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {link.topicTags.slice(0, 3).map(tag => <TopicPill key={tag} tag={tag} />)}
      </div>
      <p className="mt-3 text-[11px] text-zinc-400">
        From <span className="text-zinc-500 dark:text-zinc-300">{link.itemTitle || 'a saved note'}</span> in {link.notebookTitle} · {formatRelativeTime(link.createdAt)}
      </p>
    </a>
  )
}

export default function KnowledgeResourcesPage() {
  const { session, user, loading } = useAuthSession()
  const fallbackUserId = process.env.NEXT_PUBLIC_USER_ID || ''
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const userId = user?.id ?? (adminUnlocked ? fallbackUserId : '')
  const [showAdminGate, setShowAdminGate] = useState(false)
  const [links, setLinks] = useState<KnowledgeLink[]>([])
  const [linksLoading, setLinksLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<'all' | 'github' | 'paper' | 'video' | 'article'>('all')
  const [topicFilter, setTopicFilter] = useState<string>('all')

  useEffect(() => {
    if (typeof window !== 'undefined' && getAdminToken()) setAdminUnlocked(true)
  }, [])

  useEffect(() => {
    if (loading || !userId) return
    setLinksLoading(true)
    setError(null)
    const headers: Record<string, string> = {}
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
    else {
      const token = getAdminToken()
      if (token) headers['x-admin-token'] = token
    }
    fetch(`/api/knowledge/links?userId=${encodeURIComponent(userId)}`, { headers })
      .then(async res => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Could not load resources')
        setLinks(json.links ?? [])
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLinksLoading(false))
  }, [loading, session?.access_token, userId])

  const allTopics = useMemo(() => {
    const set = new Set<string>()
    links.forEach(l => l.topicTags.forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [links])

  const filtered = links.filter(l =>
    (typeFilter === 'all' || l.linkType === typeFilter) &&
    (topicFilter === 'all' || l.topicTags.includes(topicFilter))
  )

  const grouped = useMemo(() => {
    const byType: Record<string, KnowledgeLink[]> = { github: [], paper: [], video: [], article: [] }
    filtered.forEach(l => byType[l.linkType]?.push(l))
    return byType
  }, [filtered])

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-8"><div className="h-48 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" /></div>
  }

  if (!session && !adminUnlocked) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        {showAdminGate && (
          <AdminGateModal
            action="open the resources library"
            onSuccess={() => { setShowAdminGate(false); setAdminUnlocked(true) }}
            onCancel={() => setShowAdminGate(false)}
          />
        )}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <h1 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Resources</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Sign in to see the GitHub repos and links auto-extracted from your saved notes.</p>
          <div className="mt-5 flex items-center gap-3">
            <button onClick={() => setShowAdminGate(true)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700">Unlock admin workspace</button>
            <button onClick={() => window.dispatchEvent(new Event('signal-auth-popup:open'))} className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300">Sign in</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 pb-20">
      <div className="flex items-center justify-between gap-3 mb-2">
        <Link href="/knowledge" className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">← Reading List</Link>
      </div>

      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-7">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Resource library</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Every GitHub repo and link, pulled out and organized</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">Paste a LinkedIn post, article, or note into any notebook and Signal automatically extracts every URL — classifying GitHub repos separately from papers, videos, and general links — then tags them by topic so nothing valuable stays buried in a wall of text.</p>
      </div>

      {linksLoading ? (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-5 text-sm text-red-700 dark:text-red-300">{error}</div>
      ) : links.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-700 p-10 text-center">
          <div className="text-5xl mb-4">🔗</div>
          <p className="font-medium text-zinc-600 dark:text-zinc-300">Nothing extracted yet</p>
          <p className="mt-2 text-sm text-zinc-400 max-w-md mx-auto">Save a note containing a GitHub repo or article link in any notebook — Signal will pull it out and it shows up here automatically.</p>
          <Link href="/knowledge" className="inline-flex mt-4 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700">Go to notebooks</Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium">Type</span>
            {(['all', 'github', 'paper', 'video', 'article'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  typeFilter === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'}`}>
                {t === 'all' ? `All (${links.length})` : `${TYPE_META[t].icon} ${TYPE_META[t].title} (${links.filter(l => l.linkType === t).length})`}
              </button>
            ))}
          </div>

          {allTopics.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Topic</span>
              <button onClick={() => setTopicFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  topicFilter === 'all' ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'}`}>
                All topics
              </button>
              {allTopics.map(tag => (
                <button key={tag} onClick={() => setTopicFilter(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    topicFilter === tag ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-violet-300'}`}>
                  {TAG_LABELS[tag.toLowerCase()] ?? tag}
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 space-y-10">
            {(['github', 'paper', 'video', 'article'] as const)
              .filter(type => typeFilter === 'all' || typeFilter === type)
              .map(type => (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{TYPE_META[type].icon}</span>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{TYPE_META[type].title}</h2>
                    <span className="text-xs text-zinc-400">{grouped[type].length}</span>
                  </div>
                  {grouped[type].length === 0 ? (
                    <p className="text-sm text-zinc-400">{TYPE_META[type].empty}</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {grouped[type].map(link => <LinkCard key={link.id} link={link} />)}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
