'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import SidebarNav from './SidebarNav'
import ThemeToggle from './ThemeToggle'
import { getSupabase } from '@/lib/supabase'
import { useAuthSession } from '@/lib/useAuthSession'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLanding = pathname === '/'
  const { session, user } = useAuthSession()
  const [plan, setPlan] = useState<'free' | 'pro'>('free')

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
      })
      .catch(() => setPlan('free'))
  }, [user?.id])

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
      <aside className="fixed inset-y-0 left-0 z-40 w-56 bg-white dark:bg-zinc-900 border-r border-zinc-200/80 dark:border-zinc-800/80 flex flex-col">
        <div className="px-5 pt-6 pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80 flex-shrink-0">
          <Link href="/" className="block hover:opacity-80 transition-opacity">
            <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent font-black text-2xl tracking-tight">⚡ Signal</span>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 leading-tight">Your GenAI intelligence OS</p>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <SidebarNav />
        </nav>
        <div className="px-3 py-3 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-3">
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950 p-3">
            {!session ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Guest mode</p>
                <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">Sign in to save your sources, model settings, voice profile, and digest preferences.</p>
                <button
                  onClick={openAuthPopup}
                  className="w-full rounded-lg bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Sign in / Sign up
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-semibold text-zinc-700 dark:text-zinc-200">{user?.email ?? 'Signed in user'}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${plan === 'pro' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                    {plan === 'pro' ? 'PRO' : 'FREE'}
                  </span>
                </div>
                {plan === 'free' ? (
                  <>
                    <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">Billing is temporarily disabled. Costly workflows remain protected by the admin wall for this iteration.</p>
                  </>
                ) : (
                  <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">Paid workflows use confirmation only. Admin credentials are no longer required on this account.</p>
                )}
                <Link
                  href="/settings"
                  className="block w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Model settings
                </Link>
                <button
                  onClick={signOut}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
          <ThemeToggle />
          <p className="text-xs text-zinc-300 dark:text-zinc-600 px-2">GenAI Intelligence OS</p>
        </div>
      </aside>
      <main className="ml-56 flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
