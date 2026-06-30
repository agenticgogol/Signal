'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const CORE_ITEMS = [
  { href: '/feed',      label: 'Feed',     icon: '📰' },
  { href: '/ideas',     label: 'Ideas',    icon: '💡' },
  { href: '/create',    label: 'Create',   icon: '✍️' },
  { href: '/knowledge', label: 'Knowledge', icon: '📚' },
  { href: '/sources',   label: 'Sources',  icon: '🔗' },
]

const MORE_ITEMS = [
  { href: '/memory',                label: 'Memory Assistant', icon: '🧠' },
  { href: '/voice',                 label: 'My Voice',         icon: '🎙️' },
  { href: '/settings',              label: 'Settings',         icon: '⚙️' },
  { href: '/user-guide',            label: 'User Guide',       icon: '🧭' },
  { href: '/implementation-guide',  label: 'Implementation',   icon: '🛠️' },
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
    </ul>
  )
}
