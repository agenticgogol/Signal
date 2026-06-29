'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/feed', label: 'Feed' },
  { href: '/ideas', label: 'Ideas' },
  { href: '/create', label: 'Create' },
]

export default function NavLinks() {
  const pathname = usePathname()
  return (
    <div className="flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-gray-400">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || (href !== '/feed' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? 'text-violet-600 dark:text-violet-400 font-semibold transition-colors'
                : 'hover:text-gray-900 dark:hover:text-gray-100 transition-colors'
            }
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
