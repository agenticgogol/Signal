'use client'

import { useState } from 'react'

const SESSION_KEY = 'signal_admin_token'

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(SESSION_KEY)
}

export function clearAdminToken() {
  if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY)
}

interface Props {
  onSuccess: (token: string) => void
  onCancel: () => void
  action?: string
  persistSession?: boolean
}

export function AdminGateModal({ onSuccess, onCancel, action = 'this action', persistSession = true }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const json = await res.json()
      if (json.ok) {
        if (persistSession) sessionStorage.setItem(SESSION_KEY, json.token)
        onSuccess(json.token)
      } else {
        setError('Invalid username or password')
      }
    } catch {
      setError('Auth request failed')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-6 w-full max-w-sm mx-4">
        <div className="mb-5">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">Admin confirmation required</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Enter credentials to unlock {action}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            className="w-full text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-zinc-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-zinc-400"
          />
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !username || !password}
              className="flex-1 py-2.5 text-sm font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl transition-colors">
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface ConfirmProps {
  action?: string
  onConfirm: () => void
  onCancel: () => void
  title?: string
  description?: string
  confirmLabel?: string
}

export function ActionConfirmModal({
  action = 'this action',
  onConfirm,
  onCancel,
  title = 'Confirm paid action',
  description,
  confirmLabel = 'Proceed',
}: ConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-6 w-full max-w-sm mx-4">
        <div className="mb-5">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{title}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {description ?? `This will call external APIs to ${action}.`}
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
