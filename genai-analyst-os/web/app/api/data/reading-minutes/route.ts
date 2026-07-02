import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'

const VALID_MINUTES = [10, 15, 20, 30]

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const { data, error } = await createServiceClient()
    .from('user_profiles')
    .select('daily_reading_minutes')
    .eq('id', userId)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ minutes: data?.daily_reading_minutes ?? 15 })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const minutes = VALID_MINUTES.includes(body.minutes) ? body.minutes : null
  if (!userId || !minutes) {
    return Response.json({ error: 'userId and a valid minutes value (10, 15, 20, or 30) are required' }, { status: 400 })
  }

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  const { error } = await createServiceClient()
    .from('user_profiles')
    .update({ daily_reading_minutes: minutes })
    .eq('id', access.userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, minutes })
}
