import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const itemId = typeof body.itemId === 'string' ? body.itemId : ''
  const action = body.action === 'approve' ? 'approved' : body.action === 'dismiss' ? 'dismissed' : null
  if (!userId || !itemId || !action) {
    return Response.json({ error: 'userId, itemId, and a valid action are required' }, { status: 400 })
  }

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  const { error } = await createServiceClient()
    .from('draft_inbox_items')
    .update({ status: action, reviewed_at: new Date().toISOString() })
    .eq('user_id', access.userId)
    .eq('id', itemId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, status: action })
}
