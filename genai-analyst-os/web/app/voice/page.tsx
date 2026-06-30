'use client'

import { useEffect, useState } from 'react'
import { AdminGateModal, getAdminToken } from '@/components/AdminGate'
import type { VoiceFingerprint } from '@/lib/voice'

const EMPTY_POSTS = ['', '', '']

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs"><span className="text-zinc-500 dark:text-zinc-400">{label}</span><strong className="text-zinc-700 dark:text-zinc-200">{value}%</strong></div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} /></div>
    </div>
  )
}

function ToneBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3"><span className="w-24 text-xs text-zinc-500 dark:text-zinc-400">{label}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${value * 10}%` }} /></div><strong className="w-8 text-right text-xs text-zinc-700 dark:text-zinc-200">{value}/10</strong></div>
  )
}

function Chips({ items, empty = 'No strong pattern detected' }: { items: string[]; empty?: string }) {
  if (!items?.length) return <p className="text-xs italic text-zinc-400">{empty}</p>
  return <div className="flex flex-wrap gap-2">{items.map((item, index) => <span key={`${item}-${index}`} className="rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 px-2.5 py-1 text-xs text-violet-700 dark:text-violet-300">{item}</span>)}</div>
}

export default function VoicePage() {
  const userId = process.env.NEXT_PUBLIC_USER_ID!
  const [posts, setPosts] = useState<string[]>(EMPTY_POSTS)
  const [fingerprint, setFingerprint] = useState<VoiceFingerprint | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [showAdminGate, setShowAdminGate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')

  useEffect(() => {
    fetch(`/api/data/voice?userId=${encodeURIComponent(userId)}`)
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load voice profile')
        setFingerprint(json.fingerprint ?? null)
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoadingProfile(false))
  }, [userId])

  useEffect(() => {
    fetch(`/api/data/profile?userId=${encodeURIComponent(userId)}`)
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load profile')
        setPlan(json.plan === 'pro' ? 'pro' : 'free')
      })
      .catch(() => {})
  }, [userId])

  const validPosts = posts.map(post => post.trim()).filter(Boolean)
  const canAnalyze = validPosts.length >= 3
    && validPosts.length <= 5
    && validPosts.every(post => post.length >= 150)

  const analyze = async (token?: string) => {
    setAnalyzing(true)
    setError(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['x-admin-token'] = token
      const response = await fetch('/api/voice/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, posts: validPosts }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Voice analysis failed')
      setFingerprint(json.fingerprint)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleAnalyze = () => {
    const token = getAdminToken()
    if (token || plan === 'pro') analyze(token ?? undefined)
    else setShowAdminGate(true)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 pb-20">
      {showAdminGate && <AdminGateModal action="unlock writing voice analysis" onSuccess={token => { setShowAdminGate(false); analyze(token) }} onCancel={() => setShowAdminGate(false)} />}

      <div className="relative overflow-hidden rounded-3xl border border-violet-200/70 dark:border-violet-800/60 bg-gradient-to-br from-violet-50 via-white to-blue-50 dark:from-violet-950/40 dark:via-zinc-900 dark:to-blue-950/30 p-7 md:p-9">
        <div className="absolute -right-12 -top-20 h-60 w-60 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Voice Fingerprinting</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Teach Signal how you actually write</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Paste 3–5 posts that sound unmistakably like you. The Voice Analyst turns recurring choices into a style constitution used by Writer, Humanizer, and Final Polish.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`w-fit rounded-full border px-3 py-1.5 text-xs font-bold ${fingerprint ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300' : 'border-zinc-200 bg-white/80 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/80'}`}>{fingerprint ? '✓ Voice fingerprint active' : '○ Setup incomplete'}</div>
            <div className={`w-fit rounded-full border px-3 py-1.5 text-[11px] font-bold ${plan === 'pro' ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300' : 'border-zinc-200 bg-white/80 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/80'}`}>{plan === 'pro' ? 'Pro access' : 'Free preview'}</div>
          </div>
        </div>
      </div>

      <section className="mt-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Your writing samples</h2><p className="mt-1 text-xs text-zinc-400">Use complete, successful posts. Minimum 150 characters each; 50,000 characters total.</p></div>
          <span className="text-xs font-semibold text-zinc-400">{validPosts.length}/5 ready</span>
        </div>
        <div className="mt-5 space-y-4">
          {posts.map((post, index) => (
            <div key={index} className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-950/50 p-4">
              <div className="mb-2 flex items-center justify-between"><label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Sample {index + 1}</label>{posts.length > 3 && <button onClick={() => setPosts(current => current.filter((_, i) => i !== index))} className="text-xs text-zinc-400 hover:text-red-500">Remove</button>}</div>
              <textarea value={post} onChange={event => setPosts(current => current.map((item, i) => i === index ? event.target.value : item))} rows={7} placeholder="Paste one of your best-performing posts here…" className="w-full resize-y rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-3 text-sm leading-6 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-violet-500" />
              <p className={`mt-1 text-right text-[11px] ${post.trim() && post.trim().length < 150 ? 'text-amber-600' : 'text-zinc-400'}`}>{post.trim().length} characters</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {posts.length < 5 && <button onClick={() => setPosts(current => [...current, ''])} className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:border-violet-300">+ Add sample</button>}
          <button onClick={handleAnalyze} disabled={!canAnalyze || analyzing} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">{analyzing ? 'Analyzing your voice…' : fingerprint ? (plan === 'pro' ? 'Re-analyze Voice' : 'Pro: Re-analyze Voice') : (plan === 'pro' ? 'Analyze My Voice' : 'Pro: Analyze My Voice')}</button>
          {!canAnalyze && <p className="text-xs text-zinc-400">Complete at least three samples to continue.</p>}
        </div>
        {error && <div className="mt-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
      </section>

      {loadingProfile ? (
        <div className="mt-8 h-72 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" />
      ) : fingerprint && (
        <section className="mt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">Your style constitution</p><h2 className="mt-1 text-2xl font-bold text-zinc-950 dark:text-white">What Signal learned</h2></div><p className="text-xs text-zinc-400">{fingerprint.sample_count} samples · analyzed {new Date(fingerprint.analyzed_at).toLocaleDateString()}</p></div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Sentence rhythm</p><p className="mt-1 text-3xl font-black text-zinc-900 dark:text-zinc-100">{fingerprint.sentence_length.average_words}<span className="ml-1 text-sm font-medium text-zinc-400">words avg.</span></p></div><span className="text-xs text-zinc-400">Typical: {fingerprint.sentence_length.typical_range}</span></div><div className="mt-5 space-y-3"><MetricBar label="Short · ≤10 words" value={fingerprint.sentence_length.short_pct} color="bg-blue-500" /><MetricBar label="Medium · 11–20 words" value={fingerprint.sentence_length.medium_pct} color="bg-violet-500" /><MetricBar label="Long · 21+ words" value={fingerprint.sentence_length.long_pct} color="bg-fuchsia-500" /></div></div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Tone dimensions</p><div className="mt-5 space-y-4"><ToneBar label="Directness" value={fingerprint.tone_dimensions.directness} /><ToneBar label="Warmth" value={fingerprint.tone_dimensions.warmth} /><ToneBar label="Technicality" value={fingerprint.tone_dimensions.technicality} /><ToneBar label="Humor" value={fingerprint.tone_dimensions.humor} /></div></div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"><h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Signature phrases</h3><div className="mt-3"><Chips items={fingerprint.signature_phrases} /></div><h3 className="mt-5 text-sm font-bold text-zinc-900 dark:text-zinc-100">Transitions</h3><div className="mt-3"><Chips items={fingerprint.transitions} /></div></div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"><h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Words and phrases to avoid</h3><div className="mt-3"><Chips items={fingerprint.words_to_avoid} /></div><h3 className="mt-5 text-sm font-bold text-zinc-900 dark:text-zinc-100">Natural qualification patterns</h3><div className="mt-3"><Chips items={fingerprint.certainty.hedging_patterns} /></div></div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"><h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Topics stated directly</h3><div className="mt-3"><Chips items={fingerprint.certainty.unhedged_topics} /></div><h3 className="mt-5 text-sm font-bold text-zinc-900 dark:text-zinc-100">Topics carefully qualified</h3><div className="mt-3"><Chips items={fingerprint.certainty.qualified_topics} /></div></div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"><h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Paragraph openings</h3><div className="mt-3"><Chips items={fingerprint.paragraph_patterns.openings} /></div><h3 className="mt-5 text-sm font-bold text-zinc-900 dark:text-zinc-100">Paragraph closings</h3><div className="mt-3"><Chips items={fingerprint.paragraph_patterns.closings} /></div></div>
          </div>

          <div className="mt-5 rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/70 dark:bg-violet-950/30 p-6"><h3 className="font-bold text-zinc-900 dark:text-zinc-100">Voice principles applied to every draft</h3><ol className="mt-4 grid gap-3 md:grid-cols-2">{fingerprint.voice_principles.map((principle, index) => <li key={index} className="flex gap-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">{index + 1}</span>{principle}</li>)}</ol></div>
        </section>
      )}

      <div className="mt-8 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-5 text-sm leading-6 text-amber-900 dark:text-amber-200"><strong>Privacy and control:</strong> your pasted samples are sent to Claude for analysis but are not stored by Signal. Only the extracted fingerprint is saved to your profile. Re-analyzing replaces the previous fingerprint.</div>
      <div className="mt-4 rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/70 dark:bg-violet-950/30 p-5 text-sm leading-6 text-violet-900 dark:text-violet-200"><strong>Pro feature:</strong> voice analysis is a paid action because it runs Claude Sonnet and stores a reusable writing constitution.</div>
    </div>
  )
}
