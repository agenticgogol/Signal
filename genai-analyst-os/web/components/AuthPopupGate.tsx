'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useAuthSession } from '@/lib/useAuthSession'

const DISMISSED_KEY = 'signal_auth_popup_dismissed'
const EMAIL_KEY = 'signal_auth_email'

type Mode = 'signin' | 'signup'

export default function AuthPopupGate() {
  const { session, user, loading } = useAuthSession()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [canUsePaidFeatures, setCanUsePaidFeatures] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismissed = sessionStorage.getItem(DISMISSED_KEY) === '1'
    const rememberedEmail = localStorage.getItem(EMAIL_KEY) || ''
    if (rememberedEmail) setEmail(rememberedEmail)
    if (!loading && !session && !dismissed) setOpen(true)
    if (session) sessionStorage.removeItem(DISMISSED_KEY)
  }, [loading, session])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('signal-auth-popup:open', handler)
    return () => window.removeEventListener('signal-auth-popup:open', handler)
  }, [])

  useEffect(() => {
    const userId = user?.id
    if (!userId) {
      setPlan('free')
      return
    }
    fetch(`/api/data/profile?userId=${encodeURIComponent(userId)}`)
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Could not load profile')
        setPlan(json.plan === 'pro' ? 'pro' : 'free')
        setCanUsePaidFeatures(Boolean(json.canUsePaidFeatures))
      })
      .catch(() => { setPlan('free'); setCanUsePaidFeatures(false) })
  }, [user?.id])

  const statusText = useMemo(() => {
    if (!session) return 'Read the preview, then sign in to save your setup and use the product.'
    return plan === 'pro'
      ? canUsePaidFeatures
        ? 'Your account is active. Paid actions run on your configured model settings.'
        : 'Your account has subscription entitlement. Add a model API key in Settings to remove the admin wall.'
      : 'You are signed in. Costly actions still require the admin wall until this account is subscribed and configured.'
  }, [canUsePaidFeatures, plan, session])

  if (!open) return null

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setOpen(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const supabase = getSupabase()
      const emailRedirectTo = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/confirm?next=/today`
      const result = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
      if (result.error) throw result.error
      localStorage.setItem(EMAIL_KEY, email)
      if (result.data.session) {
        setOpen(false)
        sessionStorage.removeItem(DISMISSED_KEY)
      } else if (mode === 'signup') {
        setError('Check your email to confirm your account. The link will bring you back into Signal automatically.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
          <div className="p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Sign in or sign up</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">Keep the preview free, unlock the paid workflows when you are ready</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{statusText}</p>
              </div>
              <button onClick={dismiss} className="text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">Close</button>
            </div>

            <div className="mt-5 flex gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
              <button onClick={() => setMode('signin')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${mode === 'signin' ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>Sign in</button>
              <button onClick={() => setMode('signup')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${mode === 'signup' ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>Sign up</button>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-3">
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email username" placeholder="Email address" className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-950" />
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="Password" className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-950" />
              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
              <button disabled={busy || !email || !password} className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
            </form>

            <p className="mt-4 text-xs leading-6 text-zinc-500 dark:text-zinc-400">One account unlocks the product experience. Admin-free premium actions require both subscription entitlement and a configured model API key.</p>
          </div>

          <div className="border-t border-zinc-200 bg-zinc-50 p-7 dark:border-zinc-800 dark:bg-zinc-950 md:border-l md:border-t-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Simple plan</p>
            <h3 className="mt-2 text-xl font-black text-zinc-950 dark:text-white">Low-cost Pro access</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">You pay for the platform and workflow. Token and model costs are your own, because you can connect your own provider, model, and API key in Settings.</p>
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-3xl font-black text-zinc-950 dark:text-white">$9<span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">/mo</span></p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Intro price for individuals</p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <li>• Paid workflows available after subscription</li>
                <li>• Bring your own API provider, model, and key</li>
                <li>• Keeps maintenance and product access separate from model spend</li>
              </ul>
            </div>
            {plan === 'free' && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Billing is temporarily disabled while the payment integration is being replaced. You can still sign in and use admin-gated costly actions.
              </div>
            )}
            {session && plan === 'pro' && (
              <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">{canUsePaidFeatures ? 'Your account is subscribed and ready for admin-free premium actions.' : 'Your account is subscribed. Add your model API key in Settings to unlock admin-free premium actions.'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
