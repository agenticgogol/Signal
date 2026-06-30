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

export function GuideSection({ id, eyebrow, title, description, children }: {
  id: string; eyebrow?: string; title: string; description?: string; children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-8 pt-12">
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
