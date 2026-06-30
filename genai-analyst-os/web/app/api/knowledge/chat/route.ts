import { NextRequest } from 'next/server'
import { requirePaidFeature } from '@/lib/featureAccess'
import { requireSignedInUser } from '@/lib/serverAuth'
import { answerNotebookQuestion } from '@/lib/knowledge'

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

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  try {
    const result = await answerNotebookQuestion({ userId, notebookId, question, includeFeed })
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
