'use client'

import { useEffect, useState } from 'react'

// Today's Generate runs as a background job (no SSE — see /api/today/generate),
// so there's no real per-agent event stream to show, unlike Create. This
// gives the same "here's the multi-agent system at work" legibility anyway,
// honestly framed as a typical sequence rather than claiming live per-agent
// tracking it doesn't actually have.
const STAGES = [
  { icon: '🎯', label: 'Orchestrator planning the brief' },
  { icon: '✍️', label: 'Writer drafting' },
  { icon: '🔬', label: 'Verifier checking claims' },
  { icon: '🔍', label: 'Critic sharpening arguments' },
  { icon: '✨', label: 'Humanizer applying your voice' },
  { icon: '📊', label: 'Evaluator scoring quality' },
  { icon: '👥', label: 'Audience Sim stress-testing' },
  { icon: '💎', label: 'Final Polish' },
]
const STAGE_INTERVAL_MS = 5000

export default function GeneratingTicker() {
  const [stageIndex, setStageIndex] = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => {
    const stageTimer = setInterval(() => setStageIndex(i => Math.min(i + 1, STAGES.length - 1)), STAGE_INTERVAL_MS)
    const clock = setInterval(() => setElapsedSec(s => s + 1), 1000)
    return () => { clearInterval(stageTimer); clearInterval(clock) }
  }, [])

  const pct = Math.round(((stageIndex + 1) / STAGES.length) * 100)

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 px-3.5 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">{STAGES[stageIndex].icon} {STAGES[stageIndex].label}…</p>
        <span className="text-[11px] text-violet-500/80 dark:text-violet-400/70">{elapsedSec}s</span>
      </div>
      <div className="h-1.5 rounded-full bg-violet-100 dark:bg-violet-900/40 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[10px] text-violet-500/70 dark:text-violet-400/60">Typical 8-agent sequence shown — actual timing varies. Feel free to browse elsewhere; this finishes on its own.</p>
    </div>
  )
}
