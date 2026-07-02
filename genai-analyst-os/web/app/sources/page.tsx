'use client'

import Link from 'next/link'
import SourcesManager from '@/components/SourcesManager'

// Kept as a direct link for anyone with this URL bookmarked — the same
// management UI now also lives as the "Source Feeds" tab in Profile
// Settings, which is where it's discoverable from day one.
export default function SourcesPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">🔗 Source Feeds</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          The URLs and RSS feeds Signal watches to build your Feed. Also available under{' '}
          <Link href="/settings" className="text-violet-600 dark:text-violet-400 hover:underline">Profile Settings → Source Feeds</Link>.
        </p>
      </div>
      <SourcesManager />
    </div>
  )
}
