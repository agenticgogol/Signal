import { after } from 'next/server'
import { requirePaidFeature } from '@/lib/featureAccess'
import { generateSmartDraftsForUser } from '@/lib/draftsInbox'
import { createServiceClient } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/errors'

export const maxDuration = 300

// Manual "Generate today's content" button on the Today page — figures out
// the best engaged topic(s) and writes them up. This can be a multi-minute
// job (several ideas x several platforms), and it used to run synchronously
// inside the request — navigating away while it ran risked the browser
// abandoning the connection and cutting the generation short. Now the route
// returns immediately with a job id; the actual work runs via Next.js
// after() so it continues server-side regardless of what the client does,
// and the Today page polls /api/today/generate/status for the result.
const VALID_FORMATS = ['linkedin', 'substack', 'thread', 'blog', 'youtube_long', 'youtube_short']

export async function POST(req: Request) {
  const { userId, customTopic, formats, ideaCount } = await req.json()
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const paidGate = await requirePaidFeature(req, userId, 'Generate today\'s content')
  if (paidGate) return paidGate

  const chosenFormats = Array.isArray(formats) ? formats.filter((f: unknown) => VALID_FORMATS.includes(f as string)) : undefined
  const chosenIdeaCount = [1, 2, 3].includes(ideaCount) ? ideaCount : 1
  const chosenTopic = typeof customTopic === 'string' ? customTopic : undefined

  const db = createServiceClient()
  const { data: job, error: jobError } = await db
    .from('content_generation_jobs')
    .insert({ user_id: userId, status: 'pending' })
    .select('id')
    .single()
  if (jobError) return Response.json({ error: getErrorMessage(jobError) }, { status: 500 })

  after(async () => {
    try {
      const result = await generateSmartDraftsForUser(userId, chosenTopic, chosenFormats, chosenIdeaCount)
      await db.from('content_generation_jobs').update({
        status: 'completed',
        result,
        completed_at: new Date().toISOString(),
      }).eq('id', job.id)
    } catch (error) {
      await db.from('content_generation_jobs').update({
        status: 'failed',
        error: getErrorMessage(error),
        completed_at: new Date().toISOString(),
      }).eq('id', job.id)
    }
  })

  return Response.json({ jobId: job.id, status: 'pending' })
}
