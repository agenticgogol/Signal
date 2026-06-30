'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

function AuthConfirmInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('Confirming your email…')

  useEffect(() => {
    const supabase = getSupabase()
    const code = searchParams.get('code')
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const next = searchParams.get('next') || '/feed'
    const errorDescription = searchParams.get('error_description')

    async function run() {
      if (errorDescription) {
        setMessage(decodeURIComponent(errorDescription))
        return
      }

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          router.replace(next)
          return
        }

        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'email_change',
          })
          if (error) throw error
          router.replace(next)
          return
        }

        setMessage('Confirmation link is missing required parameters. Please request a new email and try again.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Email confirmation failed. Please request a new link and try again.')
      }
    }

    run()
  }, [router, searchParams])

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-16">
      <div className="w-full rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Account confirmation</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">Finishing sign-in</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{message}</p>
      </div>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-16">
        <div className="w-full rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Account confirmation</p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">Finishing sign-in</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Confirming your email…</p>
        </div>
      </div>
    }>
      <AuthConfirmInner />
    </Suspense>
  )
}
