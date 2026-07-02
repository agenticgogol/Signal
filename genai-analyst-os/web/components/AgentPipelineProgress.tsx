'use client'

export interface AgentStepView {
  id: string
  label: string
  icon: string
  status: 'pending' | 'running' | 'complete' | 'error'
  output?: string
}

// Makes "eight independent agents coordinating" visible and legible instead
// of a plain checklist — a horizontal pipeline that lights up stage by
// stage, a live progress bar, and one-line plain-language explanations of
// what's actually happening, not just agent names.
export default function AgentPipelineProgress({ steps }: { steps: AgentStepView[] }) {
  const completeCount = steps.filter(s => s.status === 'complete').length
  const pct = steps.length > 0 ? Math.round((completeCount / steps.length) * 100) : 0
  const runningIndex = steps.findIndex(s => s.status === 'running')
  const hasError = steps.some(s => s.status === 'error')
  const allDone = completeCount === steps.length && !hasError

  return (
    <div>
      {/* Progress bar + headline */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {allDone ? '🎉 All agents complete' : hasError ? '⚠️ Stopped — see below' : runningIndex >= 0 ? `${steps[runningIndex].icon} ${steps[runningIndex].label}` : 'Starting…'}
          </p>
          <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{completeCount}/{steps.length} agents</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${hasError ? 'bg-red-500' : allDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-500 to-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Horizontal pipeline — the "this is a coordinated multi-agent system" visual */}
      <div className="mb-6 flex items-center overflow-x-auto pb-2 -mx-1 px-1">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center shrink-0">
            <div
              title={s.label}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-base border-2 transition-all ${
                s.status === 'complete' ? 'bg-emerald-500 border-emerald-500 text-white' :
                s.status === 'running' ? 'bg-violet-600 border-violet-600 text-white animate-pulse ring-4 ring-violet-200 dark:ring-violet-900' :
                s.status === 'error' ? 'bg-red-500 border-red-500 text-white' :
                'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400'
              }`}
            >
              {s.status === 'complete' ? '✓' : s.status === 'error' ? '✗' : s.icon}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-6 sm:w-10 transition-colors ${s.status === 'complete' ? 'bg-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Detailed checklist with output, kept for transparency/debugging */}
      <div className="space-y-4">
        {steps.map(s => (
          <div key={s.id}>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                {s.status === 'running' && <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />}
                {s.status === 'complete' && <span className="text-emerald-500 text-sm">✓</span>}
                {s.status === 'error' && <span className="text-red-500 text-sm">✗</span>}
                {s.status === 'pending' && <div className="w-3 h-3 rounded-full border border-zinc-300 dark:border-zinc-600" />}
              </div>
              <span className={`text-sm font-medium ${
                s.status === 'running' ? 'text-violet-600' :
                s.status === 'complete' ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400'
              }`}>
                {s.icon} {s.label}
              </span>
            </div>
            {s.status === 'complete' && s.output && (
              <details className="ml-9 mt-1.5">
                <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600">View output</summary>
                <div className="mt-1 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 text-xs text-zinc-600 dark:text-zinc-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {s.output.length > 400 ? s.output.slice(0, 400) + '…' : s.output}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
