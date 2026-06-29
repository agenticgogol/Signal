'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import SidebarNav from './SidebarNav'
import ThemeToggle from './ThemeToggle'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLanding = pathname === '/'

  if (isLanding) {
    return <>{children}</>
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
        <div className="px-3 py-3 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-1">
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
