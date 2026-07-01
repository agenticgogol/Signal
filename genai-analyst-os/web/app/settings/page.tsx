'use client'

import { useEffect, useState } from 'react'
import { useAuthSession } from '@/lib/useAuthSession'
import { defaultModelFor, normalizeProvider, type ProviderOption, type SupportedProvider } from '@/lib/llmConfig'

const ROLES = [
  { id: 'ml_engineer',     label: 'ML / AI Engineer',  icon: '🛠️' },
  { id: 'researcher',      label: 'Researcher',        icon: '🔬' },
  { id: 'product_manager', label: 'Product Manager',   icon: '🧭' },
  { id: 'founder',         label: 'Founder',           icon: '🚀' },
  { id: 'executive',       label: 'Executive / Leader', icon: '📈' },
  { id: 'content_creator', label: 'Content Creator',   icon: '✍️' },
  { id: 'student',         label: 'Student',           icon: '🎓' },
  { id: 'other',           label: 'Other',             icon: '✨' },
]
const INTERESTS = [
  { id: 'llm',      label: 'LLM Advances', icon: '🧠' },
  { id: 'agentic',  label: 'Agentic AI',   icon: '🤖' },
  { id: 'rag',      label: 'RAG',          icon: '📚' },
  { id: 'finetune', label: 'Fine-tuning',  icon: '🎛️' },
  { id: 'infra',    label: 'GenAI Infra',  icon: '🏗️' },
  { id: 'llmops',   label: 'LLMOps',       icon: '⚙️' },
  { id: 'eval',     label: 'AI Eval',      icon: '📊' },
]
const GOALS = [
  { id: 'stay_current',      label: 'Stay current' },
  { id: 'deep_research',     label: 'Deep research' },
  { id: 'content_creation',  label: 'Create content' },
  { id: 'general_curiosity', label: 'General curiosity' },
]
const FREQUENCIES = [
  { id: 'daily',     label: 'Daily' },
  { id: 'weekly',    label: 'Weekly' },
  { id: 'on_demand', label: 'On demand' },
]

function hourUtcToLocalLabel(hourUtc: number): string {
  const d = new Date(Date.UTC(2024, 0, 1, hourUtc, 0, 0))
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  } catch { return 'unknown' }
}

interface SettingsPayload {
  provider: SupportedProvider
  model: string
  hasApiKey: boolean
  maskedApiKey: string
  providerOptions: ProviderOption[]
}

export default function SettingsPage() {
  const { session, user, loading } = useAuthSession()
  const userId = user?.id ?? ''
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [canUsePaidFeatures, setCanUsePaidFeatures] = useState(false)

  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([])
  const [provider, setProvider] = useState<SupportedProvider>('anthropic')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [maskedApiKey, setMaskedApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [clearApiKey, setClearApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [digestEmail, setDigestEmail] = useState('')
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false)

  const [role, setRole] = useState<string | null>(null)
  const [interestAreas, setInterestAreas] = useState<Set<string>>(new Set())
  const [readingGoal, setReadingGoal] = useState<string | null>(null)
  const [readingFrequency, setReadingFrequency] = useState<string | null>(null)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsStatus, setPrefsStatus] = useState<string | null>(null)

  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleHourUtc, setScheduleHourUtc] = useState<number>(13)
  const [lookbackDays, setLookbackDays] = useState<number>(7)
  const [maxPerSource, setMaxPerSource] = useState<number>(5)
  const [lastScheduledCrawlAt, setLastScheduledCrawlAt] = useState<string | null>(null)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null)
  const [runningNow, setRunningNow] = useState(false)

  const [draftsInboxEnabled, setDraftsInboxEnabled] = useState(false)
  const [draftsInboxSaving, setDraftsInboxSaving] = useState(false)
  const [draftsInboxStatus, setDraftsInboxStatus] = useState<string | null>(null)

  const [traces, setTraces] = useState<Array<{
    id: string; agent: string; provider: string | null; model: string | null
    prompt_chars: number; completion_chars: number; duration_ms: number
    status: 'success' | 'error'; error_message: string | null; created_at: string
  }>>([])
  const [arizeConfigured, setArizeConfigured] = useState(false)
  const [tracesLoading, setTracesLoading] = useState(false)

  useEffect(() => {
    if (!session?.access_token || !userId) return
    fetch(`/api/data/profile?userId=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load profile')
        setPlan(json.plan === 'pro' ? 'pro' : 'free')
        setCanUsePaidFeatures(Boolean(json.canUsePaidFeatures))
      })
      .catch(() => { setPlan('free'); setCanUsePaidFeatures(false) })
  }, [session?.access_token, userId])

  useEffect(() => {
    if (!session?.access_token || !userId) return
    fetch(`/api/data/llm-settings?userId=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async response => {
        const json = await response.json() as SettingsPayload & { error?: string }
        if (!response.ok) throw new Error(json.error ?? 'Could not load model settings')
        setProviderOptions(json.providerOptions ?? [])
        setProvider(json.provider)
        setModel(json.model)
        setHasApiKey(json.hasApiKey)
        setMaskedApiKey(json.maskedApiKey)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load model settings'))
  }, [session?.access_token, userId])

  useEffect(() => {
    if (!session?.access_token || !userId) return
    fetch(`/api/data/digest-settings?userId=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load digest settings')
        setDigestEmail(json.digestEmail ?? '')
        setDailyDigestEnabled(Boolean(json.dailyDigestEnabled))
      })
      .catch(() => {})
  }, [session?.access_token, userId])

  useEffect(() => {
    if (!providerOptions.length) return
    if (!model) setModel(defaultModelFor(provider))
  }, [provider, providerOptions, model])

  useEffect(() => {
    if (!session?.access_token || !userId) return
    fetch(`/api/data/user-preferences?userId=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load preferences')
        setRole(json.role ?? null)
        setInterestAreas(new Set(json.interestAreas ?? []))
        setReadingGoal(json.readingGoal ?? null)
        setReadingFrequency(json.readingFrequency ?? null)
      })
      .catch(() => {})
  }, [session?.access_token, userId])

  useEffect(() => {
    if (!session?.access_token || !userId) return
    fetch(`/api/data/schedule-settings?userId=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load schedule')
        setScheduleEnabled(Boolean(json.enabled))
        if (typeof json.hourUtc === 'number') setScheduleHourUtc(json.hourUtc)
        if ([1, 3, 7, 14].includes(json.lookbackDays)) setLookbackDays(json.lookbackDays)
        if ([1, 3, 5, 10].includes(json.maxPerSource)) setMaxPerSource(json.maxPerSource)
        setLastScheduledCrawlAt(json.lastScheduledCrawlAt ?? null)
      })
      .catch(() => {})
  }, [session?.access_token, userId])

  useEffect(() => {
    if (!session?.access_token || !userId) return
    fetch(`/api/data/drafts-inbox-settings?userId=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load Drafts Inbox setting')
        setDraftsInboxEnabled(Boolean(json.enabled))
      })
      .catch(() => {})
  }, [session?.access_token, userId])

  useEffect(() => {
    if (!session?.access_token || !userId) return
    setTracesLoading(true)
    fetch(`/api/data/llm-traces?userId=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load activity')
        setTraces(json.traces ?? [])
        setArizeConfigured(Boolean(json.arizeConfigured))
      })
      .catch(() => {})
      .finally(() => setTracesLoading(false))
  }, [session?.access_token, userId])

  const toggleDraftsInbox = async (next: boolean) => {
    if (!session?.access_token || !userId) return
    setDraftsInboxSaving(true)
    setDraftsInboxStatus(null)
    try {
      const response = await fetch('/api/data/drafts-inbox-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId, enabled: next }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Could not save Drafts Inbox setting')
      setDraftsInboxEnabled(next)
      setDraftsInboxStatus(next
        ? 'On — once a day, Signal will draft one post from what you engaged with most and leave it in your Drafts Inbox for review.'
        : 'Off — no automatic drafts will be generated.')
    } catch (err) {
      setDraftsInboxStatus(err instanceof Error ? err.message : 'Could not save Drafts Inbox setting')
    } finally {
      setDraftsInboxSaving(false)
    }
  }

  const toggleInterest = (id: string) => {
    setInterestAreas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const savePreferences = async () => {
    if (!session?.access_token || !userId) return
    setPrefsSaving(true)
    setPrefsStatus(null)
    try {
      const response = await fetch('/api/data/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          userId,
          role,
          interestAreas: Array.from(interestAreas),
          readingGoal,
          readingFrequency,
          markComplete: true,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Could not save preferences')
      setPrefsStatus('Saved. Your feed ranking and digest cadence are updated.')
    } catch (err) {
      setPrefsStatus(err instanceof Error ? err.message : 'Could not save preferences')
    } finally {
      setPrefsSaving(false)
    }
  }

  const saveSchedule = async (
    nextEnabled: boolean,
    nextHourUtc: number,
    nextLookbackDays: number = lookbackDays,
    nextMaxPerSource: number = maxPerSource,
  ) => {
    if (!session?.access_token || !userId) return
    setScheduleSaving(true)
    setScheduleStatus(null)
    try {
      const response = await fetch('/api/data/schedule-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          userId,
          enabled: nextEnabled,
          hourUtc: nextHourUtc,
          lookbackDays: nextLookbackDays,
          maxPerSource: nextMaxPerSource,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Could not save schedule')
      setScheduleEnabled(nextEnabled)
      setScheduleHourUtc(nextHourUtc)
      setLookbackDays(nextLookbackDays)
      setMaxPerSource(nextMaxPerSource)
      setScheduleStatus(nextEnabled
        ? `Saved. Your feed will refresh automatically around ${hourUtcToLocalLabel(nextHourUtc)} your time, every day — ${nextLookbackDays}d lookback, ${nextMaxPerSource}/source.`
        : 'Automatic refresh turned off.')
    } catch (err) {
      setScheduleStatus(err instanceof Error ? err.message : 'Could not save schedule')
    } finally {
      setScheduleSaving(false)
    }
  }

  const runNow = async () => {
    if (!session?.access_token || !userId) return
    setRunningNow(true)
    setScheduleStatus(null)
    try {
      const response = await fetch('/api/pipeline/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId, lookbackDays, maxPerSource }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json.error ?? 'Could not start the pipeline')
      setScheduleStatus(`Feed refresh started (${lookbackDays}d lookback, ${maxPerSource}/source) — check the Feed tab in a couple of minutes.`)
    } catch (err) {
      setScheduleStatus(err instanceof Error ? err.message : 'Could not start the pipeline')
    } finally {
      setRunningNow(false)
    }
  }

  const providerMeta = providerOptions.find(option => option.id === provider)

  const save = async () => {
    if (!session?.access_token || !userId) return
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const response = await fetch('/api/data/llm-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId,
          provider,
          model: model.trim(),
          apiKey: apiKey.trim(),
          clearApiKey,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Could not save model settings')
      setStatus('Saved. Paid generation will now use this provider and model.')
      if (apiKey.trim()) {
        setHasApiKey(true)
        setMaskedApiKey(`${apiKey.trim().slice(0, 4)}••••${apiKey.trim().slice(-4)}`)
      }
      if (clearApiKey) {
        setHasApiKey(false)
        setMaskedApiKey('')
      }
      setApiKey('')
      setClearApiKey(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save model settings')
    } finally {
      setSaving(false)
    }
  }

  const saveDigestSettings = async () => {
    if (!session?.access_token || !userId) return
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const response = await fetch('/api/data/digest-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId,
          digestEmail,
          dailyDigestEnabled,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Could not save digest settings')
      setStatus('Saved. Daily digest email preferences are updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save digest settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-6 py-8"><div className="h-48 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" /></div>
  }

  if (!session || !userId) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Sign in first to manage your model provider, API key, and subscription-backed generation settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 pb-20">
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-7">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Account model settings</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Bring your own provider, model, and API key</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">Admin-free premium actions require both subscription entitlement and your account-level provider settings. This controls weekly digest regeneration, topic ideas, outline generation, voice analysis, and the full multi-agent content writer stack.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 text-sm"><strong className="block text-zinc-900 dark:text-zinc-100">What Signal charges for</strong><span className="mt-1 block text-zinc-500 dark:text-zinc-400">Product access, orchestration, ranking, synthesis, and workflow UX.</span></div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 text-sm"><strong className="block text-zinc-900 dark:text-zinc-100">What your provider charges for</strong><span className="mt-1 block text-zinc-500 dark:text-zinc-400">Premium model execution such as digests, ideas, outlines, voice analysis, and drafting.</span></div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 text-sm"><strong className="block text-zinc-900 dark:text-zinc-100">Trust boundary</strong><span className="mt-1 block text-zinc-500 dark:text-zinc-400">The key is stored server-side in encrypted form and is never exposed in browser code.</span></div>
        </div>
      </div>

      <section className="mt-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Your preferences</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">These drive feed ranking and digest cadence. Change them any time — Signal re-ranks immediately.</p>

        <div className="mt-5">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Role</label>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ROLES.map(r => (
              <button key={r.id} onClick={() => setRole(r.id)}
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-xs font-medium transition-all ${
                  role === r.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-violet-300'}`}>
                <span>{r.icon}</span>{r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Interest areas</label>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {INTERESTS.map(i => (
              <button key={i.id} onClick={() => toggleInterest(i.id)}
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-xs font-medium transition-all ${
                  interestAreas.has(i.id) ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-violet-300'}`}>
                <span>{i.icon}</span>{i.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Main goal</label>
            <div className="mt-2 flex flex-col gap-1.5">
              {GOALS.map(g => (
                <button key={g.id} onClick={() => setReadingGoal(g.id)}
                  className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-medium transition-all ${
                    readingGoal === g.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-violet-300'}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Reading cadence</label>
            <div className="mt-2 flex flex-col gap-1.5">
              {FREQUENCIES.map(f => (
                <button key={f.id} onClick={() => setReadingFrequency(f.id)}
                  className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-medium transition-all ${
                    readingFrequency === f.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-violet-300'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={savePreferences}
          disabled={prefsSaving}
          className="mt-5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40"
        >
          {prefsSaving ? 'Saving...' : 'Save preferences'}
        </button>
        {prefsStatus && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{prefsStatus}</p>}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Model configuration</h2>
          <div className="mt-5 space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Provider</label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {providerOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => {
                      const next = normalizeProvider(option.id)
                      setProvider(next)
                      setModel(defaultModelFor(next))
                    }}
                    className={`rounded-2xl border p-4 text-left transition-colors ${provider === option.id ? 'border-violet-400 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30' : 'border-zinc-200 dark:border-zinc-700 hover:border-violet-300'}`}
                  >
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{option.label}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Model name</label>
              <input
                value={model}
                onChange={event => setModel(event.target.value)}
                placeholder={providerMeta?.models[0] ?? 'Enter model name'}
                className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
              {providerMeta && <p className="mt-2 text-xs text-zinc-400">Suggested: {providerMeta.models.join(' , ')}</p>}
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">API key</label>
              <input
                value={apiKey}
                onChange={event => setApiKey(event.target.value)}
                type="password"
                placeholder={hasApiKey ? `Current key: ${maskedApiKey}` : 'Paste API key'}
                className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
              <label className="mt-3 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <input type="checkbox" checked={clearApiKey} onChange={event => setClearApiKey(event.target.checked)} />
                Clear the stored API key on save
              </label>
            </div>

            <button
              onClick={save}
              disabled={saving || !model.trim() || plan !== 'pro'}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40"
            >
              {saving ? 'Saving...' : plan === 'pro' ? 'Save model settings' : 'Subscription required'}
            </button>

            {status && <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-700 dark:text-green-300">{status}</div>}
            {error && <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
            {plan !== 'pro' && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-4 text-sm leading-6 text-amber-900 dark:text-amber-200">
                Model provider and API key settings are locked until this account has an active subscription.
              </div>
            )}
            {plan === 'pro' && !canUsePaidFeatures && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 p-4 text-sm leading-6 text-blue-900 dark:text-blue-200">
                This account has subscription entitlement, but the admin wall remains in place until you save a model API key here.
              </div>
            )}
            {canUsePaidFeatures && (
              <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50/70 dark:bg-green-950/30 p-4 text-sm leading-6 text-green-900 dark:text-green-200">
                This account is fully configured. Premium actions now use confirmation only and no longer ask for admin credentials.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">What this drives</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            <p>Weekly Digest regenerate uses your provider and model.</p>
            <p>Discover New Topic uses your provider and model for topic ideas and outline creation.</p>
            <p>Create uses your provider and model across the orchestrator, writer, verifier, critic, humanizer, evaluator, audience simulator, and final polish agents.</p>
            <p>Voice Fingerprinting uses your provider and model to derive the writing constitution stored in your profile.</p>
          </div>
          <div className="mt-5 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-4 text-sm leading-6 text-amber-900 dark:text-amber-200">
            Your API key is encrypted in the application layer before it is stored in your account profile, so paid actions can run without re-entering credentials every time.
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Digest delivery</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Get one consolidated daily digest email with the story behind the day’s strongest AI signals. Weekly digests stay in-app, and both daily and weekly digests keep archives.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Delivery email</label>
            <input
              value={digestEmail}
              onChange={event => setDigestEmail(event.target.value)}
              type="email"
              placeholder={user?.email ?? 'you@example.com'}
              className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
            />
            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={dailyDigestEnabled} onChange={event => setDailyDigestEnabled(event.target.checked)} />
              Email me one Daily Digest per day
            </label>
          </div>
          <button
            onClick={saveDigestSettings}
            disabled={saving}
            className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {saving ? 'Saving...' : 'Save digest settings'}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Feed schedule</h2>
          <span className="rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">PRO</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Automatically run the crawl-and-rank pipeline at a time you choose, every day — or skip the schedule and trigger it yourself whenever you want fresh articles.</p>

        {!canUsePaidFeatures ? (
          <div className="mt-5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-4 text-sm leading-6 text-amber-900 dark:text-amber-200">
            Scheduling requires an active subscription and a configured model API key, same as the manual &quot;Get Latest Feed&quot; action above.
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={event => saveSchedule(event.target.checked, scheduleHourUtc)}
                    disabled={scheduleSaving}
                  />
                  Automatically refresh my feed every day
                </label>
                <div className="mt-3 flex items-center gap-2">
                  <select
                    value={scheduleHourUtc}
                    onChange={event => {
                      const hour = Number(event.target.value)
                      setScheduleHourUtc(hour)
                      if (scheduleEnabled) saveSchedule(true, hour)
                    }}
                    disabled={scheduleSaving}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {Array.from({ length: 24 }, (_, hourUtc) => (
                      <option key={hourUtc} value={hourUtc}>{hourUtcToLocalLabel(hourUtc)} (your time)</option>
                    ))}
                  </select>
                  <span className="text-xs text-zinc-400">Starts around this time; GitHub's scheduler can run a few minutes late under load.</span>
                </div>
              </div>
              <button
                onClick={runNow}
                disabled={runningNow}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:border-violet-300 disabled:opacity-40"
              >
                {runningNow ? 'Starting…' : '⚡ Run now'}
              </button>
            </div>

            <div className="mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Crawl depth</p>
              <p className="mt-1 text-xs text-zinc-400">Used by both Run now and the daily schedule — one setting, not two.</p>
              <div className="mt-3 flex flex-wrap gap-5">
                <div>
                  <p className="text-[11px] font-medium text-zinc-500 mb-1.5">Lookback window</p>
                  <div className="flex gap-1.5">
                    {[1, 3, 7, 14].map(n => (
                      <button key={n}
                        onClick={() => { setLookbackDays(n); saveSchedule(scheduleEnabled, scheduleHourUtc, n, maxPerSource) }}
                        disabled={scheduleSaving}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          lookbackDays === n ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-violet-300'}`}>
                        {n}d
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-zinc-500 mb-1.5">Max articles per source</p>
                  <div className="flex gap-1.5">
                    {[1, 3, 5, 10].map(n => (
                      <button key={n}
                        onClick={() => { setMaxPerSource(n); saveSchedule(scheduleEnabled, scheduleHourUtc, lookbackDays, n) }}
                        disabled={scheduleSaving}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          maxPerSource === n ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-violet-300'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-zinc-400">
              {scheduleEnabled
                ? `Auto-refresh is on, scheduled around ${hourUtcToLocalLabel(scheduleHourUtc)} your time daily.`
                : 'Auto-refresh is off — use Run now or the Feed page button whenever you want fresh articles.'}
              {' · '}Last scheduled run: {formatRelativeTime(lastScheduledCrawlAt)}
            </p>
            {scheduleStatus && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{scheduleStatus}</p>}
          </>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Drafts Inbox</h2>
          <span className="rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">PRO</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Off by default. When on, once a day Signal looks at what you engaged with most (opened, pinned, or liked) and drafts <strong>one</strong> fully-written post from it — through the same evidence-grounded, citation-verified pipeline as Create — and leaves it in your Drafts Inbox for you to approve or dismiss. Nothing publishes automatically.</p>
        {!canUsePaidFeatures ? (
          <div className="mt-5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-4 text-sm leading-6 text-amber-900 dark:text-amber-200">
            Requires an active subscription and a configured model API key, same as Create and the other Pro actions.
          </div>
        ) : (
          <>
            <label className="mt-5 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              <input type="checkbox" checked={draftsInboxEnabled} disabled={draftsInboxSaving}
                onChange={event => toggleDraftsInbox(event.target.checked)} />
              Draft one post a day from what I engaged with most
            </label>
            <p className="mt-2 text-xs text-zinc-400">Capped at one draft per account per day. Review pending drafts in Create → Drafts Inbox.</p>
            {draftsInboxStatus && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{draftsInboxStatus}</p>}
          </>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Recent AI activity</h2>
            <p className="mt-1 text-xs text-zinc-400">Every agent call your account makes — which one, on what model, how long it took.</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${arizeConfigured
            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300'
            : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'}`}>
            {arizeConfigured ? 'Arize forwarding: on' : 'Arize forwarding: not configured'}
          </span>
        </div>
        {tracesLoading ? (
          <div className="mt-4 h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        ) : traces.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">No AI calls recorded yet — this fills in as you use Create, Ask Signal, and Find Connections.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="pb-2 pr-4 font-medium">Agent</th>
                  <th className="pb-2 pr-4 font-medium">Model</th>
                  <th className="pb-2 pr-4 font-medium">Duration</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {traces.map(t => (
                  <tr key={t.id} className="border-b border-zinc-50 dark:border-zinc-900">
                    <td className="py-2 pr-4 font-semibold text-zinc-700 dark:text-zinc-300">{t.agent}</td>
                    <td className="py-2 pr-4 text-zinc-500">{t.provider ? `${t.provider} · ${t.model}` : '—'}</td>
                    <td className="py-2 pr-4 text-zinc-500">{(t.duration_ms / 1000).toFixed(1)}s</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2 text-zinc-400">{formatRelativeTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!arizeConfigured && (
          <p className="mt-4 text-[11px] text-zinc-400">Set <code>ARIZE_API_KEY</code> and <code>ARIZE_SPACE_ID</code> in your environment to also forward these spans to Arize for full-trace observability.</p>
        )}
      </section>
    </div>
  )
}
