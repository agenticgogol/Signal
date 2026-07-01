import { requirePaidFeature } from '@/lib/featureAccess'
import { generateSmartDraftsForUser } from '@/lib/draftsInbox'
import { getErrorMessage } from '@/lib/errors'

export const maxDuration = 300

// Manual "Generate today's content" button on the Today page — figures out
// the best engaged topic and writes it up for your configured platform,
// plus one cheap Republish-Pack-adapted variant for a naturally paired
// platform. Same evidence-grounded pipeline as Create; this is the one
// LLM-costing action on this page, so it's paid-gated like every other.
const VALID_FORMATS = ['linkedin', 'substack', 'thread', 'blog', 'youtube_long', 'youtube_short']

export async function POST(req: Request) {
  const { userId, customTopic, formats, ideaCount } = await req.json()
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const paidGate = await requirePaidFeature(req, userId, 'Generate today\'s content')
  if (paidGate) return paidGate

  const chosenFormats = Array.isArray(formats) ? formats.filter((f: unknown) => VALID_FORMATS.includes(f as string)) : undefined
  const chosenIdeaCount = [1, 2, 3].includes(ideaCount) ? ideaCount : 1

  try {
    const result = await generateSmartDraftsForUser(userId, typeof customTopic === 'string' ? customTopic : undefined, chosenFormats, chosenIdeaCount)
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
