import { requirePaidFeature } from '@/lib/featureAccess'
import { explainConcept } from '@/lib/conceptTutor'
import { getErrorMessage } from '@/lib/errors'

// AI Tutor — same LLM-cost-bearing gate as Ask Signal/Generate. The general
// explanation is cached globally (see lib/conceptTutor.ts), so repeat
// lookups of a popular term across different users are effectively free
// after the first one — only the per-user grounding search runs every time.
export async function POST(req: Request) {
  const { userId, term, articleId, knowledgeItemId } = await req.json()
  if (!userId || typeof term !== 'string' || !term.trim()) {
    return Response.json({ error: 'userId and term are required' }, { status: 400 })
  }

  const paidGate = await requirePaidFeature(req, userId, 'AI Tutor')
  if (paidGate) return paidGate

  try {
    const result = await explainConcept(userId, term, {
      articleId: typeof articleId === 'string' ? articleId : undefined,
      knowledgeItemId: typeof knowledgeItemId === 'string' ? knowledgeItemId : undefined,
    })
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
