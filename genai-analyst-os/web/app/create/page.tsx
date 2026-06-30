'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ActionConfirmModal, AdminGateModal } from '@/components/AdminGate'
import { PLATFORM_SPECS } from '@/lib/platformSpecs'
import { useAuthSession } from '@/lib/useAuthSession'

type Format = 'linkedin' | 'substack' | 'thread' | 'blog' | 'youtube_long' | 'youtube_short'
type Step = 1 | 2 | 3 | 4 | 5
type SourceMode = 'outline' | 'feed' | 'notebook' | 'custom'
type AgentStatus = 'pending' | 'running' | 'complete' | 'error'

interface AgentStep {
  id: string; label: string; icon: string; status: AgentStatus; output: string
}

interface FeedArticle {
  id: string; title: string; url: string; blend_score: number; topic_tags?: string[]
}

interface NotebookOption {
  id: string
  title: string
  description?: string | null
}

interface NotebookItemOption {
  id: string
  source_type: 'url' | 'note'
  source_url: string | null
  title: string
  summary: string | null
  why_it_matters: string | null
  topic_tags: string[]
  status: string
}

interface FrozenOutline {
  id: string; topic: string; format: string; created_at: string
  outline: { hook: string; angle: string; sections: { title: string }[] }
}

interface OutlineData {
  topic: string; format: string
  outline: { hook: string; angle: string; audience: string; sections: { title: string; points: string[] }[] }
}

interface ModelSettingsPayload {
  provider: string
  model: string
}

const FORMATS: { id: Format; label: string; icon: string; guidance: string }[] = [
  { id: 'linkedin',      label: 'LinkedIn',      icon: '💼', guidance: '~1300 chars · hook-first · blank lines between paras' },
  { id: 'substack',      label: 'Substack',      icon: '📧', guidance: '700–1000 words · personal arc · narrative voice' },
  { id: 'thread',        label: 'Thread',        icon: '🧵', guidance: '8–12 tweets · one insight per tweet · numbered' },
  { id: 'blog',          label: 'Blog Post',     icon: '📝', guidance: '1500–2000 words · H2 sections · TL;DR up top' },
  { id: 'youtube_long',  label: 'YouTube Long',  icon: '🎥', guidance: 'Script · 8–12 min · chapter markers · B-roll cues' },
  { id: 'youtube_short', label: 'YouTube Short', icon: '⚡', guidance: '60–90 sec · 3s hook · text overlays' },
]

const AUDIENCE_OPTIONS = [
  'Practitioners & Engineers', 'ML Researchers', 'Product Managers',
  'Business Leaders', 'General Tech', 'Mixed',
]

const INITIAL_STEPS: AgentStep[] = [
  { id: 'orchestrator',  label: 'Orchestrator — building content brief',         icon: '🎯', status: 'pending', output: '' },
  { id: 'writer',        label: 'Writer — drafting content',                     icon: '✍️', status: 'pending', output: '' },
  { id: 'verifier',      label: 'Verifier — checking claim accuracy',            icon: '🔬', status: 'pending', output: '' },
  { id: 'critic',        label: 'Critic — fact-checking & improving',            icon: '🔍', status: 'pending', output: '' },
  { id: 'humanizer',     label: 'Humanizer — applying voice & style',            icon: '✨', status: 'pending', output: '' },
  { id: 'evaluator',     label: 'Evaluator — scoring quality (5 criteria)',      icon: '📊', status: 'pending', output: '' },
  { id: 'audience_sim',  label: 'Audience Sim — 3 reader personas react',        icon: '👥', status: 'pending', output: '' },
  { id: 'final_polish',  label: 'Final Polish — addressing audience objections', icon: '💎', status: 'pending', output: '' },
]

const STEP_LABELS = ['Source', 'Brief', 'Platform', 'Generate', 'Review & Export']

function Stepper({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as Step
        const done = step < current; const active = step === current
        return (
          <div key={step} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                done ? 'bg-violet-600 text-white' :
                active ? 'bg-violet-600 text-white ring-4 ring-violet-100 dark:ring-violet-900' :
                'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'
              }`}>
                {done ? '✓' : step}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${
                active ? 'text-violet-600 dark:text-violet-400' :
                done ? 'text-zinc-500' : 'text-zinc-400'
              }`}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-px w-8 md:w-14 mx-1 mt-[-1rem] flex-shrink-0 ${
                step < current ? 'bg-violet-400' : 'bg-zinc-200 dark:bg-zinc-700'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function CreatePageInner() {
  const searchParams = useSearchParams()
  const { session, user } = useAuthSession()
  const [step, setStep] = useState<Step>(1)
  const userId = user?.id ?? process.env.NEXT_PUBLIC_USER_ID ?? ''

  // Step 1
  const [sourceMode, setSourceMode] = useState<SourceMode>('outline')
  const [frozenOutlines, setFrozenOutlines] = useState<FrozenOutline[]>([])
  const [outlineId, setOutlineId] = useState<string | null>(null)
  const [outlineData, setOutlineData] = useState<OutlineData | null>(null)
  const [feedArticles, setFeedArticles] = useState<FeedArticle[]>([])
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set())
  const [notebooks, setNotebooks] = useState<NotebookOption[]>([])
  const [selectedNotebookId, setSelectedNotebookId] = useState('')
  const [notebookItems, setNotebookItems] = useState<NotebookItemOption[]>([])
  const [selectedNotebookItemIds, setSelectedNotebookItemIds] = useState<Set<string>>(new Set())
  const [customBriefInput, setCustomBriefInput] = useState('')

  // Step 2
  const [topic, setTopic] = useState('')
  const [keyAngle, setKeyAngle] = useState('')
  const [pov, setPov] = useState('')
  const [targetAudience, setTargetAudience] = useState('')

  // Step 3
  const [format, setFormat] = useState<Format>('linkedin')

  // Step 4
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>(INITIAL_STEPS)
  const [isGenerating, setIsGenerating] = useState(false)
  const [finalOutput, setFinalOutput] = useState('')

  // Step 5
  const [copied, setCopied] = useState(false)
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [exportStatus, setExportStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const finalRef = useRef<HTMLTextAreaElement>(null)

  // Admin gate
  const [showAdminGate, setShowAdminGate] = useState(false)
  const [pendingGenerate, setPendingGenerate] = useState(false)
  const [showPaidConfirm, setShowPaidConfirm] = useState(false)
  const [pendingPaidGenerate, setPendingPaidGenerate] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [canUsePaidFeatures, setCanUsePaidFeatures] = useState(false)
  const [modelProvider, setModelProvider] = useState('')
  const [modelName, setModelName] = useState('')

  // ── Load frozen outlines on mount ──────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/data/outlines?userId=${userId}`)
      .then(r => r.json())
      .then(json => setFrozenOutlines(json.outlines ?? []))
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    fetch(`/api/data/voice?userId=${userId}`)
      .then(response => response.json())
      .then(json => setVoiceActive(Boolean(json.fingerprint)))
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    fetch(`/api/data/profile?userId=${userId}`)
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load profile')
        setPlan(json.plan === 'pro' ? 'pro' : 'free')
        setCanUsePaidFeatures(Boolean(json.canUsePaidFeatures))
      })
      .catch(() => { setPlan('free'); setCanUsePaidFeatures(false) })
  }, [userId])

  useEffect(() => {
    if (!session?.access_token || !userId) return
    fetch(`/api/data/llm-settings?userId=${userId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async response => {
        const json = await response.json() as ModelSettingsPayload & { error?: string }
        if (!response.ok) throw new Error(json.error ?? 'Could not load model settings')
        setModelProvider(json.provider ?? '')
        setModelName(json.model ?? '')
      })
      .catch(() => { setModelProvider(''); setModelName('') })
  }, [session?.access_token, userId])

  useEffect(() => {
    if (!session?.access_token || !userId) return
    fetch(`/api/data/knowledge-notebooks?userId=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(json => setNotebooks(json.notebooks ?? []))
      .catch(() => setNotebooks([]))
  }, [session?.access_token, userId])

  // ── Load feed articles when sourceMode = 'feed' ───────────────────────────
  useEffect(() => {
    if (sourceMode !== 'feed') return
    // First try sessionStorage for pinned articles
    try {
      const saved = sessionStorage.getItem('signal_selected_articles')
      if (saved) {
        const ids: string[] = JSON.parse(saved)
        if (ids.length > 0) {
          setSelectedArticleIds(new Set(ids))
        }
      }
    } catch {}

    const today = new Date().toISOString().split('T')[0]
    fetch(`/api/data/feed?userId=${userId}&date=${today}`)
      .then(r => r.json())
      .then(json => {
        const arts: FeedArticle[] = (json.items ?? []).map((item: { blend_score: number; articles: { id: string; title: string; url: string; topic_tags: string[] } | null }) => {
          const a = Array.isArray(item.articles) ? item.articles[0] : item.articles
          return a ? { id: a.id, title: a.title, url: a.url, blend_score: item.blend_score, topic_tags: a.topic_tags } : null
        }).filter(Boolean) as FeedArticle[]
        setFeedArticles(arts)
      })
      .catch(() => {})
  }, [sourceMode, userId])

  useEffect(() => {
    if (sourceMode !== 'notebook' || !session?.access_token || !userId || !selectedNotebookId) return
    fetch(`/api/data/knowledge-notebook?userId=${encodeURIComponent(userId)}&notebookId=${encodeURIComponent(selectedNotebookId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(json => {
        const nextItems: NotebookItemOption[] = (json.items ?? []).filter((item: NotebookItemOption) => item.status === 'ready')
        setNotebookItems(nextItems)
        setSelectedNotebookItemIds(new Set(nextItems.slice(0, 3).map(item => item.id)))
      })
      .catch(() => { setNotebookItems([]); setSelectedNotebookItemIds(new Set()) })
  }, [sourceMode, session?.access_token, userId, selectedNotebookId])

  // ── Handle URL params ──────────────────────────────────────────────────────
  useEffect(() => {
    const oid = searchParams.get('outline_id')
    const src = searchParams.get('source')
    const fmtParam = searchParams.get('format') as Format | null

    if (oid) {
      setOutlineId(oid)
      setSourceMode('outline')
      fetch(`/api/data/outline?id=${oid}`)
        .then(r => r.json())
        .then(json => {
          if (json.outline) {
            setOutlineData(json.outline)
            setTopic(json.outline.topic ?? '')
            setKeyAngle(json.outline.outline?.angle ?? '')
            setFormat((json.outline.format as Format) ?? 'linkedin')
          }
        }).catch(() => {})
    } else if (src === 'feed') {
      setSourceMode('feed')
    } else if (src === 'notebook') {
      setSourceMode('notebook')
      const notebookId = searchParams.get('notebook_id')
      if (notebookId) setSelectedNotebookId(notebookId)
    }
    if (fmtParam) setFormat(fmtParam)
  }, [searchParams])

  // ── Fetch outline when selected from dropdown ──────────────────────────────
  const handleOutlineSelect = (id: string) => {
    setOutlineId(id)
    if (!id) { setOutlineData(null); return }
    fetch(`/api/data/outline?id=${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.outline) {
          setOutlineData(json.outline)
          setTopic(json.outline.topic ?? '')
          setKeyAngle(json.outline.outline?.angle ?? '')
          setFormat((json.outline.format as Format) ?? 'linkedin')
        }
      }).catch(() => {})
  }

  const buildBriefAndSources = () => {
    const parts = []
    if (topic) parts.push(`Topic: ${topic}`)
    if (keyAngle) parts.push(`Angle: ${keyAngle}`)
    if (targetAudience) parts.push(`Audience: ${targetAudience}`)
    if (pov) parts.push(`Author POV: ${pov}`)
    if (sourceMode === 'custom' && customBriefInput) parts.push(customBriefInput)
    if (outlineData?.outline?.sections) {
      parts.push(`Outline:\n${outlineData.outline.sections.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}`)
    }

    const sources: { title: string; url: string; domain: string }[] = []
    if (selectedArticleIds.size > 0) {
      const selected = feedArticles.filter(a => selectedArticleIds.has(a.id))
      selected.forEach(a => {
        let domain = ''
        try { domain = new URL(a.url).hostname.replace('www.', '') } catch {}
        sources.push({ title: a.title, url: a.url, domain })
      })
      parts.push(`Source articles:\n${selected.map(a => `- ${a.title} (${a.url})`).join('\n')}`)
    }

    if (sourceMode === 'notebook' && selectedNotebookItemIds.size > 0) {
      const selected = notebookItems.filter(item => selectedNotebookItemIds.has(item.id))
      selected.forEach(item => {
        let domain = ''
        const url = item.source_url || `signal://knowledge/${item.id}`
        try { domain = new URL(url).hostname.replace('www.', '') } catch { domain = 'signal-knowledge' }
        sources.push({ title: item.title, url, domain })
      })
      parts.push(`Notebook context:\n${selected.map(item => {
        const source = item.source_url || 'Private note'
        const summary = item.summary ? `Summary: ${item.summary}` : ''
        const why = item.why_it_matters ? `Why it matters: ${item.why_it_matters}` : ''
        return `- ${item.title} (${source})\n${summary}\n${why}`.trim()
      }).join('\n\n')}`)
    }

    return { brief: parts.join('\n'), sources }
  }

  const doGenerate = async (token?: string) => {
    const { brief, sources } = buildBriefAndSources()
    if (!brief.trim()) return
    setIsGenerating(true)
    setFinalOutput('')
    setAgentSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'pending', output: '' })))
    setStep(4)

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      if (token) headers['x-admin-token'] = token

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ brief, sources, format, pov, userId }),
      })
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''
        for (const chunk of chunks) {
          const eventMatch = chunk.match(/event: (\S+)/)
          const dataMatch = chunk.match(/data: (.+)/)
          if (eventMatch && dataMatch) {
            try { handleSSEEvent(eventMatch[1], JSON.parse(dataMatch[1])) } catch {}
          }
        }
      }
      const eventMatch = buffer.match(/event: (\S+)/)
      const dataMatch = buffer.match(/data: (.+)/)
      if (eventMatch && dataMatch) {
        try { handleSSEEvent(eventMatch[1], JSON.parse(dataMatch[1])) } catch {}
      }
    } catch (err) {
      console.error('Generation error:', err)
      setAgentSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateClick = () => {
    if (canUsePaidFeatures) {
      setPendingPaidGenerate(true)
      setShowPaidConfirm(true)
    } else {
      setPendingGenerate(true)
      setShowAdminGate(true)
    }
  }

  const handleSSEEvent = (event: string, payload: Record<string, unknown>) => {
    if (event === 'agent_start') {
      const agent = payload.agent as string
      const loop = payload.loop as number | undefined
      setAgentSteps(prev => prev.map(s => s.id === agent
        ? { ...s, status: 'running', label: loop && loop > 1 && ['writer','verifier','critic','humanizer'].includes(agent)
            ? s.label.replace(/ \(loop \d+\)$/, '') + ` (loop ${loop})`
            : s.label }
        : s))
    } else if (event === 'agent_complete') {
      const agent = payload.agent as string
      const output = payload.output as string
      // For evaluator, show scores in the label
      if (agent === 'evaluator') {
        const scores = payload.scores as Record<string, number> | undefined
        const pass = payload.pass as boolean
        const scoreLabel = scores
          ? `Hook ${scores.hook} · Spec ${scores.specificity} · Cite ${scores.citations} · Voice ${scores.voice} · Platform ${scores.platform} — ${pass ? '✓ PASS' : '✗ re-running'}`
          : output
        setAgentSteps(prev => prev.map(s => s.id === 'evaluator'
          ? { ...s, status: 'complete', output: scoreLabel }
          : s))
      } else {
        setAgentSteps(prev => prev.map(s => s.id === agent
          ? { ...s, status: 'complete', output }
          : s))
      }
    } else if (event === 'loop_start') {
      const loop = payload.loop as number
      // Reset writer-through-evaluator steps for the new loop
      setAgentSteps(prev => prev.map(s =>
        ['writer','verifier','critic','humanizer','evaluator'].includes(s.id)
          ? { ...s, status: 'pending', output: '', label: s.label.replace(/ \(loop \d+\)$/, '') + (loop > 1 ? ` (loop ${loop})` : '') }
          : s
      ))
    } else if (event === 'complete') {
      setFinalOutput(payload.final as string)
      setStep(5)
    } else if (event === 'error') {
      setAgentSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s))
    }
  }

  const fallbackCopyText = (value: string) => {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (!ok) throw new Error('Clipboard copy was blocked by the browser.')
  }

  const toSubstackHtml = (input: string) => {
    const escaped = input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    return escaped
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
      .split(/\n\s*\n/)
      .map(block => {
        const trimmed = block.trim()
        if (!trimmed) return ''
        if (/^<h[1-3]>/.test(trimmed)) return trimmed
        if (/^[-•]\s+/m.test(trimmed)) {
          const items = trimmed
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => line.replace(/^[-•]\s+/, ''))
            .map(line => `<li>${line}</li>`)
            .join('')
          return `<ul>${items}</ul>`
        }
        return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`
      })
      .filter(Boolean)
      .join('\n\n')
  }

  const handleCopy = async (text?: string) => {
    const value = text ?? finalOutput
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        fallbackCopyText(value)
      }
      setCopied(true)
      setExportStatus({ ok: true, text: 'Copied to clipboard.' })
      setTimeout(() => setCopied(false), 2000)
      setTimeout(() => setExportStatus(null), 2500)
    } catch {
      try {
        fallbackCopyText(value)
        setCopied(true)
        setExportStatus({ ok: true, text: 'Copied to clipboard.' })
        setTimeout(() => setCopied(false), 2000)
        setTimeout(() => setExportStatus(null), 2500)
      } catch (error) {
        setExportStatus({ ok: false, text: error instanceof Error ? error.message : 'Copy failed.' })
      }
    }
  }

  const handleExportForPlatform = async () => {
    try {
      if (format === 'substack') {
        const html = toSubstackHtml(finalOutput)
        const plain = finalOutput
        if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
          const item = new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
          })
          await navigator.clipboard.write([item])
        } else {
          await handleCopy(html)
        }
        setExportStatus({ ok: true, text: 'Substack-ready HTML copied to clipboard.' })
      } else {
        await handleCopy(formatForPlatform())
        setExportStatus({ ok: true, text: `Copied optimized ${spec?.name ?? format} version.` })
      }
      setPublishModalOpen(false)
      setTimeout(() => setExportStatus(null), 2500)
    } catch (error) {
      setExportStatus({ ok: false, text: error instanceof Error ? error.message : 'Export failed.' })
    }
  }

  const formatForPlatform = () => {
    switch (format) {
      case 'linkedin': return finalOutput.replace(/\*\*(.*?)\*\*/g, '$1').replace(/#{1,3} /g, '')
      case 'substack': return finalOutput.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
      case 'thread': return finalOutput.split('\n').filter(l => l.trim())
        .map((l, i) => `${i + 1}. ${l.replace(/^\d+[./]\s*/, '')}`).join('\n')
      default: return finalOutput
    }
  }

  const spec = PLATFORM_SPECS[format]

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {showAdminGate && (
        <AdminGateModal
          persistSession={false}
          action="unlock content generation"
          onSuccess={token => {
            setShowAdminGate(false)
            if (pendingGenerate) { setPendingGenerate(false); doGenerate(token) }
          }}
          onCancel={() => { setShowAdminGate(false); setPendingGenerate(false) }}
        />
      )}
      {showPaidConfirm && (
        <ActionConfirmModal
          title="Confirm API usage"
          description="This will call your configured provider and use your stored account API key. No admin credentials are needed."
          confirmLabel="Proceed"
          action="generate content"
          onConfirm={() => {
            setShowPaidConfirm(false)
            if (pendingPaidGenerate) {
              setPendingPaidGenerate(false)
              doGenerate()
            }
          }}
          onCancel={() => {
            setShowPaidConfirm(false)
            setPendingPaidGenerate(false)
          }}
        />
      )}

      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Create Content</h1>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${plan === 'pro'
            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300'
            : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'}`}>
            {plan === 'pro' ? 'Pro access' : 'Free preview'}
          </span>
          {voiceActive ? <a href="/voice" className="rounded-full border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 px-2.5 py-1 text-[11px] font-bold text-green-700 dark:text-green-300">🎙️ Your voice active</a> : <a href="/voice" className="rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">Set up your voice →</a>}
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">8-agent pipeline: write → verify claims → critique → humanize → evaluate → simulate audience → polish</p>
        <p className="text-xs text-zinc-400 mt-1">Premium actions require an active subscription plus a configured model API key.</p>
        <div className="mt-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
          <strong className="text-zinc-700 dark:text-zinc-300">Generation provenance:</strong> {canUsePaidFeatures ? `this workflow runs on ${modelProvider || 'your configured provider'}${modelName ? ` · ${modelName}` : ''}` : 'premium generation requires both subscription entitlement and a configured model API key'}. The draft is built only from the source context you select in this flow, then checked and revised by the agent stack. {voiceActive ? 'Your voice fingerprint will be applied.' : 'No voice fingerprint is currently active.'}
        </div>
      </div>

      <Stepper current={step} />

      {/* ── Step 1: Source ───────────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-5">What&apos;s the source of inspiration?</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {[
              { mode: 'outline' as SourceMode, icon: '📋', label: 'From Outline', desc: 'Use a saved frozen outline from Idea Wizard' },
              { mode: 'feed'    as SourceMode, icon: '📰', label: "From Today's Feed", desc: 'Pick 1–3 articles as source context' },
              { mode: 'notebook' as SourceMode, icon: '📚', label: 'From Notebook', desc: 'Use saved personal knowledge as source context' },
              { mode: 'custom'  as SourceMode, icon: '✏️', label: 'Custom Brief', desc: 'Write your own brief from scratch' },
            ].map(({ mode, icon, label, desc }) => (
              <button key={mode} onClick={() => setSourceMode(mode)}
                className={`flex flex-col items-start gap-2 p-4 rounded-2xl border-2 transition-all text-left ${
                  sourceMode === mode
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-violet-300 dark:hover:border-violet-700'
                }`}>
                <span className="text-3xl">{icon}</span>
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{label}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</span>
              </button>
            ))}
          </div>

          {/* From Outline — dropdown of frozen outlines */}
          {sourceMode === 'outline' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 mb-6">
              {frozenOutlines.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-zinc-500 mb-2">No frozen outlines yet.</p>
                  <a href="/ideas" className="text-sm text-violet-600 hover:underline font-medium">
                    → Go to Ideas to create one
                  </a>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Select a frozen outline
                  </label>
                  <select
                    value={outlineId ?? ''}
                    onChange={e => handleOutlineSelect(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3"
                  >
                    <option value="">— Choose an outline —</option>
                    {frozenOutlines.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.topic} · {o.format} · {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </option>
                    ))}
                  </select>
                  {outlineData && (
                    <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 text-sm">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{outlineData.topic}</p>
                      <p className="text-xs text-zinc-500 mb-2">
                        {outlineData.outline?.sections?.length ?? 0} sections · {outlineData.format}
                      </p>
                      <p className="text-xs text-violet-600 dark:text-violet-400 italic mb-2">
                        &ldquo;{outlineData.outline?.hook}&rdquo;
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {outlineData.outline?.sections?.slice(0, 4).map((s, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600">
                            {s.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* From Feed — load actual articles, highlight pinned ones */}
          {sourceMode === 'feed' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 mb-6">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Select 1–3 articles from today&apos;s feed as source context
                <span className="text-xs text-zinc-400 ml-2">(📌 pinned articles are pre-selected)</span>
              </p>
              {feedArticles.length === 0 ? (
                <p className="text-xs text-zinc-400">Loading articles… run the pipeline first if empty.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {feedArticles.slice(0, 20).map(a => (
                    <label key={a.id} className={`flex items-start gap-3 cursor-pointer p-2.5 rounded-xl transition-all ${
                      selectedArticleIds.has(a.id) ? 'bg-violet-50 dark:bg-violet-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}>
                      <input
                        type="checkbox"
                        checked={selectedArticleIds.has(a.id)}
                        onChange={() => {
                          setSelectedArticleIds(prev => {
                            const next = new Set(prev)
                            if (next.has(a.id)) next.delete(a.id)
                            else if (next.size < 3) next.add(a.id)
                            return next
                          })
                        }}
                        className="mt-0.5 accent-violet-600 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-zinc-800 dark:text-zinc-200 line-clamp-1">{a.title}</span>
                        <span className="text-xs text-zinc-400">Score {(a.blend_score * 100).toFixed(0)}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {sourceMode === 'notebook' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 mb-6">
              {notebooks.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-zinc-500 mb-2">No notebooks yet.</p>
                  <a href="/knowledge" className="text-sm text-violet-600 hover:underline font-medium">
                    → Go to Knowledge Base to create one
                  </a>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Select a notebook
                  </label>
                  <select
                    value={selectedNotebookId}
                    onChange={e => setSelectedNotebookId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3"
                  >
                    <option value="">— Choose a notebook —</option>
                    {notebooks.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
                  </select>
                  {!selectedNotebookId ? (
                    <p className="text-xs text-zinc-400">Choose a notebook to load its processed items.</p>
                  ) : notebookItems.length === 0 ? (
                    <p className="text-xs text-zinc-400">No processed notebook items yet. Add links or notes in Knowledge Base first.</p>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Select 1–3 notebook items as source context</p>
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {notebookItems.slice(0, 20).map(item => (
                          <label key={item.id} className={`flex items-start gap-3 cursor-pointer p-2.5 rounded-xl transition-all ${
                            selectedNotebookItemIds.has(item.id) ? 'bg-violet-50 dark:bg-violet-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}>
                            <input
                              type="checkbox"
                              checked={selectedNotebookItemIds.has(item.id)}
                              onChange={() => {
                                setSelectedNotebookItemIds(prev => {
                                  const next = new Set(prev)
                                  if (next.has(item.id)) next.delete(item.id)
                                  else if (next.size < 3) next.add(item.id)
                                  return next
                                })
                              }}
                              className="mt-0.5 accent-violet-600 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-zinc-800 dark:text-zinc-200 line-clamp-1">{item.title}</span>
                              <span className="text-xs text-zinc-400 line-clamp-2">{item.summary || item.why_it_matters || item.source_url || 'Private note'}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Custom brief */}
          {sourceMode === 'custom' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 mb-6">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Your brief</label>
              <textarea
                value={customBriefInput}
                onChange={e => setCustomBriefInput(e.target.value)}
                placeholder="Describe the angle, key insight, target audience…"
                rows={5}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          )}

          <button onClick={() => setStep(2)}
            disabled={(sourceMode === 'outline' && !outlineId) || (sourceMode === 'notebook' && (!selectedNotebookId || selectedNotebookItemIds.size === 0))}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-colors">
            Next →
          </button>
        </div>
      )}

      {/* ── Step 2: Brief ────────────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-5">Define your brief</h2>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Topic</label>
              <input value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Why tool use in production LLMs is harder than benchmarks suggest"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Key angle</label>
              <input value={keyAngle} onChange={e => setKeyAngle(e.target.value)}
                placeholder="e.g. Practical how-to · Contrarian take · Research breakdown"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Your POV <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <textarea value={pov} onChange={e => setPov(e.target.value)}
                placeholder="Your personal take, specific experience, or strong opinion to inject."
                rows={3}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Target audience</label>
              <select value={targetAudience} onChange={e => setTargetAudience(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Select audience…</option>
                {AUDIENCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors">← Back</button>
            <button onClick={() => setStep(3)} disabled={!topic.trim()}
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-colors">
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Platform ─────────────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Choose your platform</h2>
          <p className="text-sm text-zinc-500 mb-5">Each platform has different word limits, structure, and writing style.</p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => setFormat(f.id)}
                className={`flex flex-col items-start gap-2 p-4 rounded-2xl border-2 transition-all text-left ${
                  format === f.id
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-violet-300'
                }`}>
                <span className="text-2xl">{f.icon}</span>
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{f.label}</span>
                <span className="text-xs text-zinc-400">{f.guidance}</span>
              </button>
            ))}
          </div>

          {/* Platform spec preview */}
          {spec && (
            <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl p-4 mb-6 text-sm">
              <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-2">What the AI will follow for {spec.name}:</p>
              <ul className="space-y-1 text-xs text-zinc-500">
                {spec.mustDos.map((d, i) => <li key={i} className="flex gap-2"><span className="text-green-500 flex-shrink-0">✓</span>{d}</li>)}
                {spec.avoid.slice(0, 3).map((d, i) => <li key={i} className="flex gap-2"><span className="text-red-400 flex-shrink-0">✗</span>No {d}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors">← Back</button>
            <button onClick={handleGenerateClick}
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium text-sm transition-colors">
              {canUsePaidFeatures ? 'Generate Content →' : '🔒 Subscription + API key required →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Generate ─────────────────────────────────────────────── */}
      {step === 4 && (
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Generating…</h2>
          <p className="text-sm text-zinc-500 mb-5">8-agent pipeline: plan → draft → verify → critique → humanize → evaluate → audience test → polish</p>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-6">
            <div className="space-y-5">
              {agentSteps.map(s => (
                <div key={s.id}>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {s.status === 'running' && <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />}
                      {s.status === 'complete' && <span className="text-green-500 text-sm">✓</span>}
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

          {!isGenerating && agentSteps.some(s => s.status === 'error') && (
            <div className="mt-4 flex gap-3">
              <button onClick={handleGenerateClick} className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium">Retry</button>
              <button onClick={() => setStep(3)} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-xl hover:bg-zinc-50">← Back</button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 5: Review & Export ───────────────────────────────────────── */}
      {step === 5 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Review & Export</h2>
              <p className="text-sm text-zinc-500">Edit freely. Written for <span className="font-medium text-violet-600">{spec?.name ?? format}</span>.</p>
            </div>
            {spec?.charLimit && (
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                finalOutput.length > spec.charLimit
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-green-50 text-green-600 border-green-200'
              }`}>
                {finalOutput.length} / {spec.charLimit} chars
              </span>
            )}
          </div>

          <textarea
            ref={finalRef}
            value={finalOutput}
            onChange={e => setFinalOutput(e.target.value)}
            rows={22}
            className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 px-4 py-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono mb-4"
          />

          <div className="flex flex-wrap gap-3">
            <button onClick={() => {
              setStep(4)
              if (canUsePaidFeatures) {
                setPendingPaidGenerate(true)
                setShowPaidConfirm(true)
              } else {
                setPendingGenerate(true)
                setShowAdminGate(true)
              }
            }} disabled={isGenerating}
              className="px-4 py-2.5 text-sm font-medium border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors disabled:opacity-50">
              ⟳ Regenerate
            </button>
            <button onClick={() => handleCopy()}
              className="px-4 py-2.5 text-sm font-medium border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors">
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
            <button onClick={() => setPublishModalOpen(true)}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium text-sm transition-colors">
              ✅ Export for Publishing
            </button>
          </div>

          {exportStatus && (
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              exportStatus.ok
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
            }`}>
              {exportStatus.ok ? '✓ ' : '✗ '}{exportStatus.text}
            </div>
          )}

          {publishModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-6 max-w-md w-full mx-4">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-1">
                  Export for {spec?.name ?? format}
                </h3>
                <p className="text-sm text-zinc-500 mb-4">Copy the content in the format optimized for this platform.</p>
                <div className="space-y-3 mb-5">
                  {['linkedin', 'substack', 'thread'].includes(format) && (
                    <button
                      onClick={handleExportForPlatform}
                      className="w-full px-4 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium text-left transition-colors">
                      {format === 'linkedin' ? '💼' : format === 'substack' ? '📧' : '🧵'} Copy optimized for {spec?.name}
                      <span className="block text-xs text-violet-200 mt-0.5">
                        {format === 'linkedin' ? 'Strips markdown, clean line breaks' :
                         format === 'substack' ? 'HTML-ready for Substack editor' :
                         'Numbered tweets ready to post'}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={async () => { await handleCopy(); setPublishModalOpen(false) }}
                    className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 rounded-xl text-sm font-medium text-left transition-colors">
                    📋 Copy raw text
                  </button>
                </div>
                <button onClick={() => setPublishModalOpen(false)}
                  className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-6 py-8 text-zinc-400">Loading…</div>}>
      <CreatePageInner />
    </Suspense>
  )
}
