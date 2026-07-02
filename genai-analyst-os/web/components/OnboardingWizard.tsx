'use client'

import { useState } from 'react'
import SourcesManager from '@/components/SourcesManager'
import { PROVIDER_OPTIONS, DEFAULT_PROVIDER, defaultModelFor, normalizeProvider, type SupportedProvider } from '@/lib/llmConfig'

export interface OnboardingPrefs {
  role: string | null
  interestAreas: string[]
  readingGoal: string | null
  readingFrequency: string | null
}

const SIGNAL_KEYS = ['engagement', 'recently_read', 'trending_news', 'recent_trend', 'emerging_topic'] as const
const SIGNAL_LABELS: Record<typeof SIGNAL_KEYS[number], string> = {
  engagement: 'Explicit engagement (likes/pins)',
  recently_read: 'Recently read',
  trending_news: 'Trending news',
  recent_trend: 'Recent trend',
  emerging_topic: 'Emerging topic',
}
const DEFAULT_SIGNAL_WEIGHTS: Record<string, number> = {
  engagement: 0.35, recently_read: 0.25, trending_news: 0.15, recent_trend: 0.15, emerging_topic: 0.10,
}

function hourUtcToLocalLabel(hourUtc: number): string {
  const d = new Date(Date.UTC(2024, 0, 1, hourUtc, 0, 0))
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

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
  { id: 'stay_current',      label: 'Stay current', detail: 'A quick daily pulse on what matters' },
  { id: 'deep_research',     label: 'Deep research', detail: 'Dig into specific topics in depth' },
  { id: 'content_creation',  label: 'Create content', detail: 'Turn what I read into posts and drafts' },
  { id: 'general_curiosity', label: 'General curiosity', detail: 'Browse and explore casually' },
]

const FREQUENCIES = [
  { id: 'daily',     label: 'Daily', detail: 'A short morning brief' },
  { id: 'weekly',    label: 'Weekly', detail: 'One digest each week' },
  { id: 'on_demand', label: 'On demand', detail: 'I\'ll check in myself' },
]

const TOTAL_STEPS = 9

export default function OnboardingWizard({
  userId,
  accessToken,
  onComplete,
  onSkip,
}: {
  userId: string
  accessToken: string
  onComplete: (prefs: OnboardingPrefs) => void
  onSkip: () => void
}) {
  const [step, setStep] = useState(1)
  const [role, setRole] = useState<string | null>(null)
  const [interests, setInterests] = useState<Set<string>>(new Set())
  const [goal, setGoal] = useState<string | null>(null)
  const [frequency, setFrequency] = useState<string | null>(null)

  // Step 5 — model provider + key
  const [provider, setProvider] = useState<SupportedProvider>(DEFAULT_PROVIDER)
  const [model, setModel] = useState(defaultModelFor(DEFAULT_PROVIDER))
  const [apiKey, setApiKey] = useState('')
  const [modelSaving, setModelSaving] = useState(false)
  const [modelStatus, setModelStatus] = useState<string | null>(null)

  // Step 6 — feed schedule
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleHourUtc, setScheduleHourUtc] = useState(13)
  const [scheduleSaving, setScheduleSaving] = useState(false)

  // Step 7 — content generation schedule (Drafts Inbox)
  const [draftsEnabled, setDraftsEnabled] = useState(false)
  const [draftsFormat, setDraftsFormat] = useState('linkedin')
  const [draftsSaving, setDraftsSaving] = useState(false)

  // Step 8 — content ranking logic
  const [signalWeights, setSignalWeights] = useState<Record<string, number>>(DEFAULT_SIGNAL_WEIGHTS)
  const [weightsSaving, setWeightsSaving] = useState(false)

  // Step 9 — publisher platforms
  const [mediumToken, setMediumToken] = useState('')
  const [connectSaving, setConnectSaving] = useState(false)
  const [connectStatus, setConnectStatus] = useState<string | null>(null)

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }

  const toggleInterest = (id: string) => {
    setInterests(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveModelSettings = async () => {
    if (!apiKey.trim()) { setStep(6); return }
    setModelSaving(true)
    setModelStatus(null)
    try {
      const res = await fetch('/api/data/llm-settings', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ userId, provider, model: model.trim(), apiKey: apiKey.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save')
      setModelStatus('Saved.')
      setStep(6)
    } catch (e) {
      setModelStatus(e instanceof Error ? e.message : 'Could not save — you can also do this later in Settings.')
    } finally {
      setModelSaving(false)
    }
  }

  const saveFeedSchedule = async (enabled: boolean) => {
    setScheduleSaving(true)
    try {
      await fetch('/api/data/schedule-settings', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ userId, enabled, hourUtc: scheduleHourUtc, lookbackDays: 7, maxPerSource: 5 }),
      })
      setScheduleEnabled(enabled)
    } catch {}
    setScheduleSaving(false)
  }

  const saveDraftsSchedule = async (enabled: boolean) => {
    setDraftsSaving(true)
    try {
      await fetch('/api/data/drafts-inbox-settings', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ userId, enabled, format: draftsFormat }),
      })
      setDraftsEnabled(enabled)
    } catch {}
    setDraftsSaving(false)
  }

  const saveSignalWeights = async (next: Record<string, number>) => {
    setSignalWeights(next)
    setWeightsSaving(true)
    try {
      await fetch('/api/data/content-signal-weights', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ userId, weights: next }),
      })
    } catch {}
    setWeightsSaving(false)
  }

  const connectMedium = async () => {
    if (!mediumToken.trim()) { finish(); return }
    setConnectSaving(true)
    setConnectStatus(null)
    try {
      const res = await fetch('/api/data/platform-connections', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ userId, platform: 'medium', accessToken: mediumToken.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not connect')
      setConnectStatus('Connected.')
      finish()
    } catch (e) {
      setConnectStatus(e instanceof Error ? e.message : 'Could not connect — you can also do this later in Settings.')
      finish()
    } finally {
      setConnectSaving(false)
    }
  }

  const finish = () => {
    onComplete({
      role,
      interestAreas: Array.from(interests),
      readingGoal: goal,
      readingFrequency: frequency,
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Progress */}
        <div className="h-1 bg-zinc-100 dark:bg-zinc-800 shrink-0">
          <div
            className="h-full bg-violet-600 transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <div className="p-7 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
              Quick setup · {step} of {TOTAL_STEPS}
            </p>
            <button onClick={onSkip} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              Skip all
            </button>
          </div>

          {step === 1 && (
            <>
              <h2 className="mt-2 text-xl font-black text-zinc-950 dark:text-white">What best describes you?</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">This helps Signal prioritize what to surface first.</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {ROLES.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-medium transition-all ${
                      role === r.id
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-violet-300'
                    }`}
                  >
                    <span className="text-base">{r.icon}</span>
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!role}
                className="mt-6 w-full rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-white transition-colors"
              >
                Continue
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="mt-2 text-xl font-black text-zinc-950 dark:text-white">What are you into?</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Pick a few — your feed will be ranked around these from day one.</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {INTERESTS.map(i => (
                  <button
                    key={i.id}
                    onClick={() => toggleInterest(i.id)}
                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-medium transition-all ${
                      interests.has(i.id)
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-violet-300'
                    }`}
                  >
                    <span className="text-base">{i.icon}</span>
                    {i.label}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={interests.size === 0}
                  className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-white transition-colors"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="mt-2 text-xl font-black text-zinc-950 dark:text-white">How do you want to use Signal?</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">We'll tune how much we show and how often.</p>

              <p className="mt-5 text-xs font-bold uppercase tracking-wide text-zinc-400">Main goal</p>
              <div className="mt-2 space-y-1.5">
                {GOALS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`flex w-full items-center justify-between rounded-xl border-2 px-3.5 py-2.5 text-left transition-all ${
                      goal === g.id
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-violet-300'
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{g.label}</span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">{g.detail}</span>
                    </span>
                    {goal === g.id && <span className="text-violet-600 dark:text-violet-400">✓</span>}
                  </button>
                ))}
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-wide text-zinc-400">How often</p>
              <div className="mt-2 flex gap-2">
                {FREQUENCIES.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFrequency(f.id)}
                    className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-center transition-all ${
                      frequency === f.id
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-violet-300'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{f.label}</span>
                    <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{f.detail}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!goal || !frequency}
                  className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-white transition-colors"
                >
                  Continue →
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="mt-2 text-xl font-black text-zinc-950 dark:text-white">Where should we look?</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Add the sites, blogs, or RSS feeds you want tracked — or use the starter pack and adjust later.</p>
              <div className="mt-5 max-h-[50vh] overflow-y-auto pr-1">
                <SourcesManager showChecklist={false} />
              </div>
              <div className="mt-6 flex gap-2">
                <button onClick={() => setStep(3)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">Back</button>
                <button onClick={() => setStep(5)} className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-3 text-sm font-bold text-white transition-colors">Continue →</button>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="mt-2 text-xl font-black text-zinc-950 dark:text-white">Bring your own model (optional)</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Unlocks Generate, Ask Signal, Create, and digests — requires an active subscription too. Skip if you're not ready; you can add this any time in Settings.</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {PROVIDER_OPTIONS.map(option => (
                  <button key={option.id}
                    onClick={() => { const next = normalizeProvider(option.id); setProvider(next); setModel(defaultModelFor(next)) }}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${provider === option.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-violet-300'}`}>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{option.label}</p>
                  </button>
                ))}
              </div>
              <input value={model} onChange={e => setModel(e.target.value)} placeholder="Model name"
                className="mt-3 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="API key"
                className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
              {modelStatus && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{modelStatus}</p>}
              <div className="mt-6 flex gap-2">
                <button onClick={() => setStep(4)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">Back</button>
                <button onClick={saveModelSettings} disabled={modelSaving}
                  className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-3 text-sm font-bold text-white transition-colors">
                  {modelSaving ? 'Saving…' : apiKey.trim() ? 'Save & continue →' : 'Skip →'}
                </button>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <h2 className="mt-2 text-xl font-black text-zinc-950 dark:text-white">Feed schedule</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Automatically refresh your feed every day at a time you pick — requires the subscription + key from the last step.</p>
              <label className="mt-5 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                <input type="checkbox" checked={scheduleEnabled} disabled={scheduleSaving} onChange={e => saveFeedSchedule(e.target.checked)} />
                Automatically refresh my feed every day
              </label>
              <select value={scheduleHourUtc} disabled={scheduleSaving}
                onChange={e => { const h = Number(e.target.value); setScheduleHourUtc(h); if (scheduleEnabled) saveFeedSchedule(true) }}
                className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500">
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourUtcToLocalLabel(h)} (your time)</option>)}
              </select>
              <div className="mt-6 flex gap-2">
                <button onClick={() => setStep(5)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">Back</button>
                <button onClick={() => setStep(7)} className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-3 text-sm font-bold text-white transition-colors">Continue →</button>
              </div>
            </>
          )}

          {step === 7 && (
            <>
              <h2 className="mt-2 text-xl font-black text-zinc-950 dark:text-white">Content generation schedule</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Once a day, draft one post from what you engaged with most — reviewed by you before anything publishes.</p>
              <label className="mt-5 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                <input type="checkbox" checked={draftsEnabled} disabled={draftsSaving} onChange={e => saveDraftsSchedule(e.target.checked)} />
                Draft one post a day automatically
              </label>
              <select value={draftsFormat} disabled={draftsSaving}
                onChange={e => setDraftsFormat(e.target.value)}
                className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500">
                <option value="linkedin">LinkedIn</option>
                <option value="substack">Substack</option>
                <option value="thread">Twitter/X Thread</option>
                <option value="blog">Blog Post</option>
                <option value="youtube_long">YouTube Long Script</option>
                <option value="youtube_short">YouTube Short Script</option>
              </select>
              <div className="mt-6 flex gap-2">
                <button onClick={() => setStep(6)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">Back</button>
                <button onClick={() => setStep(8)} className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-3 text-sm font-bold text-white transition-colors">Continue →</button>
              </div>
            </>
          )}

          {step === 8 && (
            <>
              <h2 className="mt-2 text-xl font-black text-zinc-950 dark:text-white">Content ranking logic</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">How "Generate" and Drafts Inbox pick a topic. Defaults work well — adjust only if you have a strong preference.</p>
              <div className="mt-5 space-y-3">
                {SIGNAL_KEYS.map(key => (
                  <div key={key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-zinc-700 dark:text-zinc-200">{SIGNAL_LABELS[key]}</span>
                      <span className="text-zinc-400">{Math.round((signalWeights[key] ?? 0) * 100)}%</span>
                    </div>
                    <input type="range" min={0} max={100} value={Math.round((signalWeights[key] ?? 0) * 100)}
                      disabled={weightsSaving}
                      onChange={e => saveSignalWeights({ ...signalWeights, [key]: Number(e.target.value) / 100 })}
                      className="w-full accent-violet-600" />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-2">
                <button onClick={() => setStep(7)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">Back</button>
                <button onClick={() => setStep(9)} className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-3 text-sm font-bold text-white transition-colors">Continue →</button>
              </div>
            </>
          )}

          {step === 9 && (
            <>
              <h2 className="mt-2 text-xl font-black text-zinc-950 dark:text-white">Publisher platforms (optional)</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Connect Medium now with a self-service integration token, or skip — LinkedIn, X, and more can be connected any time in Settings.</p>
              <input value={mediumToken} onChange={e => setMediumToken(e.target.value)} type="password" placeholder="Medium integration token (optional)"
                className="mt-4 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
              {connectStatus && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{connectStatus}</p>}
              <div className="mt-6 flex gap-2">
                <button onClick={() => setStep(8)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">Back</button>
                <button onClick={connectMedium} disabled={connectSaving}
                  className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-3 text-sm font-bold text-white transition-colors">
                  {connectSaving ? 'Saving…' : 'Finish setup →'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
