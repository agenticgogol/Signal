import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { getErrorMessage } from '@/lib/errors'

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const userId = params.get('userId') || ''
  const jobId = params.get('jobId') || ''
  if (!userId || !jobId) return Response.json({ error: 'userId and jobId are required' }, { status: 400 })

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  try {
    const { data, error } = await createServiceClient()
      .from('content_generation_jobs')
      .select('status, result, error')
      .eq('user_id', access.userId)
      .eq('id', jobId)
      .maybeSingle()
    if (error) throw error
    if (!data) return Response.json({ status: 'not_found' })
    return Response.json(data)
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
