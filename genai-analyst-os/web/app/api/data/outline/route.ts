import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  const db = createServiceClient()
  const { data } = await db.from('content_outlines').select('*').eq('id', id).maybeSingle()
  return Response.json({ outline: data })
}
