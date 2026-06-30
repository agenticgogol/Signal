'use client'

import { useState } from 'react'

export interface OnboardingPrefs {
  role: string | null
  interestAreas: string[]
  readingGoal: string | null
  readingFrequency: string | null
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

export default function OnboardingWizard({
  onComplete,
  onSkip,
}: {
  onComplete: (prefs: OnboardingPrefs) => void
  onSkip: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [role, setRole] = useState<string | null>(null)
  const [interests, setInterests] = useState<Set<string>>(new Set())
  const [goal, setGoal] = useState<string | null>(null)
  const [frequency, setFrequency] = useState<string | null>(null)

  const toggleInterest = (id: string) => {
    setInterests(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
      <div className="w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Progress */}
        <div className="h-1 bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full bg-violet-600 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-7">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
              Quick setup · {step} of 3
            </p>
            <button onClick={onSkip} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              Skip for now
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
                  onClick={finish}
                  disabled={!goal || !frequency}
                  className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-white transition-colors"
                >
                  Build my feed →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
