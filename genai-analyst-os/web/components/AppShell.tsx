'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import SidebarNav, { SidebarGuides } from './SidebarNav'
import ThemeToggle from './ThemeToggle'
import OnboardingWizard, { type OnboardingPrefs } from './OnboardingWizard'
import TutorSlideOver, { type TutorTarget } from './TutorSlideOver'
import { getSupabase } from '@/lib/supabase'
import { useAuthSession } from '@/lib/useAuthSession'

interface SetupStatusPayload {
  checklistComplete: boolean
  hasSources: boolean
  hasPaidEntitlement: boolean
  hasApiKeyConfigured: boolean
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLanding = pathname === '/'
  const { session, user } = useAuthSession()
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [canUsePaidFeatures, setCanUsePaidFeatures] = useState(false)
  const [setupStatus, setSetupStatus] = useState<SetupStatusPayload | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [tutorTarget, setTutorTarget] = useState<TutorTarget | null>(null)

  // Global entry point for "click a term while reading" — any page can open
  // the AI Tutor slide-over by dispatching this event, without needing its
  // own state/wiring. Same pattern as signal-auth-popup:open.
  useEffect(() => {
    const handler = (e: Event) => setTutorTarget((e as CustomEvent<TutorTarget>).detail)
    window.addEventListener('signal-tutor:open', handler)
    return () => window.removeEventListener('signal-tutor:open', handler)
  }, [])

  useEffect(() => {
    if (!user?.id || !session?.access_token) return
    fetch(`/api/data/user-preferences?userId=${encodeURIComponent(user.id)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load preferences')
        setShowOnboarding(!json.onboardingCompleted)
      })
      .catch(() => setShowOnboarding(false))
  }, [user?.id, session?.access_token])

  const saveOnboarding = async (prefs: OnboardingPrefs, markComplete = true) => {
    if (!user?.id || !session?.access_token) return
    try {
      await fetch('/api/data/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: user.id, ...prefs, markComplete }),
      })
    } catch {}
    setShowOnboarding(false)
  }

  useEffect(() => {
    if (!user?.id) {
      setPlan('free')
      return
    }
    fetch(`/api/data/profile?userId=${encodeURIComponent(user.id)}`)
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load profile')
        setPlan(json.plan === 'pro' ? 'pro' : 'free')
        setCanUsePaidFeatures(Boolean(json.canUsePaidFeatures))
      })
      .catch(() => { setPlan('free'); setCanUsePaidFeatures(false) })
  }, [user?.id])

  useEffect(() => {
    if (!session?.access_token || !user?.id) {
      setSetupStatus(null)
      return
    }
    fetch(`/api/data/setup-status?userId=${encodeURIComponent(user.id)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load setup status')
        setSetupStatus(json)
        // Every signed-in account should start with a working feed — seed
        // curated AI/LLM sources automatically rather than waiting for the
        // user to discover the "Import starter sources" button themselves.
        // The seed route is idempotent (no-ops once any source exists).
        if (json.hasSources === false && session?.access_token) {
          fetch('/api/sources/seed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ userId: user.id }),
          }).catch(() => {})
        }
      })
      .catch(() => setSetupStatus(null))
  }, [session?.access_token, user?.id])

  if (isLanding) {
    return <>{children}</>
  }

  const openAuthPopup = () => {
    window.dispatchEvent(new Event('signal-auth-popup:open'))
  }

  const signOut = async () => {
    await getSupabase().auth.signOut()
  }

  return (
    <div className="flex min-h-screen">
      {tutorTarget && (
        <TutorSlideOver key={tutorTarget.term + (tutorTarget.articleId ?? '') + (tutorTarget.knowledgeItemId ?? '')} target={tutorTarget} onClose={() => setTutorTarget(null)} />
      )}
      {showOnboarding && user?.id && session?.access_token && (
        <OnboardingWizard
          userId={user.id}
          accessToken={session.access_token}
          onComplete={prefs => saveOnboarding(prefs, true)}
          onSkip={() => saveOnboarding({ role: null, interestAreas: [], readingGoal: null, readingFrequency: null }, true)}
        />
      )}
      <aside className="fixed inset-y-0 left-0 z-40 w-56 bg-white dark:bg-zinc-900 border-r border-zinc-200/80 dark:border-zinc-800/80 flex flex-col">
        <div className="px-5 pt-6 pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80 flex-shrink-0">
          <Link href="/" className="block hover:opacity-80 transition-opacity">
            <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent font-black text-2xl tracking-tight">⚡ Signal.ai</span>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 leading-tight">Your GenAI intelligence OS</p>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <SidebarNav />
        </nav>
        <div className="px-3 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
          <SidebarGuides />
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950 p-2.5">
            {!session ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Guest mode</p>
                <button
                  onClick={openAuthPopup}
                  className="w-full rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Sign in / Sign up
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-semibold text-zinc-700 dark:text-zinc-200">{user?.email ?? 'Signed in user'}</p>
                  <span
                    title={plan === 'pro' ? (canUsePaidFeatures ? 'Paid workflows use confirmation only.' : 'Subscribed — add a model API key in Settings to unlock paid workflows.') : 'Free plan — costly workflows require the admin wall.'}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold cursor-help ${plan === 'pro' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
                  >
                    {plan === 'pro' ? 'PRO' : 'FREE'}
                  </span>
                </div>
                {setupStatus && !setupStatus.checklistComplete && (
                  <Link
                    href={!setupStatus.hasSources ? '/sources' : !setupStatus.hasPaidEntitlement || !setupStatus.hasApiKeyConfigured ? '/settings' : '/voice'}
                    className="block w-full rounded-lg bg-violet-600 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-violet-700"
                  >
                    Finish setup
                  </Link>
                )}
                <div className="flex gap-1.5">
                  <Link
                    href="/settings"
                    className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Settings
                  </Link>
                  <button
                    onClick={signOut}
                    className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            <ThemeToggle />
            <p className="text-[10px] text-zinc-300 dark:text-zinc-700 shrink-0">© {new Date().getFullYear()}</p>
          </div>
        </div>
      </aside>
      <main className="ml-56 flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
