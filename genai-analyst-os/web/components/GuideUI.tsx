import Image from 'next/image'
import type { ReactNode } from 'react'

export function GuideHero({ eyebrow, title, description, chips }: {
  eyebrow: string; title: string; description: string; chips: string[]
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-violet-200/70 dark:border-violet-800/60 bg-gradient-to-br from-violet-50 via-white to-blue-50 dark:from-violet-950/40 dark:via-zinc-900 dark:to-blue-950/30 p-8 md:p-10">
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-300/20 blur-3xl" />
      <div className="relative max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">{eyebrow}</p>
        <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-zinc-950 dark:text-white">{title}</h1>
        <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-300">{description}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map(chip => <span key={chip} className="rounded-full border border-violet-200 dark:border-violet-800 bg-white/80 dark:bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">{chip}</span>)}
        </div>
      </div>
    </div>
  )
}

export interface QuickNavGroup {
  label: string
  items: { id: string; label: string; icon: string }[]
}

// A jump-to-section grid, grouped the same way the sections themselves are
// grouped, so a reader can find "Publishing" or "Ask Signal" in one glance
// instead of scrolling through fifteen sections to find the right one.
export function QuickNav({ groups }: { groups: QuickNavGroup[] }) {
  return (
    <nav className="sticky top-4 z-30 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">Quick navigation</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map(group => (
          <div key={group.label}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">{group.label}</p>
            <ul className="space-y-1">
              {group.items.map(item => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
                    <span className="text-base leading-none">{item.icon}</span>{item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

export function GuideSection({ id, eyebrow, title, description, children }: {
  id: string; eyebrow?: string; title: string; description?: string; children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 pt-12">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">{eyebrow}</p>}
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">{title}</h2>
      {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

export function FeatureCard({ icon, title, value, children }: {
  icon: string; title: string; value?: string; children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/50 text-xl">{icon}</span>
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
          {value && <p className="mt-0.5 text-xs font-semibold text-violet-600 dark:text-violet-400">{value}</p>}
        </div>
      </div>
      <div className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{children}</div>
    </div>
  )
}

export function StepCard({ number, title, action, result }: {
  number: number; title: string; action: string; result: string
}) {
  return (
    <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <span className="absolute -top-3 left-5 flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white shadow">{number}</span>
      <h3 className="mt-2 font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300"><strong>Click:</strong> {action}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-400"><strong className="text-zinc-500 dark:text-zinc-400">Result:</strong> {result}</p>
    </div>
  )
}

export function ScreenshotFrame({ src, alt, caption, number }: {
  src: string; alt: string; caption: string; number?: number
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 shadow-xl">
      <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-900 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-3 text-[10px] font-medium text-zinc-500">Signal product view</span>
      </div>
      <div className="relative aspect-[16/9] bg-zinc-900">
        <Image src={src} alt={alt} fill className="object-cover object-top" sizes="(max-width: 1200px) 100vw, 900px" />
        {number && <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-black text-white shadow-lg ring-4 ring-white/20">{number}</span>}
      </div>
      <figcaption className="bg-white dark:bg-zinc-900 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">{caption}</figcaption>
    </figure>
  )
}

export function FlowNode({ icon, title, subtitle, tone = 'violet' }: {
  icon: string; title: string; subtitle: string; tone?: 'violet' | 'blue' | 'green' | 'amber'
}) {
  const tones = {
    violet: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    green: 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  }
  return (
    <div className={`min-w-36 flex-1 rounded-2xl border p-4 text-center ${tones[tone]}`}>
      <div className="text-2xl">{icon}</div><p className="mt-2 text-sm font-bold">{title}</p><p className="mt-1 text-[11px] opacity-75">{subtitle}</p>
    </div>
  )
}

export function Arrow() {
  return <div className="hidden md:flex items-center text-xl font-black text-zinc-300 dark:text-zinc-700">→</div>
}

// ── PipelineDiagram ───────────────────────────────────────────────────────────
// A vertical, layered architecture diagram in the style of a real systems
// design doc: an entry point, a stack of colored "zone" boxes each holding
// one or more step boxes connected by arrows, an optional exit point, and
// an optional persistent side rail for a cross-cutting concern (memory,
// observability, auth) that touches every zone rather than sitting in the
// linear flow.

const ZONE_TONES = {
  blue:   { wrap: 'border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20', label: 'text-blue-700 dark:text-blue-300' },
  green:  { wrap: 'border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/20', label: 'text-green-700 dark:text-green-300' },
  amber:  { wrap: 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20', label: 'text-amber-700 dark:text-amber-300' },
  violet: { wrap: 'border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/20', label: 'text-violet-700 dark:text-violet-300' },
  zinc:   { wrap: 'border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40', label: 'text-zinc-600 dark:text-zinc-400' },
} as const

const STEP_TONES = {
  blue:   'border-blue-300 bg-white dark:bg-zinc-900 dark:border-blue-800',
  green:  'border-green-300 bg-white dark:bg-zinc-900 dark:border-green-800',
  amber:  'border-amber-300 bg-white dark:bg-zinc-900 dark:border-amber-800',
  violet: 'border-violet-300 bg-white dark:bg-zinc-900 dark:border-violet-800',
  zinc:   'border-zinc-300 bg-white dark:bg-zinc-900 dark:border-zinc-700',
} as const

export interface PipelineStep {
  title: string
  detail: string[]
  tone?: keyof typeof STEP_TONES
}

export interface PipelineZone {
  label: string
  tone: keyof typeof ZONE_TONES
  steps: PipelineStep[]
  dashed?: boolean
  note?: string
}

function DownArrow() {
  return <div className="flex justify-center py-1 text-lg font-black text-zinc-300 dark:text-zinc-700">↓</div>
}

function PipelineStepBox({ step }: { step: PipelineStep }) {
  const tone = step.tone ?? 'zinc'
  return (
    <div className={`rounded-xl border-2 p-3.5 ${STEP_TONES[tone]}`}>
      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{step.title}</p>
      {step.detail.map((line, i) => (
        <p key={i} className="mt-0.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{line}</p>
      ))}
    </div>
  )
}

export function PipelineDiagram({
  entry, zones, exit, sideRail,
}: {
  entry?: { icon: string; label: string }
  zones: PipelineZone[]
  exit?: { icon: string; label: string }
  sideRail?: { label: string; sublabel?: string }
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <div className="flex gap-5 items-stretch">
        {sideRail && (
          <div className="hidden md:flex flex-col items-center justify-between shrink-0 w-36 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/20 px-3 py-5 text-center">
            <span className="text-xl">🧭</span>
            <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{sideRail.label}</p>
            {sideRail.sublabel && <p className="text-[11px] text-blue-500 dark:text-blue-400">{sideRail.sublabel}</p>}
            <div className="flex flex-col gap-6 text-blue-300 dark:text-blue-700 text-lg font-black">
              <span>↔</span><span>↔</span><span>↔</span>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {entry && (
            <>
              <div className="mx-auto w-fit rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-700 dark:text-zinc-200">
                {entry.icon} {entry.label}
              </div>
              <DownArrow />
            </>
          )}

          {zones.map((zone, zi) => {
            const tone = ZONE_TONES[zone.tone]
            return (
              <div key={zone.label}>
                <div className={`rounded-2xl border p-4 ${tone.wrap} ${zone.dashed ? 'border-dashed' : ''}`}>
                  <p className={`text-xs font-black uppercase tracking-wider ${tone.label}`}>{zone.label}</p>
                  <div className="mt-3 space-y-2">
                    {zone.steps.map((step, si) => (
                      <div key={step.title}>
                        <PipelineStepBox step={step} />
                        {si < zone.steps.length - 1 && <DownArrow />}
                      </div>
                    ))}
                  </div>
                  {zone.note && <p className="mt-3 text-[11px] text-zinc-400">{zone.note}</p>}
                </div>
                {zi < zones.length - 1 && <DownArrow />}
              </div>
            )
          })}

          {exit && (
            <>
              <DownArrow />
              <div className="mx-auto w-fit rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-700 dark:text-zinc-200">
                {exit.icon} {exit.label}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function Callout({ title, children, tone = 'violet' }: {
  title: string; children: ReactNode; tone?: 'violet' | 'green' | 'amber'
}) {
  const tones = {
    violet: 'border-violet-200 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/30',
    green: 'border-green-200 bg-green-50/70 dark:border-green-800 dark:bg-green-950/30',
    amber: 'border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30',
  }
  return <div className={`rounded-2xl border p-5 ${tones[tone]}`}><p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{title}</p><div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{children}</div></div>
}
