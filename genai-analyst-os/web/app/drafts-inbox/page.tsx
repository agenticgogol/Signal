'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Drafts Inbox is now the "Share your voice" section of the Today page —
// this route stays only so old links/bookmarks don't 404.
export default function DraftsInboxRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/today')
  }, [router])
  return null
}
