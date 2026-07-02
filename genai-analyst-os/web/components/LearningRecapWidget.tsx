'use client'

import { useEffect, useState } from 'react'
import { openTutor } from '@/lib/openTutor'

interface RecapConcept { term: string; count: number }
interface RevisitCandidate { term: string; lookupCount: number; lastLookedUpAt: string }
interface Recap {
  topConcepts: RecapConcept[]
  revisitCandidates: RevisitCandidate[]
  itemsEngaged: number
  questionsAsked: number
}

// Makes the "read -> understand -> publish" loop visible instead of an
// invisible backend signal — same data Generate already uses to pick a
// topic, surfaced here so the connection is obvious, with a direct button
// to act on it. Sits beside Reset view since both are "about the page as a
// whole," not about any one reading/publishing item.
export default function LearningRecapWidget({ userId, onUseTopic }: { userId: string; onUseTopic: (topic: string) => void }) {
  const [recap, setRecap] = useState<Recap | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetch(`/api/today/recap?userId=${encodeURIComponent(userId)}`)
      .then(res => res.json())
      .then(json => { if (!json.error) setRecap(json) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  if (loading || !recap || recap.topConcepts.length === 0) return null

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/20 px-4 py-3 max-w-md">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">🧠 Your week</p>
        <span className="text-[11px] text-violet-500/80 dark:text-violet-400/70">{recap.itemsEngaged} engaged · {recap.questionsAsked} asked</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {recap.topConcepts.slice(0, 3).map(c => (
          <button
            key={c.term}
            onClick={() => onUseTopic(c.term)}
            title={`Turn "${c.term}" into a post`}
            className="flex items-center gap-1 rounded-full bg-white dark:bg-zinc-900 border border-violet-200 dark:border-violet-800 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-colors"
          >
            {c.term} <span className="text-violet-400">✍️</span>
          </button>
        ))}
      </div>
      {recap.revisitCandidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-violet-200/60 dark:border-violet-800/50">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Still fuzzy on:</span>
          {recap.revisitCandidates.map(r => (
            <button
              key={r.term}
              onClick={() => openTutor(r.term)}
              className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline"
            >
              {r.term} →
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
