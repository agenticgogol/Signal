import { NextRequest } from 'next/server'
import { requirePaidFeature } from '@/lib/featureAccess'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { answerNotebookQuestion } from '@/lib/knowledge'
import { logChatEvent, logKnowledgeEvent } from '@/lib/memory'
import { getErrorMessage } from '@/lib/errors'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const notebookId = typeof body.notebookId === 'string' ? body.notebookId : ''
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  const includeFeed = Boolean(body.includeFeed)

  if (!userId || !notebookId || !question) {
    return Response.json({ error: 'userId, notebookId, and question are required' }, { status: 400 })
  }

  const paidGate = await requirePaidFeature(req, userId, 'Knowledge chat')
  if (paidGate) return paidGate

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  try {
    const result = await answerNotebookQuestion({ userId: access.userId, notebookId, question, includeFeed })
    await logKnowledgeEvent({
      userId: access.userId,
      notebookId,
      eventType: 'ask_chat',
      metadata: { includeFeed, mode: access.mode },
    })
    await logChatEvent({
      userId: access.userId,
      scope: 'notebook',
      notebookId,
      question,
      answerSummary: result.answer.slice(0, 600),
      citations: result.citations,
      metadata: { includeFeed, retrievalMode: result.retrievalMode, mode: access.mode },
    })
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
