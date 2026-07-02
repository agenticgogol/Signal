'use client'

import TutorPanel from '@/components/TutorPanel'

export default function TutorHubPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">🎓 AI Tutor</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Ask about any AI/ML concept or term — a clear explanation, how it works, code when relevant, and use cases. Grounded in your own Feed and Library when something you&apos;ve saved is actually relevant.</p>
      </div>
      <TutorPanel variant="full" />
    </div>
  )
}
