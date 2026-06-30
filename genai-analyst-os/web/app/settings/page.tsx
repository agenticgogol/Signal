'use client'

import { useEffect, useState } from 'react'
import { useAuthSession } from '@/lib/useAuthSession'
import { defaultModelFor, normalizeProvider, type ProviderOption, type SupportedProvider } from '@/lib/llmConfig'

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
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">Paid actions use your account-level provider settings. This controls weekly digest regeneration, topic ideas, outline generation, voice analysis, and the full multi-agent content writer stack.</p>
      </div>

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
              disabled={saving || !model.trim()}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Save model settings'}
            </button>

            {status && <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-700 dark:text-green-300">{status}</div>}
            {error && <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
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
    </div>
  )
}
