'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/feed',    label: 'Feed',    icon: '📰' },
  { href: '/ideas',   label: 'Ideas',   icon: '💡' },
  { href: '/create',  label: 'Create',  icon: '✍️'  },
  { href: '/sources', label: 'Sources', icon: '🔗' },
]

export default function SidebarNav() {
  const pathname = usePathname()
  return (
    <ul className="space-y-0.5">
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <li key={href}>
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
          </li>
        )
      })}
    </ul>
  )
}
