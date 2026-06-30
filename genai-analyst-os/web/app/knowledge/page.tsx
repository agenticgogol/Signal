'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuthSession } from '@/lib/useAuthSession'

interface Notebook {
  id: string
  title: string
  description: string | null
  created_at: string
  updated_at: string
}

export default function KnowledgePage() {
  const { session, user, loading } = useAuthSession()
  const userId = user?.id ?? ''
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNotebooks = async () => {
    if (!session?.access_token || !userId) return
    setError(null)
    try {
      const res = await fetch(`/api/data/knowledge-notebooks?userId=${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not load notebooks')
      setNotebooks(json.notebooks ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    if (!loading) fetchNotebooks()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.access_token, userId])

  const handleCreate = async () => {
    if (!session?.access_token || !userId || !title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/knowledge/notebooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId, title: title.trim(), description: description.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not create notebook')
      setTitle('')
      setDescription('')
      await fetchNotebooks()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-8"><div className="h-48 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" /></div>
  }

  if (!session || !userId) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <h1 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Knowledge Base</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Sign in first to create personal notebooks, save links and notes, and chat against your own stored knowledge.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 pb-20">
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-7">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Personal knowledge base</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Save links, notes, and ideas into notebooks you can actually use</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">This is your private research layer inside Signal. Each notebook can ingest saved URLs and notes, generate Signal summaries and “why it matters”, answer grounded questions, and later feed Create, Ideas, and Outline.</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Create notebook</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Enterprise agents research"
                className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Theme, project, or why this notebook exists."
                rows={4}
                className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
            </div>
            <button onClick={handleCreate} disabled={saving || !title.trim()}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40">
              {saving ? 'Creating…' : 'Create notebook'}
            </button>
            {error && <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Your notebooks</h2>
              <p className="mt-1 text-xs text-zinc-400">{notebooks.length} notebook{notebooks.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {notebooks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 p-6 text-sm text-zinc-500 dark:text-zinc-400">
                No notebooks yet. Create one, then start saving URLs or notes into it.
              </div>
            ) : notebooks.map(notebook => (
              <Link key={notebook.id} href={`/knowledge/${notebook.id}`}
                className="block rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{notebook.title}</p>
                {notebook.description && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{notebook.description}</p>}
                <p className="mt-2 text-xs text-zinc-400">Updated {new Date(notebook.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
