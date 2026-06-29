'use client'

import { useState, useEffect, useCallback } from 'react'

interface Source {
  id: string; url: string; rss_url: string | null; source_tier: number; name: string | null
}

function getDomain(url: string) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

const TIER_INFO: Record<number, { label: string; desc: string; dot: string }> = {
  1: { label: 'Tier 1', desc: 'Top signal sources', dot: 'bg-violet-500' },
  2: { label: 'Tier 2', desc: 'Solid practitioners', dot: 'bg-blue-500' },
  3: { label: 'Tier 3', desc: 'Broad coverage',    dot: 'bg-zinc-400' },
}

export default function SourcesPage() {
  const userId = process.env.NEXT_PUBLIC_USER_ID!
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [newUrl, setNewUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const fetchSources = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/data/sources?userId=${userId}`)
      const json = await res.json()
      setSources(json.sources ?? [])
    } catch {}
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchSources() }, [fetchSources])

  const handleAdd = async () => {
    if (!newUrl.trim()) return
    setAdding(true)
    setMsg(null)
    try {
      const res = await fetch('/api/sources/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim(), userId }),
      })
      if (res.ok) {
        setNewUrl('')
        await fetchSources()
        setMsg({ text: 'Source added successfully', ok: true })
      } else {
        const j = await res.json()
        setMsg({ text: j.error ?? 'Failed to add source', ok: false })
      }
    } catch (e) { setMsg({ text: String(e), ok: false }) }
    setAdding(false)
    setTimeout(() => setMsg(null), 5000)
  }

  const byTier: Record<number, Source[]> = {}
  for (const s of sources) {
    const t = s.source_tier ?? 2
    if (!byTier[t]) byTier[t] = []
    byTier[t].push(s)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Sources</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          {sources.length} sources tracked · new articles crawled on each pipeline run
        </p>
      </div>

      {/* Add source */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5 mb-8">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Add a source</p>
        <div className="flex gap-3">
          <input
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="https://example.com or RSS URL"
            className="flex-1 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-zinc-400"
          />
          <button onClick={handleAdd} disabled={adding || !newUrl.trim()}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {msg && (
          <p className={`text-xs mt-2.5 ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {msg.ok ? '✓ ' : '✗ '}{msg.text}
          </p>
        )}
      </div>

      {/* Sources by tier */}
      {loading ? (
        <div className="space-y-3">
          {[0,1,2,3,4].map(i => <div key={i} className="h-14 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-8">
          {[1, 2, 3].map(tier => {
            const tierSources = byTier[tier] ?? []
            if (!tierSources.length) return null
            const info = TIER_INFO[tier]
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${info.dot}`} />
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{info.label}</h2>
                  <span className="text-xs text-zinc-400">· {info.desc}</span>
                  <span className="ml-auto text-xs text-zinc-400">{tierSources.length} sources</span>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {tierSources.map((src, i) => {
                    const dom = getDomain(src.url)
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${dom}&sz=32`}
                          alt=""
                          className="w-5 h-5 rounded flex-shrink-0"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {src.name ?? dom}
                          </p>
                          <p className="text-xs text-zinc-400 truncate">{src.url}</p>
                        </div>
                        {src.rss_url && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800 flex-shrink-0">
                            RSS
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
