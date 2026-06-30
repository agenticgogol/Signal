import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { logArticleEvent } from '@/lib/memory'

// POST: upsert a like/dislike reaction; DELETE: remove reaction
export async function POST(req: NextRequest) {
  const { userId, articleId, reaction } = await req.json() // reaction: 'like' | 'dislike'
  if (!userId || !articleId || !reaction) {
    return Response.json({ error: 'userId, articleId, reaction required' }, { status: 400 })
  }
  const db = createServiceClient()
  const { error } = await db
    .from('article_reactions')
    .upsert({ user_id: userId, article_id: articleId, reaction }, { onConflict: 'user_id,article_id' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await logArticleEvent({
    userId,
    articleId,
    eventType: reaction === 'like' ? 'like' : 'dislike',
  })
  return Response.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { userId, articleId } = await req.json()
  const db = createServiceClient()
  await db.from('article_reactions').delete().eq('user_id', userId).eq('article_id', articleId)
  return Response.json({ ok: true })
}

// GET: fetch all reactions for a user (for a given date's feed)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  const db = createServiceClient()
  const { data } = await db
    .from('article_reactions')
    .select('article_id, reaction')
    .eq('user_id', userId)
  return Response.json({ reactions: data ?? [] })
}
