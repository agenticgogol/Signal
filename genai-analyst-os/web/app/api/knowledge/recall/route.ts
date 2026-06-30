import { NextRequest } from 'next/server'
import { requirePaidFeature } from '@/lib/featureAccess'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { answerRecallQuestion } from '@/lib/knowledge'
import { logChatEvent } from '@/lib/memory'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const question = typeof body.question === 'string' ? body.question.trim() : ''

  if (!userId || !question) {
    return Response.json({ error: 'userId and question are required' }, { status: 400 })
  }

  const paidGate = await requirePaidFeature(req, userId, 'Recall chat')
  if (paidGate) return paidGate

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  try {
    const result = await answerRecallQuestion({ userId: access.userId, question })
    await logChatEvent({
      userId: access.userId,
      scope: 'memory',
      question,
      answerSummary: result.answer.slice(0, 600),
      citations: result.citations,
      metadata: { feedMatches: result.feedMatches, knowledgeMatches: result.knowledgeMatches, mode: access.mode },
    })
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
