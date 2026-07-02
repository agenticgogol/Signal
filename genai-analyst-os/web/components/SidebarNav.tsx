'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// "Today" (the landing page — daily reading + drafts review) is reached via
// the sidebar logo/header, not a list item, so this list stays just the
// "go deeper" surfaces per the redesign: focus on Today first, explore only
// if there's time left.
const CORE_ITEMS = [
  { href: '/today',       label: 'Today',        icon: '👋' },
  { href: '/feed',        label: 'Feed',         icon: '📰' },
  { href: '/feed?tab=news', label: 'News',       icon: '🌐' },
  { href: '/knowledge',   label: 'Your Library', icon: '📚' },
  { href: '/ideas',       label: 'Ideas',        icon: '💡' },
  { href: '/create',      label: 'Create',       icon: '✍️' },
]

const MORE_ITEMS = [
  { href: '/sources',               label: 'Source Feeds',     icon: '📡' },
  { href: '/memory',                label: 'Memory Assistant', icon: '🧠' },
  { href: '/voice',                 label: 'My Voice',         icon: '🎙️' },
  { href: '/settings',              label: 'Profile Settings', icon: '⚙️' },
]

const GUIDE_ITEMS = [
  { href: '/user-guide',            label: 'User Guide',        icon: '🧭', desc: 'How every feature works' },
  { href: '/implementation-guide',  label: 'Implementation Guide', icon: '🛠️', desc: 'Architecture & setup' },
]

function NavLink({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
    </Link>
  )
}

export default function SidebarNav() {
  const pathname = usePathname()
  const moreHasActive = MORE_ITEMS.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))
  const [moreOpen, setMoreOpen] = useState(moreHasActive)

  return (
    <ul className="space-y-0.5">
      {CORE_ITEMS.map(({ href, label, icon }) => (
        <li key={href}>
          <NavLink href={href} label={label} icon={icon} active={pathname === href || pathname.startsWith(href + '/')} />
        </li>
      ))}

      <li className="mt-3 border-t border-zinc-200/80 dark:border-zinc-800/80 pt-3">
        <button
          onClick={() => setMoreOpen(o => !o)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all"
        >
          <span className="flex items-center gap-3">
            <span className="text-base leading-none">⋯</span>
            More
          </span>
          <span className={`text-xs transition-transform ${moreOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {moreOpen && (
          <ul className="mt-0.5 space-y-0.5">
            {MORE_ITEMS.map(({ href, label, icon }) => (
              <li key={href}>
                <NavLink href={href} label={label} icon={icon} active={pathname === href || pathname.startsWith(href + '/')} />
              </li>
            ))}
          </ul>
        )}
      </li>

      <li className="mt-3 rounded-xl bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/20 border border-violet-200/70 dark:border-violet-800/50 p-2.5">
        <p className="px-1 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-500 dark:text-violet-400">📖 New here?</p>
        <ul className="space-y-0.5">
          {GUIDE_ITEMS.map(({ href, label, icon, desc }) => (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  pathname === href
                    ? 'bg-white dark:bg-zinc-900 text-violet-700 dark:text-violet-300 shadow-sm'
                    : 'text-violet-700 dark:text-violet-300 hover:bg-white/70 dark:hover:bg-zinc-900/70'}`}
              >
                <span className="text-sm leading-none">{icon}</span>
                <span>
                  <span className="block">{label}</span>
                  <span className="block text-[10px] font-normal text-violet-500/80 dark:text-violet-400/70">{desc}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </li>
    </ul>
  )
}
