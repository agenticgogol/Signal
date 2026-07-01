import { NextRequest } from 'next/server'
import { requirePaidFeature } from '@/lib/featureAccess'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { answerKnowledgeBaseQuestion } from '@/lib/knowledge'
import { logChatEvent } from '@/lib/memory'

// Knowledge-only Q&A for the unified Knowledge workspace search bar —
// deliberately separate from /api/knowledge/recall, which also blends in
// feed articles. This route only ever answers from ingested, processed
// knowledge base content.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  const notebookId = typeof body.notebookId === 'string' && body.notebookId ? body.notebookId : null

  if (!userId || !question) {
    return Response.json({ error: 'userId and question are required' }, { status: 400 })
  }

  const paidGate = await requirePaidFeature(req, userId, 'Knowledge base Q&A')
  if (paidGate) return paidGate

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  try {
    const result = await answerKnowledgeBaseQuestion({ userId: access.userId, question, notebookId })
    await logChatEvent({
      userId: access.userId,
      scope: 'notebook',
      notebookId,
      question,
      answerSummary: result.answer.slice(0, 600),
      citations: result.citations,
      metadata: { mode: access.mode, matchCount: result.matchCount },
    })
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
