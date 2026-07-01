import { NextRequest } from 'next/server'
import { requirePaidFeature } from '@/lib/featureAccess'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { ingestKnowledgeItem, getOrCreateDefaultNotebook } from '@/lib/knowledge'
import { extractUploadText } from '@/lib/knowledgeFiles'
import { logKnowledgeEvent } from '@/lib/memory'

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  if (!form) return Response.json({ error: 'Invalid upload payload' }, { status: 400 })

  const userId = String(form.get('userId') || '').trim()
  let notebookId = String(form.get('notebookId') || '').trim()
  const file = form.get('file')

  if (!userId || !(file instanceof File)) {
    return Response.json({ error: 'userId and file are required' }, { status: 400 })
  }

  const paidGate = await requirePaidFeature(req, userId, 'Knowledge ingestion')
  if (paidGate) return paidGate

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  if (!notebookId) {
    try {
      notebookId = await getOrCreateDefaultNotebook(access.userId)
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
    }
  }

  try {
    const extracted = await extractUploadText(file)
    if (!extracted.text.trim()) {
      return Response.json({ error: 'Could not extract readable text from this file.' }, { status: 400 })
    }

    const item = await ingestKnowledgeItem({
      userId: access.userId,
      notebookId,
      sourceType: 'note',
      title: extracted.title,
      noteText: extracted.text,
    })

    await logKnowledgeEvent({
      userId: access.userId,
      notebookId,
      knowledgeItemId: item.id,
      eventType: 'upload_file',
      metadata: { mode: access.mode, filename: file.name, mimeType: file.type || null },
    })

    return Response.json({ item })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
