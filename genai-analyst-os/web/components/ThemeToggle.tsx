'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

function getSystemPref(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemPref() : theme
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
  } else {
    root.classList.add('light')
    root.classList.remove('dark')
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = (localStorage.getItem('signal_theme') as Theme) || 'system'
    setTheme(saved)
    applyTheme(saved)

    // Listen for OS pref changes when in system mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if ((localStorage.getItem('signal_theme') || 'system') === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const cycle = () => {
    const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
    localStorage.setItem('signal_theme', next)
    applyTheme(next)
  }

  if (!mounted) return null

  const icon = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '💻'
  const label = theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System'

  return (
    <button
      onClick={cycle}
      title={`Theme: ${label} — click to cycle`}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
    >
      <span className="text-sm">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
