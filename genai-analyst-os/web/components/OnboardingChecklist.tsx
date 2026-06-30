'use client'

import Link from 'next/link'

export interface SetupStatus {
  sourcesCount: number
  hasSources: boolean
  hasEnoughSources: boolean
  hasVoice: boolean
  hasDigestEmail: boolean
  dailyDigestEnabled: boolean
  hasPaidEntitlement: boolean
  hasApiKeyConfigured: boolean
  canUsePaidFeatures: boolean
  checklistComplete: boolean
}

function Row({
  done, title, detail, href, cta,
}: {
  done: boolean
  title: string
  detail: string
  href: string
  cta: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${done ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
        {done ? '✓' : '•'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${done ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'}`}>
            {done ? 'Done' : 'Needed'}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{detail}</p>
      </div>
      <Link href={href} className="shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
        {cta}
      </Link>
    </div>
  )
}

export default function OnboardingChecklist({
  status,
  compact = false,
}: {
  status: SetupStatus
  compact?: boolean
}) {
  const rows = [
    {
      done: status.hasSources,
      title: `Add sources${status.sourcesCount > 0 ? ` (${status.sourcesCount})` : ''}`,
      detail: status.hasSources
        ? 'Your feed can now be personalized from your own tracked sources.'
        : 'Start with a few sources so Signal has something to crawl and rank for your account.',
      href: '/sources',
      cta: status.hasSources ? 'Manage' : 'Add sources',
    },
    {
      done: status.hasPaidEntitlement,
      title: 'Activate premium access',
      detail: status.hasPaidEntitlement
        ? 'This account has premium entitlement.'
        : 'Premium workflows stay behind the admin wall until this account is subscribed.',
      href: '/settings',
      cta: 'Open settings',
    },
    {
      done: status.hasApiKeyConfigured,
      title: 'Connect model API key',
      detail: status.hasApiKeyConfigured
        ? 'Your provider key is configured for account-level generation.'
        : 'Add provider, model, and API key so premium actions can run without admin credentials.',
      href: '/settings',
      cta: status.hasApiKeyConfigured ? 'Review' : 'Connect model',
    },
    {
      done: status.hasVoice,
      title: 'Optional: teach Signal your voice',
      detail: status.hasVoice
        ? 'Your voice fingerprint is active and will shape generated drafts.'
        : 'Paste 3–5 strong writing samples to make drafts sound closer to you.',
      href: '/voice',
      cta: status.hasVoice ? 'View voice' : 'Set up voice',
    },
  ]

  return (
    <div className="rounded-3xl border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/20 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Setup checklist</p>
          <h2 className="mt-1 text-xl font-black text-zinc-950 dark:text-white">
            {status.checklistComplete ? 'Your account is operational' : 'Finish setup to unlock the full product'}
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {status.checklistComplete
              ? 'Personal sources, paid entitlement, and model execution are all configured.'
              : 'Signal is strongest when your sources, account access, and execution settings are all in place.'}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-bold text-violet-700 dark:text-violet-300">
          {rows.filter(r => r.done).length}/{rows.length} complete
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? '' : 'lg:grid-cols-2'}`}>
        {rows.map(row => <Row key={row.title} {...row} />)}
      </div>
    </div>
  )
}
