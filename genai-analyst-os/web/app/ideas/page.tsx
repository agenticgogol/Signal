'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── types ──────────────────────────────────────────────────────────────────────

interface Idea {
  id: string
  position: number
  format: string
  angle_title: string
  hook_sentence: string
  rationale: string
  idea_date: string
}

interface GeneratedIdea {
  title: string
  pitch: string
  why_timely: string
}

interface OutlineSection {
  title: string
  points: string[]
}

interface Outline {
  sections: OutlineSection[]
  angle: string
  audience: string
  hook: string
  format_recommendation: string
}

// ── styling maps ───────────────────────────────────────────────────────────────

const FORMAT_STYLES: Record<string, string> = {
  linkedin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  substack: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  thread: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  blog: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  youtube_long: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  youtube_short: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
}

const POSITION_COLORS = [
  'bg-yellow-400 text-yellow-900',
  'bg-gray-300 text-gray-800',
  'bg-orange-300 text-orange-900',
  'bg-gray-200 text-gray-700',
  'bg-gray-200 text-gray-700',
]

// ── wizard constants ───────────────────────────────────────────────────────────

const FOCUS_OPTIONS = [
  'Agents & Orchestration', 'RAG & Retrieval', 'Fine-tuning', 'LLM Engineering',
  'AI Products', 'Research Trends', 'Ops & Infrastructure', 'Safety & Alignment',
]

const AUDIENCE_OPTIONS = [
  'Practitioners & Engineers', 'ML Researchers', 'Product Managers',
  'Business Leaders', 'General Tech', 'Mixed',
]

const ANGLE_OPTIONS = [
  'Contrarian take', 'Practical how-to', 'Research breakdown',
  'Industry analysis', 'Personal experience', 'Future prediction',
]

// ── sub-components ─────────────────────────────────────────────────────────────

function StepDot({ step, current }: { step: number; current: number }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
      step < current ? 'bg-violet-600 text-white' :
      step === current ? 'bg-violet-600 text-white ring-4 ring-violet-100 dark:ring-violet-900' :
      'bg-gray-200 dark:bg-gray-700 text-gray-400'
    }`}>
      {step < current ? '✓' : step}
    </div>
  )
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const router = useRouter()
  const userId = process.env.NEXT_PUBLIC_USER_ID!
  const today = new Date().toISOString().split('T')[0]

  const [tab, setTab] = useState<'today' | 'wizard'>('today')

  // Tab 1 state
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [ideasLoading, setIdeasLoading] = useState(true)
  const [ideasError, setIdeasError] = useState<string | null>(null)

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1)
  const [focusStep, setFocusStep] = useState(1)   // sub-step within Q&A
  const [focusAreas, setFocusAreas] = useState<string[]>([])
  const [focusOther, setFocusOther] = useState('')
  const [audience, setAudience] = useState('')
  const [angle, setAngle] = useState('')
  const [freeText, setFreeText] = useState('')

  // Step 2 — generated topic ideas
  const [generatedIdeas, setGeneratedIdeas] = useState<GeneratedIdea[]>([])
  const [selectedIdeaIdx, setSelectedIdeaIdx] = useState<number | null>(null)
  const [customTopic, setCustomTopic] = useState('')
  const [generatingIdeas, setGeneratingIdeas] = useState(false)

  // Step 3 — outline
  const [outline, setOutline] = useState<Outline | null>(null)
  const [outlineSections, setOutlineSections] = useState<OutlineSection[]>([])
  const [generatingOutline, setGeneratingOutline] = useState(false)
  const [savingOutline, setSavingOutline] = useState(false)

  const fetchIdeas = useCallback(async () => {
    setIdeasLoading(true)
    setIdeasError(null)
    try {
      const res = await fetch(`/api/data/ideas?userId=${userId}&date=${today}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setIdeas((json.ideas as Idea[]) ?? [])
    } catch (e) {
      setIdeasError(String(e))
    } finally {
      setIdeasLoading(false)
    }
  }, [userId, today])

  useEffect(() => { fetchIdeas() }, [fetchIdeas])

  // Pre-fill wizard from "Use This Outline" on a today's idea
  const useIdeaInWizard = (idea: Idea) => {
    setFreeText(`${idea.angle_title}\n\nHook: ${idea.hook_sentence}\n\nWhy: ${idea.rationale}`)
    setTab('wizard')
    setWizardStep(1)
    setFocusStep(4)
  }

  // Generate topic ideas
  const handleGenerateIdeas = async () => {
    setGeneratingIdeas(true)
    setWizardStep(2)
    try {
      const allFocus = focusOther ? [...focusAreas, focusOther] : focusAreas
      const res = await fetch('/api/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focusAreas: allFocus, audience, angle, freeText, userId }),
      })
      const json = await res.json()
      setGeneratedIdeas(json.ideas ?? [])
    } catch {}
    setGeneratingIdeas(false)
  }

  // Generate outline
  const handleGenerateOutline = async () => {
    const topic = selectedIdeaIdx !== null
      ? generatedIdeas[selectedIdeaIdx]?.title
      : customTopic
    if (!topic) return
    setGeneratingOutline(true)
    setWizardStep(3)
    try {
      const allFocus = focusOther ? [...focusAreas, focusOther] : focusAreas
      const res = await fetch('/api/outline/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, audience, angle, focusAreas: allFocus, userId }),
      })
      const json = await res.json()
      setOutline(json.outline)
      setOutlineSections(json.outline?.sections ?? [])
    } catch {}
    setGeneratingOutline(false)
  }

  // Save and freeze outline
  const handleFreezeOutline = async () => {
    if (!outline) return
    setSavingOutline(true)
    const topic = selectedIdeaIdx !== null
      ? generatedIdeas[selectedIdeaIdx]?.title
      : customTopic
    const allFocus = focusOther ? [...focusAreas, focusOther] : focusAreas
    try {
      const res = await fetch('/api/outline/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outline: { ...outline, sections: outlineSections },
          topic,
          format: outline.format_recommendation ?? 'blog',
          focusAreas: allFocus,
          userId,
        }),
      })
      const json = await res.json()
      if (json.id) {
        router.push(`/create?outline_id=${json.id}`)
      }
    } catch {}
    setSavingOutline(false)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Ideas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Today&apos;s AI-curated ideas and your topic discovery wizard
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-8 w-fit">
        <button
          onClick={() => setTab('today')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'today'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          📅 Today&apos;s AI-Generated Ideas
        </button>
        <button
          onClick={() => setTab('wizard')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'wizard'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          🧭 Discover New Topic
        </button>
      </div>

      {/* ── Tab 1: Today's Ideas ─────────────────────────────────────────── */}
      {tab === 'today' && (
        <div>
          {ideasError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 text-red-700 dark:text-red-300 text-sm">
              Failed to load ideas.
            </div>
          )}

          {ideasLoading && (
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-xl ring-1 ring-black/5 p-6">
                  <div className="space-y-3 animate-pulse">
                    <div className="h-5 w-24 bg-gray-200 dark:bg-gray-800 rounded-full" />
                    <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
                    <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!ideasLoading && ideas.length === 0 && !ideasError && (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">💡</div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No ideas for today yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-6">
                Run the pipeline to generate your daily content ideas, or discover your own topic.
              </p>
              <div className="flex justify-center gap-3">
                <form action="/api/pipeline/trigger" method="POST">
                  <button type="submit" className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors">
                    Run Pipeline
                  </button>
                </form>
                <button
                  onClick={() => setTab('wizard')}
                  className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm transition-colors"
                >
                  🧭 Discover Topic
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {ideas.map((idea, idx) => (
              <div
                key={idea.id}
                className="bg-white dark:bg-gray-900 rounded-xl ring-1 ring-black/5 dark:ring-white/5 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${POSITION_COLORS[idx] ?? POSITION_COLORS[4]}`}>
                      #{idea.position}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${FORMAT_STYLES[idea.format] ?? FORMAT_STYLES.blog}`}>
                        {idea.format.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 leading-snug mb-1">{idea.angle_title}</h3>
                      {idea.hook_sentence && <p className="text-sm italic text-gray-500 dark:text-gray-400 mb-2">&ldquo;{idea.hook_sentence}&rdquo;</p>}
                      {idea.rationale && <p className="text-xs text-gray-400 dark:text-gray-500">{idea.rationale}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => useIdeaInWizard(idea)}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                    >
                      Use This Outline
                    </button>
                    <a
                      href={`/create?idea_id=${idea.id}&format=${idea.format}`}
                      className="px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors text-center"
                    >
                      Go to Create
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab 2: Wizard ────────────────────────────────────────────────── */}
      {tab === 'wizard' && (
        <div>
          {/* Step indicators */}
          <div className="flex items-center gap-3 mb-8">
            {[1, 2, 3].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <StepDot step={step} current={wizardStep} />
                <span className={`text-sm font-medium ${wizardStep >= step ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                  {step === 1 ? 'Focus Q&A' : step === 2 ? 'Pick a Topic' : 'Build Outline'}
                </span>
                {i < 2 && <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 w-8" />}
              </div>
            ))}
          </div>

          {/* ── Wizard Step 1: Q&A ──────────────────────────────────────── */}
          {wizardStep === 1 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl ring-1 ring-black/5 dark:ring-white/5 p-6">
              {/* Q1 */}
              {focusStep >= 1 && (
                <div className={`mb-8 transition-all ${focusStep > 1 ? 'opacity-60' : ''}`}>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Q1: What&apos;s your primary content focus this week?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => {
                          setFocusAreas(prev =>
                            prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
                          )
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          focusAreas.includes(opt)
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-violet-400'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                    <input
                      value={focusOther}
                      onChange={e => setFocusOther(e.target.value)}
                      placeholder="Other…"
                      className="px-3 py-1.5 rounded-full text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 w-32 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  {focusStep === 1 && (
                    <button
                      onClick={() => setFocusStep(2)}
                      disabled={focusAreas.length === 0 && !focusOther}
                      className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Next →
                    </button>
                  )}
                </div>
              )}

              {/* Q2 */}
              {focusStep >= 2 && (
                <div className={`mb-8 transition-all ${focusStep > 2 ? 'opacity-60' : ''}`}>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Q2: Who is your target audience?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {AUDIENCE_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => setAudience(opt)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          audience === opt
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-violet-400'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {focusStep === 2 && (
                    <button
                      onClick={() => setFocusStep(3)}
                      disabled={!audience}
                      className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Next →
                    </button>
                  )}
                </div>
              )}

              {/* Q3 */}
              {focusStep >= 3 && (
                <div className={`mb-8 transition-all ${focusStep > 3 ? 'opacity-60' : ''}`}>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Q3: What angle resonates with you most?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ANGLE_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => setAngle(opt)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          angle === opt
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-violet-400'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {focusStep === 3 && (
                    <button
                      onClick={() => setFocusStep(4)}
                      disabled={!angle}
                      className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Next →
                    </button>
                  )}
                </div>
              )}

              {/* Q4 */}
              {focusStep >= 4 && (
                <div className="mb-6">
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Q4: Any specific topics or trends you want to explore? <span className="font-normal text-gray-400">(optional)</span>
                  </p>
                  <input
                    value={freeText}
                    onChange={e => setFreeText(e.target.value)}
                    placeholder="e.g. 'tool use in production', 'cost of reasoning models', 'eval frameworks'"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}

              {focusStep >= 4 && (
                <button
                  onClick={handleGenerateIdeas}
                  disabled={generatingIdeas || focusAreas.length === 0}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  {generatingIdeas ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating ideas…
                    </span>
                  ) : 'Generate Topic Ideas →'}
                </button>
              )}
            </div>
          )}

          {/* ── Wizard Step 2: Pick Topic ────────────────────────────────── */}
          {wizardStep === 2 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl ring-1 ring-black/5 dark:ring-white/5 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Pick a topic</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Based on your feed and focus areas</p>

              {generatingIdeas ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {generatedIdeas.map((idea, i) => (
                      <label
                        key={i}
                        className={`flex gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedIdeaIdx === i
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="idea"
                          checked={selectedIdeaIdx === i}
                          onChange={() => { setSelectedIdeaIdx(i); setCustomTopic('') }}
                          className="mt-1 accent-violet-600"
                        />
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{idea.title}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{idea.pitch}</p>
                          <p className="text-xs text-violet-600 dark:text-violet-400">{idea.why_timely}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Or type your own topic:
                    </label>
                    <input
                      value={customTopic}
                      onChange={e => { setCustomTopic(e.target.value); setSelectedIdeaIdx(null) }}
                      placeholder="Your topic idea…"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleGenerateOutline}
                      disabled={selectedIdeaIdx === null && !customTopic.trim()}
                      className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                      Build Outline →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Wizard Step 3: Outline ───────────────────────────────────── */}
          {wizardStep === 3 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl ring-1 ring-black/5 dark:ring-white/5 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Your Outline</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Edit sections inline, then freeze to use for content</p>

              {generatingOutline ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : outline ? (
                <>
                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Angle</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{outline.angle}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Audience</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{outline.audience}</p>
                    </div>
                    <div className="col-span-2 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
                      <p className="text-xs text-violet-400 mb-1">Hook</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100 italic">&ldquo;{outline.hook}&rdquo;</p>
                    </div>
                  </div>

                  {/* Editable sections */}
                  <div className="space-y-4 mb-6">
                    {outlineSections.map((section, si) => (
                      <div key={si} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                        <input
                          value={section.title}
                          onChange={e => {
                            const updated = [...outlineSections]
                            updated[si] = { ...updated[si], title: e.target.value }
                            setOutlineSections(updated)
                          }}
                          className="w-full font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 pb-1 mb-3 focus:outline-none focus:border-violet-500"
                        />
                        {section.points.map((pt, pi) => (
                          <div key={pi} className="flex gap-2 mb-1.5">
                            <span className="text-gray-300 dark:text-gray-600 mt-2 text-xs flex-shrink-0">•</span>
                            <textarea
                              value={pt}
                              rows={1}
                              onChange={e => {
                                const updated = [...outlineSections]
                                const points = [...updated[si].points]
                                points[pi] = e.target.value
                                updated[si] = { ...updated[si], points }
                                setOutlineSections(updated)
                              }}
                              className="flex-1 text-sm text-gray-600 dark:text-gray-400 bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-violet-500 rounded px-1"
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleFreezeOutline}
                      disabled={savingOutline}
                      className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                      {savingOutline ? 'Saving…' : '🔒 Freeze & Use for Content'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400">Failed to generate outline. Try again.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
